"""Admisión de artículos a subasta.

Circuito (enunciado): el dueño carga el bien + declaraciones → la empresa pide
enviarlo a inspección → lo acepta o rechaza (con causas) → si lo acepta propone
valor base + comisión + subasta → el dueño acepta (pasa al catálogo) o rechaza
(devolución con gastos).

`producto_estado` se mantiene en sync con el estado de la admisión:
  en_inspeccion → 'en_inspeccion'; aprobada → 'aceptado' (+ disponible='si');
  rechazada / rechazada_duenio → 'rechazado' (+ causa).
El seguro del bien se contrata inline sobre la tabla `seguros` (sin ubicacion_bien,
que quedó borrada).
"""
from datetime import datetime, date, time, timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel

from app.database import get_db
from app.models.admision import Admision
from app.models.producto import Producto
from app.models.producto_estado import ProductoEstado
from app.models.foto import Foto
from app.models.subasta import Subasta
from app.models.catalogo import Catalogo
from app.models.item_catalogo import ItemCatalogo
from app.models.seguro import Seguro
from app.models.ubicacion_bien import UbicacionBien
from app.models.pagos import CuentaDuenio
from app.models.empleado import EMPLEADO_SISTEMA
from app.schemas.admision import (
    AdmisionCreate, InspeccionRequest, RechazarAdmisionRequest,
    ProponerRequest, RechazarDuenioRequest, AprobarDuenioRequest,
)
from app.services import notificacion_service

router = APIRouter()

COMPANIA_SEGURO = "Aseguradora BIDLY S.A."
DEPOSITO_DEFECTO = "Depósito Central BIDLY"


class ItemColeccion(BaseModel):
    admisionId: int
    valorBase: Decimal
    comision: Optional[Decimal] = None


class ColeccionRequest(BaseModel):
    subastaId: int
    nombreColeccion: str
    items: List[ItemColeccion]
    # Modo de venta del catálogo: 'individual' (pieza por pieza, default) o
    # 'bloque' (única venta: el mejor postor se lleva todas las piezas).
    ventaModo: Optional[str] = "individual"


def _sync_producto_estado(producto_id: int, estado: str, causa: Optional[str], db: Session) -> None:
    """Refleja el avance de la admisión en producto_estado (SPEC) y en
    productos.disponible ('si' sólo cuando el bien queda aceptado)."""
    if producto_id is None:
        return
    pe = db.query(ProductoEstado).filter(ProductoEstado.producto == producto_id).first()
    if not pe:
        pe = ProductoEstado(producto=producto_id)
        db.add(pe)
    pe.estado = estado
    pe.causa_rechazo = causa
    pe.fecha_cambio = datetime.utcnow()
    prod = db.query(Producto).filter(Producto.identificador == producto_id).first()
    if prod:
        prod.disponible = "si" if estado == "aceptado" else "no"


def _asegurar_producto(producto_id: int, valor_base, db: Session, premium: bool = False) -> None:
    """De cada bien recibido para la venta se contrata un seguro según el valor
    base. Guarda la póliza en `seguros` y la referencia en productos.seguro.

    Con Cobertura Premium Bidly la póliza se contrata por un valor reforzado
    (valor base + 5%), que es lo que cubre la cobertura extra."""
    prod = db.query(Producto).filter(Producto.identificador == producto_id).first()
    if not prod or prod.seguro:
        return
    base = Decimal(str(valor_base or 0))
    importe = base * Decimal("1.05") if premium else base
    nropoliza = f"POL-{producto_id}-{int(datetime.utcnow().timestamp())}"
    db.add(Seguro(
        nropoliza=nropoliza,
        compania=COMPANIA_SEGURO,
        polizacombinada="no",
        importe=importe or Decimal("1"),
    ))
    # La póliza debe existir en `seguros` ANTES de referenciarla en productos.seguro
    # (FK fk_productos_seguros); forzamos el INSERT con flush.
    db.flush()
    prod.seguro = nropoliza


def _asignar_ubicacion(producto_id: int, deposito: Optional[str], db: Session) -> None:
    """Registra en qué depósito quedó guardada la pieza, para que el dueño pueda
    verla desde la app (enunciado). Usa la dirección de inspección como depósito y
    genera un sector/estante determinístico. Idempotente (un bien → una ubicación)."""
    if producto_id is None:
        return
    if db.query(UbicacionBien).filter(UbicacionBien.producto == producto_id).first():
        return
    sector = f"Sector {chr(65 + producto_id % 6)} · Estante {producto_id % 20 + 1}"
    db.add(UbicacionBien(
        producto=producto_id,
        deposito=(deposito or DEPOSITO_DEFECTO),
        sector=sector,
        ingresado_en=datetime.utcnow(),
    ))
    db.flush()


def _to_dict(a: Admision, db: Session) -> dict:
    prod = db.query(Producto).filter(Producto.identificador == a.producto).first()
    n_fotos = db.query(Foto).filter(Foto.producto == a.producto).count() if a.producto else 0
    sub = db.query(Subasta).filter(Subasta.identificador == a.subasta).first() if a.subasta else None
    # Ubicación en depósito + póliza del seguro (visibles cuando el bien fue aceptado).
    ub = db.query(UbicacionBien).filter(UbicacionBien.producto == a.producto).first() if a.producto else None
    seg = db.query(Seguro).filter(Seguro.nropoliza == prod.seguro).first() if (prod and prod.seguro) else None
    return {
        "identificador": a.identificador,
        "estado": a.estado,
        "producto": {
            "identificador": a.producto,
            "titulo": prod.descripcioncatalogo if prod else None,
            "descripcionCompleta": prod.descripcioncompleta if prod else None,
            "fotos": n_fotos,
        },
        "duenio": a.duenio,
        "declaraPropiedad": a.declara_propiedad,
        "declaraOrigen": a.declara_origen,
        "direccionEnvio": a.direccion_envio,
        "observacion": a.observacion,
        "valorBase": float(a.valor_base) if a.valor_base is not None else None,
        "comision": float(a.comision) if a.comision is not None else None,
        "subastaId": a.subasta,
        "subasta": {
            "identificador": sub.identificador,
            "fecha": sub.fecha.isoformat() if sub and sub.fecha else None,
            "hora": sub.hora.isoformat() if sub and sub.hora else None,
            "ubicacion": sub.ubicacion if sub else None,
        } if sub else None,
        "gastosDevolucion": float(a.gastos_devolucion) if a.gastos_devolucion is not None else None,
        "esColeccion": a.es_coleccion,
        "nombreColeccion": a.nombre_coleccion,
        "garantiaPremium": getattr(a, "garantia_premium", "no") or "no",
        "creadoEn": a.creado_en.isoformat() if a.creado_en else None,
        # Ubicación en depósito + póliza (el dueño las ve una vez aceptado el bien).
        "ubicacion": {"deposito": ub.deposito, "sector": ub.sector} if ub else None,
        "poliza": {
            "nroPoliza": seg.nropoliza,
            "compania": seg.compania,
            "importe": float(seg.importe) if seg.importe is not None else None,
        } if seg else None,
        # Aviso a autoridades por duda de origen.
        "alertaOrigen": a.alerta_origen or "no",
        "alertaOrigenMotivo": a.alerta_origen_motivo,
    }


def _get(id: int, db: Session) -> Admision:
    a = db.query(Admision).filter(Admision.identificador == id).first()
    if not a:
        raise HTTPException(404, "Admisión no encontrada")
    return a


# ── Dueño ─────────────────────────────────────────────────────────────────────
@router.post("", status_code=201)
@router.post("/", status_code=201)
def crear(body: AdmisionCreate, db: Session = Depends(get_db)):
    if not body.declaraPropiedad:
        raise HTTPException(422, detail={
            "message": "Debés declarar que el bien te pertenece.", "code": "DECLARACION_PROPIEDAD"})
    if not body.declaraOrigen:
        raise HTTPException(422, detail={
            "message": "Debés declarar el origen lícito del bien.", "code": "DECLARACION_ORIGEN"})

    a = Admision(
        producto=body.productoId,
        duenio=body.duenioId,
        estado="solicitada",
        declara_propiedad="si",
        declara_origen="si",
        creado_en=datetime.utcnow(),
        actualizado_en=datetime.utcnow(),
    )
    db.add(a)
    db.commit()
    db.refresh(a)

    notificacion_service.crear(
        body.duenioId, "admision",
        "Recibimos tu solicitud de admisión. Te avisaremos si debés enviar el bien a inspección.",
        db,
    )
    db.commit()
    return _to_dict(a, db)


@router.get("/duenio/{duenio_id}")
def por_duenio(duenio_id: int, db: Session = Depends(get_db)):
    admisiones = (
        db.query(Admision)
        .filter(Admision.duenio == duenio_id)
        .order_by(Admision.identificador.desc())
        .all()
    )
    return [_to_dict(a, db) for a in admisiones]


@router.patch("/{id}/aprobar-duenio")
def aprobar_duenio(id: int, body: AprobarDuenioRequest = AprobarDuenioRequest(), db: Session = Depends(get_db)):
    """El dueño acepta el valor base y la comisión: el bien pasa al catálogo de la
    subasta. Opcionalmente contrata la Cobertura Premium Bidly (+5% del valor base,
    que se le descuenta del cobro al vender)."""
    a = _get(id, db)
    if a.estado != "propuesta":
        raise HTTPException(409, detail={"message": "No hay una propuesta pendiente para aceptar", "code": "SIN_PROPUESTA"})
    if not a.subasta:
        raise HTTPException(409, detail={"message": "La admisión no tiene subasta asignada", "code": "SIN_SUBASTA"})

    # Gate B: el dinero de lo vendido va a una cuenta a la vista que el dueño debe
    # declarar antes del inicio de la subasta (enunciado). Exigimos al menos una
    # cuenta de cobro ANTES de que el bien entre al catálogo. El front usa el code
    # SIN_CUENTA_COBRO para redirigir a "Mis cobros".
    tiene_cuenta = (
        db.query(CuentaDuenio).filter(CuentaDuenio.duenio == a.duenio).first() is not None
    )
    if not tiene_cuenta:
        raise HTTPException(409, detail={
            "message": "Antes de aceptar necesitás declarar una cuenta de cobro donde recibir el dinero de la venta.",
            "code": "SIN_CUENTA_COBRO",
        })

    # Buscar (o crear) el catálogo de la subasta y agregar el ítem. Si el bien viene
    # de una colección, el catálogo lleva su nombre (visible en el panel y el Home).
    nombre_cat = (a.nombre_coleccion if (a.es_coleccion == "si" and a.nombre_coleccion) else None)
    catalogo = db.query(Catalogo).filter(Catalogo.subasta == a.subasta).first()
    if not catalogo:
        catalogo = Catalogo(
            descripcion=nombre_cat or f"Catálogo subasta {a.subasta}",
            subasta=a.subasta, responsable=EMPLEADO_SISTEMA,
        )
        db.add(catalogo)
        db.flush()
    elif nombre_cat and (catalogo.descripcion or "").startswith("Catálogo subasta"):
        # El catálogo existía con el nombre genérico: adopta el de la colección.
        catalogo.descripcion = nombre_cat

    valor = Decimal(str(a.valor_base or 0))
    comision = Decimal(str(a.comision)) if a.comision is not None else valor * Decimal("0.10")
    db.add(ItemCatalogo(
        catalogo=catalogo.identificador,
        producto=a.producto,
        preciobase=valor,
        comision=comision,
        subastado="no",
    ))

    premium = bool(body.garantiaPremium)
    a.garantia_premium = "si" if premium else "no"

    # De cada bien recibido para la venta se contrata un seguro según el valor base
    # (reforzado si eligió la Cobertura Premium Bidly).
    _asegurar_producto(a.producto, valor, db, premium=premium)
    # Y queda guardado en un depósito (el dueño puede ver la ubicación desde la app).
    _asignar_ubicacion(a.producto, a.direccion_envio, db)

    a.estado = "aprobada"
    a.actualizado_en = datetime.utcnow()
    # producto_estado: aceptado → disponible='si' (entra al catálogo).
    _sync_producto_estado(a.producto, "aceptado", None, db)
    db.commit()

    if premium:
        costo = valor * Decimal("0.05")
        notificacion_service.crear(
            a.duenio, "seguro",
            f"Tu bien fue aceptado con Cobertura Premium Bidly. El costo (${costo}, 5% del "
            "valor base) se descuenta de tu cobro al venderse. Ya forma parte del catálogo.",
            db,
        )
    else:
        notificacion_service.crear(
            a.duenio, "seguro",
            "Tu bien fue aceptado y asegurado. Ya forma parte del catálogo de la subasta.",
            db,
        )
    db.commit()
    return _to_dict(a, db)


@router.patch("/{id}/rechazar-duenio")
def rechazar_duenio(id: int, body: RechazarDuenioRequest, db: Session = Depends(get_db)):
    """El dueño no acepta el valor base/comisión: devolución con gastos a su cargo."""
    a = _get(id, db)
    if a.estado != "propuesta":
        raise HTTPException(409, detail={"message": "No hay una propuesta pendiente", "code": "SIN_PROPUESTA"})
    a.estado = "rechazada_duenio"
    if body.gastosDevolucion is not None:
        a.gastos_devolucion = body.gastosDevolucion
    a.actualizado_en = datetime.utcnow()
    _sync_producto_estado(a.producto, "rechazado", "El dueño no aceptó el valor base/comisión propuestos.", db)
    db.commit()
    return _to_dict(a, db)


# ── Empresa / Admin ───────────────────────────────────────────────────────────
@router.get("")
@router.get("/")
def listar(estado: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(Admision)
    if estado:
        q = q.filter(Admision.estado == estado)
    return [_to_dict(a, db) for a in q.order_by(Admision.identificador.desc()).all()]


@router.get("/pendientes/count")
def contar_pendientes(db: Session = Depends(get_db)):
    n = db.query(Admision).filter(Admision.estado.in_(["solicitada", "en_inspeccion"])).count()
    return {"pendientes": n}


@router.get("/{id}")
def obtener(id: int, db: Session = Depends(get_db)):
    return _to_dict(_get(id, db), db)


@router.patch("/{id}/inspeccion")
def pedir_inspeccion(id: int, body: InspeccionRequest, db: Session = Depends(get_db)):
    a = _get(id, db)
    a.estado = "en_inspeccion"
    a.direccion_envio = body.direccionEnvio
    a.actualizado_en = datetime.utcnow()
    _sync_producto_estado(a.producto, "en_inspeccion", None, db)
    db.commit()
    notificacion_service.crear(
        a.duenio, "admision",
        f"Tu artículo pasó a inspección. Enviá el bien a: {body.direccionEnvio}. "
        "Si no se acepta, la devolución corre por tu cuenta.",
        db,
    )
    db.commit()
    return _to_dict(a, db)


@router.patch("/{id}/rechazar")
def rechazar(id: int, body: RechazarAdmisionRequest, db: Session = Depends(get_db)):
    a = _get(id, db)
    a.estado = "rechazada"
    a.observacion = body.observacion
    if body.gastosDevolucion is not None:
        a.gastos_devolucion = body.gastosDevolucion
    a.actualizado_en = datetime.utcnow()
    _sync_producto_estado(a.producto, "rechazado", body.observacion, db)
    db.commit()
    notificacion_service.crear(
        a.duenio, "admision",
        f"Tu artículo no fue aceptado. Motivo: {body.observacion}. "
        "Será devuelto con cargo a tu cuenta.",
        db,
    )
    db.commit()
    return _to_dict(a, db)


class AlertarOrigenRequest(BaseModel):
    motivo: str


@router.patch("/{id}/alertar-origen")
def alertar_origen(id: int, body: AlertarOrigenRequest, db: Session = Depends(get_db)):
    """La empresa tiene dudas sobre el origen del bien: avisa a las autoridades
    (queda registrado con motivo y fecha) y le pide al dueño que acredite el origen
    lícito. No bloquea el circuito; deja constancia del aviso (enunciado)."""
    a = _get(id, db)
    a.alerta_origen = "si"
    a.alerta_origen_motivo = body.motivo
    a.alerta_origen_en = datetime.utcnow()
    a.actualizado_en = datetime.utcnow()
    db.commit()
    notificacion_service.crear(
        a.duenio, "admision",
        f"Necesitamos que acredites el origen lícito de tu bien. Motivo: {body.motivo}.",
        db,
    )
    db.commit()
    return _to_dict(a, db)


@router.post("/coleccion")
def crear_coleccion(body: ColeccionRequest, db: Session = Depends(get_db)):
    """Agrupa varios bienes de un mismo dueño en una subasta (colección con el
    nombre del usuario). Propone todos con su valor base + comisión."""
    sub = db.query(Subasta).filter(Subasta.identificador == body.subastaId).first()
    if not sub:
        raise HTTPException(404, "Subasta no encontrada")
    if not body.items:
        raise HTTPException(422, detail={"message": "La colección no tiene ítems", "code": "SIN_ITEMS"})

    # Consigna: la colección lleva el nombre del usuario y el seguro es de un mismo
    # dueño (único beneficiario). Todos los bienes deben ser del MISMO dueño.
    admisiones = [
        db.query(Admision).filter(Admision.identificador == it.admisionId).first()
        for it in body.items
    ]
    admisiones = [a for a in admisiones if a]
    duenios_distintos = {a.duenio for a in admisiones}
    if len(duenios_distintos) > 1:
        raise HTTPException(422, detail={
            "message": "El catálogo debe ser de un solo dueño (lleva su nombre y el seguro tiene un único beneficiario).",
            "code": "COLECCION_MULTIPLE_DUENIO"})

    # Modo de venta del catálogo (tabla propia subasta_venta_modo; sin fila = individual).
    modo = body.ventaModo if body.ventaModo in ("individual", "bloque") else "individual"
    from app.models.venta_modo import SubastaVentaModo
    vm = db.query(SubastaVentaModo).filter(SubastaVentaModo.subasta == body.subastaId).first()
    if vm:
        vm.modo = modo
    else:
        db.add(SubastaVentaModo(subasta=body.subastaId, modo=modo))

    resultado = []
    duenios = set()
    total = Decimal("0")
    for a in admisiones:
        a.estado = "propuesta"
        it = next(x for x in body.items if x.admisionId == a.identificador)
        a.valor_base = it.valorBase
        a.comision = it.comision if it.comision is not None else Decimal(str(it.valorBase)) * Decimal("0.10")
        a.subasta = body.subastaId
        a.es_coleccion = "si"
        a.nombre_coleccion = body.nombreColeccion
        a.actualizado_en = datetime.utcnow()
        total += Decimal(str(it.valorBase or 0))
        duenios.add(a.duenio)
        resultado.append(a)
    db.commit()

    # Consigna: cada pieza conserva su precio base (no se funden en un lote único);
    # el total es la suma de las bases, informativo para el dueño.
    detalle_modo = (
        "Se venden todas juntas en una única venta (el mejor postor se lleva todo)."
        if modo == "bloque" else "Se rematan pieza por pieza."
    )
    for d in duenios:
        notificacion_service.crear(
            d, "admision",
            f"Tus {len(resultado)} bienes se agruparon en el catálogo \"{body.nombreColeccion}\" "
            f"(base total ${total}). {detalle_modo} Aceptá o rechazá las propuestas desde la app.",
            db,
        )
    db.commit()
    return [_to_dict(a, db) for a in resultado]


@router.patch("/{id}/proponer")
def proponer(id: int, body: ProponerRequest, db: Session = Depends(get_db)):
    """La empresa acepta el bien y propone valor base + comisión, asignándolo a una subasta."""
    a = _get(id, db)
    sub = db.query(Subasta).filter(Subasta.identificador == body.subastaId).first()
    if not sub:
        raise HTTPException(404, "Subasta no encontrada")

    # Regla del profe: si la empresa fija una fecha, la subasta debe programarse con
    # al menos 10 días de anticipación. Validamos ANTES de tocar nada.
    if body.fecha is not None and body.fecha < date.today() + timedelta(days=10):
        raise HTTPException(422, detail={
            "message": "La subasta debe programarse con al menos 10 días de anticipación.",
            "code": "FECHA_MUY_PRONTO"})

    a.estado = "propuesta"
    a.valor_base = body.valorBase
    a.comision = body.comision if body.comision is not None else Decimal(str(body.valorBase)) * Decimal("0.10")
    a.subasta = body.subastaId
    a.actualizado_en = datetime.utcnow()

    # Si vino fecha en la propuesta, se la fijamos a la subasta asignada (dato en
    # subastas.fecha, del profe; no es cambio de esquema). Hora por defecto 15:00.
    if body.fecha is not None:
        sub.fecha = body.fecha
        if body.hora is not None:
            sub.hora = body.hora
        elif not sub.hora:
            sub.hora = time(15, 0)

    db.commit()

    # La fecha que se le informa al dueño es la de la subasta asignada (o "a
    # confirmar" si todavía no tiene fecha). Fuente única: subastas.fecha del profe.
    fecha = sub.fecha.isoformat() if sub.fecha else "a confirmar"
    notificacion_service.crear(
        a.duenio, "admision",
        f"¡Tu artículo fue aceptado! Subasta del {fecha} en {sub.ubicacion or 'a confirmar'}. "
        f"Valor base ${a.valor_base} y comisión ${a.comision}. Aceptá o rechazá la propuesta desde la app.",
        db,
    )
    db.commit()
    return _to_dict(a, db)
