from datetime import datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List

from app.database import get_db
from app.models.puja import Puja
from app.models.pujo_fecha import PujoFecha
from app.models.item_catalogo import ItemCatalogo
from app.models.catalogo import Catalogo
from app.models.asistente import Asistente
from app.models.cliente import Cliente
from app.models.medio_pago import MedioPago
from app.models.subasta_estado_admin import SubastaEstadoAdmin
from app.schemas.puja import PujaCreate
from app.services import notificacion_service, subasta_sesion_service

router = APIRouter()


def _build_puja(p: Puja, db: Session) -> dict:
    data = {col.name: getattr(p, col.name) for col in p.__table__.columns}
    fecha = db.query(PujoFecha).filter(PujoFecha.pujo == p.identificador).first()
    data["fechaHora"] = fecha.fechahora if fecha else None
    return data


@router.get("/")
def listar_pujas(
    item: Optional[int] = None,
    asistente: Optional[int] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Puja)
    if item:
        q = q.filter(Puja.item == item).order_by(Puja.importe.desc())
    elif asistente:
        q = q.filter(Puja.asistente == asistente).order_by(Puja.importe.desc())
    else:
        q = q.order_by(Puja.importe.desc())
    return [_build_puja(p, db) for p in q.all()]


@router.post("/", status_code=201)
def colocar_puja(body: PujaCreate, db: Session = Depends(get_db)):
    asistente_id = body.asistente.identificador
    item_id      = body.item.identificador
    importe      = body.importe

    # Locking pesimista en el item
    item = (
        db.query(ItemCatalogo)
        .with_for_update()
        .filter(ItemCatalogo.identificador == item_id)
        .first()
    )
    if not item:
        raise HTTPException(404, detail={"message": "Item no encontrado", "code": "NOT_FOUND"})

    if item.subastado == "si":
        raise HTTPException(409, detail={"message": "El item ya fue subastado", "code": "ITEM_SOLD"})

    # Obtener subasta via catálogo
    catalogo = db.query(Catalogo).filter(Catalogo.identificador == item.catalogo).first()
    if not catalogo:
        raise HTTPException(404, detail={"message": "Catálogo no encontrado", "code": "NOT_FOUND"})

    subasta_id = catalogo.subasta

    # Verificar estado de subasta
    admin = db.query(SubastaEstadoAdmin).filter(SubastaEstadoAdmin.subasta == subasta_id).first()
    if not admin or admin.estado_subasta != "iniciada":
        raise HTTPException(409, detail={"message": "La subasta no está activa", "code": "AUCTION_CLOSED"})

    # Verificar item activo en sesión
    if not subasta_sesion_service.es_item_activo(subasta_id, item_id, db):
        raise HTTPException(409, detail={"message": "Este item no es el activo", "code": "ITEM_NOT_ACTIVE"})

    # Verificar asistente
    asistente = db.query(Asistente).filter(Asistente.identificador == asistente_id).first()
    if not asistente or asistente.subasta != subasta_id:
        raise HTTPException(403, detail={"message": "No estás inscripto en esta subasta", "code": "FORBIDDEN"})

    # Verificar medio de pago
    tiene_pago = db.query(MedioPago).filter(MedioPago.cliente == asistente.cliente).first()
    if not tiene_pago:
        raise HTTPException(422, detail={"message": "No tenés medios de pago registrados", "code": "NO_PAYMENT"})

    # Calcular mínimo y máximo
    ultima = (
        db.query(Puja)
        .filter(Puja.item == item_id)
        .order_by(Puja.importe.desc())
        .first()
    )
    precio_base = Decimal(str(item.preciobase))
    ultima_imp  = Decimal(str(ultima.importe)) if ultima else Decimal("0")

    minimo = max(ultima_imp + precio_base * Decimal("0.01"), precio_base)
    maximo = ultima_imp + precio_base * Decimal("0.20")

    if importe < minimo:
        raise HTTPException(
            422,
            detail={
                "message": "El importe está por debajo del mínimo aceptable",
                "error": "Bid below minimum",
                "code": "MIN_BID",
                "minimoAceptable": float(minimo),
                "maximoAceptable": float(maximo),
            },
        )

    cliente = db.query(Cliente).filter(Cliente.identificador == asistente.cliente).first()
    categoria = cliente.categoria if cliente else "comun"
    if categoria not in ("oro", "platino") and importe > maximo:
        raise HTTPException(
            422,
            detail={
                "message": "El importe supera el máximo aceptable",
                "error": "Bid above maximum",
                "code": "MAX_BID",
                "minimoAceptable": float(minimo),
                "maximoAceptable": float(maximo),
            },
        )

    # Insertar puja
    puja = Puja(asistente=asistente_id, item=item_id, importe=importe, ganador="no")
    db.add(puja)
    db.flush()

    fecha = PujoFecha(pujo=puja.identificador, fechahora=datetime.utcnow())
    db.add(fecha)

    # Reset timer
    subasta_sesion_service.reset_timer(subasta_id, db)

    db.commit()

    # Notificaciones post-commit
    notificacion_service.notificar_lider(asistente_id, importe, db)
    notificacion_service.notificar_desplazado(item_id, asistente_id, db)
    db.commit()

    return _build_puja(puja, db)


@router.get("/{item_id}/ganador")
def get_ganador(item_id: int, db: Session = Depends(get_db)):
    puja = (
        db.query(Puja)
        .filter(Puja.item == item_id, Puja.ganador == "si")
        .first()
    )
    if not puja:
        raise HTTPException(404, "No hay ganador aún")
    return _build_puja(puja, db)
