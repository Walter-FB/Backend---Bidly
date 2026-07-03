"""Saldo/límite disponible de los medios de pago del cliente.

Cada medio de pago tiene un monto disponible (cheque certificado → montocheque;
tarjeta/cuenta → saldo). Las compras del cliente no pueden superar la suma de esos
montos. Al alcanzar el límite ya no puede seguir pujando.
"""
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.pagos import MedioPago, Reembolso, RegistroPago
from app.models.registro_subasta import RegistroDeSubasta


def _d(v) -> Decimal:
    return Decimal(str(v or 0))


def _monto_medio(mp: MedioPago) -> Decimal:
    if mp.tipo == "cheque":
        return _d(mp.montocheque)
    return _d(mp.saldo)


def saldo_total(cliente_id: int, db: Session) -> Decimal:
    """Suma de lo que hay en TODOS los medios del cliente (coincide con el cartel
    del front). El requisito de 'medio verificado' para pujar se controla aparte."""
    medios = db.query(MedioPago).filter(MedioPago.cliente == cliente_id).all()
    return sum((_monto_medio(m) for m in medios), Decimal("0"))


def comprometido(cliente_id: int, db: Session) -> Decimal:
    """Compras que el cliente todavía DEBE (adjudicadas y no pagadas). Lo ya pagado
    o reembolsado no reduce el disponible: no es plata comprometida pendiente."""
    registros = db.query(RegistroDeSubasta).filter(RegistroDeSubasta.cliente == cliente_id).all()
    total = Decimal("0")
    for r in registros:
        ree = db.query(Reembolso).filter(Reembolso.registro == r.identificador).first()
        if ree and ree.reembolsada == "si":
            continue
        pago = db.query(RegistroPago).filter(RegistroPago.registro == r.identificador).first()
        if pago and pago.estado == "pagado":
            continue  # ya pagada → saldada, no cuenta como comprometido
        total += _d(r.importe)
    return total


def disponible(cliente_id: int, db: Session) -> Decimal:
    """Todo lo que tenés en tus medios está disponible para pujar."""
    return saldo_total(cliente_id, db)


def validar_puja(cliente_id: int, importe, db: Session) -> None:
    disp = disponible(cliente_id, db)
    if _d(importe) > disp:
        raise HTTPException(
            422,
            detail={
                "message": (
                    f"No te alcanza el saldo. Disponible: ${disp}. La puja no puede superar "
                    "la suma de tus medios de pago."
                ),
                "code": "SALDO_INSUFICIENTE",
                "saldoDisponible": float(disp),
            },
        )


def resumen(cliente_id: int, db: Session) -> dict:
    total = saldo_total(cliente_id, db)
    return {"saldoTotal": float(total), "comprometido": 0.0, "disponible": float(total)}
