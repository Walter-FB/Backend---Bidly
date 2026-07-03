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
from app.services import notificacion_service, subasta_sesion_service, payout_service


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
        _comprar_por_empresa(item, db)
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
        _comprar_por_empresa(item, db)
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

    # Pago al dueño (payout): neto = puja − comisión, a acreditar en su cuenta a la vista.
    if prod and not payout_service.existe_payout(item.producto, db):
        payout_service.crear_payout(
            duenio_id=prod.duenio,
            producto_id=item.producto,
            subasta_id=catalogo.subasta if catalogo else None,
            importe_bruto=puja.importe,
            comision=item.comision,
            origen="venta",
            db=db,
        )

    if asistente:
        # Mensaje privado con el desglose a pagar (pujado + comisión + envío).
        total = (puja.importe or 0) + (item.comision or 0)
        notificacion_service.crear(
            asistente.cliente,
            "ganaste",
            f"¡Ganaste el ítem! Pujado ${puja.importe} + comisión ${item.comision} = ${total}. "
            "El costo de envío a tu dirección declarada se suma al pagar (o retirás en persona).",
            db,
        )
        # La actividad (ganar) puede mejorar la categoría.
        from app.services import categoria_service
        categoria_service.recalcular(asistente.cliente, db)

    db.flush()
    return item


def _comprar_por_empresa(item: ItemCatalogo, db: Session) -> None:
    """Nadie pujó: la empresa compra el bien al valor base y se paga al dueño."""
    if payout_service.existe_payout(item.producto, db):
        return
    catalogo = db.query(Catalogo).filter(Catalogo.identificador == item.catalogo).first()
    prod = db.query(Producto).filter(Producto.identificador == item.producto).first()
    if not prod:
        return
    payout = payout_service.crear_payout(
        duenio_id=prod.duenio,
        producto_id=item.producto,
        subasta_id=catalogo.subasta if catalogo else None,
        importe_bruto=item.preciobase,
        comision=item.comision,
        origen="empresa",
        db=db,
    )
    notificacion_service.crear(
        prod.duenio,
        "payout",
        f"Nadie pujó tu bien: la empresa lo compró al valor base. "
        f"Se te acreditarán ${payout.importe_neto} en tu cuenta declarada.",
        db,
    )


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
