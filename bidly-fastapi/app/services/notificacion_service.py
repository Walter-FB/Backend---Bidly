"""Notificaciones internas al cliente (tabla `notificaciones`).

Se guardan en base y el front las lee por polling. Se quitó el push por Expo
(dependía de `cliente_push_tokens`, tabla que quedó borrada).
"""
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.notificacion import Notificacion
from app.models.asistente import Asistente


def crear(cliente_id: int, tipo: str, mensaje: str, db: Session) -> Notificacion:
    n = Notificacion(
        cliente=cliente_id,
        tipo=tipo,
        mensaje=mensaje,
        leida="no",
        fechahora=datetime.utcnow(),
    )
    db.add(n)
    db.flush()
    return n


def notificar_asistentes_subasta(subasta_id: int, tipo: str, mensaje: str, db: Session) -> None:
    asistentes = db.query(Asistente).filter(Asistente.subasta == subasta_id).all()
    for a in asistentes:
        crear(a.cliente, tipo, mensaje, db)
