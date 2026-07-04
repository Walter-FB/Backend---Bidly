from sqlalchemy import Column, Integer, String, Numeric, ForeignKey
from app.database import Base


class EntregaVenta(Base):
    __tablename__ = "entrega_venta"

    registro     = Column(Integer, ForeignKey("registrodesubasta.identificador"), primary_key=True)
    tipo_entrega = Column(String)             # 'retiro' | 'envio'
    costo_envio  = Column(Numeric(precision=12, scale=2), default=0)
