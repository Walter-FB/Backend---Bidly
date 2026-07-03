"""Reglas de multas por impago y garantía (cheque certificado).

Enunciado:
- Si al pagar el usuario no posee el dinero, recibe una multa del 10% de lo
  ofertado que debe abonar ANTES de participar en otra subasta, y tiene 72hs
  para presentar los fondos de la oferta realizada.
- Si no cumple, el caso se deriva a la justicia y queda fuera del alcance de la
  app (no puede acceder a ningún servicio).
- Si dejó como garantía un monto (cheque certificado), sus compras no pueden
  superar dicho monto, pero mientras le alcance puede pujar cuanto quiera.

El estado de sanción (bloqueado / en justicia) se DERIVA de la tabla `multas`,
sin tablas de estado adicionales: bloqueado = tiene multa impaga; en justicia =
tiene multa impaga con fecha_limite vencida.
"""
from datetime import datetime, date, timedelta
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.pagos import Multa, MedioPago, Reembolso
from app.models.registro_subasta import RegistroDeSubasta
from app.models.puja import Puja
from app.models.asistente import Asistente
from app.models.item_catalogo import ItemCatalogo

HORAS_LIMITE_PAGO = 72
PORCENTAJE_MULTA = Decimal("0.10")


def _d(v) -> Decimal:
    return Decimal(str(v or 0))


# ── Garantía (cheque certificado) ─────────────────────────────────────────────
def _cheques(cliente_id: int, db: Session):
    return (
        db.query(MedioPago)
        .filter(MedioPago.cliente == cliente_id, MedioPago.tipo == "cheque")
        .all()
    )


def _tiene_medio_ilimitado(cliente_id: int, db: Session) -> bool:
    """Tarjeta o cuenta bancaria NO imponen tope: la garantía de monto fijo sólo
    aplica cuando el respaldo es un cheque certificado."""
    return (
        db.query(MedioPago)
        .filter(MedioPago.cliente == cliente_id, MedioPago.tipo.in_(["tarjeta", "cuenta"]))
        .first()
        is not None
    )


def _garantia_total(cliente_id: int, db: Session) -> Decimal:
    return sum((_d(c.montocheque) for c in _cheques(cliente_id, db)), Decimal("0"))


def _compras_comprometidas(cliente_id: int, db: Session) -> Decimal:
    """Suma de importes ofertados (adjudicados) del cliente que no fueron reembolsados."""
    registros = db.query(RegistroDeSubasta).filter(RegistroDeSubasta.cliente == cliente_id).all()
    total = Decimal("0")
    for r in registros:
        ree = db.query(Reembolso).filter(Reembolso.registro == r.identificador).first()
        if ree and ree.reembolsada == "si":
            continue
        total += _d(r.importe)
    return total


def garantia_disponible(cliente_id: int, db: Session):
    """Devuelve el monto de garantía todavía disponible, o None si no hay tope
    (el cliente tiene un medio ilimitado o no dejó garantía en cheque)."""
    if _tiene_medio_ilimitado(cliente_id, db):
        return None
    total = _garantia_total(cliente_id, db)
    if total <= 0:
        return None
    return total - _compras_comprometidas(cliente_id, db)


def validar_puja_contra_garantia(cliente_id: int, importe_puja, db: Session) -> None:
    disp = garantia_disponible(cliente_id, db)
    if disp is None:
        return
    if _d(importe_puja) > disp:
        raise HTTPException(
            422,
            detail={
                "message": (
                    f"La puja supera tu garantía disponible (${disp}). Tus compras no "
                    "pueden superar el monto del cheque certificado entregado."
                ),
                "code": "GUARANTEE_EXCEEDED",
                "garantiaDisponible": float(max(disp, Decimal('0'))),
            },
        )


# ── Multas por impago ─────────────────────────────────────────────────────────
def _puja_ganadora_registro(registro: RegistroDeSubasta, db: Session):
    """Ubica la puja ganadora que originó el registro (por producto + cliente)."""
    return (
        db.query(Puja)
        .join(ItemCatalogo, Puja.item == ItemCatalogo.identificador)
        .join(Asistente, Puja.asistente == Asistente.identificador)
        .filter(
            ItemCatalogo.producto == registro.producto,
            Asistente.cliente == registro.cliente,
            Puja.ganador == "si",
        )
        .order_by(Puja.importe.desc())
        .first()
    )


def generar_multa_impago(registro: RegistroDeSubasta, db: Session) -> Multa:
    """Genera la multa del 10% del importe ofertado, con 72hs de límite."""
    puja = _puja_ganadora_registro(registro, db)
    monto = (_d(registro.importe) * PORCENTAJE_MULTA).quantize(Decimal("0.01"))
    multa = Multa(
        cliente=registro.cliente,
        pujo=puja.identificador if puja else None,
        importe=monto,
        pagada="no",
        fechagenerada=date.today(),
        fecha_limite=datetime.utcnow() + timedelta(hours=HORAS_LIMITE_PAGO),
    )
    db.add(multa)
    db.flush()
    return multa


# ── Sanciones (bloqueo / justicia) ────────────────────────────────────────────
def multas_pendientes(cliente_id: int, db: Session):
    return db.query(Multa).filter(Multa.cliente == cliente_id, Multa.pagada == "no").all()


def cliente_en_justicia(cliente_id: int, db: Session) -> bool:
    now = datetime.utcnow()
    return any(m.fecha_limite and now > m.fecha_limite for m in multas_pendientes(cliente_id, db))


def cliente_bloqueado(cliente_id: int, db: Session) -> bool:
    return len(multas_pendientes(cliente_id, db)) > 0


def verificar_puede_participar(cliente_id: int, db: Session) -> None:
    """Lanza 403 si el cliente está derivado a la justicia o tiene multa impaga."""
    if cliente_en_justicia(cliente_id, db):
        raise HTTPException(
            403,
            detail={
                "message": (
                    "Tu cuenta fue suspendida por impago derivado a la justicia. "
                    "No podés acceder a los servicios de la aplicación."
                ),
                "code": "EN_JUSTICIA",
            },
        )
    pend = multas_pendientes(cliente_id, db)
    if pend:
        total = sum((_d(m.importe) for m in pend), Decimal("0"))
        raise HTTPException(
            403,
            detail={
                "message": (
                    f"Tenés una multa pendiente de ${total}. Debés abonarla antes de "
                    "participar en otra subasta."
                ),
                "code": "MULTA_PENDIENTE",
                "montoAdeudado": float(total),
            },
        )


def multa_to_dict(m: Multa) -> dict:
    vencida = bool(m.fecha_limite and datetime.utcnow() > m.fecha_limite and m.pagada != "si")
    return {
        "identificador": m.identificador,
        "cliente": m.cliente,
        "pujo": m.pujo,
        "importe": float(m.importe) if m.importe is not None else None,
        "pagada": m.pagada,
        "fechaGenerada": m.fechagenerada.isoformat() if m.fechagenerada else None,
        "fechaLimite": m.fecha_limite.isoformat() if m.fecha_limite else None,
        "vencida": vencida,
    }


def estado_sancion(cliente_id: int, db: Session) -> dict:
    pend = multas_pendientes(cliente_id, db)
    total = sum((_d(m.importe) for m in pend), Decimal("0"))
    return {
        "bloqueado": len(pend) > 0,
        "enJusticia": cliente_en_justicia(cliente_id, db),
        "montoAdeudado": float(total),
        "multas": [multa_to_dict(m) for m in pend],
    }
