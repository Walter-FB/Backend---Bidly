"""
Serializadores compartidos.

El frontend (React Native) espera
objetos en camelCase y con relaciones ANIDADAS (p. ej. item.producto.identificador,
puja.asistente.numeroPostor). La serialización ORM cruda devolvía columnas planas
en minúscula y las FK como enteros, rompiendo el contrato. Estos helpers producen
el shape correcto y se reutilizan en todos los routers.
"""
from sqlalchemy.orm import Session

from app.models.item_catalogo import ItemCatalogo
from app.models.producto import Producto
from app.models.puja import Puja
from app.models.pujo_fecha import PujoFecha
from app.models.asistente import Asistente


def item_to_dict(item: ItemCatalogo, db: Session) -> dict:
    prod = db.query(Producto).filter(Producto.identificador == item.producto).first()
    descripcion_catalogo = prod.descripcioncatalogo if prod else None
    descripcion_completa = prod.descripcioncompleta if prod else None
    return {
        "identificador": item.identificador,
        "catalogo": item.catalogo,
        "preciobase": item.preciobase,
        "precioBase": item.preciobase,
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
    fecha = db.query(PujoFecha).filter(PujoFecha.pujo == p.identificador).first()
    return {
        "identificador": p.identificador,
        "importe": p.importe,
        "ganador": p.ganador,
        "item": p.item,
        "asistente": asistente_ref(p.asistente, db),
        "fechaHora": fecha.fechahora if fecha else None,
    }
