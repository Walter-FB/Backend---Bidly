from sqlalchemy import Column, Integer, String, Date, Time, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class Subasta(Base):
    __tablename__ = "subastas"

    identificador       = Column(Integer, primary_key=True, autoincrement=True)
    fecha               = Column(Date)
    hora                = Column(Time)
    estado              = Column(String, default="cerrada")
    subastador          = Column(Integer, ForeignKey("subastadores.identificador"))
    ubicacion           = Column(String)
    capacidadasistentes = Column(Integer)
    tienedeposito       = Column(String)
    seguridadpropia     = Column(String)
    categoria           = Column(String)

    catalogos_rel   = relationship("Catalogo", back_populates="subasta_rel")
    asistentes_rel  = relationship("Asistente", back_populates="subasta_rel")
