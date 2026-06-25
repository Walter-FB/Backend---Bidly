from sqlalchemy import Column, Integer, DateTime, ForeignKey
from app.database import Base


class SubastaSesion(Base):
    __tablename__ = "subasta_sesion"

    subasta      = Column(Integer, ForeignKey("subastas.identificador"), primary_key=True)
    item_activo  = Column(Integer, ForeignKey("itemscatalogo.identificador"))
    orden_actual = Column(Integer)
    timer_desde  = Column(DateTime)
    iniciada_en  = Column(DateTime)
