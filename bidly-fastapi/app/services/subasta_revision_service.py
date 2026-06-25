from datetime import datetime
from sqlalchemy.orm import Session
from app.models.subasta_revision import SubastaRevision
from app.models.subasta import Subasta


def registrar_nueva(subasta: Subasta, solicitante_id: int | None, db: Session) -> SubastaRevision:
    revision = SubastaRevision(
        subasta=subasta.identificador,
        solicitante=solicitante_id,
        estado="pendiente",
        fechasolicitud=datetime.utcnow(),
    )
    db.add(revision)
    db.flush()
    return revision


def listar(estado: str | None, db: Session) -> list[SubastaRevision]:
    q = db.query(SubastaRevision)
    if estado == "pendiente":
        q = q.filter(SubastaRevision.estado == "pendiente")
    elif estado == "pausada":
        q = q.filter(SubastaRevision.estado == "pausada")
    else:
        q = q.filter(SubastaRevision.estado.in_(["pendiente", "aprobada", "pausada"]))
    return q.order_by(SubastaRevision.fechasolicitud.desc()).all()


def contar_pendientes(db: Session) -> int:
    return db.query(SubastaRevision).filter(SubastaRevision.estado == "pendiente").count()


def filtrar_visibles_publico(subastas: list[Subasta], db: Session) -> list[Subasta]:
    aprobadas = {
        r.subasta
        for r in db.query(SubastaRevision).filter(SubastaRevision.estado == "aprobada").all()
    }
    return [s for s in subastas if s.identificador in aprobadas]
