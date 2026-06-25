from sqlalchemy import Column, Integer, String, ForeignKey
from app.database import Base

EMPLEADO_SISTEMA = 1


class Empleado(Base):
    __tablename__ = "empleados"

    identificador = Column(Integer, ForeignKey("personas.identificador"), primary_key=True)
    cargo         = Column(String)
    sector        = Column(Integer, ForeignKey("sectores.identificador"))
