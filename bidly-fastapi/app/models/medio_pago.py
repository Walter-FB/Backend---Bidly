from sqlalchemy import Column, Integer, String, Numeric, ForeignKey
from app.database import Base


class MedioPago(Base):
    __tablename__ = "mediosdepago"

    identificador = Column(Integer, primary_key=True, autoincrement=True)
    cliente       = Column(Integer, ForeignKey("clientes.identificador"))
    tipo          = Column(String)
    numerotarjeta = Column(String)
    vencimiento   = Column(String)
    titular       = Column(String)
    numerocuenta  = Column(String)
    banco         = Column(String)
    numerocheque  = Column(String)
    montocheque   = Column(Numeric(precision=12, scale=2))
    verificado    = Column(String, default="no")
