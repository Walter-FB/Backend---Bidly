from datetime import date
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import Response
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.config import settings
from app.models.producto import Producto
from app.models.foto import Foto
from app.models.empleado import Empleado, EMPLEADO_SISTEMA
from app.models.item_catalogo import ItemCatalogo
from app.models.duenio import Duenio
from app.schemas.producto import ProductoCreate, DisponibleUpdate, ProductoResponse

router = APIRouter()


def _get_revisor_aleatorio(db: Session) -> int:
    emp = db.query(Empleado).order_by(func.random()).first()
    return emp.identificador if emp else EMPLEADO_SISTEMA


def _ensure_duenio(persona_id: int, db: Session) -> int:
    """Garantiza que exista una fila en `duenios` para esta persona.
    Al registrarse, un usuario solo existe en personas/clientes; cuando publica
    un producto pasa a ser dueño, y productos.duenio es FK NOT NULL a duenios.
    """
    d = db.query(Duenio).filter(Duenio.identificador == persona_id).first()
    if not d:
        d = Duenio(
            identificador=persona_id,
            verificacionfinanciera="no",
            verificacionjudicial="no",
            calificacionriesgo=3,
            verificador=_get_revisor_aleatorio(db),
        )
        db.add(d)
        db.flush()
    return persona_id


@router.get("/{id}", response_model=ProductoResponse)
def get_producto(id: int, db: Session = Depends(get_db)):
    p = db.query(Producto).filter(Producto.identificador == id).first()
    if not p:
        raise HTTPException(404, "Producto no encontrado")
    return p


@router.get("/duenio/{duenio_id}", response_model=List[ProductoResponse])
def get_productos_duenio(duenio_id: int, db: Session = Depends(get_db)):
    return db.query(Producto).filter(Producto.duenio == duenio_id).all()


@router.post("", response_model=ProductoResponse, status_code=201)
@router.post("/", response_model=ProductoResponse, status_code=201)
def crear_producto(body: ProductoCreate, db: Session = Depends(get_db)):
    duenio_id = _ensure_duenio(body.duenio, db)
    p = Producto(
        fecha=date.today(),
        disponible=body.disponible or "si",
        descripcioncatalogo=body.descripcionCatalogo,
        descripcioncompleta=body.descripcionCompleta,
        revisor=_get_revisor_aleatorio(db),
        duenio=duenio_id,
        seguro=body.seguro,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/{id}", status_code=204)
def eliminar_producto(id: int, db: Session = Depends(get_db)):
    en_uso = db.query(ItemCatalogo).filter(ItemCatalogo.producto == id).first()
    if en_uso:
        raise HTTPException(409, "El producto está en uso en una subasta")
    db.query(Foto).filter(Foto.producto == id).delete()
    deleted = db.query(Producto).filter(Producto.identificador == id).delete()
    if not deleted:
        raise HTTPException(404, "Producto no encontrado")
    db.commit()


@router.patch("/{id}/disponible", response_model=ProductoResponse)
def update_disponible(id: int, body: DisponibleUpdate, db: Session = Depends(get_db)):
    p = db.query(Producto).filter(Producto.identificador == id).first()
    if not p:
        raise HTTPException(404, "Producto no encontrado")
    p.disponible = body.disponible
    db.commit()
    db.refresh(p)
    return p


@router.get("/{id}/fotos")
def get_fotos_ids(id: int, db: Session = Depends(get_db)):
    fotos = db.query(Foto).filter(Foto.producto == id).order_by(Foto.identificador).all()
    return [f.identificador for f in fotos]


@router.get("/{id}/portada")
def get_portada(id: int, db: Session = Depends(get_db)):
    foto = db.query(Foto).filter(Foto.producto == id).order_by(Foto.identificador).first()
    if not foto or not foto.foto:
        raise HTTPException(404, "Sin portada")
    return Response(content=bytes(foto.foto), media_type="image/jpeg")


@router.post("/{id}/fotos")
async def upload_fotos(
    id: int,
    fotos: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    ids = []
    for archivo in fotos:
        content = await archivo.read()
        if len(content) > settings.MAX_FILE_SIZE_BYTES:
            raise HTTPException(413, f"Archivo {archivo.filename} supera 15MB")
        f = Foto(producto=id, foto=content)
        db.add(f)
        db.flush()
        ids.append(f.identificador)
    db.commit()
    return ids
