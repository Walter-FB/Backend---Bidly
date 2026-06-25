import base64
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.cliente import Cliente
from app.models.persona import Persona
from app.models.credencial import Credencial
from app.models.medio_pago import MedioPago
from app.models.dni_verificacion import DniVerificacion
from app.models.empleado import EMPLEADO_SISTEMA
from app.schemas.cliente import (
    ClienteCreate, CategoriaUpdate, AdmitidoUpdate,
    MedioPagoCreate, MedioPagoResponse, ClienteResponse,
)

router = APIRouter()

TIPO_MAP = {
    "tarjeta": "tarjeta", "TARJETA": "tarjeta",
    "cuenta": "cuenta", "CUENTA": "cuenta",
    "cheque": "cheque", "CHEQUE": "cheque",
}


def _normalizar_tipo(tipo: str) -> str:
    return TIPO_MAP.get(tipo, tipo.lower())


def _normalizar_vencimiento(v: str | None) -> str | None:
    if not v:
        return v
    v = v.strip()
    if "/" in v:
        parts = v.split("/")
        if len(parts) == 2:
            mes, anio = parts
            if len(anio) == 4:
                return f"{mes}/{anio[2:]}"
    return v


def _enrich_cliente(c: Cliente, db: Session) -> dict:
    data = {col.name: getattr(c, col.name) for col in c.__table__.columns}
    persona = db.query(Persona).filter(Persona.identificador == c.identificador).first()
    cred    = db.query(Credencial).filter(Credencial.cliente == c.identificador).first()
    data["nombre"] = persona.nombre if persona else None
    data["email"]  = cred.email if cred else None
    return data


@router.post("/", status_code=201)
def crear_cliente(body: ClienteCreate, db: Session = Depends(get_db)):
    verificador = body.verificador or EMPLEADO_SISTEMA
    c = Cliente(
        identificador=body.identificador,
        numeropais=body.numeroPais,
        admitido="no",
        categoria="comun",
        verificador=verificador,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return _enrich_cliente(c, db)


@router.get("/{id}")
def get_cliente(id: int, db: Session = Depends(get_db)):
    c = db.query(Cliente).filter(Cliente.identificador == id).first()
    if not c:
        raise HTTPException(404, "Cliente no encontrado")
    return _enrich_cliente(c, db)


@router.patch("/{id}/categoria")
def update_categoria(id: int, body: CategoriaUpdate, db: Session = Depends(get_db)):
    c = db.query(Cliente).filter(Cliente.identificador == id).first()
    if not c:
        raise HTTPException(404, "Cliente no encontrado")
    c.categoria = body.categoria
    db.commit()
    db.refresh(c)
    return _enrich_cliente(c, db)


@router.patch("/{id}/admitido")
def update_admitido(id: int, body: AdmitidoUpdate, db: Session = Depends(get_db)):
    c = db.query(Cliente).filter(Cliente.identificador == id).first()
    if not c:
        raise HTTPException(404, "Cliente no encontrado")
    c.admitido = body.admitido
    db.commit()
    db.refresh(c)
    return _enrich_cliente(c, db)


@router.get("/{id}/medios-pago", response_model=List[MedioPagoResponse])
def get_medios_pago(id: int, db: Session = Depends(get_db)):
    return db.query(MedioPago).filter(MedioPago.cliente == id).all()


@router.post("/{id}/medios-pago", response_model=MedioPagoResponse, status_code=201)
def add_medio_pago(id: int, body: MedioPagoCreate, db: Session = Depends(get_db)):
    mp = MedioPago(
        cliente=id,
        tipo=_normalizar_tipo(body.tipo),
        numerotarjeta=body.numeroTarjeta,
        vencimiento=_normalizar_vencimiento(body.vencimiento),
        titular=body.titular,
        numerocuenta=body.numeroCuenta,
        banco=body.banco,
        numerocheque=body.numeroCheque,
        montocheque=body.montoCheque,
        verificado=body.verificado or "no",
    )
    db.add(mp)
    db.commit()
    db.refresh(mp)

    from app.services import notificacion_service
    tipo_normalizado = _normalizar_tipo(body.tipo)
    nombre_tipo = "tarjeta" if tipo_normalizado == "tarjeta" else "cuenta bancaria" if tipo_normalizado == "cuenta" else "medio de pago"
    notificacion_service.crear(id, "medio_pago_agregado", f"Se agregó un {nombre_tipo} a tu cuenta", db)
    db.commit()

    return mp


@router.post("/{id}/dni-fotos")
async def upload_dni(
    id: int,
    frente: UploadFile = File(...),
    dorso: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    frente_bytes = await frente.read()
    dorso_bytes  = await dorso.read()

    dni = DniVerificacion(
        clienteid=id,
        fotofrente=base64.b64encode(frente_bytes).decode(),
        fotodorso=base64.b64encode(dorso_bytes).decode(),
        creadoen=datetime.utcnow(),
    )
    db.add(dni)
    db.commit()
    return {}
