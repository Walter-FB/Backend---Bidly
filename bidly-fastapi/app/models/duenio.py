from sqlalchemy import Column, Integer, String, ForeignKey
from app.database import Base


class Duenio(Base):
    __tablename__ = "duenios"

    identificador          = Column(Integer, ForeignKey("personas.identificador"), primary_key=True)
    numeropais             = Column(Integer)
    verificacionfinanciera = Column(String)
    verificacionjudicial   = Column(String)
    calificacionriesgo     = Column(Integer)
    verificador            = Column(Integer, ForeignKey("empleados.identificador"), nullable=False)
