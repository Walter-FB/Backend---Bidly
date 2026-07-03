"""Pagos al dueño (payouts) y cuentas a la vista donde cobra."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.pagos import Payout, CuentaDuenio
from app.schemas.pagos import CuentaCreate, PagarPayoutRequest
from app.services import payout_service, notificacion_service

router = APIRouter()


# ── Cuentas a la vista ────────────────────────────────────────────────────────
@router.post("/cuentas", status_code=201)
def crear_cuenta(body: CuentaCreate, db: Session = Depends(get_db)):
    c = CuentaDuenio(
        duenio=body.duenioId,
        alias=body.alias,
        banco=body.banco,
        pais=body.pais,
        moneda=body.moneda or "pesos",
        es_exterior="si" if body.esExterior else "no",
        declarada_en=datetime.utcnow(),
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return payout_service.cuenta_to_dict(c)


@router.get("/cuentas/duenio/{duenio_id}")
def cuentas_duenio(duenio_id: int, db: Session = Depends(get_db)):
    cuentas = db.query(CuentaDuenio).filter(CuentaDuenio.duenio == duenio_id).all()
    return [payout_service.cuenta_to_dict(c) for c in cuentas]


# ── Payouts ───────────────────────────────────────────────────────────────────
@router.get("/duenio/{duenio_id}")
def payouts_duenio(duenio_id: int, db: Session = Depends(get_db)):
    return payout_service.por_duenio(duenio_id, db)


@router.patch("/{id}/pagar")
def pagar_payout(id: int, body: PagarPayoutRequest, db: Session = Depends(get_db)):
    cuenta = db.query(CuentaDuenio).filter(CuentaDuenio.identificador == body.cuentaId).first()
    if not cuenta:
        raise HTTPException(404, "Cuenta no encontrada")
    p = payout_service.marcar_pagado(id, body.cuentaId, db)
    if not p:
        raise HTTPException(404, "Payout no encontrado")
    db.commit()
    notificacion_service.crear(
        p.duenio, "payout",
        f"Se acreditaron ${p.importe_neto} en tu cuenta {cuenta.alias}.",
        db,
    )
    db.commit()
    return payout_service.to_dict(p, db)
