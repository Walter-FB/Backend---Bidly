"""Saldo/límite disponible de los medios de pago del cliente.

Cada medio tiene un monto (cheque certificado → montocheque; tarjeta/cuenta →
saldo). El "disponible para pujar" = suma de los medios MENOS lo que el cliente
ya tiene comprometido en pujas líder de subastas abiertas (lo que pagaría si
gana). Así, al pujar el disponible baja y, cuando se agota (p. ej. el monto del
cheque), no puede seguir pujando — que es lo que pide el enunciado.

Sólo se cuentan las pujas líder de subastas ABIERTAS (no compras de subastas ya
cerradas), para reflejar en tiempo real cuánto le queda sin arrastrar historial.
"""
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.pagos import MedioPago
from app.models.asistente import Asistente
from app.models.subasta import Subasta
from app.models.catalogo import Catalogo
from app.models.item_catalogo import ItemCatalogo
from app.models.puja import Puja


def _d(v) -> Decimal:
    return Decimal(str(v or 0))


def _monto_medio(mp: MedioPago) -> Decimal:
    if mp.tipo == "cheque":
        return _d(mp.montocheque)
    return _d(mp.saldo)


def saldo_total(cliente_id: int, db: Session) -> Decimal:
    """Suma de lo que hay en TODOS los medios del cliente (coincide con lo que se
    ve abajo de cada medio en el front)."""
    medios = db.query(MedioPago).filter(MedioPago.cliente == cliente_id).all()
    return sum((_monto_medio(m) for m in medios), Decimal("0"))


def comprometido(cliente_id: int, db: Session, excluir_item: int = None) -> Decimal:
    """Suma de las pujas LÍDER del cliente en subastas abiertas (lo que se
    compromete a pagar si gana). `excluir_item` se saltea (una nueva puja sobre
    ese ítem reemplaza a la anterior del mismo cliente)."""
    total = Decimal("0")
    asistentes = db.query(Asistente).filter(Asistente.cliente == cliente_id).all()
    for a in asistentes:
        sub = db.query(Subasta).filter(Subasta.identificador == a.subasta).first()
        if not sub or sub.estado != "abierta":
            continue
        items = (
            db.query(ItemCatalogo)
            .join(Catalogo, ItemCatalogo.catalogo == Catalogo.identificador)
            .filter(Catalogo.subasta == a.subasta, ItemCatalogo.subastado == "no")
            .all()
        )
        for it in items:
            if excluir_item is not None and it.identificador == excluir_item:
                continue
            top = (
                db.query(Puja)
                .filter(Puja.item == it.identificador)
                .order_by(Puja.importe.desc())
                .first()
            )
            if top and top.asistente == a.identificador:
                total += _d(top.importe)
    return total


def disponible(cliente_id: int, db: Session) -> Decimal:
    disp = saldo_total(cliente_id, db) - comprometido(cliente_id, db)
    return disp if disp > 0 else Decimal("0")


def _monto_de_medio(cliente_id: int, medio_id: int, db: Session):
    """Monto del medio elegido (cheque → montocheque; tarjeta/cuenta → saldo).
    None si el medio no existe o no es del cliente."""
    mp = (
        db.query(MedioPago)
        .filter(MedioPago.identificador == medio_id, MedioPago.cliente == cliente_id)
        .first()
    )
    return _monto_medio(mp) if mp else None


def validar_puja(cliente_id: int, importe, db: Session, item_id: int = None, medio_id: int = None) -> None:
    # La garantía la fija el MEDIO elegido: con un cheque de $10.000 no podés pujar
    # más de $10.000, aunque tengas otras tarjetas. Si no eligió medio, se usa la
    # suma de todos. Se descuenta lo ya comprometido en otras pujas líder.
    base = _monto_de_medio(cliente_id, medio_id, db) if medio_id else None
    if base is None:
        base = saldo_total(cliente_id, db)
    disp = base - comprometido(cliente_id, db, excluir_item=item_id)
    if disp < 0:
        disp = Decimal("0")
    if _d(importe) > disp:
        raise HTTPException(
            422,
            detail={
                "message": (
                    f"No te alcanza el saldo del medio elegido. Podés pujar hasta ${disp} con ese "
                    "medio (por ejemplo, un cheque limita a su monto certificado)."
                ),
                "code": "SALDO_INSUFICIENTE",
                "saldoDisponible": float(disp),
            },
        )


def resumen(cliente_id: int, db: Session) -> dict:
    total = saldo_total(cliente_id, db)
    comp = comprometido(cliente_id, db)
    disp = total - comp
    if disp < 0:
        disp = Decimal("0")
    return {"saldoTotal": float(total), "comprometido": float(comp), "disponible": float(disp)}
