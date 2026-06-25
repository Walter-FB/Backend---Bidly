from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.registro_subasta import RegistroDeSubasta
from app.models.registro_pago import RegistroPago
from app.models.reembolso import Reembolso
from app.schemas.registro_subasta import RegistroCreate, PagarRequest, ReembolsoUpdate

router = APIRouter()


def _enrich_registro(r: RegistroDeSubasta, db: Session) -> dict:
    data = {col.name: getattr(r, col.name) for col in r.__table__.columns}
    pago = db.query(RegistroPago).filter(RegistroPago.registro == r.identificador).first()
    ree  = db.query(Reembolso).filter(Reembolso.registro == r.identificador).first()
    data["estadoPago"]   = pago.estado if pago else "pendiente"
    data["medioPago"]    = pago.medio_pago if pago else None
    data["importeTotal"] = float(pago.importe_total) if pago and pago.importe_total else None
    data["fechaPago"]    = pago.fecha_pago.isoformat() if pago and pago.fecha_pago else None
    data["reembolsada"]  = ree.reembolsada if ree else "no"
    return data


@router.post("/", status_code=201)
def crear_registro(body: RegistroCreate, db: Session = Depends(get_db)):
    r = RegistroDeSubasta(**body.model_dump())
    db.add(r)
    db.commit()
    db.refresh(r)
    return _enrich_registro(r, db)


@router.get("/{id}")
def get_registro(id: int, db: Session = Depends(get_db)):
    r = db.query(RegistroDeSubasta).filter(RegistroDeSubasta.identificador == id).first()
    if not r:
        raise HTTPException(404, "Registro no encontrado")
    return _enrich_registro(r, db)


@router.get("/cliente/{cliente_id}")
def get_registros_cliente(cliente_id: int, db: Session = Depends(get_db)):
    registros = (
        db.query(RegistroDeSubasta)
        .filter(RegistroDeSubasta.cliente == cliente_id)
        .all()
    )
    return [_enrich_registro(r, db) for r in registros]


@router.get("/subasta/{subasta_id}")
def get_registros_subasta(subasta_id: int, db: Session = Depends(get_db)):
    registros = (
        db.query(RegistroDeSubasta)
        .filter(RegistroDeSubasta.subasta == subasta_id)
        .all()
    )
    return [_enrich_registro(r, db) for r in registros]


@router.post("/{id}/pagar")
def pagar(id: int, body: PagarRequest, db: Session = Depends(get_db)):
    r = db.query(RegistroDeSubasta).filter(RegistroDeSubasta.identificador == id).first()
    if not r:
        raise HTTPException(404, "Registro no encontrado")

    pago = db.query(RegistroPago).filter(RegistroPago.registro == id).first()
    if pago:
        pago.estado      = "pagado"
        pago.medio_pago  = body.medioPagoId
        pago.fecha_pago  = datetime.utcnow()
    else:
        pago = RegistroPago(
            registro=id,
            estado="pagado",
            medio_pago=body.medioPagoId,
            fecha_pago=datetime.utcnow(),
        )
        db.add(pago)
    db.commit()
    return _enrich_registro(r, db)


@router.patch("/{id}/reembolso")
def update_reembolso(id: int, body: ReembolsoUpdate, db: Session = Depends(get_db)):
    r = db.query(RegistroDeSubasta).filter(RegistroDeSubasta.identificador == id).first()
    if not r:
        raise HTTPException(404, "Registro no encontrado")

    ree = db.query(Reembolso).filter(Reembolso.registro == id).first()
    if ree:
        ree.reembolsada = body.reembolsada
    else:
        ree = Reembolso(registro=id, reembolsada=body.reembolsada)
        db.add(ree)
    db.commit()
    return _enrich_registro(r, db)
