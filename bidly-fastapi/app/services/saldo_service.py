"""Presupuesto de los medios de pago del cliente.

Cada medio tiene un presupuesto en PESOS que imita la cuenta/tarjeta del usuario
(no tenemos acceso real a esa plata). El presupuesto se guarda en `saldo` (lo que
queda) y se gasta al pagar una compra.

Cuándo se valida el tope (aclaración del enunciado / negocio):
  - CHEQUE y CUENTA = garantía → se valida EN LA PUJA: no podés pujar por más que
    el monto declarado. Además el cheque no vale para subastas en dólares.
  - CRÉDITO y DÉBITO = presupuesto → NO se validan al pujar; se chequean recién en
    el momento del pago (ver routers/registro.py).

Las subastas en dólares se convierten a pesos (moneda_service.DOLAR) para poder
compararlas contra el presupuesto, que siempre está en pesos.
"""
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.pagos import MedioPago
from app.models.item_catalogo import ItemCatalogo
from app.models.catalogo import Catalogo
from app.models.subasta_moneda import SubastaMoneda
from app.services import moneda_service


def _d(v) -> Decimal:
    return Decimal(str(v or 0))


VALIDA_EN_PUJA = ("cheque", "cuenta")


def _moneda_de_item(item_id, db: Session) -> str:
    """Moneda de la subasta a la que pertenece un ítem ('pesos' | 'dolares')."""
    if not item_id:
        return "pesos"
    row = (
        db.query(SubastaMoneda.moneda)
        .join(Catalogo, Catalogo.subasta == SubastaMoneda.subasta)
        .join(ItemCatalogo, ItemCatalogo.catalogo == Catalogo.identificador)
        .filter(ItemCatalogo.identificador == item_id)
        .first()
    )
    return (row[0] if row else "pesos") or "pesos"


def saldo_total(cliente_id: int, db: Session) -> Decimal:
    """Suma del presupuesto restante de las GARANTÍAS del cliente (cheque/cuenta).

    Las tarjetas (crédito/débito) quedan afuera a propósito: su presupuesto es
    interno (imita el límite del banco, que el postor no conoce) y recién se
    chequea al pagar. No debe figurar en el saldo visible.
    """
    medios = (
        db.query(MedioPago)
        .filter(MedioPago.cliente == cliente_id, MedioPago.tipo.in_(VALIDA_EN_PUJA))
        .all()
    )
    return sum((_d(m.saldo) for m in medios), Decimal("0"))


def validar_puja(cliente_id: int, importe, db: Session, item_id: int = None, medio_id: int = None) -> None:
    """Valida el tope de puja según el medio elegido.

    Solo aplica a CHEQUE y CUENTA (garantía): la puja no puede superar el monto
    declarado del medio. Crédito/débito no se validan acá (se chequean al pagar).
    """
    if not medio_id:
        return  # sin medio elegido: el gate de "medio verificado" ya corre aparte

    medio = (
        db.query(MedioPago)
        .filter(MedioPago.identificador == medio_id, MedioPago.cliente == cliente_id)
        .first()
    )
    if not medio:
        return

    # El medio elegido debe estar validado por la empresa (el cheque arranca sin
    # validar y no se puede usar hasta que lo aprueben desde el panel).
    if medio.verificado != "si":
        raise HTTPException(422, detail={
            "message": "Ese medio de pago todavía no está validado por la empresa. No podés pujar con él.",
            "code": "MEDIO_NO_VERIFICADO",
        })

    if medio.tipo not in VALIDA_EN_PUJA:
        return  # crédito/débito → se verifica al momento del pago

    moneda = _moneda_de_item(item_id, db)

    # El cheque certificado es en pesos: no vale para subastas en dólares.
    if medio.tipo == "cheque" and moneda == "dolares":
        raise HTTPException(422, detail={
            "message": "El cheque certificado es en pesos: no vale para subastas en dólares. Usá una cuenta o tarjeta internacional.",
            "code": "CHEQUE_EN_DOLARES",
        })

    importe_pesos = moneda_service.a_pesos(importe, moneda)
    disponible = _d(medio.saldo)
    if importe_pesos > disponible:
        raise HTTPException(422, detail={
            "message": f"No podés pujar por más que el monto de tu {medio.tipo} (${disponible}).",
            "code": "SALDO_INSUFICIENTE",
            "saldoDisponible": float(disponible),
        })


def descontar(medio_id: int, importe_pesos, db: Session) -> None:
    """Gasta `importe_pesos` del presupuesto del medio (al pagar una compra)."""
    medio = db.query(MedioPago).filter(MedioPago.identificador == medio_id).first()
    if not medio or medio.saldo is None:
        return
    restante = _d(medio.saldo) - _d(importe_pesos)
    medio.saldo = restante if restante > 0 else Decimal("0")
    db.flush()


def resumen(cliente_id: int, db: Session) -> dict:
    """Presupuesto visible del cliente (solo garantías: cheques y cuentas)."""
    total = saldo_total(cliente_id, db)
    return {"saldoTotal": float(total), "comprometido": 0.0, "disponible": float(total)}
