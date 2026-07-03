from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.asistente import Asistente
from app.models.puja import Puja
from app.models.pujo_fecha import PujoFecha
from app.schemas.asistente import InscribirRequest, AsistenteResponse
from app.schemas.puja import PujaResponse
from app.serializers import puja_to_dict
from app.services import multa_service, acceso_service

router = APIRouter()


def _build_puja_response(p: Puja, db: Session) -> dict:
    return puja_to_dict(p, db)


@router.get("/{id}", response_model=AsistenteResponse)
def get_asistente(id: int, db: Session = Depends(get_db)):
    a = db.query(Asistente).filter(Asistente.identificador == id).first()
    if not a:
        raise HTTPException(404, "Asistente no encontrado")
    return a


@router.get("/{id}/pujos")
def get_pujas_asistente(id: int, db: Session = Depends(get_db)):
    pujas = (
        db.query(Puja)
        .filter(Puja.asistente == id)
        .order_by(Puja.importe.desc())
        .all()
    )
    return [_build_puja_response(p, db) for p in pujas]


@router.post("/inscribir", response_model=AsistenteResponse)
def inscribir(body: InscribirRequest, db: Session = Depends(get_db)):
    # No puede participar en otra subasta si tiene una multa impaga (o quedó
    # derivado a la justicia por impago vencido).
    multa_service.verificar_puede_participar(body.clienteId, db)
    # Categoría subasta ≤ usuario y no estar conectado a otra subasta en vivo.
    acceso_service.validar_inscripcion(body.clienteId, body.subastaId, db)

    existing = (
        db.query(Asistente)
        .filter(Asistente.cliente == body.clienteId, Asistente.subasta == body.subastaId)
        .first()
    )
    if existing:
        return existing

    count = db.query(Asistente).filter(Asistente.subasta == body.subastaId).count()
    a = Asistente(
        numeropostor=count + 1,
        cliente=body.clienteId,
        subasta=body.subastaId,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return a
