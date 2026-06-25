from datetime import datetime
from sqlalchemy.orm import Session
from app.models.subasta_estado_admin import SubastaEstadoAdmin
from app.models.subasta import Subasta
from app.models.subasta_sesion import SubastaSesion


def crear_estado_pendiente(subasta_id: int, db: Session) -> None:
    admin = SubastaEstadoAdmin(
        subasta=subasta_id,
        estado="pendiente",
        estado_subasta="pendiente",
        alguna_vez_abierta=False,
    )
    db.add(admin)
    db.flush()


def pasar_a_esperando(subasta_id: int, db: Session) -> None:
    admin = db.query(SubastaEstadoAdmin).filter(SubastaEstadoAdmin.subasta == subasta_id).first()
    if not admin:
        raise ValueError(f"Sin estado admin para subasta {subasta_id}")
    admin.estado_subasta = "esperando"
    db.flush()


def iniciar_subasta(subasta_id: int, db: Session) -> None:
    from app.services import subasta_sesion_service

    admin = db.query(SubastaEstadoAdmin).filter(SubastaEstadoAdmin.subasta == subasta_id).first()
    if not admin:
        raise ValueError(f"Sin estado admin para subasta {subasta_id}")

    now = datetime.utcnow()
    admin.estado_subasta      = "iniciada"
    admin.alguna_vez_abierta  = True
    admin.fecha_apertura      = admin.fecha_apertura or now
    admin.fecha_inicio_real   = now

    s = db.query(Subasta).filter(Subasta.identificador == subasta_id).first()
    if s:
        s.estado = "abierta"

    subasta_sesion_service.iniciar_sesion(subasta_id, db)
    db.flush()


def finalizar_subasta(subasta_id: int, db: Session) -> None:
    admin = db.query(SubastaEstadoAdmin).filter(SubastaEstadoAdmin.subasta == subasta_id).first()
    if admin:
        admin.estado_subasta     = "finalizada"
        admin.fecha_finalizacion = datetime.utcnow()

    s = db.query(Subasta).filter(Subasta.identificador == subasta_id).first()
    if s:
        s.estado = "cerrada"

    db.query(SubastaSesion).filter(SubastaSesion.subasta == subasta_id).delete()
    db.flush()


def estado_subasta(subasta_id: int, db: Session) -> str:
    admin = db.query(SubastaEstadoAdmin).filter(SubastaEstadoAdmin.subasta == subasta_id).first()
    return admin.estado_subasta if admin else "pendiente"


def estado_efectivo(subasta_id: int, db: Session) -> str:
    est = estado_subasta(subasta_id, db)
    return "abierta" if est == "iniciada" else "cerrada"
