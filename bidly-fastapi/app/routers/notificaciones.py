from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.notificacion import Notificacion
from app.schemas.notificacion import NotificacionResponse

router = APIRouter()


@router.get("/{id}", response_model=NotificacionResponse)
def get_notificacion(id: int, db: Session = Depends(get_db)):
    n = db.query(Notificacion).filter(Notificacion.identificador == id).first()
    if not n:
        raise HTTPException(404, "Notificación no encontrada")
    return n


@router.get("/cliente/{cliente_id}", response_model=List[NotificacionResponse])
def get_notificaciones_cliente(cliente_id: int, db: Session = Depends(get_db)):
    return (
        db.query(Notificacion)
        .filter(Notificacion.cliente == cliente_id)
        .order_by(Notificacion.fechahora.desc())
        .all()
    )
