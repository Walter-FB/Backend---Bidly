"""Registro de venta (registroDeSubasta) + pago de la compra por el ganador.

Guarda importe + comisión + comprador + dueño + producto + subasta (DDL del profe)
y suma, sobre tablas de features, el pago (registro_pago), el reembolso (reembolsos)
y la multa por impago (multas). Moneda dual: una subasta en dólares no se cancela
con cheque.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.registro_subasta import RegistroDeSubasta
from app.models.pagos import RegistroPago, Reembolso, Multa, MedioPago
from app.models.subasta import Subasta
from app.models.subasta_moneda import SubastaMoneda
from app.models.persona import Persona
from app.models.credencial import Credencial
from app.schemas.registro_subasta import RegistroCreate, PagarRequest, ReembolsoUpdate
from app.services import subasta_service, multa_service, notificacion_service

router = APIRouter()


def _enrich_registro(r: RegistroDeSubasta, db: Session) -> dict:
    pago = db.query(RegistroPago).filter(RegistroPago.registro == r.identificador).first()
    ree  = db.query(Reembolso).filter(Reembolso.registro == r.identificador).first()

    # Multa asociada (si esta compra derivó en impago) a través de la puja ganadora.
    puja_ganadora = multa_service._puja_ganadora_registro(r, db)
    multa = (
        db.query(Multa).filter(Multa.pujo == puja_ganadora.identificador).first()
        if puja_ganadora else None
    )

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
        "estadoPago":   pago.estado if pago else "pendiente",
        "medioPago":    pago.medio_pago if pago else None,
        "importeTotal": float(pago.importe_total) if pago and pago.importe_total else None,
        "fechaPago":    pago.fecha_pago.isoformat() if pago and pago.fecha_pago else None,
        "envio":        float(pago.envio) if pago and pago.envio is not None else None,
        "direccionEnvio": pago.direccion_envio if pago else None,
        "retiroPersonal": pago.retiro_personal if pago else "no",
        "reembolsada":  ree.reembolsada if ree else "no",
        "multa":        multa_service.multa_to_dict(multa) if multa else None,
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
    registros = db.query(RegistroDeSubasta).filter(RegistroDeSubasta.cliente == cliente_id).all()
    return [_enrich_registro(r, db) for r in registros]


@router.get("/subasta/{subasta_id}")
def get_registros_subasta(subasta_id: int, db: Session = Depends(get_db)):
    registros = db.query(RegistroDeSubasta).filter(RegistroDeSubasta.subasta == subasta_id).all()
    return [_enrich_registro(r, db) for r in registros]


@router.post("/{id}/impago")
def declarar_impago(id: int, db: Session = Depends(get_db)):
    """El usuario no dispone de los fondos para cumplir con el pago: se genera la
    multa del 10% de lo ofertado y queda bloqueado hasta abonarla (72hs para
    presentar los fondos antes de derivar el caso a la justicia)."""
    r = db.query(RegistroDeSubasta).filter(RegistroDeSubasta.identificador == id).first()
    if not r:
        raise HTTPException(404, "Registro no encontrado")

    pago = db.query(RegistroPago).filter(RegistroPago.registro == id).first()
    if pago and pago.estado == "pagado":
        raise HTTPException(409, detail={"message": "La compra ya fue pagada", "code": "ALREADY_PAID"})

    # Evitar multas duplicadas para la misma compra.
    puja_ganadora = multa_service._puja_ganadora_registro(r, db)
    ya_existe = (
        db.query(Multa).filter(Multa.pujo == puja_ganadora.identificador).first()
        if puja_ganadora else None
    )
    if ya_existe:
        raise HTTPException(409, detail={"message": "Ya existe una multa para esta compra", "code": "MULTA_EXISTS"})

    if pago:
        pago.estado = "impago"
    else:
        pago = RegistroPago(
            registro=id,
            estado="impago",
            importe_total=(r.importe or 0) + (r.comision or 0),
        )
        db.add(pago)

    multa = multa_service.generar_multa_impago(r, db)
    db.commit()

    if r.cliente:
        notificacion_service.crear(
            r.cliente, "multa",
            f"No se pudo completar el pago. Se generó una multa de ${multa.importe}. "
            "Tenés 72hs para presentar los fondos antes de derivar el caso a la justicia.",
            db,
        )
        db.commit()

    return _enrich_registro(r, db)


@router.post("/{id}/pagar")
def pagar(id: int, body: PagarRequest, db: Session = Depends(get_db)):
    from decimal import Decimal

    r = db.query(RegistroDeSubasta).filter(RegistroDeSubasta.identificador == id).first()
    if not r:
        raise HTTPException(404, "Registro no encontrado")

    # Moneda: una subasta en dólares se cancela en dólares (transferencia o tarjeta
    # internacional), no con cheque.
    sm = db.query(SubastaMoneda).filter(SubastaMoneda.subasta == r.subasta).first()
    medio = db.query(MedioPago).filter(MedioPago.identificador == body.medioPagoId).first()
    if sm and sm.moneda == "dolares" and medio and medio.tipo == "cheque":
        raise HTTPException(422, detail={
            "message": "Una subasta en dólares debe cancelarse por transferencia o tarjeta internacional, no con cheque.",
            "code": "MONEDA_INCOMPATIBLE",
        })

    envio = Decimal("0") if body.retiroPersonal else Decimal(str(body.envio or 0))
    importe_total = Decimal(str(r.importe or 0)) + Decimal(str(r.comision or 0)) + envio

    pago = db.query(RegistroPago).filter(RegistroPago.registro == id).first()
    if not pago:
        pago = RegistroPago(registro=id)
        db.add(pago)
    pago.estado          = "pagado"
    pago.medio_pago      = body.medioPagoId
    pago.fecha_pago      = datetime.utcnow()
    pago.importe_total   = importe_total
    pago.envio           = envio
    pago.direccion_envio = None if body.retiroPersonal else body.direccionEnvio
    pago.retiro_personal = "si" if body.retiroPersonal else "no"
    db.commit()

    if body.retiroPersonal and r.cliente:
        # Al retirar en persona pierde la cobertura del seguro.
        notificacion_service.crear(
            r.cliente, "retiro",
            "Elegiste retiro personal: una vez retirado el bien perdés la cobertura del seguro.",
            db,
        )
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
        notificacion_service.crear(r.cliente, "reembolso", "Tu pago fue reembolsado exitosamente", db)
        db.commit()

    return _enrich_registro(r, db)
