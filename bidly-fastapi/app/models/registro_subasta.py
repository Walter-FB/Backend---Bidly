from sqlalchemy import Column, Integer, Numeric, ForeignKey
from app.database import Base


class RegistroDeSubasta(Base):
    __tablename__ = "registrodesubasta"

    identificador = Column(Integer, primary_key=True, autoincrement=True)
    subasta       = Column(Integer, ForeignKey("subastas.identificador"))
    duenio        = Column(Integer, ForeignKey("duenios.identificador"))
    producto      = Column(Integer, ForeignKey("productos.identificador"))
    cliente       = Column(Integer, ForeignKey("clientes.identificador"))
    importe       = Column(Numeric(precision=12, scale=2))
    comision      = Column(Numeric(precision=12, scale=2))
