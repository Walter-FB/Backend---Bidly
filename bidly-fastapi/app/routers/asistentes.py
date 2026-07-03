"""Asistentes: inscripción de un postor a una subasta.

Consigna: para acceder, el postor debe estar registrado, la categoría de la subasta
debe ser <= la propia y no puede estar conectado a más de una subasta a la vez
(otra subasta abierta en la que ya sea asistente). Ver acceso_service.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.asistente import Asistente
from app.models.puja import Puja
from app.models.subasta import Subasta
from app.schemas.asistente import InscribirRequest, AsistenteResponse
from app.serializers import puja_to_dict
from app.services import acceso_service

router = APIRouter()


@router.get("/{id}", response_model=AsistenteResponse)
def get_asistente(id: int, db: Session = Depends(get_db)):
    a = db.query(Asistente).filter(Asistente.identificador == id).first()
    if not a:
        raise HTTPException(404, "Asistente no encontrado")
    return a


@router.get("/{id}/pujos")
def get_pujas_asistente(id: int, db: Session = Depends(get_db)):
    pujas = db.query(Puja).filter(Puja.asistente == id).order_by(Puja.importe.desc()).all()
    return [puja_to_dict(p, db) for p in pujas]


@router.post("/inscribir", response_model=AsistenteResponse)
def inscribir(body: InscribirRequest, db: Session = Depends(get_db)):
    subasta = db.query(Subasta).filter(Subasta.identificador == body.subastaId).first()
    if not subasta:
        raise HTTPException(404, detail={"message": "Subasta no encontrada", "code": "NOT_FOUND"})

    # Categoría de la subasta <= la del postor + no conectado a otra subasta abierta.
    acceso_service.validar_inscripcion(body.clienteId, body.subastaId, db)

    existing = (
        db.query(Asistente)
        .filter(Asistente.cliente == body.clienteId, Asistente.subasta == body.subastaId)
        .first()
    )
    if existing:
        return existing

    count = db.query(Asistente).filter(Asistente.subasta == body.subastaId).count()
    a = Asistente(numeropostor=count + 1, cliente=body.clienteId, subasta=body.subastaId)
    db.add(a)
    db.commit()
    db.refresh(a)
    return a
