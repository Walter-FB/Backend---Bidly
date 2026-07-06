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


def venta_modo(subasta_id: int, db: Session) -> str:
    """Modo de venta del catálogo: 'individual' (pieza por pieza, default) o
    'bloque' (única venta: el mejor postor se lleva todas las piezas)."""
    from app.models.venta_modo import SubastaVentaModo
    vm = db.query(SubastaVentaModo).filter(SubastaVentaModo.subasta == subasta_id).first()
    return vm.modo if (vm and vm.modo) else "individual"


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
    data["ventaModo"] = venta_modo(subasta.identificador, db)

    # Reloj del remate: si está abierta, exponer cuánto falta del ítem activo
    # (permite mostrar el countdown en el listado, no solo en el detalle).
    # OJO: estado() puede adjudicar ítems (escribe). Lo hacemos dentro de un
    # SAVEPOINT para que, si el remate de ESTA subasta falla (dato inconsistente,
    # etc.), no aborte la transacción entera ni tumbe todo el listado: se revierte
    # solo este ítem y la subasta se muestra igual, sin countdown.
    data["itemActivoId"] = None
    data["segundosRestantes"] = None
    if subasta.estado == "abierta":
        from app.services import remate_service
        try:
            with db.begin_nested():
                rem = remate_service.estado(subasta.identificador, db)
            data["itemActivoId"] = rem.get("itemActivoId")
            data["segundosRestantes"] = rem.get("segundosRestantes")
        except Exception:
            # Subasta con remate roto: se la deja sin countdown y sigue el resto.
            pass

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

    # Nombres de los productos en una sola query (evita N+1 por ítem).
    prods = {}
    if items:
        ids = [i.producto for i in items]
        for p in db.query(Producto).filter(Producto.identificador.in_(ids)).all():
            prods[p.identificador] = p

    data["titulo"] = (
        prods[items[0].producto].descripcioncatalogo
        if items and items[0].producto in prods else None
    )

    # Catálogo linkeado: nombre + resumen de ítems (para el panel y el Home).
    cat = db.query(Catalogo).filter(Catalogo.subasta == subasta.identificador).first()
    data["catalogoNombre"] = cat.descripcion if cat else None
    data["itemsResumen"] = [
        {
            "id": i.identificador,
            "nombre": (prods[i.producto].descripcioncatalogo if i.producto in prods else f"Ítem #{i.identificador}"),
            "precioBase": float(i.preciobase) if i.preciobase is not None else None,
            "subastado": i.subastado,
        }
        for i in items[:12]  # tope defensivo para no inflar el listado
    ]

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


def adjudicar_bloque(subasta_id: int, db: Session) -> None:
    """Venta en bloque (única venta): el mejor postor del ítem líder se lleva TODAS
    las piezas pendientes del catálogo. El importe ganador se prorratea entre las
    piezas según su precio base — así cada producto conserva su registroDeSubasta,
    payout y seguro individuales (DDL del profe: registro por producto).
    Sin pujas → la empresa compra cada pieza al valor base (flujo estándar)."""
    from app.services import payout_service, notificacion_service, categoria_service

    pendientes = (
        db.query(ItemCatalogo)
        .join(Catalogo, ItemCatalogo.catalogo == Catalogo.identificador)
        .filter(Catalogo.subasta == subasta_id, ItemCatalogo.subastado == "no")
        .order_by(ItemCatalogo.identificador)
        .with_for_update(of=ItemCatalogo)
        .all()
    )
    if not pendientes:
        return

    # Las pujas del bloque viven en el ítem líder (el primero pendiente).
    lider = pendientes[0]
    puja_ganadora = (
        db.query(Puja)
        .filter(Puja.item == lider.identificador, Puja.ganador == "no")
        .order_by(Puja.importe.desc())
        .first()
    )
    if not puja_ganadora:
        # Nadie pujó: la empresa compra pieza por pieza al valor base.
        for it in pendientes:
            adjudicar_item(it.identificador, db)
        return

    puja_ganadora.ganador = "si"
    asistente = db.query(Asistente).filter(Asistente.identificador == puja_ganadora.asistente).first()
    comprador = asistente.cliente if asistente else None

    ganado = Decimal(str(puja_ganadora.importe))
    total_base = sum(Decimal(str(it.preciobase or 0)) for it in pendientes) or Decimal("1")
    total_comision = Decimal("0")
    restante = ganado

    for i, it in enumerate(pendientes):
        base_i = Decimal(str(it.preciobase or 0))
        # Prorrateo por base; la última pieza absorbe el redondeo (la suma da exacto).
        parte = restante if i == len(pendientes) - 1 else (ganado * base_i / total_base).quantize(Decimal("0.01"))
        restante -= parte
        comision_i = Decimal(str(it.comision or 0))
        total_comision += comision_i

        it.subastado = "si"
        prod = db.query(Producto).filter(Producto.identificador == it.producto).first()
        registro = RegistroDeSubasta(
            subasta=subasta_id,
            duenio=prod.duenio if prod else None,
            producto=it.producto,
            cliente=comprador,
            importe=parte,
            comision=comision_i,
        )
        db.add(registro)
        db.flush()
        db.add(RegistroPago(registro=registro.identificador, estado="pendiente", importe_total=parte + comision_i))
        db.add(Reembolso(registro=registro.identificador, reembolsada="no"))

        # Payout al dueño ORIGINAL (antes de transferir la pieza al comprador).
        if prod and not payout_service.existe_payout(it.producto, db):
            payout_service.crear_payout(
                duenio_id=prod.duenio,
                producto_id=it.producto,
                subasta_id=subasta_id,
                importe_bruto=parte,
                comision=comision_i,
                origen="venta",
                db=db,
                premium=_premium_de(it.producto, it.preciobase, db),
            )
        if prod and comprador:
            _ensure_duenio(comprador, db)
            prod.duenio = comprador
            prod.disponible = "no"

    if comprador:
        notificacion_service.crear(
            comprador, "ganaste",
            f"¡Ganaste el catálogo completo ({len(pendientes)} piezas) en única venta! "
            f"Pujado ${ganado} + comisiones ${total_comision} = ${ganado + total_comision}. "
            "El costo de envío a tu dirección declarada se suma al pagar "
            "(o retirás en persona y perdés el seguro).",
            db,
        )
        nueva_cat = categoria_service.recalcular(comprador, db)
        if nueva_cat:
            notificacion_service.crear(
                comprador, "categoria",
                f"¡Subiste de categoría por tu actividad! Ahora sos {nueva_cat.upper()}.", db)

    _cerrar_si_completa(subasta_id, db)
    db.flush()


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
