from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from app.database import Base

# Estados válidos del ciclo de aprobación interna de Bidly.
ESTADOS_PRODUCTO = ("solicitado", "en_inspeccion", "aceptado", "rechazado")


class ProductoEstado(Base):
    """Estado de aprobación de un producto (tabla propia, fuera de la DDL del profe).

    El esquema del profe no tiene 'estado de aprobación': un producto solo tiene
    `disponible ('si'|'no')`. Esta tabla agrega el ciclo solicitado → en_inspeccion
    → aceptado | rechazado (con causa), sin tocar la tabla `productos`.
    PK = FK a productos: un estado por producto. `disponible` se mantiene en sync
    ('aceptado' → 'si', resto → 'no').
    """
    __tablename__ = "producto_estado"

    producto      = Column(Integer, ForeignKey("productos.identificador"), primary_key=True)
    estado        = Column(String(20), nullable=False, default="solicitado")
    causa_rechazo = Column(String(300))
    fecha_cambio  = Column(DateTime, nullable=False, server_default=func.now())
