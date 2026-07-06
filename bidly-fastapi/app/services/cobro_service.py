"""Cobro AUTOMÁTICO de la compra al adjudicarse el ítem (patrón lazy).

Cuando un ítem se adjudica —lo dispara solo `remate_service.tick()` cuando el
front pollea `GET /subastas/{id}/remate`, o el cierre a mano del subastador— en la
MISMA transacción se intenta cobrar la compra al ganador sin que tenga que
confirmar nada:

  - Se busca la tarjeta de CRÉDITO/DÉBITO del comprador (la que "se acepta
    siempre": nace verificada y su presupuesto recién se chequea al pagar). Si no
    tiene, se cae a las garantías (cuenta/cheque).
  - Si el presupuesto del medio alcanza para `importe + comisión` → se cobra solo
    (registro_pago='pagado', se descuenta el saldo) y se notifica.
  - Si NO alcanza (pujó/ganó por más plata de la que tiene la tarjeta) → se genera
    la multa del 10% automáticamente (registro_pago='impago') y queda bloqueado.
    La multa aparece sola en "Mis compras".

Robustez: todo corre dentro de un SAVEPOINT propio y `cobrar_automatico` nunca
propaga excepciones. Si algo falla, la compra queda 'pendiente' (fallback al pago
manual) SIN abortar la adjudicación del ítem (evita dejar la subasta clavada
"en vivo", como el overflow que ya nos pasó antes).
"""
from datetime import datetime
from decimal import Decimal
from sqlalchemy.orm import Session

from app.models.pagos import MedioPago, RegistroPago, Multa
from app.models.registro_subasta import RegistroDeSubasta
from app.models.subasta_moneda import SubastaMoneda
from app.services import moneda_service, saldo_service, multa_service, notificacion_service


def _d(v) -> Decimal:
    return Decimal(str(v or 0))


# Prioridad del medio a cobrar: primero las tarjetas "que se aceptan siempre"
# (crédito/débito, cuyo presupuesto recién se valida acá, al pagar), después las
# garantías (cuenta/cheque, que ya se validaron al pujar).
_PRIORIDAD_TIPO = {"credito": 0, "debito": 1, "cuenta": 2, "cheque": 3}

_TIPO_LABEL = {
    "credito": "tarjeta de crédito", "debito": "tarjeta de débito",
    "cuenta": "cuenta bancaria", "cheque": "cheque certificado",
}


def _moneda_subasta(subasta_id, db: Session) -> str:
    sm = db.query(SubastaMoneda).filter(SubastaMoneda.subasta == subasta_id).first()
    return (sm.moneda if sm and sm.moneda else "pesos")


def _elegir_medio(cliente_id: int, total_pesos: Decimal, moneda: str, db: Session):
    """Medio verificado del comprador que alcanza a cubrir `total_pesos`.

    Ordena crédito/débito primero (y, dentro de cada tipo, el de mayor saldo) y
    devuelve el primero que cubra el total. Si ninguno cubre, devuelve None."""
    medios = (
        db.query(MedioPago)
        .filter(MedioPago.cliente == cliente_id, MedioPago.verificado == "si")
        .all()
    )
    # El cheque certificado es en pesos: no sirve para subastas en dólares.
    if (moneda or "pesos").lower() == "dolares":
        medios = [m for m in medios if m.tipo != "cheque"]
    medios = [m for m in medios if m.saldo is not None]
    medios.sort(key=lambda m: (_PRIORIDAD_TIPO.get(m.tipo, 9), -float(_d(m.saldo))))
    return next((m for m in medios if _d(m.saldo) >= total_pesos), None)


def cobrar_automatico(registros, db: Session) -> None:
    """Intenta cobrar automáticamente la(s) compra(s) recién adjudicada(s).

    `registros` es una lista: 1 elemento en venta individual, N en venta en bloque
    (todas las piezas del catálogo se cobran como una sola operación). Nunca
    propaga excepciones: ante cualquier error la compra queda 'pendiente'."""
    try:
        with db.begin_nested():
            _intentar(list(registros), db)
    except Exception:
        # No romper la adjudicación: la compra queda 'pendiente' (pago manual).
        pass


def _intentar(registros: list, db: Session) -> None:
    # Toma solo las compras que todavía no están pagadas.
    pendientes = []
    for r in registros:
        pago = db.query(RegistroPago).filter(RegistroPago.registro == r.identificador).first()
        if pago and pago.estado == "pagado":
            continue
        pendientes.append((r, pago))
    if not pendientes:
        return

    lider = registros[0]
    cliente = lider.cliente
    moneda = _moneda_subasta(lider.subasta, db)

    total = sum((_d(r.importe) + _d(r.comision) for r, _ in pendientes), Decimal("0"))
    total_pesos = moneda_service.a_pesos(total, moneda)

    elegido = _elegir_medio(cliente, total_pesos, moneda, db) if cliente else None
    ahora = datetime.utcnow()

    if elegido:
        # Alcanza: se cobra solo (una sola vez, aunque sean varias piezas).
        for r, pago in pendientes:
            if not pago:
                pago = RegistroPago(registro=r.identificador)
                db.add(pago)
            pago.estado          = "pagado"
            pago.medio_pago      = elegido.identificador
            pago.importe_total   = _d(r.importe) + _d(r.comision)
            pago.fecha_pago      = ahora
            pago.envio           = Decimal("0")   # envío/retiro se coordina aparte
            pago.retiro_personal = "no"
        saldo_service.descontar(elegido.identificador, total_pesos, db)
        db.flush()
        if cliente:
            notificacion_service.crear(
                cliente, "pago",
                f"Se cobró automáticamente ${total} de tu {_TIPO_LABEL.get(elegido.tipo, 'medio de pago')}. "
                "¡Tu compra quedó paga!",
                db,
            )
        return

    # No alcanza (o no hay medio): impago automático + multa del 10%.
    for r, pago in pendientes:
        if not pago:
            pago = RegistroPago(registro=r.identificador)
            db.add(pago)
        pago.estado        = "impago"
        pago.importe_total = _d(r.importe) + _d(r.comision)
    db.flush()

    # Una sola multa por la operación (10% de lo ofertado, sin comisión).
    importe_base = sum((_d(r.importe) for r, _ in pendientes), Decimal("0"))
    puja = multa_service._puja_ganadora_registro(lider, db)
    ya = db.query(Multa).filter(Multa.pujo == puja.identificador).first() if puja else None
    if ya:
        return
    multa = multa_service.generar_multa_impago(lider, db, importe_base=importe_base)
    if cliente:
        notificacion_service.crear(
            cliente, "multa",
            f"No se pudo cobrar ${total}: tu tarjeta no tiene fondos suficientes. "
            f"Se generó una multa de ${multa.importe} (10% de lo ofertado). Tenés 72hs "
            "para presentar los fondos antes de derivar el caso a la justicia.",
            db,
        )
