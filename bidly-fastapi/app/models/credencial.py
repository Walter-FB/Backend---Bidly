from sqlalchemy import Column, Integer, String, ForeignKey
from app.database import Base


class Credencial(Base):
    __tablename__ = "credenciales"

    cliente      = Column(Integer, ForeignKey("clientes.identificador"), primary_key=True)
    email        = Column(String, unique=True)
    passwordhash = Column(String)
