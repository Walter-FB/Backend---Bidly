from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from app.database import Base


class DniVerificacion(Base):
    __tablename__ = "dni_verificacion"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    clienteid  = Column(Integer, ForeignKey("clientes.identificador"))
    fotofrente = Column(String)
    fotodorso  = Column(String)
    creadoen   = Column(DateTime)
