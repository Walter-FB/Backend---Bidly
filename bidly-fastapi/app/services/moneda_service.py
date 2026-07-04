"""Conversión de moneda (demo).

Los presupuestos de los medios de pago se guardan SIEMPRE en pesos (imitan la
cuenta/tarjeta del usuario, a la que no tenemos acceso real). Cuando una subasta
es en dólares, convertimos el importe a pesos con una cotización de referencia
fija para poder compararlo contra ese presupuesto.
"""
from decimal import Decimal

# Cotización de referencia del dólar (demo). Si algún día se quiere real, sale de acá.
DOLAR = Decimal("1500")


def a_pesos(importe, moneda: str | None) -> Decimal:
    """Lleva `importe` a pesos. Si la moneda es 'dolares', multiplica por la
    cotización; si es pesos (o None), lo deja igual."""
    imp = Decimal(str(importe or 0))
    if (moneda or "pesos").lower() == "dolares":
        return imp * DOLAR
    return imp


def a_dolares(importe_pesos, moneda: str | None) -> Decimal:
    """Lleva un presupuesto en pesos a la moneda de la subasta (para mostrar cuánto
    dispone el usuario en una subasta en dólares)."""
    imp = Decimal(str(importe_pesos or 0))
    if (moneda or "pesos").lower() == "dolares":
        return imp / DOLAR
    return imp
