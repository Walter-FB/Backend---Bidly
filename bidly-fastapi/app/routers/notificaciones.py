from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.notificacion import Notificacion
from app.models.cliente_push_token import ClientePushToken
from app.schemas.notificacion import NotificacionResponse

router = APIRouter()


class PushTokenCreate(BaseModel):
    cliente: int
    token: str


@router.post("/push-token")
def registrar_push_token(body: PushTokenCreate, db: Session = Depends(get_db)):
    existing = db.query(ClientePushToken).filter(ClientePushToken.cliente == body.cliente).first()
    if existing:
        existing.token = body.token
    else:
        db.add(ClientePushToken(cliente=body.cliente, token=body.token))
    db.commit()
    return {"ok": True}


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


@router.patch("/{id}/leer")
def marcar_leida(id: int, db: Session = Depends(get_db)):
    n = db.query(Notificacion).filter(Notificacion.identificador == id).first()
    if not n:
        raise HTTPException(404, "Notificación no encontrada")
    n.leida = "si"
    db.commit()
    return {"ok": True}
