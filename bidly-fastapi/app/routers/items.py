from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.item_catalogo import ItemCatalogo
from app.services import subasta_service
from app.serializers import item_to_dict

router = APIRouter()


@router.get("/{id}")
def get_item(id: int, db: Session = Depends(get_db)):
    item = db.query(ItemCatalogo).filter(ItemCatalogo.identificador == id).first()
    if not item:
        raise HTTPException(404, "Item no encontrado")
    return item_to_dict(item, db)


@router.patch("/{id}/adjudicar")
def adjudicar(id: int, db: Session = Depends(get_db)):
    """Cierra un ítem: el mejor postor lo gana y se registra la venta."""
    item = db.query(ItemCatalogo).filter(ItemCatalogo.identificador == id).first()
    if not item:
        raise HTTPException(404, "Item no encontrado")
    subasta_service.adjudicar_item(id, db)
    db.commit()
    db.refresh(item)
    return item_to_dict(item, db)
