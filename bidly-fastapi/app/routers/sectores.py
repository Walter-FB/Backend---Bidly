"""Sectores/regiones de la empresa. Agrupan empleados y subastadores."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.sector import Sector
from app.models.empleado import Empleado
from app.models.persona import Persona
from app.models.subastador import Subastador

router = APIRouter()


def _to_dict(s: Sector, db: Session) -> dict:
    resp = db.query(Persona).filter(Persona.identificador == s.responsablesector).first() if s.responsablesector else None
    n_emp = db.query(Empleado).filter(Empleado.sector == s.identificador).count()
    return {
        "identificador": s.identificador,
        "nombre": s.nombresector,
        "codigo": s.codigosector,
        "responsable": resp.nombre if resp else None,
        "empleados": n_emp,
    }


@router.get("")
@router.get("/")
def listar(db: Session = Depends(get_db)):
    return [_to_dict(s, db) for s in db.query(Sector).order_by(Sector.identificador).all()]


@router.get("/{id}/subastadores")
def subastadores_del_sector(id: int, db: Session = Depends(get_db)):
    s = db.query(Sector).filter(Sector.identificador == id).first()
    if not s:
        raise HTTPException(404, "Sector no encontrado")
    # La relación subastador↔sector es por región (subastadores.region = nombre del sector).
    subs = db.query(Subastador).filter(Subastador.region == s.nombresector).all()
    out = []
    for sub in subs:
        p = db.query(Persona).filter(Persona.identificador == sub.identificador).first()
        out.append({"identificador": sub.identificador, "nombre": p.nombre if p else None,
                    "matricula": sub.matricula, "region": sub.region})
    return out
