from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.foto import Foto

router = APIRouter()


@router.get("/{foto_id}")
def get_foto(foto_id: int, db: Session = Depends(get_db)):
    foto = db.query(Foto).filter(Foto.identificador == foto_id).first()
    if not foto or not foto.foto:
        raise HTTPException(404, "Foto no encontrada")
    return Response(content=bytes(foto.foto), media_type="image/jpeg")
