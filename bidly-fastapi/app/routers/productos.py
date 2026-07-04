from datetime import date
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import List, Optional

from app.auth import get_current_client
from app.database import get_db
from app.config import settings
from app.models.producto import Producto
from app.models.foto import Foto
from app.models.empleado import Empleado, EMPLEADO_SISTEMA
from app.models.item_catalogo import ItemCatalogo
from app.models.duenio import Duenio
from app.models.producto_estado import ProductoEstado
from app.schemas.producto import ProductoCreate, DisponibleUpdate

router = APIRouter()


class RechazarRequest(BaseModel):
    motivo: Optional[str] = "Rechazado por administrador"
    tipoDevolucion: Optional[str] = None


def _get_revisor_aleatorio(db: Session) -> int:
    emp = db.query(Empleado).order_by(func.random()).first()
    return emp.identificador if emp else EMPLEADO_SISTEMA


def _ensure_duenio(persona_id: int, db: Session) -> int:
    """Garantiza que exista una fila en `duenios` para esta persona."""
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


def _enrich_producto(p: Producto, db: Session) -> dict:
    estado_obj = db.query(ProductoEstado).filter(ProductoEstado.producto == p.identificador).first()
    return {
        "identificador": p.identificador,
        "fecha": p.fecha.isoformat() if p.fecha else None,
        "disponible": p.disponible,
        "descripcionCatalogo": p.descripcioncatalogo,
        "descripcionCompleta": p.descripcioncompleta,
        "revisor": p.revisor,
        "duenio": p.duenio,
        "seguro": p.seguro,
        "estadoRevision": estado_obj.estado if estado_obj else None,
        "motivoRechazo": estado_obj.motivo if estado_obj else None,
        "tipoDevolucion": estado_obj.tipo_devolucion if estado_obj else None,
    }


# IMPORTANTE: /pendientes debe ir ANTES de /{id} para evitar conflicto de rutas
@router.get("/pendientes")
def get_productos_pendientes(db: Session = Depends(get_db), current_user=Depends(get_current_client)):
    if current_user.get("rol") != "admin":
        raise HTTPException(403, "Solo admins pueden ver productos pendientes")
    estados = db.query(ProductoEstado).filter(ProductoEstado.estado == "pendiente").all()
    result = []
    for e in estados:
        p = db.query(Producto).filter(Producto.identificador == e.producto).first()
        if p:
            result.append(_enrich_producto(p, db))
    return result


@router.get("/duenio/{duenio_id}")
def get_productos_duenio(duenio_id: int, db: Session = Depends(get_db)):
    productos = db.query(Producto).filter(Producto.duenio == duenio_id).all()
    return [_enrich_producto(p, db) for p in productos]


@router.get("/{id}")
def get_producto(id: int, db: Session = Depends(get_db)):
    p = db.query(Producto).filter(Producto.identificador == id).first()
    if not p:
        raise HTTPException(404, "Producto no encontrado")
    return _enrich_producto(p, db)


@router.post("", status_code=201)
@router.post("/", status_code=201)
def crear_producto(body: ProductoCreate, db: Session = Depends(get_db)):
    duenio_id = _ensure_duenio(body.duenio, db)
    p = Producto(
        fecha=date.today(),
        disponible="no",
        descripcioncatalogo=body.descripcionCatalogo,
        descripcioncompleta=body.descripcionCompleta,
        revisor=_get_revisor_aleatorio(db),
        duenio=duenio_id,
        seguro=body.seguro,
    )
    db.add(p)
    db.flush()

    estado = ProductoEstado(producto=p.identificador, estado="pendiente")
    db.add(estado)
    db.commit()
    db.refresh(p)
    return _enrich_producto(p, db)


@router.patch("/{id}/aprobar")
def aprobar_producto(id: int, db: Session = Depends(get_db), current_user=Depends(get_current_client)):
    if current_user.get("rol") != "admin":
        raise HTTPException(403, "Solo admins pueden aprobar productos")
    p = db.query(Producto).filter(Producto.identificador == id).first()
    if not p:
        raise HTTPException(404, "Producto no encontrado")

    p.disponible = "si"

    estado = db.query(ProductoEstado).filter(ProductoEstado.producto == id).first()
    if estado:
        estado.estado = "aprobado"
        estado.motivo = None
    else:
        db.add(ProductoEstado(producto=id, estado="aprobado"))

    db.commit()

    from app.services import notificacion_service
    if p.duenio:
        notificacion_service.crear(p.duenio, "producto_aprobado",
            f"Tu producto '{p.descripcioncatalogo or f'#{id}'}' fue aprobado y ya está disponible.", db)
        db.commit()

    return _enrich_producto(p, db)


@router.patch("/{id}/rechazar")
def rechazar_producto(id: int, body: RechazarRequest, db: Session = Depends(get_db), current_user=Depends(get_current_client)):
    if current_user.get("rol") != "admin":
        raise HTTPException(403, "Solo admins pueden rechazar productos")
    p = db.query(Producto).filter(Producto.identificador == id).first()
    if not p:
        raise HTTPException(404, "Producto no encontrado")

    p.disponible = "no"

    estado = db.query(ProductoEstado).filter(ProductoEstado.producto == id).first()
    if estado:
        estado.estado = "rechazado"
        estado.motivo = body.motivo
        estado.tipo_devolucion = body.tipoDevolucion
    else:
        db.add(ProductoEstado(producto=id, estado="rechazado", motivo=body.motivo, tipo_devolucion=body.tipoDevolucion))

    db.commit()

    from app.services import notificacion_service
    if p.duenio:
        msg = f"Tu producto '{p.descripcioncatalogo or f'#{id}'}' fue rechazado."
        if body.motivo:
            msg += f" Motivo: {body.motivo}"
        notificacion_service.crear(p.duenio, "producto_rechazado", msg, db)
        db.commit()

    return _enrich_producto(p, db)


@router.delete("/{id}", status_code=204)
def eliminar_producto(id: int, db: Session = Depends(get_db)):
    en_uso = db.query(ItemCatalogo).filter(ItemCatalogo.producto == id).first()
    if en_uso:
        raise HTTPException(409, "El producto está en uso en una subasta")
    db.query(ProductoEstado).filter(ProductoEstado.producto == id).delete()
    db.query(Foto).filter(Foto.producto == id).delete()
    deleted = db.query(Producto).filter(Producto.identificador == id).delete()
    if not deleted:
        raise HTTPException(404, "Producto no encontrado")
    db.commit()


@router.patch("/{id}/disponible")
def update_disponible(id: int, body: DisponibleUpdate, db: Session = Depends(get_db)):
    p = db.query(Producto).filter(Producto.identificador == id).first()
    if not p:
        raise HTTPException(404, "Producto no encontrado")
    p.disponible = body.disponible
    db.commit()
    db.refresh(p)
    return _enrich_producto(p, db)


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
