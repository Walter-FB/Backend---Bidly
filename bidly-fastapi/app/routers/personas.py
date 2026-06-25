from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.persona import Persona
from app.schemas.persona import PersonaCreate, PersonaUpdate, PersonaResponse

router = APIRouter()


@router.post("/", response_model=PersonaResponse, status_code=201)
def crear_persona(body: PersonaCreate, db: Session = Depends(get_db)):
    p = Persona(**body.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.get("/{id}", response_model=PersonaResponse)
def get_persona(id: int, db: Session = Depends(get_db)):
    p = db.query(Persona).filter(Persona.identificador == id).first()
    if not p:
        raise HTTPException(404, "Persona no encontrada")
    return p


@router.put("/{id}", response_model=PersonaResponse)
def update_persona(id: int, body: PersonaUpdate, db: Session = Depends(get_db)):
    p = db.query(Persona).filter(Persona.identificador == id).first()
    if not p:
        raise HTTPException(404, "Persona no encontrada")
    for k, v in body.model_dump().items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p


@router.patch("/{id}", response_model=PersonaResponse)
def patch_persona(id: int, body: PersonaUpdate, db: Session = Depends(get_db)):
    p = db.query(Persona).filter(Persona.identificador == id).first()
    if not p:
        raise HTTPException(404, "Persona no encontrada")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p
