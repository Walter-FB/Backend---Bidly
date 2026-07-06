"""Reglas de multas por impago.

Enunciado:
- Si al pagar el usuario no posee el dinero, recibe una multa del 10% de lo
  ofertado que debe abonar ANTES de participar en otra subasta, y tiene 72hs
  para presentar los fondos de la oferta realizada.
- Si no cumple, el caso se deriva a la justicia y queda fuera del alcance de la
  app (no puede acceder a ningún servicio).

El estado de sanción (bloqueado / en justicia) se DERIVA de la tabla `multas`,
sin tablas de estado adicionales: bloqueado = tiene multa impaga; en justicia =
tiene multa impaga con fecha_limite vencida.

La garantía del cheque (que las compras no superen el monto del cheque) se valida
en `saldo_service`, contra el medio de pago elegido al pujar.
"""
from datetime import datetime, date, timedelta
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.pagos import Multa
from app.models.registro_subasta import RegistroDeSubasta
from app.models.puja import Puja
from app.models.asistente import Asistente
from app.models.item_catalogo import ItemCatalogo

HORAS_LIMITE_PAGO = 72
PORCENTAJE_MULTA = Decimal("0.10")


def _d(v) -> Decimal:
    return Decimal(str(v or 0))


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
