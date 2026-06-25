from datetime import datetime
from sqlalchemy.orm import Session
from app.models.subasta_sesion import SubastaSesion
from app.models.item_catalogo import ItemCatalogo
from app.models.catalogo import Catalogo

TIMEOUT_SEGUNDOS = 1800


def obtener_sesion(subasta_id: int, db: Session) -> SubastaSesion | None:
    return db.query(SubastaSesion).filter(SubastaSesion.subasta == subasta_id).first()


def iniciar_sesion(subasta_id: int, db: Session) -> SubastaSesion | None:
    primer_item = _get_primer_item_pendiente(subasta_id, db)
    if not primer_item:
        return None

    now = datetime.utcnow()
    sesion = SubastaSesion(
        subasta=subasta_id,
        item_activo=primer_item.identificador,
        orden_actual=1,
        timer_desde=now,
        iniciada_en=now,
    )
    db.add(sesion)
    db.flush()
    return sesion


def avanzar_item(subasta_id: int, db: Session) -> SubastaSesion | None:
    sesion = db.query(SubastaSesion).filter(SubastaSesion.subasta == subasta_id).first()
    if not sesion:
        return None

    proximo = _get_proximo_item_pendiente(subasta_id, sesion.item_activo, db)
    if not proximo:
        from app.services import subasta_estado_service, notificacion_service
        subasta_estado_service.finalizar_subasta(subasta_id, db)
        notificacion_service.notificar_asistentes_subasta(
            subasta_id, "subasta_por_cerrar", "La subasta ha finalizado", db
        )
        return None

    sesion.item_activo  = proximo.identificador
    sesion.orden_actual = (sesion.orden_actual or 0) + 1
    sesion.timer_desde  = datetime.utcnow()
    db.flush()
    return sesion


def reset_timer(subasta_id: int, db: Session) -> None:
    sesion = db.query(SubastaSesion).filter(SubastaSesion.subasta == subasta_id).first()
    if sesion:
        sesion.timer_desde = datetime.utcnow()
        db.flush()


def es_item_activo(subasta_id: int, item_id: int, db: Session) -> bool:
    sesion = db.query(SubastaSesion).filter(SubastaSesion.subasta == subasta_id).first()
    return sesion is not None and sesion.item_activo == item_id


def segundos_restantes(sesion: SubastaSesion) -> int:
    if not sesion or not sesion.timer_desde:
        return 0
    elapsed = (datetime.utcnow() - sesion.timer_desde).total_seconds()
    return max(0, int(TIMEOUT_SEGUNDOS - elapsed))


def _get_primer_item_pendiente(subasta_id: int, db: Session) -> ItemCatalogo | None:
    return (
        db.query(ItemCatalogo)
        .join(Catalogo, ItemCatalogo.catalogo == Catalogo.identificador)
        .filter(Catalogo.subasta == subasta_id, ItemCatalogo.subastado == "no")
        .order_by(ItemCatalogo.identificador)
        .first()
    )


def _get_proximo_item_pendiente(
    subasta_id: int, item_actual_id: int, db: Session
) -> ItemCatalogo | None:
    return (
        db.query(ItemCatalogo)
        .join(Catalogo, ItemCatalogo.catalogo == Catalogo.identificador)
        .filter(
            Catalogo.subasta == subasta_id,
            ItemCatalogo.subastado == "no",
            ItemCatalogo.identificador != item_actual_id,
        )
        .order_by(ItemCatalogo.identificador)
        .first()
    )
