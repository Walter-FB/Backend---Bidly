from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from pydantic import BaseModel
from decimal import Decimal

from app.database import get_db
from app.models.seguro import Seguro
from app.schemas.seguro import SeguroCreate, SeguroUpdate, SeguroResponse
from app.services import seguro_service

router = APIRouter()


class AumentarPolizaRequest(BaseModel):
    nuevoImporte: Decimal


class CombinarRequest(BaseModel):
    productoIds: list[int]


@router.post("/combinada")
def combinar(body: CombinarRequest, db: Session = Depends(get_db)):
    """Contrata una póliza combinada sobre varias piezas del mismo dueño."""
    s = seguro_service.contratar_combinada(body.productoIds, db)
    db.commit()
    return {"nroPoliza": s.nropoliza, "polizaCombinada": s.polizacombinada, "importe": float(s.importe)}


@router.get("/producto/{producto_id}")
def get_poliza_producto(producto_id: int, db: Session = Depends(get_db)):
    """Póliza + depósito de un bien (para que el dueño lo vea desde la app)."""
    return seguro_service.poliza_de_producto(producto_id, db)


@router.patch("/{nro_poliza}/aumentar")
def aumentar_poliza(nro_poliza: str, body: AumentarPolizaRequest, db: Session = Depends(get_db)):
    """El dueño aumenta el valor de la póliza pagando la diferencia del premio."""
    res = seguro_service.aumentar_poliza(nro_poliza, body.nuevoImporte, db)
    db.commit()
    return res


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
