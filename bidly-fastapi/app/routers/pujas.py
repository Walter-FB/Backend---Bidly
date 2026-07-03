"""Pujas (ofertas). Subasta dinámica ascendente.

Reglas de la consigna:
 - Solo se puja en una subasta 'abierta' y en un ítem no subastado.
 - El postor debe estar inscripto (asistente) y su categoría debe ser >= la de la subasta.
 - Mínimo  = mejor oferta + 1% del valor base (o el valor base en la primera puja).
 - Máximo  = mejor oferta + 20% del valor base  (NO aplica a oro/platino).
 - Una puja por vez: se confirma la transacción antes de permitir otra (commit).
"""
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models.puja import Puja
from app.models.item_catalogo import ItemCatalogo
from app.models.catalogo import Catalogo
from app.models.asistente import Asistente
from app.models.cliente import Cliente
from app.models.subasta import Subasta
from app.schemas.puja import PujaCreate
from app.services import categoria_service, acceso_service, multa_service, saldo_service
from app.serializers import puja_to_dict

router = APIRouter()


@router.get("")
@router.get("/")
def listar_pujas(
    item: Optional[int] = None,
    asistente: Optional[int] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Puja)
    if item:
        q = q.filter(Puja.item == item)
    elif asistente:
        q = q.filter(Puja.asistente == asistente)
    return [puja_to_dict(p, db) for p in q.order_by(Puja.importe.desc()).all()]


@router.post("", status_code=201)
@router.post("/", status_code=201)
def colocar_puja(body: PujaCreate, db: Session = Depends(get_db)):
    asistente_id = body.asistente.identificador
    item_id      = body.item.identificador
    importe      = Decimal(str(body.importe))

    # Lock pesimista del ítem: garantiza el orden y una puja por vez.
    item = (
        db.query(ItemCatalogo)
        .with_for_update()
        .filter(ItemCatalogo.identificador == item_id)
        .first()
    )
    if not item:
        raise HTTPException(404, detail={"message": "Ítem no encontrado", "code": "NOT_FOUND"})
    if item.subastado == "si":
        raise HTTPException(409, detail={"message": "El ítem ya fue subastado", "code": "ITEM_SOLD"})

    catalogo = db.query(Catalogo).filter(Catalogo.identificador == item.catalogo).first()
    if not catalogo:
        raise HTTPException(404, detail={"message": "Catálogo no encontrado", "code": "NOT_FOUND"})
    subasta = db.query(Subasta).filter(Subasta.identificador == catalogo.subasta).first()
    if not subasta or subasta.estado != "abierta":
        raise HTTPException(409, detail={"message": "La subasta no está abierta", "code": "AUCTION_CLOSED"})

    asistente = db.query(Asistente).filter(Asistente.identificador == asistente_id).first()
    if not asistente or asistente.subasta != subasta.identificador:
        raise HTTPException(403, detail={"message": "No estás inscripto en esta subasta", "code": "FORBIDDEN"})

    cliente = db.query(Cliente).filter(Cliente.identificador == asistente.cliente).first()
    categoria = cliente.categoria if cliente else "comun"
    if not categoria_service.puede_acceder(categoria, subasta.categoria):
        raise HTTPException(403, detail={
            "message": "Tu categoría no habilita esta subasta", "code": "CATEGORIA_INSUFICIENTE"})

    # Gates de features restauradas: para pujar el postor necesita al menos un medio
    # de pago verificado, no tener multas impagas (ni estar derivado a la justicia) y
    # no superar el límite de saldo de sus medios (incluye el monto del cheque).
    cliente_id = asistente.cliente
    acceso_service.validar_puede_pujar(cliente_id, db)
    multa_service.verificar_puede_participar(cliente_id, db)
    saldo_service.validar_puja(cliente_id, importe, db, item_id=item_id)

    # Mínimo / máximo respecto de la mejor oferta y el valor base.
    ultima = (
        db.query(Puja).filter(Puja.item == item_id).order_by(Puja.importe.desc()).first()
    )
    precio_base = Decimal(str(item.preciobase))
    ultima_imp  = Decimal(str(ultima.importe)) if ultima else Decimal("0")

    minimo = max(ultima_imp + precio_base * Decimal("0.01"), precio_base)
    maximo = max(ultima_imp, precio_base) + precio_base * Decimal("0.20")

    if importe < minimo:
        raise HTTPException(422, detail={
            "message": "El importe está por debajo del mínimo aceptable",
            "code": "MIN_BID",
            "minimoAceptable": float(minimo), "maximoAceptable": float(maximo)})

    if not categoria_service.sin_tope_maximo(categoria) and importe > maximo:
        raise HTTPException(422, detail={
            "message": "El importe supera el máximo aceptable",
            "code": "MAX_BID",
            "minimoAceptable": float(minimo), "maximoAceptable": float(maximo)})

    puja = Puja(asistente=asistente_id, item=item_id, importe=importe, ganador="no")
    db.add(puja)
    db.commit()  # confirma la transacción antes de habilitar otra puja
    db.refresh(puja)
    return puja_to_dict(puja, db)


@router.get("/{item_id}/ganador")
def get_ganador(item_id: int, db: Session = Depends(get_db)):
    puja = db.query(Puja).filter(Puja.item == item_id, Puja.ganador == "si").first()
    return puja_to_dict(puja, db) if puja else None
