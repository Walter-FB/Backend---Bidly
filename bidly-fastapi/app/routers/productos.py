"""Productos + estado de aprobación interna (SPEC).

El profe no tiene 'estado de aprobación': un producto solo tiene `disponible`.
Agregamos la tabla propia `producto_estado` con el ciclo
solicitado → en_inspeccion → aceptado | rechazado (+causa), y mantenemos
`disponible` en sync ('aceptado' → 'si', resto → 'no').
"""
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from sqlalchemy import func
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional

from app.database import get_db
from app.config import settings
from app.models.producto import Producto
from app.models.producto_estado import ProductoEstado, ESTADOS_PRODUCTO
from app.models.foto import Foto
from app.models.empleado import Empleado, EMPLEADO_SISTEMA
from app.models.item_catalogo import ItemCatalogo
from app.models.duenio import Duenio

router = APIRouter()

MIN_FOTOS = 6


def _get_revisor_aleatorio(db: Session) -> int:
    emp = db.query(Empleado).order_by(func.random()).first()
    return emp.identificador if emp else EMPLEADO_SISTEMA


def _ensure_duenio(persona_id: int, db: Session) -> int:
    """Garantiza una fila en `duenios` para esta persona. Al registrarse el usuario
    solo existe en personas/clientes; al publicar un producto pasa a ser dueño y
    productos.duenio es FK NOT NULL a duenios."""
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


def _estado_de(producto_id: int, db: Session) -> tuple[str, Optional[str]]:
    pe = db.query(ProductoEstado).filter(ProductoEstado.producto == producto_id).first()
    return (pe.estado, pe.causa_rechazo) if pe else ("solicitado", None)


def _producto_dict(p: Producto, db: Session) -> dict:
    estado, causa = _estado_de(p.identificador, db)
    return {
        "identificador": p.identificador,
        "fecha": p.fecha,
        "disponible": p.disponible,
        "descripcionCatalogo": p.descripcioncatalogo,
        "descripcionCompleta": p.descripcioncompleta,
        "revisor": p.revisor,
        "duenio": p.duenio,
        "seguro": p.seguro,
        "estado": estado,
        "causaRechazo": causa,
        "fotos": db.query(Foto).filter(Foto.producto == p.identificador).count(),
    }


class CambioEstado(BaseModel):
    estado: str
    causa: Optional[str] = None


# ── Listado (panel interno) ───────────────────────────────────────────────────
@router.get("")
@router.get("/")
def listar_productos(estado: Optional[str] = None, db: Session = Depends(get_db)):
    productos = db.query(Producto).order_by(Producto.identificador.desc()).all()
    result = [_producto_dict(p, db) for p in productos]
    if estado:
        result = [r for r in result if r["estado"] == estado]
    return result


@router.get("/duenio/{duenio_id}")
def get_productos_duenio(duenio_id: int, db: Session = Depends(get_db)):
    productos = (
        db.query(Producto)
        .filter(Producto.duenio == duenio_id)
        .order_by(Producto.identificador.desc())
        .all()
    )
    return [_producto_dict(p, db) for p in productos]


# ── Publicar bien (dueño): ≥6 fotos + checkbox de propiedad ───────────────────
@router.post("", status_code=201)
@router.post("/", status_code=201)
async def crear_producto(
    descripcionCompleta: str = Form(...),
    duenio: int = Form(...),
    declaraPropiedad: bool = Form(False),
    descripcionCatalogo: Optional[str] = Form(None),
    fotos: List[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
):
    # Consigna: casillero obligatorio de declaración de propiedad + al menos 6 fotos.
    if not declaraPropiedad:
        raise HTTPException(400, detail={
            "message": "Tenés que declarar que el bien te pertenece.", "code": "NO_DECLARATION"})
    if len(fotos) < MIN_FOTOS:
        raise HTTPException(400, detail={
            "message": f"Subí al menos {MIN_FOTOS} fotos del bien.", "code": "POCAS_FOTOS"})

    duenio_id = _ensure_duenio(duenio, db)
    # El bien nace 'solicitado' / disponible='no' hasta que Bidly lo apruebe.
    p = Producto(
        fecha=date.today(),
        disponible="no",
        descripcioncatalogo=descripcionCatalogo,
        descripcioncompleta=descripcionCompleta,
        revisor=_get_revisor_aleatorio(db),
        duenio=duenio_id,
        seguro=None,
    )
    db.add(p)
    db.flush()

    db.add(ProductoEstado(producto=p.identificador, estado="solicitado"))

    for archivo in fotos:
        content = await archivo.read()
        if len(content) > settings.MAX_FILE_SIZE_BYTES:
            raise HTTPException(413, f"El archivo {archivo.filename} supera 15MB")
        db.add(Foto(producto=p.identificador, foto=content))

    db.commit()
    db.refresh(p)
    return _producto_dict(p, db)


@router.get("/{id}")
def get_producto(id: int, db: Session = Depends(get_db)):
    p = db.query(Producto).filter(Producto.identificador == id).first()
    if not p:
        raise HTTPException(404, detail={"message": "Producto no encontrado", "code": "NOT_FOUND"})
    return _producto_dict(p, db)


# ── Aprobación interna: cambiar estado ────────────────────────────────────────
@router.patch("/{id}/estado")
def cambiar_estado(id: int, body: CambioEstado, db: Session = Depends(get_db)):
    if body.estado not in ESTADOS_PRODUCTO:
        raise HTTPException(400, detail={"message": "Estado inválido.", "code": "BAD_STATE"})
    if body.estado == "rechazado" and not (body.causa and body.causa.strip()):
        raise HTTPException(400, detail={"message": "Indicá la causa del rechazo.", "code": "NO_CAUSE"})

    p = db.query(Producto).filter(Producto.identificador == id).first()
    if not p:
        raise HTTPException(404, detail={"message": "El producto no existe.", "code": "NOT_FOUND"})

    causa = body.causa.strip() if body.estado == "rechazado" else None
    pe = db.query(ProductoEstado).filter(ProductoEstado.producto == id).first()
    if not pe:
        pe = ProductoEstado(producto=id)
        db.add(pe)
    pe.estado = body.estado
    pe.causa_rechazo = causa
    pe.fecha_cambio = datetime.utcnow()

    # Sincronizar disponible: solo el aceptado queda disponible para catálogo.
    p.disponible = "si" if body.estado == "aceptado" else "no"

    db.commit()
    return {"producto": id, "estado": body.estado, "causa": causa}


@router.delete("/{id}", status_code=204)
def eliminar_producto(id: int, db: Session = Depends(get_db)):
    en_uso = db.query(ItemCatalogo).filter(ItemCatalogo.producto == id).first()
    if en_uso:
        raise HTTPException(409, detail={"message": "El producto está en una subasta", "code": "IN_USE"})
    db.query(Foto).filter(Foto.producto == id).delete()
    db.query(ProductoEstado).filter(ProductoEstado.producto == id).delete()
    deleted = db.query(Producto).filter(Producto.identificador == id).delete()
    if not deleted:
        raise HTTPException(404, detail={"message": "Producto no encontrado", "code": "NOT_FOUND"})
    db.commit()


# ── Fotos ─────────────────────────────────────────────────────────────────────
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
async def upload_fotos(id: int, fotos: List[UploadFile] = File(...), db: Session = Depends(get_db)):
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
