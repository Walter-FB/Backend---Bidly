from sqlalchemy import Column, Integer, String, ForeignKey
from app.database import Base


class UsuarioRol(Base):
    __tablename__ = "usuario_rol"

    cliente = Column(Integer, ForeignKey("clientes.identificador"), primary_key=True)
    rol     = Column(String, default="postor")
