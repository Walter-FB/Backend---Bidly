from sqlalchemy import Column, Integer, String, ForeignKey
from app.database import Base


class ProductoDetalle(Base):
    """Detalle ampliado de un producto (tabla nueva; productos está protegida).

    Cubre obras de arte/diseñador (artista, fecha, historia) y piezas compuestas
    por varios elementos (ej. juego de té de 18 piezas).
    """
    __tablename__ = "producto_detalle"

    producto      = Column(Integer, ForeignKey("productos.identificador"), primary_key=True)
    es_obra_arte  = Column(String, default="no")   # 'si' | 'no'
    artista       = Column(String)
    fecha_obra    = Column(String)
    historia      = Column(String)
    cantidad_piezas = Column(Integer, default=1)
    composicion   = Column(String)                 # descripción de las piezas
