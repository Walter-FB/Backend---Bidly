"""Mejora automática de categoría del cliente.

Enunciado: "La diversidad de los medios de pago del usuario y su actividad en las
subastas permiten mejorar su categoría." Solo mejora, nunca baja.

Actualiza el VALOR de clientes.categoria (DML), sin tocar el DDL de la tabla.
"""
from sqlalchemy.orm import Session

from app.models.cliente import Cliente
from app.models.medio_pago import MedioPago
from app.models.asistente import Asistente
from app.models.registro_subasta import RegistroDeSubasta

CATEGORIAS = ["comun", "especial", "plata", "oro", "platino"]


def _rango(cat: str) -> int:
    try:
        return CATEGORIAS.index((cat or "comun").lower())
    except ValueError:
        return 0


def _categoria_objetivo(tipos: int, asistidas: int, ganadas: int) -> str:
    if tipos >= 3 and ganadas >= 3:
        return "platino"
    if tipos >= 2 and ganadas >= 2:
        return "oro"
    if tipos >= 2 or ganadas >= 1:
        return "plata"
    if tipos >= 1 or asistidas >= 1:
        return "especial"
    return "comun"


def recalcular(cliente_id: int, db: Session) -> str | None:
    cliente = db.query(Cliente).filter(Cliente.identificador == cliente_id).first()
    if not cliente:
        return None

    tipos = (
        db.query(MedioPago.tipo)
        .filter(MedioPago.cliente == cliente_id, MedioPago.verificado == "si")
        .distinct()
        .count()
    )
    asistidas = db.query(Asistente).filter(Asistente.cliente == cliente_id).count()
    ganadas = db.query(RegistroDeSubasta).filter(RegistroDeSubasta.cliente == cliente_id).count()

    objetivo = _categoria_objetivo(tipos, asistidas, ganadas)
    if _rango(objetivo) > _rango(cliente.categoria):
        cliente.categoria = objetivo  # solo mejora
        db.flush()
        return objetivo
    return None
