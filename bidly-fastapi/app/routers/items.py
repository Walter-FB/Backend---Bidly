from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.item_catalogo import ItemCatalogo
from app.models.producto import Producto
from app.services.item_adjudicacion_service import adjudicar_manual
from app.serializers import item_to_dict

router = APIRouter()


def _enrich_item(item: ItemCatalogo, db: Session) -> dict:
    return item_to_dict(item, db)


@router.get("/{id}")
def get_item(id: int, db: Session = Depends(get_db)):
    item = db.query(ItemCatalogo).filter(ItemCatalogo.identificador == id).first()
    if not item:
        raise HTTPException(404, "Item no encontrado")
    return _enrich_item(item, db)


@router.patch("/{id}/adjudicar")
def adjudicar(id: int, db: Session = Depends(get_db)):
    item = adjudicar_manual(id, db)
    db.commit()
    return _enrich_item(item, db)
