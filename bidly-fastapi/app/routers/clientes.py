from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.cliente import Cliente
from app.models.persona import Persona
from app.models.credencial import Credencial
from app.models.empleado import EMPLEADO_SISTEMA
from app.models.pagos import MedioPago
from app.schemas.cliente import ClienteCreate, CategoriaUpdate, AdmitidoUpdate
from app.schemas.pagos import MedioPagoCreate, MedioPagoResponse, VerificarMedioRequest

router = APIRouter()

# Tipos finales: 'debito' | 'credito' | 'cuenta' | 'cheque'.
# 'tarjeta' (legacy, sin subtipo) se trata como débito.
TIPO_MAP = {
    "tarjeta": "debito", "TARJETA": "debito",
    "debito": "debito", "débito": "debito",
    "credito": "credito", "crédito": "credito",
    "cuenta": "cuenta", "CUENTA": "cuenta",
    "cheque": "cheque", "CHEQUE": "cheque",
}


def _normalizar_tipo(tipo: str) -> str:
    return TIPO_MAP.get((tipo or "").strip(), (tipo or "").strip().lower())


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
    c = Cliente(
        identificador=body.identificador,
        numeropais=body.numeroPais,
        admitido="no",
        categoria="comun",
        verificador=body.verificador or EMPLEADO_SISTEMA,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return _enrich_cliente(c, db)


@router.get("/pendientes/lista")
def listar_pendientes(db: Session = Depends(get_db)):
    """Postores que aún no fueron admitidos por la empresa (para el subastador)."""
    clientes = db.query(Cliente).filter(Cliente.admitido != "si").all()
    return [_enrich_cliente(c, db) for c in clientes]


@router.get("/todos/lista")
def listar_todos(db: Session = Depends(get_db)):
    """TODOS los postores (pendientes y admitidos), para gestionarlos desde el
    panel: admitir a los nuevos y ajustar la categoría de los ya admitidos."""
    clientes = db.query(Cliente).order_by(Cliente.identificador.desc()).all()
    return [_enrich_cliente(c, db) for c in clientes]


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


@router.get("/{id}/metricas")
def get_metricas(id: int, db: Session = Depends(get_db)):
    """Participación del usuario: asistidas, ganadas, importes ofertados/comprados y
    desglose por categoría de subasta."""
    from app.models.asistente import Asistente
    from app.models.puja import Puja
    from app.models.registro_subasta import RegistroDeSubasta
    from app.models.subasta import Subasta

    asistencias = db.query(Asistente).filter(Asistente.cliente == id).all()
    pujas = (
        db.query(Puja)
        .join(Asistente, Puja.asistente == Asistente.identificador)
        .filter(Asistente.cliente == id)
        .all()
    )
    registros = db.query(RegistroDeSubasta).filter(RegistroDeSubasta.cliente == id).all()

    por_categoria: dict = {}
    for a in asistencias:
        s = db.query(Subasta).filter(Subasta.identificador == a.subasta).first()
        cat = (s.categoria if s else None) or "sin_categoria"
        por_categoria[cat] = por_categoria.get(cat, 0) + 1

    return {
        "asistidas": len(asistencias),
        "ganadas": len(registros),
        "cantidadPujas": len(pujas),
        "totalOfertado": float(sum((p.importe or 0) for p in pujas)),
        "totalComprado": float(sum((r.importe or 0) for r in registros)),
        "porCategoria": por_categoria,
    }


# ── Medios de pago del postor + saldo ─────────────────────────────────────────
@router.get("/{id}/saldo")
def get_saldo(id: int, db: Session = Depends(get_db)):
    """Saldo visible del cliente (solo garantías: cheques y cuentas)."""
    from app.services import saldo_service
    return saldo_service.resumen(id, db)


@router.get("/{id}/medios-pago", response_model=List[MedioPagoResponse])
def get_medios_pago(id: int, db: Session = Depends(get_db)):
    medios = db.query(MedioPago).filter(MedioPago.cliente == id).all()
    out = []
    for m in medios:
        r = MedioPagoResponse.model_validate(m)
        if m.tipo in ("credito", "debito"):
            # El presupuesto de las tarjetas es secreto: imita el límite del
            # banco (que el postor no conoce) y se chequea recién al pagar.
            r.limite = None
            r.saldo = None
        out.append(r)
    return out


# Presupuesto por defecto de las tarjetas (imita la cuenta bancaria del usuario,
# a la que no tenemos acceso; en PESOS). Es "secreto": no se muestra y recién se
# chequea al cobrar (cobro_service). Arranca bajo ($500) a propósito para que el
# cobro automático dispare la multa cuando el ganador pujó por más de lo que tiene.
PRESUPUESTO_DEBITO = 500
PRESUPUESTO_CREDITO = 500


@router.post("/{id}/medios-pago", response_model=MedioPagoResponse, status_code=201)
def add_medio_pago(id: int, body: MedioPagoCreate, db: Session = Depends(get_db)):
    # Si viene tipo='tarjeta' con subtipo, ese subtipo manda (debito/credito).
    tipo = _normalizar_tipo(body.subtipo or body.tipo)

    montocheque = None
    if tipo == "cheque":
        # Cheque: el usuario elige el monto certificado. Queda ESPERANDO VALIDACIÓN.
        monto = Decimal(str(body.montoCheque or body.monto or 0))
        montocheque = monto
        limite = saldo = monto
        verificado = "no"
    elif tipo == "cuenta":
        # Cuenta: el usuario elige el monto reservado. Se valida sola (sin la
        # burocracia del cheque), lista para pujar.
        monto = Decimal(str(body.monto or body.montoCheque or 0))
        limite = saldo = monto
        verificado = "si"
    elif tipo == "credito":
        limite = saldo = Decimal(PRESUPUESTO_CREDITO)
        verificado = "si"
    else:  # debito (incluye 'tarjeta' legacy)
        tipo = "debito"
        limite = saldo = Decimal(PRESUPUESTO_DEBITO)
        verificado = "si"

    mp = MedioPago(
        cliente=id,
        tipo=tipo,
        numerotarjeta=body.numeroTarjeta,
        vencimiento=_normalizar_vencimiento(body.vencimiento),
        titular=body.titular,
        numerocuenta=body.numeroCuenta,
        banco=body.banco,
        numerocheque=body.numeroCheque,
        montocheque=montocheque,
        limite=limite,
        saldo=saldo,
        verificado=verificado,
    )
    db.add(mp)
    db.commit()
    db.refresh(mp)

    from app.services import notificacion_service, categoria_service
    nombre = {
        "debito": "tarjeta de débito", "credito": "tarjeta de crédito",
        "cuenta": "cuenta bancaria", "cheque": "cheque certificado",
    }.get(tipo, "medio de pago")
    if tipo == "cheque":
        notificacion_service.crear(
            id, "medio_pago",
            f"Cargaste un {nombre} por ${saldo}. Queda ESPERANDO VALIDACIÓN de la empresa "
            "antes de poder usarlo para pujar.", db)
    else:
        notificacion_service.crear(id, "medio_pago", f"Se agregó una {nombre} a tu cuenta.", db)

    # La diversidad de medios puede mejorar la categoría (3+ → oro, etc.).
    nueva = categoria_service.recalcular(id, db)
    if nueva:
        notificacion_service.crear(
            id, "categoria", f"¡Subiste de categoría! Ahora sos {nueva.upper()}.", db)
    db.commit()
    return mp


@router.get("/medios-pago/pendientes", response_model=List[MedioPagoResponse])
def medios_pendientes(db: Session = Depends(get_db)):
    """[INTERNO] Cheques a la espera de validación de la empresa."""
    return db.query(MedioPago).filter(MedioPago.verificado != "si").all()


@router.delete("/medios-pago/{mp_id}", status_code=204)
def eliminar_medio_pago(mp_id: int, db: Session = Depends(get_db)):
    """Borra un medio de pago del cliente (si no fue usado en un pago)."""
    from app.models.pagos import RegistroPago
    mp = db.query(MedioPago).filter(MedioPago.identificador == mp_id).first()
    if not mp:
        raise HTTPException(404, "Medio de pago no encontrado")
    en_uso = db.query(RegistroPago).filter(RegistroPago.medio_pago == mp_id).first()
    if en_uso:
        raise HTTPException(409, detail={"message": "No se puede borrar: ya se usó para pagar una compra.", "code": "IN_USE"})
    db.delete(mp)
    db.commit()


@router.patch("/medios-pago/{mp_id}/verificar", response_model=MedioPagoResponse)
def verificar_medio_pago(mp_id: int, body: VerificarMedioRequest, db: Session = Depends(get_db)):
    """[INTERNO] La empresa verifica un medio de pago (necesario para poder pujar)."""
    mp = db.query(MedioPago).filter(MedioPago.identificador == mp_id).first()
    if not mp:
        raise HTTPException(404, "Medio de pago no encontrado")
    mp.verificado = body.verificado or "si"
    db.commit()
    db.refresh(mp)
    if mp.verificado == "si":
        from app.services import notificacion_service
        notificacion_service.crear(mp.cliente, "medio_pago", "Tu medio de pago fue verificado. Ya podés pujar.", db)
        db.commit()
    return mp
