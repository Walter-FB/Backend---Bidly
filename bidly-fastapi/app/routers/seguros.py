"""Seguros (tabla del profe). De cada bien recibido para la venta se contrata un
seguro en función del valor base. CRUD simple sobre la póliza; sin ubicación de
depósito ni pólizas combinadas (eso se recortó)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from decimal import Decimal

from app.database import get_db
from app.models.seguro import Seguro
from app.models.producto import Producto
from app.schemas.seguro import SeguroCreate, SeguroUpdate, SeguroResponse

router = APIRouter()


class AumentarPolizaRequest(BaseModel):
    nuevoImporte: Decimal


@router.get("/producto/{producto_id}")
def get_poliza_producto(producto_id: int, db: Session = Depends(get_db)):
    """Póliza asociada a un bien (para que el dueño la vea desde la app)."""
    prod = db.query(Producto).filter(Producto.identificador == producto_id).first()
    if not prod or not prod.seguro:
        return None
    s = db.query(Seguro).filter(Seguro.nropoliza == prod.seguro).first()
    return s


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


@router.patch("/{nro_poliza}/aumentar", response_model=SeguroResponse)
def aumentar_poliza(nro_poliza: str, body: AumentarPolizaRequest, db: Session = Depends(get_db)):
    """El dueño aumenta el valor de la póliza pagando la diferencia del premio."""
    s = db.query(Seguro).filter(Seguro.nropoliza == nro_poliza).first()
    if not s:
        raise HTTPException(404, "Seguro no encontrado")
    if body.nuevoImporte <= (s.importe or 0):
        raise HTTPException(422, detail={"message": "El nuevo importe debe ser mayor", "code": "IMPORTE_INVALIDO"})
    s.importe = body.nuevoImporte
    db.commit()
    db.refresh(s)
    return s
