from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy import ForeignKey
from app.database import Base


class UbicacionBien(Base):
    """Ubicación física de un bien entregado para la subasta (tabla propia).

    El enunciado pide que el dueño pueda ver "en qué depósito se encuentra" su
    pieza. El profe no modela esto, así que lo guardamos en una tabla nueva con
    FK a `productos` (sin tocar las 16 del profe). Un bien → una ubicación
    (PK = producto), como `producto_estado`.
    """
    __tablename__ = "ubicaciones_bien"

    producto     = Column(Integer, ForeignKey("productos.identificador"), primary_key=True)
    deposito     = Column(String)   # nombre/dirección del depósito
    sector       = Column(String)   # sector / estante / posición dentro del depósito
    ingresado_en = Column(DateTime)
