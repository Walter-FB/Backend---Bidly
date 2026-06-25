from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from decimal import Decimal

from app.database import get_db
from app.models.catalogo import Catalogo
from app.models.item_catalogo import ItemCatalogo
from app.models.producto import Producto
from app.models.empleado import EMPLEADO_SISTEMA
from app.schemas.catalogo import CatalogoCreate, CatalogoResponse, ItemCatalogoCreate, ItemCatalogoResponse

router = APIRouter()


def _enrich_item(item: ItemCatalogo, db: Session) -> dict:
    data = {col.name: getattr(item, col.name) for col in item.__table__.columns}
    prod = db.query(Producto).filter(Producto.identificador == item.producto).first()
    if prod:
        data["descripcionCatalogo"] = prod.descripcioncatalogo
        data["descripcionCompleta"] = prod.descripcioncompleta
    return data


@router.post("/", response_model=CatalogoResponse, status_code=201)
def crear_catalogo(body: CatalogoCreate, db: Session = Depends(get_db)):
    c = Catalogo(
        descripcion=body.descripcion,
        subasta=body.subasta,
        responsable=body.responsable or EMPLEADO_SISTEMA,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.get("/{id}/items")
def get_items(id: int, db: Session = Depends(get_db)):
    items = db.query(ItemCatalogo).filter(ItemCatalogo.catalogo == id).all()
    return [_enrich_item(i, db) for i in items]


@router.post("/{id}/items", status_code=201)
def add_item(id: int, body: ItemCatalogoCreate, db: Session = Depends(get_db)):
    catalogo = db.query(Catalogo).filter(Catalogo.identificador == id).first()
    if not catalogo:
        raise HTTPException(404, "Catálogo no encontrado")
    comision = Decimal(str(body.precioBase)) * Decimal("0.10")
    item = ItemCatalogo(
        catalogo=id,
        producto=body.producto,
        preciobase=body.precioBase,
        comision=comision,
        subastado="no",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _enrich_item(item, db)
