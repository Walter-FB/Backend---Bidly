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
from app.models.pagos import MedioPago

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


def _por_ganadas(ganadas: int) -> str:
    """Escala por subastas ganadas: sube un escalón cada 2 ganadas.
    1 → plata, 2-3 → oro, 4+ → platino."""
    if ganadas >= 4:
        return "platino"
    if ganadas >= 2:
        return "oro"
    if ganadas >= 1:
        return "plata"
    return "comun"


def _por_medios(medios: int, ganadas: int) -> str:
    """Escala por diversidad de medios de pago (consigna: la diversidad de medios
    mejora la categoría). 3+ medios → oro; 3+ medios y al menos 1 puja ganada →
    platino."""
    if medios >= 3 and ganadas >= 1:
        return "platino"
    if medios >= 3:
        return "oro"
    return "comun"


def _categoria_objetivo(asistidas: int, ganadas: int, medios: int) -> str:
    """Se toma el MAYOR de todos los criterios (asistencia, ganadas, medios)."""
    candidatos = ["comun", _por_ganadas(ganadas), _por_medios(medios, ganadas)]
    if asistidas >= 1:
        candidatos.append("especial")
    return max(candidatos, key=rango)


def recalcular(cliente_id: int, db: Session) -> str | None:
    """Mejora la categoría combinando actividad (asistencias/ganadas) y diversidad
    de medios de pago. Solo sube, nunca baja. Devuelve la nueva categoría si cambió."""
    cliente = db.query(Cliente).filter(Cliente.identificador == cliente_id).first()
    if not cliente:
        return None

    asistidas = db.query(Asistente).filter(Asistente.cliente == cliente_id).count()
    ganadas = db.query(RegistroDeSubasta).filter(RegistroDeSubasta.cliente == cliente_id).count()
    medios = db.query(MedioPago).filter(MedioPago.cliente == cliente_id).count()

    objetivo = _categoria_objetivo(asistidas, ganadas, medios)
    if rango(objetivo) > rango(cliente.categoria):
        cliente.categoria = objetivo  # solo mejora
        db.flush()
        return objetivo
    return None
