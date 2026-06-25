from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models.subasta_revision import SubastaRevision
from app.schemas.subasta_revision import SubastaRevisionResponse, RechazarRequest
from app.services import subasta_estado_service, subasta_revision_service, notificacion_service

router = APIRouter()


@router.get("/")
def listar(estado: Optional[str] = None, db: Session = Depends(get_db)):
    return subasta_revision_service.listar(estado, db)


@router.get("/pendientes/count")
def contar_pendientes(db: Session = Depends(get_db)):
    return {"pendientes": subasta_revision_service.contar_pendientes(db)}


@router.patch("/{subasta_id}/aprobar")
def aprobar(subasta_id: int, db: Session = Depends(get_db)):
    from datetime import datetime
    rev = db.query(SubastaRevision).filter(SubastaRevision.subasta == subasta_id).first()
    if not rev:
        raise HTTPException(404, "Revisión no encontrada")
    rev.estado        = "aprobada"
    rev.fecharevision = datetime.utcnow()
    subasta_estado_service.pasar_a_esperando(subasta_id, db)
    db.commit()
    return {}


@router.patch("/{subasta_id}/pausar")
def pausar(subasta_id: int, db: Session = Depends(get_db)):
    rev = db.query(SubastaRevision).filter(SubastaRevision.subasta == subasta_id).first()
    if not rev:
        raise HTTPException(404, "Revisión no encontrada")
    rev.estado = "pausada"

    estado = subasta_estado_service.estado_subasta(subasta_id, db)
    if estado == "iniciada":
        subasta_estado_service.finalizar_subasta(subasta_id, db)
    else:
        from app.models.subasta import Subasta
        s = db.query(Subasta).filter(Subasta.identificador == subasta_id).first()
        if s:
            s.estado = "cerrada"

    db.commit()
    return {}


@router.patch("/{subasta_id}/rechazar")
def rechazar(subasta_id: int, body: RechazarRequest, db: Session = Depends(get_db)):
    from datetime import datetime
    rev = db.query(SubastaRevision).filter(SubastaRevision.subasta == subasta_id).first()
    if not rev:
        raise HTTPException(404, "Revisión no encontrada")
    rev.estado        = "rechazada"
    rev.fecharevision = datetime.utcnow()
    rev.observacion   = body.observacion

    estado = subasta_estado_service.estado_subasta(subasta_id, db)
    if estado == "iniciada":
        subasta_estado_service.finalizar_subasta(subasta_id, db)

    notificacion_service.notificar_asistentes_subasta(
        subasta_id, "subasta_rechazada",
        f"La subasta fue rechazada. {body.observacion or ''}".strip(),
        db,
    )
    db.commit()
    return {}
