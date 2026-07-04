from sqlalchemy import Column, Integer, String, Numeric, Date, ForeignKey
from app.database import Base


class Multa(Base):
    __tablename__ = "multas"

    identificador = Column(Integer, primary_key=True, autoincrement=True)
    cliente       = Column(Integer, ForeignKey("clientes.identificador"))
    pujo          = Column(Integer, ForeignKey("pujos.identificador"))
    importe       = Column(Numeric(precision=12, scale=2))
    pagada        = Column(String, default="no")
    fechagenerada = Column(Date)
