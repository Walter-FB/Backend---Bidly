from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import Optional, List

from app.database import get_db
from app.models.subasta import Subasta
from app.models.subasta_moneda import SubastaMoneda
from app.models.subasta_sesion import SubastaSesion
from app.models.subasta_revision import SubastaRevision
from app.models.subasta_estado_admin import SubastaEstadoAdmin
from app.models.asistente import Asistente
from app.models.catalogo import Catalogo
from app.models.item_catalogo import ItemCatalogo
from app.models.producto import Producto
from app.models.foto import Foto
from app.schemas.subasta import SubastaCreate, SubastaEstadoUpdate, SesionResponse
from app.services import subasta_service, subasta_estado_service, subasta_revision_service
from app.services.subasta_sesion_service import segundos_restantes
from app.serializers import item_to_dict

router = APIRouter()


def _build_sesion_response(sesion: SubastaSesion) -> dict:
    if not sesion:
        return {"itemActivoId": None, "ordenActual": None, "timerDesde": None, "segundosRestantes": None}
    return {
        "itemActivoId": sesion.item_activo,
        "ordenActual": sesion.orden_actual,
        "timerDesde": sesion.timer_desde,
        "segundosRestantes": segundos_restantes(sesion),
    }


@router.get("")
@router.get("/")
def listar_subastas(
    estado: Optional[str] = None,
    categoria: Optional[str] = None,
    moneda: Optional[str] = None,
    publico: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Subasta)
    if estado:
        q = q.filter(Subasta.estado == estado)
    if categoria:
        q = q.filter(Subasta.categoria == categoria)

    subastas = q.all()

    if moneda:
        ids_con_moneda = {
            sm.subasta
            for sm in db.query(SubastaMoneda).filter(SubastaMoneda.moneda == moneda).all()
        }
        subastas = [s for s in subastas if s.identificador in ids_con_moneda]

    if publico:
        subastas = subasta_revision_service.filtrar_visibles_publico(subastas, db)

    return subasta_service.enrich_all(subastas, db)


@router.get("/{id}")
def get_subasta(id: int, db: Session = Depends(get_db)):
    s = db.query(Subasta).filter(Subasta.identificador == id).first()
    if not s:
        raise HTTPException(404, "Subasta no encontrada")
    return subasta_service.enrich(s, db)


@router.post("", status_code=201)
@router.post("/", status_code=201)
def crear_subasta(body: SubastaCreate, db: Session = Depends(get_db)):
    s = Subasta(
        fecha=body.fecha,
        hora=body.hora,
        estado=body.estado or "cerrada",
        subastador=body.subastador,
        ubicacion=body.ubicacion,
        capacidadasistentes=body.capacidadAsistentes,
        tienedeposito=body.tieneDeposito,
        seguridadpropia=body.seguridadPropia,
        categoria=body.categoria,
    )
    db.add(s)
    db.flush()

    sm = SubastaMoneda(subasta=s.identificador, moneda=body.moneda)
    db.add(sm)

    subasta_estado_service.crear_estado_pendiente(s.identificador, db)
    subasta_revision_service.registrar_nueva(s, solicitante_id=body.subastador, db=db)

    db.commit()
    db.refresh(s)
    return subasta_service.enrich(s, db)


@router.get("/{id}/catalogo")
def get_catalogo(id: int, db: Session = Depends(get_db)):
    item = (
        db.query(ItemCatalogo)
        .join(Catalogo, ItemCatalogo.catalogo == Catalogo.identificador)
        .filter(Catalogo.subasta == id)
        .order_by(ItemCatalogo.identificador)
        .first()
    )
    if not item:
        raise HTTPException(404, "Sin items en el catálogo")
    return item_to_dict(item, db)


@router.get("/{id}/catalogos")
def get_catalogos(id: int, db: Session = Depends(get_db)):
    items = (
        db.query(ItemCatalogo)
        .join(Catalogo, ItemCatalogo.catalogo == Catalogo.identificador)
        .filter(Catalogo.subasta == id)
        .order_by(ItemCatalogo.identificador)
        .all()
    )
    return [item_to_dict(item, db) for item in items]


@router.get("/{id}/estado")
def get_estado(id: int, db: Session = Depends(get_db)):
    s = db.query(Subasta).filter(Subasta.identificador == id).first()
    if not s:
        raise HTTPException(404, "Subasta no encontrada")
    return {"estado": subasta_estado_service.estado_efectivo(id, db)}


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


@router.patch("/{id}/estado")
def update_estado(id: int, body: SubastaEstadoUpdate, db: Session = Depends(get_db)):
    s = db.query(Subasta).filter(Subasta.identificador == id).first()
    if not s:
        raise HTTPException(404, "Subasta no encontrada")

    rev = db.query(SubastaRevision).filter(SubastaRevision.subasta == id).first()
    if rev and rev.estado not in ("aprobada",):
        raise HTTPException(400, detail={"message": "La subasta debe estar aprobada", "code": "NOT_APPROVED"})

    # Mapear el estado pedido a la transición real de la máquina de estados:
    # 'abierta' -> iniciar (crea sesión + timer + estado_subasta='iniciada')
    # 'cerrada' -> finalizar (borra sesión + estado_subasta='finalizada')
    estado_admin = db.query(SubastaEstadoAdmin).filter(SubastaEstadoAdmin.subasta == id).first()
    if not estado_admin:
        subasta_estado_service.crear_estado_pendiente(id, db)

    if body.estado == "abierta":
        subasta_estado_service.iniciar_subasta(id, db)
    elif body.estado == "cerrada":
        subasta_estado_service.finalizar_subasta(id, db)
    else:
        s.estado = body.estado

    db.commit()
    db.refresh(s)
    return subasta_service.enrich(s, db)


@router.get("/{id}/sesion")
def get_sesion(id: int, db: Session = Depends(get_db)):
    sesion = db.query(SubastaSesion).filter(SubastaSesion.subasta == id).first()
    if not sesion:
        raise HTTPException(404, "Sin sesión activa")
    return _build_sesion_response(sesion)
