"""Timer del remate (subasta dinámica ascendente con reloj).

El catálogo se remata de a un ítem por vez: el ítem "activo" tiene una fila en
`item_remate` con su `termina_en`. Arranca en 3 minutos y suma 15s por cada puja.
Al llegar a 0 el ítem se adjudica solo (mejor postor, o la empresa si nadie pujó)
y arranca el siguiente ítem del catálogo. Cuando cae el último, la subasta cierra.

No hay cron: el reloj avanza de forma "perezosa" (lazy) cada vez que alguien lee
el estado del remate (el front lo poll-ea) o cuando entra una puja.
"""
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.models.item_remate import ItemRemate
from app.models.item_catalogo import ItemCatalogo
from app.models.catalogo import Catalogo
from app.models.subasta import Subasta

DURACION_SEG = 180   # 3 minutos por ítem
EXTENSION_SEG = 15   # +15s por cada puja


def _items_pendientes(subasta_id: int, db: Session):
    """Ítems del catálogo sin subastar, en orden."""
    return (
        db.query(ItemCatalogo)
        .join(Catalogo, ItemCatalogo.catalogo == Catalogo.identificador)
        .filter(Catalogo.subasta == subasta_id, ItemCatalogo.subastado == "no")
        .order_by(ItemCatalogo.identificador)
        .all()
    )


def _remate_de(item_id: int, db: Session) -> ItemRemate | None:
    return db.query(ItemRemate).filter(ItemRemate.item == item_id).first()


def _activar_siguiente(subasta_id: int, db: Session) -> ItemRemate | None:
    """Pone en marcha el reloj del primer ítem pendiente que no lo tenga."""
    pendientes = _items_pendientes(subasta_id, db)
    if not pendientes:
        return None
    item = pendientes[0]
    rem = _remate_de(item.identificador, db)
    if not rem:
        rem = ItemRemate(item=item.identificador, termina_en=datetime.utcnow() + timedelta(seconds=DURACION_SEG))
        db.add(rem)
        db.flush()
    return rem


def iniciar(subasta_id: int, db: Session) -> None:
    """Al abrir la subasta: limpia relojes viejos (evita adjudicar al instante por un
    timer vencido de una apertura anterior) y arranca el del primer ítem pendiente."""
    limpiar(subasta_id, db)
    _activar_siguiente(subasta_id, db)
    db.flush()


def extender(item_id: int, db: Session) -> None:
    """Suma 15s al ítem activo cuando entra una puja (si el reloj sigue vivo)."""
    rem = _remate_de(item_id, db)
    if not rem:
        return
    base = max(rem.termina_en or datetime.utcnow(), datetime.utcnow())
    rem.termina_en = base + timedelta(seconds=EXTENSION_SEG)
    db.flush()


def tick(subasta_id: int, db: Session):
    """Avanza el reloj: adjudica los ítems cuyo tiempo se agotó y activa el
    siguiente. Devuelve la fila `item_remate` del ítem activo (o None si terminó)."""
    from app.services import subasta_service

    sub = db.query(Subasta).filter(Subasta.identificador == subasta_id).first()
    if not sub or sub.estado != "abierta":
        return None

    for _ in range(200):  # tope de seguridad (evita loop infinito)
        pendientes = _items_pendientes(subasta_id, db)
        if not pendientes:
            return None
        item = pendientes[0]
        rem = _remate_de(item.identificador, db)
        if not rem:
            # No tenía reloj (ej. subasta recién abierta): lo arranca.
            return _activar_siguiente(subasta_id, db)
        if rem.termina_en and datetime.utcnow() >= rem.termina_en:
            # Se acabó el tiempo → se adjudica solo y sigue con el próximo ítem.
            subasta_service.adjudicar_item(item.identificador, db)
            db.delete(rem)
            db.flush()
            continue
        return rem  # ítem activo con tiempo restante
    return None


def estado(subasta_id: int, db: Session) -> dict:
    """Estado del remate para el front: ítem activo + segundos restantes."""
    rem = tick(subasta_id, db)
    sub = db.query(Subasta).filter(Subasta.identificador == subasta_id).first()
    estado_sub = sub.estado if sub else "cerrada"
    if not rem:
        return {"itemActivoId": None, "terminaEn": None, "segundosRestantes": None, "estado": estado_sub}
    restantes = (rem.termina_en - datetime.utcnow()).total_seconds() if rem.termina_en else None
    return {
        "itemActivoId": rem.item,
        "terminaEn": rem.termina_en.isoformat() if rem.termina_en else None,
        "segundosRestantes": max(0, int(restantes)) if restantes is not None else None,
        "estado": estado_sub,
    }


def limpiar(subasta_id: int, db: Session) -> None:
    """Borra los relojes de una subasta (al cerrarla a mano)."""
    items = (
        db.query(ItemCatalogo.identificador)
        .join(Catalogo, ItemCatalogo.catalogo == Catalogo.identificador)
        .filter(Catalogo.subasta == subasta_id)
        .subquery()
    )
    db.query(ItemRemate).filter(ItemRemate.item.in_(items)).delete(synchronize_session=False)
    db.flush()
