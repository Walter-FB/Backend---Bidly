"""
Serializadores compartidos.

El frontend (React Native) espera objetos en camelCase y con relaciones ANIDADAS
(p. ej. item.producto.identificador, puja.asistente.numeroPostor). Estos helpers
producen ese shape y se reutilizan en los routers.
"""
from sqlalchemy.orm import Session

from app.models.item_catalogo import ItemCatalogo
from app.models.producto import Producto
from app.models.puja import Puja
from app.models.asistente import Asistente


def item_to_dict(item: ItemCatalogo, db: Session, mostrar_precio: bool = True) -> dict:
    prod = db.query(Producto).filter(Producto.identificador == item.producto).first()
    descripcion_catalogo = prod.descripcioncatalogo if prod else None
    descripcion_completa = prod.descripcioncompleta if prod else None
    # El catálogo es público, pero solo los usuarios registrados ven el precio base.
    precio = item.preciobase if mostrar_precio else None
    return {
        "identificador": item.identificador,
        "catalogo": item.catalogo,
        "preciobase": precio,
        "precioBase": precio,
        "comision": item.comision,
        "subastado": item.subastado,
        "producto": {
            "identificador": item.producto,
            "descripcionCatalogo": descripcion_catalogo,
            "descripcionCompleta": descripcion_completa,
        },
        # Compatibilidad: el front antiguo también leía estos en el nivel raíz.
        "descripcionCatalogo": descripcion_catalogo,
        "descripcionCompleta": descripcion_completa,
    }


def asistente_ref(asistente_id, db: Session) -> dict | None:
    if asistente_id is None:
        return None
    a = db.query(Asistente).filter(Asistente.identificador == asistente_id).first()
    return {
        "identificador": asistente_id,
        "numeroPostor": a.numeropostor if a else None,
    }


def puja_to_dict(p: Puja, db: Session) -> dict:
    return {
        "identificador": p.identificador,
        "importe": p.importe,
        "ganador": p.ganador,
        "item": p.item,
        "asistente": asistente_ref(p.asistente, db),
    }
