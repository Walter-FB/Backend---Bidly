from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.seguro import Seguro
from app.schemas.seguro import SeguroCreate, SeguroUpdate, SeguroResponse

router = APIRouter()


@router.get("/{nro_poliza}", response_model=SeguroResponse)
def get_seguro(nro_poliza: str, db: Session = Depends(get_db)):
    s = db.query(Seguro).filter(Seguro.nropoliza == nro_poliza).first()
    if not s:
        raise HTTPException(404, "Seguro no encontrado")
    return s


@router.post("/", response_model=SeguroResponse, status_code=201)
def crear_seguro(body: SeguroCreate, db: Session = Depends(get_db)):
    s = Seguro(
        nropoliza=body.nroPoliza,
        compania=body.compania,
        polizacombinada=body.polizaCombinada,
        importe=body.importe,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.put("/{nro_poliza}", response_model=SeguroResponse)
def update_seguro(nro_poliza: str, body: SeguroUpdate, db: Session = Depends(get_db)):
    s = db.query(Seguro).filter(Seguro.nropoliza == nro_poliza).first()
    if not s:
        raise HTTPException(404, "Seguro no encontrado")
    if body.compania is not None:
        s.compania = body.compania
    if body.polizaCombinada is not None:
        s.polizacombinada = body.polizaCombinada
    if body.importe is not None:
        s.importe = body.importe
    db.commit()
    db.refresh(s)
    return s
