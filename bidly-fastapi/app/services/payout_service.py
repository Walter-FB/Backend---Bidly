"""Pagos al dueño (payout) del dinero de los bienes vendidos.

- Bien vendido a un postor  → payout origen='venta'   (neto = puja − comisión).
- Nadie pujó → la empresa compra al valor base al finalizar la subasta →
  payout origen='empresa' (neto = valor base − comisión).
El neto se acredita en una cuenta a la vista declarada por el dueño.
"""
from datetime import datetime
from decimal import Decimal
from sqlalchemy.orm import Session

from app.models.payout import Payout
from app.models.cuenta_duenio import CuentaDuenio
from app.models.producto import Producto
from app.models.subasta import Subasta


def _d(v) -> Decimal:
    return Decimal(str(v or 0))


def crear_payout(duenio_id, producto_id, subasta_id, importe_bruto, comision, origen, db: Session) -> Payout:
    neto = _d(importe_bruto) - _d(comision)
    if neto < 0:
        neto = Decimal("0")
    p = Payout(
        duenio=duenio_id,
        producto=producto_id,
        subasta=subasta_id,
        importe_bruto=_d(importe_bruto),
        comision=_d(comision),
        importe_neto=neto,
        origen=origen,
        estado="pendiente",
        creado_en=datetime.utcnow(),
    )
    db.add(p)
    db.flush()
    return p


def existe_payout(producto_id, db: Session) -> bool:
    return db.query(Payout).filter(Payout.producto == producto_id).first() is not None


def to_dict(p: Payout, db: Session) -> dict:
    prod = db.query(Producto).filter(Producto.identificador == p.producto).first() if p.producto else None
    sub = db.query(Subasta).filter(Subasta.identificador == p.subasta).first() if p.subasta else None
    return {
        "identificador": p.identificador,
        "duenio": p.duenio,
        "producto": {"identificador": p.producto, "titulo": prod.descripcioncatalogo if prod else None},
        "subastaId": p.subasta,
        "subastaFecha": sub.fecha.isoformat() if sub and sub.fecha else None,
        "importeBruto": float(p.importe_bruto) if p.importe_bruto is not None else None,
        "comision": float(p.comision) if p.comision is not None else None,
        "importeNeto": float(p.importe_neto) if p.importe_neto is not None else None,
        "origen": p.origen,
        "cuenta": p.cuenta,
        "estado": p.estado,
        "creadoEn": p.creado_en.isoformat() if p.creado_en else None,
        "pagadoEn": p.pagado_en.isoformat() if p.pagado_en else None,
    }


def por_duenio(duenio_id, db: Session):
    payouts = (
        db.query(Payout)
        .filter(Payout.duenio == duenio_id)
        .order_by(Payout.identificador.desc())
        .all()
    )
    return [to_dict(p, db) for p in payouts]


def marcar_pagado(payout_id, cuenta_id, db: Session) -> Payout | None:
    p = db.query(Payout).filter(Payout.identificador == payout_id).first()
    if not p:
        return None
    p.estado = "pagado"
    p.cuenta = cuenta_id
    p.pagado_en = datetime.utcnow()
    db.flush()
    return p


def cuenta_to_dict(c: CuentaDuenio) -> dict:
    return {
        "identificador": c.identificador,
        "duenio": c.duenio,
        "alias": c.alias,
        "banco": c.banco,
        "pais": c.pais,
        "moneda": c.moneda,
        "esExterior": c.es_exterior,
        "declaradaEn": c.declarada_en.isoformat() if c.declarada_en else None,
    }
