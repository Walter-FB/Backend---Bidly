from datetime import datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.config import settings
from app.models.registro_subasta import RegistroDeSubasta
from app.models.registro_pago import RegistroPago
from app.models.reembolso import Reembolso
from app.models.entrega_venta import EntregaVenta
from app.models.subasta import Subasta
from app.models.persona import Persona
from app.models.credencial import Credencial
from app.schemas.registro_subasta import RegistroCreate, PagarRequest, ReembolsoUpdate, EntregaRequest
from app.services import subasta_service

router = APIRouter()


def _enrich_registro(r: RegistroDeSubasta, db: Session) -> dict:
    pago     = db.query(RegistroPago).filter(RegistroPago.registro == r.identificador).first()
    ree      = db.query(Reembolso).filter(Reembolso.registro == r.identificador).first()
    entrega  = db.query(EntregaVenta).filter(EntregaVenta.registro == r.identificador).first()

    subasta_obj = db.query(Subasta).filter(Subasta.identificador == r.subasta).first()
    persona = db.query(Persona).filter(Persona.identificador == r.cliente).first()
    cred    = db.query(Credencial).filter(Credencial.cliente == r.cliente).first()

    return {
        "identificador": r.identificador,
        "subastaId": r.subasta,
        "subasta": subasta_service.enrich(subasta_obj, db) if subasta_obj else {"identificador": r.subasta},
        "duenio": r.duenio,
        "producto": r.producto,
        "clienteId": r.cliente,
        "cliente": {
            "identificador": r.cliente,
            "nombre": persona.nombre if persona else None,
            "email": cred.email if cred else None,
        },
        "importe": r.importe,
        "comision": r.comision,
        "estadoPago":     pago.estado if pago else "pendiente",
        "medioPago":      pago.medio_pago if pago else None,
        "importeTotal":   float(pago.importe_total) if pago and pago.importe_total else None,
        "fechaPago":      pago.fecha_pago.isoformat() if pago and pago.fecha_pago else None,
        "reembolsada":    ree.reembolsada if ree else "no",
        "tipoEntrega":    entrega.tipo_entrega if entrega else None,
        "costoEnvio":     float(entrega.costo_envio) if entrega and entrega.costo_envio else 0,
        "costoEnvioConfig": settings.COSTO_ENVIO_PESOS,  # valor actual de config, siempre devuelto
    }


@router.post("", status_code=201)
@router.post("/", status_code=201)
def crear_registro(body: RegistroCreate, db: Session = Depends(get_db)):
    r = RegistroDeSubasta(**body.model_dump())
    db.add(r)
    db.commit()
    db.refresh(r)
    return _enrich_registro(r, db)


@router.get("/{id}")
def get_registro(id: int, db: Session = Depends(get_db)):
    r = db.query(RegistroDeSubasta).filter(RegistroDeSubasta.identificador == id).first()
    if not r:
        raise HTTPException(404, "Registro no encontrado")
    return _enrich_registro(r, db)


@router.get("/cliente/{cliente_id}")
def get_registros_cliente(cliente_id: int, db: Session = Depends(get_db)):
    registros = (
        db.query(RegistroDeSubasta)
        .filter(RegistroDeSubasta.cliente == cliente_id)
        .all()
    )
    return [_enrich_registro(r, db) for r in registros]


@router.get("/duenio/{duenio_id}")
def get_registros_duenio(duenio_id: int, db: Session = Depends(get_db)):
    registros = (
        db.query(RegistroDeSubasta)
        .filter(RegistroDeSubasta.duenio == duenio_id)
        .all()
    )
    return [_enrich_registro(r, db) for r in registros]


@router.get("/subasta/{subasta_id}")
def get_registros_subasta(subasta_id: int, db: Session = Depends(get_db)):
    registros = (
        db.query(RegistroDeSubasta)
        .filter(RegistroDeSubasta.subasta == subasta_id)
        .all()
    )
    return [_enrich_registro(r, db) for r in registros]


@router.post("/{id}/pagar")
def pagar(id: int, body: PagarRequest, db: Session = Depends(get_db)):
    r = db.query(RegistroDeSubasta).filter(RegistroDeSubasta.identificador == id).first()
    if not r:
        raise HTTPException(404, "Registro no encontrado")

    pago = db.query(RegistroPago).filter(RegistroPago.registro == id).first()
    if pago:
        pago.estado      = "pagado"
        pago.medio_pago  = body.medioPagoId
        pago.fecha_pago  = datetime.utcnow()
    else:
        pago = RegistroPago(
            registro=id,
            estado="pagado",
            medio_pago=body.medioPagoId,
            fecha_pago=datetime.utcnow(),
        )
        db.add(pago)
    db.commit()
    return _enrich_registro(r, db)


@router.patch("/{id}/entrega")
def registrar_entrega(id: int, body: EntregaRequest, db: Session = Depends(get_db)):
    r = db.query(RegistroDeSubasta).filter(RegistroDeSubasta.identificador == id).first()
    if not r:
        raise HTTPException(404, "Registro no encontrado")
    if body.tipoEntrega not in ("retiro", "envio"):
        raise HTTPException(422, detail={"message": "tipoEntrega debe ser 'retiro' o 'envio'", "code": "INVALID_ENTREGA"})

    costo = Decimal(str(settings.COSTO_ENVIO_PESOS)) if body.tipoEntrega == "envio" else Decimal("0")

    entrega = db.query(EntregaVenta).filter(EntregaVenta.registro == id).first()
    if entrega:
        entrega.tipo_entrega = body.tipoEntrega
        entrega.costo_envio  = costo
    else:
        entrega = EntregaVenta(registro=id, tipo_entrega=body.tipoEntrega, costo_envio=costo)
        db.add(entrega)

    # Actualizar importe_total en registro_pago para reflejar el costo de envío
    pago = db.query(RegistroPago).filter(RegistroPago.registro == id).first()
    if pago:
        pago.importe_total = (r.importe or 0) + (r.comision or 0) + costo

    db.commit()
    return _enrich_registro(r, db)


@router.patch("/{id}/reembolso")
def update_reembolso(id: int, body: ReembolsoUpdate, db: Session = Depends(get_db)):
    r = db.query(RegistroDeSubasta).filter(RegistroDeSubasta.identificador == id).first()
    if not r:
        raise HTTPException(404, "Registro no encontrado")

    ree = db.query(Reembolso).filter(Reembolso.registro == id).first()
    if ree:
        ree.reembolsada = body.reembolsada
    else:
        ree = Reembolso(registro=id, reembolsada=body.reembolsada)
        db.add(ree)
    db.commit()

    if body.reembolsada == "si" and r.cliente:
        from app.services import notificacion_service
        notificacion_service.crear(r.cliente, "reembolso", "Tu pago fue reembolsado exitosamente", db)
        db.commit()

    return _enrich_registro(r, db)
