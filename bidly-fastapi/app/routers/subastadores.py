from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.subastador import Subastador
from app.models.persona import Persona
from app.models.subasta import Subasta
from app.schemas.subastador import SubastadorCreate, SubastadorResponse
from app.services.subasta_service import enrich_all

router = APIRouter()


def _enrich_subastador(s: Subastador, db: Session) -> dict:
    data = {col.name: getattr(s, col.name) for col in s.__table__.columns}
    persona = db.query(Persona).filter(Persona.identificador == s.identificador).first()
    data["nombre"] = persona.nombre if persona else None
    return data


@router.get("/{id}")
def get_subastador(id: int, db: Session = Depends(get_db)):
    s = db.query(Subastador).filter(Subastador.identificador == id).first()
    if not s:
        raise HTTPException(404, "Subastador no encontrado")
    return _enrich_subastador(s, db)


@router.post("")
@router.post("/")
def crear_subastador(body: SubastadorCreate, db: Session = Depends(get_db)):
    existing = db.query(Subastador).filter(Subastador.identificador == body.identificador).first()
    if existing:
        return _enrich_subastador(existing, db)
    s = Subastador(
        identificador=body.identificador,
        matricula=body.matricula,
        region=body.region,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return _enrich_subastador(s, db)


@router.get("/{id}/subastas")
def get_subastas_subastador(id: int, db: Session = Depends(get_db)):
    subastas = db.query(Subasta).filter(Subasta.subastador == id).all()
    return enrich_all(subastas, db)
