from sqlalchemy import Column, Integer, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class Asistente(Base):
    __tablename__ = "asistentes"

    identificador = Column(Integer, primary_key=True, autoincrement=True)
    numeropostor  = Column(Integer)
    cliente       = Column(Integer, ForeignKey("clientes.identificador"))
    subasta       = Column(Integer, ForeignKey("subastas.identificador"))

    subasta_rel   = relationship("Subasta", back_populates="asistentes_rel")
    pujas_rel     = relationship("Puja", back_populates="asistente_rel")
