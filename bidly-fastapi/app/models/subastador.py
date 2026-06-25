from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class Subastador(Base):
    __tablename__ = "subastadores"

    identificador = Column(Integer, ForeignKey("personas.identificador"), primary_key=True)
    matricula     = Column(String)
    region        = Column(String)

    persona       = relationship("Persona", foreign_keys=[identificador])
