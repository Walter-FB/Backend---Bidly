"""Reglas de acceso a subastas (enunciado):

- La categoría de la subasta debe ser menor o igual que la del usuario.
- Solo puede pujar quien tenga al menos un medio de pago VERIFICADO.
- Un usuario no puede estar conectado a más de una subasta a la vez.

Adaptación (sin `subasta_sesion` / `subasta_estado_admin`, tablas borradas): una
subasta está "en vivo" cuando `subastas.estado == 'abierta'` (DDL del profe). El
chequeo de "una sola a la vez" se hace mirando de qué OTRAS subastas abiertas es
asistente el cliente.
"""
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.cliente import Cliente
from app.models.subasta import Subasta
from app.models.pagos import MedioPago
from app.models.asistente import Asistente
from app.models.puja import Puja
from app.models.item_catalogo import ItemCatalogo
from app.models.catalogo import Catalogo

CATEGORIAS = ["comun", "especial", "plata", "oro", "platino"]


def _rango(cat: str) -> int:
    try:
        return CATEGORIAS.index((cat or "comun").lower())
    except ValueError:
        return 0


def categoria_permite(cliente_cat: str, subasta_cat: str) -> bool:
    """True si el usuario puede acceder: categoría subasta ≤ categoría usuario."""
    return _rango(subasta_cat) <= _rango(cliente_cat)


def tiene_medio_verificado(cliente_id: int, db: Session) -> bool:
    return (
        db.query(MedioPago)
        .filter(MedioPago.cliente == cliente_id, MedioPago.verificado == "si")
        .first()
        is not None
    )


def _subasta_viva(subasta_id: int, db: Session) -> bool:
    """En vivo = abierta Y con ítems por subastar. Si ya se adjudicó todo el
    catálogo, la subasta terminó (aunque el estado haya quedado 'abierta') y no
    debe contar como "conexión activa"."""
    sub = db.query(Subasta).filter(Subasta.identificador == subasta_id).first()
    if not sub or sub.estado != "abierta":
        return False
    pendientes = (
        db.query(ItemCatalogo)
        .join(Catalogo, ItemCatalogo.catalogo == Catalogo.identificador)
        .filter(Catalogo.subasta == subasta_id, ItemCatalogo.subastado == "no")
        .count()
    )
    return pendientes > 0


def conectado_en_otra_viva(cliente_id: int, subasta_id: int, db: Session) -> bool:
    """True si el cliente ya está PARTICIPANDO (pujó) en otra subasta abierta.

    Mirar una subasta (inscribirse sin pujar) NO cuenta: el enunciado permite ver
    la subasta libremente. El límite de "una a la vez" aplica a la participación,
    así que solo bloquea si el cliente tiene al menos una puja en otra subasta que
    sigue viva."""
    otras = (
        db.query(Asistente)
        .filter(Asistente.cliente == cliente_id, Asistente.subasta != subasta_id)
        .all()
    )
    for a in otras:
        if not _subasta_viva(a.subasta, db):
            continue
        if db.query(Puja).filter(Puja.asistente == a.identificador).first() is not None:
            return True
    return False


def validar_inscripcion(cliente_id: int, subasta_id: int, db: Session) -> None:
    cliente = db.query(Cliente).filter(Cliente.identificador == cliente_id).first()
    subasta = db.query(Subasta).filter(Subasta.identificador == subasta_id).first()
    if not subasta:
        raise HTTPException(404, "Subasta no encontrada")

    cat_cli = cliente.categoria if cliente else "comun"
    if not categoria_permite(cat_cli, subasta.categoria):
        raise HTTPException(403, detail={
            "message": f"Tu categoría ({cat_cli}) no alcanza para esta subasta ({subasta.categoria}).",
            "code": "CATEGORIA_INSUFICIENTE",
        })

    if conectado_en_otra_viva(cliente_id, subasta_id, db):
        raise HTTPException(409, detail={
            "message": "Ya estás participando en otra subasta en vivo. Terminá ahí antes de pujar en otra (podés ver todas, pero pujar en una a la vez).",
            "code": "YA_CONECTADO",
        })


def validar_puede_pujar(cliente_id: int, db: Session) -> None:
    if not tiene_medio_verificado(cliente_id, db):
        raise HTTPException(422, detail={
            "message": "Necesitás al menos un medio de pago verificado por la empresa para pujar.",
            "code": "SIN_MEDIO_VERIFICADO",
        })
