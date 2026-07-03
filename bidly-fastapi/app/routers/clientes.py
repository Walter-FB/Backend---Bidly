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

TIPO_MAP = {
    "tarjeta": "tarjeta", "TARJETA": "tarjeta",
    "cuenta": "cuenta", "CUENTA": "cuenta",
    "cheque": "cheque", "CHEQUE": "cheque",
}


def _normalizar_tipo(tipo: str) -> str:
    return TIPO_MAP.get(tipo, (tipo or "").lower())


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
    """Saldo total, comprometido y disponible del cliente (suma de sus medios)."""
    from app.services import saldo_service
    return saldo_service.resumen(id, db)


@router.get("/{id}/medios-pago", response_model=List[MedioPagoResponse])
def get_medios_pago(id: int, db: Session = Depends(get_db)):
    return db.query(MedioPago).filter(MedioPago.cliente == id).all()


# La tarjeta/cuenta tiene un CUPO que verifica la empresa (el usuario no lo carga).
# El CHEQUE certificado sí tiene un monto determinado: es el valor escrito en el
# cheque físico que el usuario entrega, así que ese lo declara el usuario.
CUPO_TARJETA_CUENTA = 500000
MONTO_CHEQUE_DEFECTO = 10000


@router.post("/{id}/medios-pago", response_model=MedioPagoResponse, status_code=201)
def add_medio_pago(id: int, body: MedioPagoCreate, db: Session = Depends(get_db)):
    tipo = _normalizar_tipo(body.tipo)
    montocheque = (body.montoCheque or MONTO_CHEQUE_DEFECTO) if tipo == "cheque" else None
    saldo = None if tipo == "cheque" else CUPO_TARJETA_CUENTA

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
        saldo=saldo,
        verificado="si",  # la empresa verifica el medio al registrarlo (demo)
    )
    db.add(mp)
    db.commit()
    db.refresh(mp)

    from app.services import notificacion_service, categoria_service
    tipo = _normalizar_tipo(body.tipo)
    nombre = "tarjeta" if tipo == "tarjeta" else "cuenta bancaria" if tipo == "cuenta" else "cheque certificado" if tipo == "cheque" else "medio de pago"
    notificacion_service.crear(id, "medio_pago", f"Se agregó un {nombre} a tu cuenta.", db)
    categoria_service.recalcular(id, db)
    db.commit()
    return mp


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
