from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.multa import Multa
from app.schemas.multa import MultaUpdate
from app.services import multa_service

router = APIRouter()


@router.get("/cliente/{cliente_id}")
def get_multas_cliente(cliente_id: int, db: Session = Depends(get_db)):
    multas = (
        db.query(Multa)
        .filter(Multa.cliente == cliente_id)
        .order_by(Multa.identificador.desc())
        .all()
    )
    return [multa_service.multa_to_dict(m) for m in multas]


@router.get("/cliente/{cliente_id}/estado")
def get_estado_sancion(cliente_id: int, db: Session = Depends(get_db)):
    return multa_service.estado_sancion(cliente_id, db)


@router.get("/{id}")
def get_multa(id: int, db: Session = Depends(get_db)):
    m = db.query(Multa).filter(Multa.identificador == id).first()
    if not m:
        raise HTTPException(404, "Multa no encontrada")
    return multa_service.multa_to_dict(m)


@router.patch("/{id}")
def update_multa(id: int, body: MultaUpdate, db: Session = Depends(get_db)):
    m = db.query(Multa).filter(Multa.identificador == id).first()
    if not m:
        raise HTTPException(404, "Multa no encontrada")
    m.pagada = body.pagada
    db.commit()
    db.refresh(m)
    return multa_service.multa_to_dict(m)
