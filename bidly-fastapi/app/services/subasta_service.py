"""Subastas: enriquecido para el front y adjudicación de ítems.

Sin máquina de estados en vivo: una subasta usa directamente `subastas.estado`
('abierta' | 'cerrada'), como en la DDL del profe. Sin sesión ni timers (eso se
quemó). Sí conserva moneda dual (subasta_moneda) y, al cerrar, genera el payout al
dueño, la notificación al ganador y la fila de registro_pago pendiente.
"""
from decimal import Decimal
from sqlalchemy.orm import Session

from app.models.subasta import Subasta
from app.models.subasta_moneda import SubastaMoneda
from app.models.item_catalogo import ItemCatalogo
from app.models.catalogo import Catalogo
from app.models.producto import Producto
from app.models.asistente import Asistente
from app.models.puja import Puja
from app.models.registro_subasta import RegistroDeSubasta
from app.models.pagos import RegistroPago, Reembolso


def _moneda(subasta_id: int, db: Session) -> str:
    sm = db.query(SubastaMoneda).filter(SubastaMoneda.subasta == subasta_id).first()
    return sm.moneda if sm else "pesos"


def _ensure_duenio(persona_id: int, db: Session) -> None:
    """Garantiza una fila en `duenios` para el comprador antes de asignarle un
    producto (productos.duenio es FK NOT NULL a duenios). Un postor puede no ser
    dueño todavía; al ganar un bien pasa a serlo."""
    from sqlalchemy import func
    from app.models.duenio import Duenio
    from app.models.empleado import Empleado, EMPLEADO_SISTEMA
    if db.query(Duenio).filter(Duenio.identificador == persona_id).first():
        return
    emp = db.query(Empleado).order_by(func.random()).first()
    db.add(Duenio(
        identificador=persona_id,
        verificacionfinanciera="no",
        verificacionjudicial="no",
        calificacionriesgo=3,
        verificador=emp.identificador if emp else EMPLEADO_SISTEMA,
    ))
    db.flush()


def enrich(subasta: Subasta, db: Session) -> dict:
    data: dict = {col.name: getattr(subasta, col.name) for col in subasta.__table__.columns}
    data["moneda"] = _moneda(subasta.identificador, db)

    items = (
        db.query(ItemCatalogo)
        .join(Catalogo, ItemCatalogo.catalogo == Catalogo.identificador)
        .filter(Catalogo.subasta == subasta.identificador)
        .all()
    )
    data["totalItems"]      = len(items)
    data["itemsPendientes"] = sum(1 for i in items if i.subastado == "no")
    precios = [i.preciobase for i in items if i.preciobase is not None]
    data["precioBase"] = min(precios) if precios else None

    first_item = items[0] if items else None
    if first_item:
        prod = db.query(Producto).filter(Producto.identificador == first_item.producto).first()
        data["titulo"] = prod.descripcioncatalogo if prod else None
    else:
        data["titulo"] = None

    data["totalAsistentes"] = (
        db.query(Asistente).filter(Asistente.subasta == subasta.identificador).count()
    )
    return data


def enrich_all(subastas: list[Subasta], db: Session) -> list[dict]:
    return [enrich(s, db) for s in subastas]


def _premium_de(producto_id, valor_base, db: Session) -> Decimal:
    """Costo de la Cobertura Premium Bidly (5% del valor base) si el dueño la
    contrató al aceptar la propuesta; 0 si no."""
    from app.models.admision import Admision
    adm = (
        db.query(Admision)
        .filter(Admision.producto == producto_id)
        .order_by(Admision.identificador.desc())
        .first()
    )
    if adm and getattr(adm, "garantia_premium", "no") == "si":
        return Decimal(str(valor_base or 0)) * Decimal("0.05")
    return Decimal("0")


def _comprar_por_empresa(item: ItemCatalogo, db: Session) -> None:
    """Nadie pujó: la empresa compra el bien al valor base y se paga al dueño
    (payout origen='empresa'). No hay comprador, así que no se crea registroDeSubasta."""
    from app.services import payout_service, notificacion_service
    prod = db.query(Producto).filter(Producto.identificador == item.producto).first()
    if not prod or payout_service.existe_payout(item.producto, db):
        return
    catalogo = db.query(Catalogo).filter(Catalogo.identificador == item.catalogo).first()
    payout = payout_service.crear_payout(
        duenio_id=prod.duenio,
        producto_id=item.producto,
        subasta_id=catalogo.subasta if catalogo else None,
        importe_bruto=item.preciobase,
        comision=item.comision,
        origen="empresa",
        db=db,
        premium=_premium_de(item.producto, item.preciobase, db),
    )
    notificacion_service.crear(
        prod.duenio, "payout",
        f"Nadie pujó tu bien: la empresa lo compró al valor base. "
        f"Se te acreditarán ${payout.importe_neto} en tu cuenta declarada.",
        db,
    )


def adjudicar_item(item_id: int, db: Session) -> ItemCatalogo:
    """Cierra un ítem:
      - con pujas → el mejor postor gana: registroDeSubasta (importe + comisión),
        pujos.ganador='si', payout al dueño (neto = puja − comisión), registro_pago
        pendiente + reembolso, y notificación al ganador con el desglose a pagar.
      - sin pujas → la empresa compra al valor base y se genera el payout al dueño.
    """
    from app.services import payout_service, notificacion_service
    item = (
        db.query(ItemCatalogo)
        .with_for_update()
        .filter(ItemCatalogo.identificador == item_id)
        .first()
    )
    if not item or item.subastado == "si":
        return item

    catalogo_item = db.query(Catalogo).filter(Catalogo.identificador == item.catalogo).first()
    subasta_id = catalogo_item.subasta if catalogo_item else None

    puja_ganadora = (
        db.query(Puja)
        .filter(Puja.item == item_id)
        .order_by(Puja.importe.desc())
        .first()
    )
    item.subastado = "si"

    if not puja_ganadora:
        _comprar_por_empresa(item, db)
        _cerrar_si_completa(subasta_id, db)
        db.flush()
        return item

    puja_ganadora.ganador = "si"
    asistente = db.query(Asistente).filter(Asistente.identificador == puja_ganadora.asistente).first()
    catalogo  = db.query(Catalogo).filter(Catalogo.identificador == item.catalogo).first()
    prod      = db.query(Producto).filter(Producto.identificador == item.producto).first()

    registro = RegistroDeSubasta(
        subasta=catalogo.subasta if catalogo else None,
        duenio=prod.duenio if prod else None,
        producto=item.producto,
        cliente=asistente.cliente if asistente else None,
        importe=puja_ganadora.importe,
        comision=item.comision,
    )
    db.add(registro)
    db.flush()

    # Pago de la compra: nace pendiente (el ganador paga después) + reembolso 'no'.
    importe_total = (puja_ganadora.importe or 0) + (item.comision or 0)
    db.add(RegistroPago(registro=registro.identificador, estado="pendiente", importe_total=importe_total))
    db.add(Reembolso(registro=registro.identificador, reembolsada="no"))

    # Pago al dueño (payout): neto = puja − comisión, a acreditar en su cuenta a la vista.
    if prod and not payout_service.existe_payout(item.producto, db):
        payout_service.crear_payout(
            duenio_id=prod.duenio,
            producto_id=item.producto,
            subasta_id=catalogo.subasta if catalogo else None,
            importe_bruto=puja_ganadora.importe,
            comision=item.comision,
            origen="venta",
            db=db,
            # El premium (5%) se calcula sobre el valor base, no sobre lo pujado.
            premium=_premium_de(item.producto, item.preciobase, db),
        )

    if asistente:
        notificacion_service.crear(
            asistente.cliente, "ganaste",
            f"¡Ganaste el ítem! Pujado ${puja_ganadora.importe} + comisión ${item.comision} = "
            f"${importe_total}. El costo de envío a tu dirección declarada se suma al pagar "
            "(o retirás en persona y perdés el seguro).",
            db,
        )
        # La actividad (ganar) puede mejorar la categoría del comprador. Cada 2
        # subastas ganadas sube un escalón (y con 3+ medios + 1 ganada → platino).
        from app.services import categoria_service
        nueva_cat = categoria_service.recalcular(asistente.cliente, db)
        if nueva_cat:
            notificacion_service.crear(
                asistente.cliente, "categoria",
                f"¡Subiste de categoría por tu actividad! Ahora sos {nueva_cat.upper()}.", db)

    # El comprador pasa a ser el nuevo dueño de la pieza (registración del nuevo
    # dueño). Se hace DESPUÉS del payout, que se acredita al dueño original (el
    # vendedor). El registroDeSubasta ya guardó al vendedor como `duenio`.
    if prod and asistente and asistente.cliente:
        _ensure_duenio(asistente.cliente, db)
        prod.duenio = asistente.cliente
        prod.disponible = "no"  # vendido: ya no está disponible para otro catálogo

    # Si con este ítem se agotó el catálogo, la subasta se cierra sola.
    _cerrar_si_completa(subasta_id, db)
    db.flush()
    return item


def _cerrar_si_completa(subasta_id, db: Session) -> None:
    """Si no quedan ítems pendientes, marca la subasta 'cerrada' (así deja de
    figurar como en vivo/abierta)."""
    if not subasta_id:
        return
    pendientes = (
        db.query(ItemCatalogo)
        .join(Catalogo, ItemCatalogo.catalogo == Catalogo.identificador)
        .filter(Catalogo.subasta == subasta_id, ItemCatalogo.subastado == "no")
        .count()
    )
    if pendientes == 0:
        s = db.query(Subasta).filter(Subasta.identificador == subasta_id).first()
        if s and s.estado != "cerrada":
            s.estado = "cerrada"


def reabrir_items(subasta_id: int, db: Session) -> None:
    """Al abrir la puja, los ítems que NO tienen un ganador real (los que compró la
    empresa por falta de pujas, o que quedaron adjudicados sin venta) vuelven a estar
    disponibles para pujar. Los ítems con ganador real (puja ganadora) NO se tocan.

    Así, abrir una subasta siempre la deja pujable — evita que quede 'en vivo' pero
    sin nada para ofertar."""
    from app.models.pagos import Payout
    items = (
        db.query(ItemCatalogo)
        .join(Catalogo, ItemCatalogo.catalogo == Catalogo.identificador)
        .filter(Catalogo.subasta == subasta_id)
        .all()
    )
    for it in items:
        if it.subastado != "si":
            continue
        gano = (
            db.query(Puja)
            .filter(Puja.item == it.identificador, Puja.ganador == "si")
            .first()
        )
        if gano:
            continue  # venta real a un postor → no se reabre
        it.subastado = "no"
        # Deshacer la "compra por la empresa" de ese bien (ya no la compró).
        db.query(Payout).filter(Payout.producto == it.producto, Payout.origen == "empresa").delete()
    db.flush()


def cerrar_subasta(subasta_id: int, db: Session) -> None:
    """Cierra la subasta: adjudica todos los ítems pendientes y la marca 'cerrada'."""
    pendientes = (
        db.query(ItemCatalogo)
        .join(Catalogo, ItemCatalogo.catalogo == Catalogo.identificador)
        .filter(Catalogo.subasta == subasta_id, ItemCatalogo.subastado == "no")
        .all()
    )
    for item in pendientes:
        adjudicar_item(item.identificador, db)

    subasta = db.query(Subasta).filter(Subasta.identificador == subasta_id).first()
    if subasta:
        subasta.estado = "cerrada"
    db.flush()
