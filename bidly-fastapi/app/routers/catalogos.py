from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from decimal import Decimal

from app.database import get_db
from app.config import settings
from app.models.catalogo import Catalogo
from app.models.item_catalogo import ItemCatalogo
from app.models.medio_pago import MedioPago
from app.models.producto import Producto
from app.models.producto_categoria import ProductoCategoria
from app.models.empleado import EMPLEADO_SISTEMA
from app.schemas.catalogo import CatalogoCreate, CatalogoResponse, ItemCatalogoCreate, ItemCatalogoResponse
from app.serializers import item_to_dict

router = APIRouter()


def _enrich_item(item: ItemCatalogo, db: Session) -> dict:
    return item_to_dict(item, db)


@router.post("", response_model=CatalogoResponse, status_code=201)
@router.post("/", response_model=CatalogoResponse, status_code=201)
def crear_catalogo(body: CatalogoCreate, db: Session = Depends(get_db)):
    c = Catalogo(
        descripcion=body.descripcion,
        subasta=body.subasta,
        responsable=EMPLEADO_SISTEMA,
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

    # Validar categoría: todos los ítems del catálogo deben ser de la misma categoría
    cat_nuevo = db.query(ProductoCategoria).filter(ProductoCategoria.producto == body.producto).first()
    if cat_nuevo:
        conflicto = (
            db.query(ProductoCategoria)
            .join(ItemCatalogo, ProductoCategoria.producto == ItemCatalogo.producto)
            .filter(
                ItemCatalogo.catalogo == id,
                ProductoCategoria.categoria != cat_nuevo.categoria,
            )
            .first()
        )
        if conflicto:
            raise HTTPException(
                422,
                detail={
                    "message": f"Categoría incompatible: el nuevo producto es '{cat_nuevo.categoria}' pero el catálogo ya tiene productos de '{conflicto.categoria}'",
                    "code": "CATEGORY_MISMATCH",
                },
            )

    # Validar que el dueño del producto tenga cuenta de cobro registrada
    prod = db.query(Producto).filter(Producto.identificador == body.producto).first()
    if prod and prod.duenio:
        cuenta_cobro = db.query(MedioPago).filter(
            MedioPago.cliente == prod.duenio,
            MedioPago.tipo == "cuenta",
            MedioPago.es_cuenta_cobro == "si",
        ).first()
        if not cuenta_cobro:
            raise HTTPException(
                422,
                detail={
                    "message": "El vendedor no tiene una cuenta bancaria de cobro registrada. "
                               "Debe agregar una cuenta y marcarla como cuenta de cobro.",
                    "code": "NO_COBRO_ACCOUNT",
                },
            )

    comision = Decimal(str(body.precioBase)) * Decimal(str(settings.COMISION_PORCENT))
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
