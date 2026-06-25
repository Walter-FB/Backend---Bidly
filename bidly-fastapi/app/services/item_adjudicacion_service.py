from datetime import datetime
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.models.item_catalogo import ItemCatalogo
from app.models.puja import Puja
from app.models.catalogo import Catalogo
from app.models.asistente import Asistente
from app.models.producto import Producto
from app.models.registro_subasta import RegistroDeSubasta
from app.models.registro_pago import RegistroPago
from app.models.reembolso import Reembolso
from app.services import notificacion_service, subasta_sesion_service


def adjudicar_manual(item_id: int, db: Session) -> ItemCatalogo:
    item = db.query(ItemCatalogo).filter(ItemCatalogo.identificador == item_id).first()
    if not item:
        raise HTTPException(404, "Item no encontrado")

    puja_ganadora = (
        db.query(Puja)
        .filter(Puja.item == item_id)
        .order_by(Puja.importe.desc())
        .first()
    )

    if not puja_ganadora:
        item.subastado = "si"
        db.flush()
        return item

    return _adjudicar(item, puja_ganadora, db)


def finalizar_item(item_id: int, notificar: bool, db: Session) -> None:
    item = (
        db.query(ItemCatalogo)
        .with_for_update()
        .filter(ItemCatalogo.identificador == item_id)
        .first()
    )
    if not item or item.subastado == "si":
        return

    puja_ganadora = (
        db.query(Puja)
        .filter(Puja.item == item_id)
        .order_by(Puja.importe.desc())
        .first()
    )

    if not puja_ganadora:
        item.subastado = "si"
    else:
        _adjudicar(item, puja_ganadora, db)

    catalogo = db.query(Catalogo).filter(Catalogo.identificador == item.catalogo).first()
    if catalogo:
        subasta_sesion_service.avanzar_item(catalogo.subasta, db)
        _cerrar_subasta_si_corresponde(catalogo.subasta, db)

    db.flush()


def _adjudicar(item: ItemCatalogo, puja: Puja, db: Session) -> ItemCatalogo:
    puja.ganador  = "si"
    item.subastado = "si"

    asistente = db.query(Asistente).filter(Asistente.identificador == puja.asistente).first()
    catalogo  = db.query(Catalogo).filter(Catalogo.identificador == item.catalogo).first()
    prod      = db.query(Producto).filter(Producto.identificador == item.producto).first()

    registro = RegistroDeSubasta(
        subasta=catalogo.subasta if catalogo else None,
        duenio=prod.duenio if prod else None,
        producto=item.producto,
        cliente=asistente.cliente if asistente else None,
        importe=puja.importe,
        comision=item.comision,
    )
    db.add(registro)
    db.flush()

    importe_total = (puja.importe or 0) + (item.comision or 0)
    pago = RegistroPago(
        registro=registro.identificador,
        estado="pendiente",
        importe_total=importe_total,
    )
    db.add(pago)

    reembolso = Reembolso(registro=registro.identificador, reembolsada="no")
    db.add(reembolso)

    if asistente:
        notificacion_service.crear(
            asistente.cliente,
            "ganaste",
            f"¡Ganaste el item por ${puja.importe}!",
            db,
        )

    db.flush()
    return item


def _cerrar_subasta_si_corresponde(subasta_id: int, db: Session) -> None:
    from app.models.catalogo import Catalogo
    pendientes = (
        db.query(ItemCatalogo)
        .join(Catalogo, ItemCatalogo.catalogo == Catalogo.identificador)
        .filter(Catalogo.subasta == subasta_id, ItemCatalogo.subastado == "no")
        .count()
    )
    if pendientes == 0:
        from app.services import subasta_estado_service
        subasta_estado_service.finalizar_subasta(subasta_id, db)
