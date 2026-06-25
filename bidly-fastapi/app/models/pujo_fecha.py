from sqlalchemy import Column, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class PujoFecha(Base):
    __tablename__ = "pujo_fecha"

    pujo      = Column(Integer, ForeignKey("pujos.identificador"), primary_key=True)
    fechahora = Column(DateTime)

    puja_rel  = relationship("Puja", back_populates="fecha_rel")
