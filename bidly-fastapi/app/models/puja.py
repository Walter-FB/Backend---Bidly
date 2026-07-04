from sqlalchemy import Column, Integer, String, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class Puja(Base):
    __tablename__ = "pujos"

    identificador = Column(Integer, primary_key=True, autoincrement=True)
    asistente     = Column(Integer, ForeignKey("asistentes.identificador"))
    item          = Column(Integer, ForeignKey("itemscatalogo.identificador"))
    importe       = Column(Numeric(precision=12, scale=2))
    ganador       = Column(String, default="no")

    asistente_rel = relationship("Asistente", back_populates="pujas_rel")
    item_rel      = relationship("ItemCatalogo", back_populates="pujas_rel")
    fecha_rel     = relationship("PujoFecha", back_populates="puja_rel", uselist=False)
