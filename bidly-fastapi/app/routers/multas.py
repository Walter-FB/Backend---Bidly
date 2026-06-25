from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.multa import Multa
from app.schemas.multa import MultaUpdate, MultaResponse

router = APIRouter()


@router.get("/{id}", response_model=MultaResponse)
def get_multa(id: int, db: Session = Depends(get_db)):
    m = db.query(Multa).filter(Multa.identificador == id).first()
    if not m:
        raise HTTPException(404, "Multa no encontrada")
    return m


@router.patch("/{id}", response_model=MultaResponse)
def update_multa(id: int, body: MultaUpdate, db: Session = Depends(get_db)):
    m = db.query(Multa).filter(Multa.identificador == id).first()
    if not m:
        raise HTTPException(404, "Multa no encontrada")
    m.pagada = body.pagada
    db.commit()
    db.refresh(m)
    return m
