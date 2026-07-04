from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.pagos import Multa
from app.models.persona import Persona
from app.schemas.pagos import MultaUpdate
from app.services import multa_service

router = APIRouter()


@router.get("")
@router.get("/")
def listar_multas(db: Session = Depends(get_db)):
    """Todas las multas (para el panel interno), con nombre del cliente y estado
    (pagada / bloqueado / vencida = en justicia)."""
    multas = db.query(Multa).order_by(Multa.identificador.desc()).all()
    out = []
    for m in multas:
        p = db.query(Persona).filter(Persona.identificador == m.cliente).first()
        d = multa_service.multa_to_dict(m)
        d["clienteNombre"] = p.nombre if p else None
        out.append(d)
    return out


@router.get("/cliente/{cliente_id}")
def get_multas_cliente(cliente_id: int, db: Session = Depends(get_db)):
    multas = (
        db.query(Multa)
        .filter(Multa.cliente == cliente_id)
        .order_by(Multa.identificador.desc())
        .all()
    )
    return [multa_service.multa_to_dict(m) for m in multas]


@router.get("/cliente/{cliente_id}/estado")
def get_estado_sancion(cliente_id: int, db: Session = Depends(get_db)):
    return multa_service.estado_sancion(cliente_id, db)


@router.get("/{id}")
def get_multa(id: int, db: Session = Depends(get_db)):
    m = db.query(Multa).filter(Multa.identificador == id).first()
    if not m:
        raise HTTPException(404, "Multa no encontrada")
    return multa_service.multa_to_dict(m)


@router.patch("/{id}")
def update_multa(id: int, body: MultaUpdate, db: Session = Depends(get_db)):
    m = db.query(Multa).filter(Multa.identificador == id).first()
    if not m:
        raise HTTPException(404, "Multa no encontrada")
    m.pagada = body.pagada
    db.commit()
    db.refresh(m)
    return multa_service.multa_to_dict(m)


@router.post("/{id}/vencer")
def vencer_multa_demo(id: int, db: Session = Depends(get_db)):
    """[DEMO] Adelanta el vencimiento de la multa (fecha límite al pasado) para
    mostrar la derivación a la justicia sin esperar las 72hs reales. NO cambia la
    lógica: en producción el plazo sigue siendo de 72hs."""
    m = db.query(Multa).filter(Multa.identificador == id).first()
    if not m:
        raise HTTPException(404, "Multa no encontrada")
    if m.pagada == "si":
        raise HTTPException(409, detail={"message": "La multa ya está pagada", "code": "YA_PAGADA"})
    m.fecha_limite = datetime.utcnow() - timedelta(hours=1)
    db.commit()
    db.refresh(m)
    return multa_service.multa_to_dict(m)
