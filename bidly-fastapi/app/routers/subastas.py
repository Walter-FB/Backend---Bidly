"""Subastas. Estado directo de la DDL del profe: 'abierta' | 'cerrada'.

La arma el subastador (staff interno), le carga el catálogo y la abre/cierra.
Sin moneda dual, sin sesión en vivo, sin timers (todo eso se quemó).
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.auth import get_optional_client
from app.models.subasta import Subasta
from app.models.asistente import Asistente
from app.models.catalogo import Catalogo
from app.models.item_catalogo import ItemCatalogo
from app.models.foto import Foto
from app.models.subasta_moneda import SubastaMoneda
from app.schemas.subasta import SubastaCreate, SubastaEstadoUpdate
from app.services import subasta_service, remate_service
from app.serializers import item_to_dict

router = APIRouter()


def _ensure_subastador(persona_id: int, db: Session) -> int:
    """Garantiza una fila en `subastadores` para quien arma la subasta
    (subastas.subastador es FK a subastadores)."""
    from app.models.subastador import Subastador
    s = db.query(Subastador).filter(Subastador.identificador == persona_id).first()
    if not s:
        db.add(Subastador(identificador=persona_id, matricula=None, region=None))
        db.flush()
    return persona_id


def _subastador_auto(db: Session) -> int:
    """Rematador por defecto cuando no se indica uno: el primer subastador
    registrado, o se da de alta como subastador al primer empleado de la casa.
    (El subastador es el martillero que dirige el remate — staff de Bidly,
    NO el dueño de los bienes.)"""
    from app.models.subastador import Subastador
    from app.models.empleado import Empleado, EMPLEADO_SISTEMA
    s = db.query(Subastador).order_by(Subastador.identificador).first()
    if s:
        return s.identificador
    emp = db.query(Empleado).order_by(Empleado.identificador).first()
    return _ensure_subastador(emp.identificador if emp else EMPLEADO_SISTEMA, db)


@router.get("")
@router.get("/")
def listar_subastas(
    estado: Optional[str] = None,
    categoria: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Subasta)
    if estado:
        q = q.filter(Subasta.estado == estado)
    if categoria:
        q = q.filter(Subasta.categoria == categoria)
    data = subasta_service.enrich_all(q.all(), db)
    db.commit()  # persiste adjudicaciones hechas por el tick del remate al enriquecer
    return data


@router.get("/{id}")
def get_subasta(id: int, db: Session = Depends(get_db)):
    s = db.query(Subasta).filter(Subasta.identificador == id).first()
    if not s:
        raise HTTPException(404, "Subasta no encontrada")
    data = subasta_service.enrich(s, db)
    db.commit()
    return data


@router.post("", status_code=201)
@router.post("/", status_code=201)
def crear_subasta(body: SubastaCreate, db: Session = Depends(get_db)):
    subastador_id = (
        _ensure_subastador(body.subastador, db) if body.subastador else _subastador_auto(db)
    )
    s = Subasta(
        fecha=body.fecha,
        hora=body.hora,
        estado=body.estado or "cerrada",
        subastador=subastador_id,
        ubicacion=body.ubicacion,
        capacidadasistentes=body.capacidadAsistentes,
        tienedeposito=body.tieneDeposito,
        seguridadpropia=body.seguridadPropia,
        categoria=body.categoria,
    )
    db.add(s)
    db.flush()
    # Moneda de la subasta (pesos/dólares) en la tabla de features subasta_moneda.
    db.add(SubastaMoneda(subasta=s.identificador, moneda=(body.moneda or "pesos")))
    db.commit()
    db.refresh(s)
    return subasta_service.enrich(s, db)


@router.patch("/{id}/estado")
def update_estado(id: int, body: SubastaEstadoUpdate, db: Session = Depends(get_db)):
    s = db.query(Subasta).filter(Subasta.identificador == id).first()
    if not s:
        raise HTTPException(404, "Subasta no encontrada")

    if body.estado == "cerrada":
        # Al cerrar: adjudica los ítems pendientes (mejor postor gana / si nadie
        # pujó la empresa lo compra a base) y marca la subasta cerrada.
        subasta_service.cerrar_subasta(id, db)
        remate_service.limpiar(id, db)  # apaga los relojes del remate
    else:
        s.estado = body.estado  # 'abierta'
        if body.estado == "abierta":
            # Al abrir la puja, liberar los ítems sin ganador real (así queda pujable).
            subasta_service.reabrir_items(id, db)
            # Arranca el reloj del primer ítem: el catálogo se remata de a uno.
            remate_service.iniciar(id, db)
    db.commit()
    db.refresh(s)
    return subasta_service.enrich(s, db)


@router.get("/{id}/estado")
def get_estado(id: int, db: Session = Depends(get_db)):
    s = db.query(Subasta).filter(Subasta.identificador == id).first()
    if not s:
        raise HTTPException(404, "Subasta no encontrada")
    return {"estado": s.estado}


@router.get("/{id}/remate")
def get_remate(id: int, db: Session = Depends(get_db)):
    """Estado del reloj del remate: ítem activo + segundos restantes. Cada llamada
    hace avanzar el reloj (adjudica lo vencido y activa el siguiente ítem)."""
    s = db.query(Subasta).filter(Subasta.identificador == id).first()
    if not s:
        raise HTTPException(404, "Subasta no encontrada")
    estado = remate_service.estado(id, db)
    db.commit()  # persistir adjudicaciones/avances hechos por el tick
    return estado


@router.get("/{id}/catalogo")
def get_catalogo(id: int, db: Session = Depends(get_db), current: dict = Depends(get_optional_client)):
    item = (
        db.query(ItemCatalogo)
        .join(Catalogo, ItemCatalogo.catalogo == Catalogo.identificador)
        .filter(Catalogo.subasta == id)
        .order_by(ItemCatalogo.identificador)
        .first()
    )
    if not item:
        raise HTTPException(404, "Sin items en el catálogo")
    return item_to_dict(item, db, mostrar_precio=current is not None)


@router.get("/{id}/catalogos")
def get_catalogos(id: int, db: Session = Depends(get_db), current: dict = Depends(get_optional_client)):
    items = (
        db.query(ItemCatalogo)
        .join(Catalogo, ItemCatalogo.catalogo == Catalogo.identificador)
        .filter(Catalogo.subasta == id)
        .order_by(ItemCatalogo.identificador)
        .all()
    )
    return [item_to_dict(item, db, mostrar_precio=current is not None) for item in items]


@router.get("/{id}/portada")
def get_portada(id: int, db: Session = Depends(get_db)):
    item = (
        db.query(ItemCatalogo)
        .join(Catalogo, ItemCatalogo.catalogo == Catalogo.identificador)
        .filter(Catalogo.subasta == id)
        .order_by(ItemCatalogo.identificador)
        .first()
    )
    if not item:
        raise HTTPException(404, "Sin portada")
    foto = db.query(Foto).filter(Foto.producto == item.producto).order_by(Foto.identificador).first()
    if not foto or not foto.foto:
        raise HTTPException(404, "Sin portada")
    return Response(content=bytes(foto.foto), media_type="image/jpeg")


@router.get("/{id}/asistentes")
def get_asistentes(id: int, db: Session = Depends(get_db)):
    asistentes = db.query(Asistente).filter(Asistente.subasta == id).all()
    return [{col.name: getattr(a, col.name) for col in a.__table__.columns} for a in asistentes]
