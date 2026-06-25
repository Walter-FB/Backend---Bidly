from datetime import datetime
from decimal import Decimal
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.models.subasta import Subasta
from app.models.subasta_moneda import SubastaMoneda
from app.models.subasta_estado_admin import SubastaEstadoAdmin
from app.models.subasta_revision import SubastaRevision
from app.models.subasta_sesion import SubastaSesion
from app.models.item_catalogo import ItemCatalogo
from app.models.catalogo import Catalogo
from app.models.producto import Producto
from app.models.asistente import Asistente

FASE_PENDIENTE  = "PENDIENTE"
FASE_PROGRAMADA = "PROGRAMADA"
FASE_EN_CURSO   = "EN_CURSO"
FASE_FINALIZADA = "FINALIZADA"
TIMEOUT_SEG = 1800


def enrich(subasta: Subasta, db: Session) -> dict:
    data: dict = {}
    for col in subasta.__table__.columns:
        data[col.name] = getattr(subasta, col.name)

    sm = db.query(SubastaMoneda).filter(SubastaMoneda.subasta == subasta.identificador).first()
    data["moneda"] = sm.moneda if sm else None

    admin = (
        db.query(SubastaEstadoAdmin)
        .filter(SubastaEstadoAdmin.subasta == subasta.identificador)
        .first()
    )
    data["estadoSubasta"]    = admin.estado_subasta if admin else "pendiente"
    data["algunaVezAbierta"] = admin.alguna_vez_abierta if admin else False
    data["fechaApertura"]    = admin.fecha_apertura if admin else None
    data["fechaInicioReal"]  = admin.fecha_inicio_real if admin else None

    rev = (
        db.query(SubastaRevision)
        .filter(SubastaRevision.subasta == subasta.identificador)
        .first()
    )
    data["revisionEstado"] = rev.estado if rev else None

    items = (
        db.query(ItemCatalogo)
        .join(Catalogo, ItemCatalogo.catalogo == Catalogo.identificador)
        .filter(Catalogo.subasta == subasta.identificador)
        .all()
    )
    data["totalItems"]      = len(items)
    data["itemsPendientes"] = sum(1 for i in items if i.subastado == "no")
    precios = [i.preciobase for i in items if i.preciobase is not None]
    data["precioBase"] = min(precios) if precios else None

    first_item = items[0] if items else None
    if first_item:
        prod = db.query(Producto).filter(Producto.identificador == first_item.producto).first()
        data["titulo"] = prod.descripcioncatalogo if prod else None
    else:
        data["titulo"] = None

    data["totalAsistentes"] = (
        db.query(Asistente)
        .filter(Asistente.subasta == subasta.identificador)
        .count()
    )

    sesion = (
        db.query(SubastaSesion)
        .filter(SubastaSesion.subasta == subasta.identificador)
        .first()
    )
    estado_sub = data["estadoSubasta"]

    if estado_sub == "finalizada":
        data["fase"]              = FASE_FINALIZADA
        data["segundosRestantes"] = 0
    elif estado_sub == "iniciada" and sesion:
        data["fase"] = FASE_EN_CURSO
        elapsed = (datetime.utcnow() - sesion.timer_desde).total_seconds()
        data["segundosRestantes"] = max(0, int(TIMEOUT_SEG - elapsed))
    elif estado_sub == "esperando":
        data["fase"]              = FASE_PROGRAMADA
        data["segundosRestantes"] = None
    else:
        data["fase"]              = FASE_PENDIENTE
        data["segundosRestantes"] = None

    return data


def enrich_all(subastas: list[Subasta], db: Session) -> list[dict]:
    return [enrich(s, db) for s in subastas]


def referencia_inactividad(subasta_id: int, db: Session) -> datetime:
    result = db.execute(
        text("""
            SELECT MAX(pf.fechahora)
            FROM pujo_fecha pf
            JOIN pujos p ON pf.pujo = p.identificador
            JOIN itemscatalogo ic ON p.item = ic.identificador
            JOIN catalogos c ON ic.catalogo = c.identificador
            WHERE c.subasta = :sid
        """),
        {"sid": subasta_id},
    ).scalar()

    if result:
        return result

    sesion = db.query(SubastaSesion).filter(SubastaSesion.subasta == subasta_id).first()
    return sesion.iniciada_en if sesion else datetime.utcnow()


def inactividad_vencida(subasta_id: int, now: datetime, db: Session) -> bool:
    ref = referencia_inactividad(subasta_id, db)
    return (now - ref).total_seconds() >= TIMEOUT_SEG
