"""Categorías de postores/subastas y su orden.

Consigna: "la categoría de la subasta debe ser menor o igual que la propia" para
que un postor pueda acceder/pujar. Y "la actividad en las subastas permite mejorar
su categoría" (solo mejora, nunca baja). Trabaja sobre el VALOR de clientes.categoria
(DML), sin tocar el DDL.
"""
from sqlalchemy.orm import Session

from app.models.cliente import Cliente
from app.models.asistente import Asistente
from app.models.registro_subasta import RegistroDeSubasta

CATEGORIAS = ["comun", "especial", "plata", "oro", "platino"]


def rango(cat: str) -> int:
    try:
        return CATEGORIAS.index((cat or "comun").lower())
    except ValueError:
        return 0


def puede_acceder(categoria_usuario: str, categoria_subasta: str) -> bool:
    """True si la categoría de la subasta es <= la del usuario."""
    return rango(categoria_subasta) <= rango(categoria_usuario)


def sin_tope_maximo(categoria_usuario: str) -> bool:
    """Oro y platino no tienen tope máximo de puja (límite del 20%)."""
    return (categoria_usuario or "comun").lower() in ("oro", "platino")


def _categoria_objetivo(asistidas: int, ganadas: int) -> str:
    if ganadas >= 3:
        return "platino"
    if ganadas >= 2:
        return "oro"
    if ganadas >= 1:
        return "plata"
    if asistidas >= 1:
        return "especial"
    return "comun"


def recalcular(cliente_id: int, db: Session) -> str | None:
    """Mejora la categoría según la actividad (asistencias/ganadas). Solo sube."""
    cliente = db.query(Cliente).filter(Cliente.identificador == cliente_id).first()
    if not cliente:
        return None

    asistidas = db.query(Asistente).filter(Asistente.cliente == cliente_id).count()
    ganadas = db.query(RegistroDeSubasta).filter(RegistroDeSubasta.cliente == cliente_id).count()

    objetivo = _categoria_objetivo(asistidas, ganadas)
    if rango(objetivo) > rango(cliente.categoria):
        cliente.categoria = objetivo  # solo mejora
        db.flush()
        return objetivo
    return None
