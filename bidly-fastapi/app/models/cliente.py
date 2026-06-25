from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class Cliente(Base):
    __tablename__ = "clientes"

    identificador = Column(Integer, ForeignKey("personas.identificador"), primary_key=True)
    numeropais    = Column(Integer)
    admitido      = Column(String, default="no")
    categoria     = Column(String, default="comun")
    verificador   = Column(Integer, ForeignKey("empleados.identificador"), nullable=False)

    persona       = relationship("Persona", foreign_keys=[identificador])
