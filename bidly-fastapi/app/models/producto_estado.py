from sqlalchemy import Column, Integer, String, ForeignKey
from app.database import Base


class ProductoEstado(Base):
    __tablename__ = "producto_estado"

    producto        = Column(Integer, ForeignKey("productos.identificador"), primary_key=True)
    estado          = Column(String, default="pendiente")   # pendiente | aprobado | rechazado
    motivo          = Column(String, nullable=True)
    tipo_devolucion = Column(String, nullable=True)         # flete | retiro
