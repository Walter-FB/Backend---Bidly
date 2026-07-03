from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from app.database import Base


class CuentaDuenio(Base):
    """Cuenta a la vista donde el dueño recibe el dinero de lo vendido.

    Puede ser del exterior y debe declararse antes del inicio de la subasta
    (tabla nueva, no protegida).
    """
    __tablename__ = "cuentas_duenio"

    identificador = Column(Integer, primary_key=True, autoincrement=True)
    duenio        = Column(Integer, ForeignKey("duenios.identificador"))
    alias         = Column(String)   # CBU / IBAN / alias
    banco         = Column(String)
    pais          = Column(String)
    moneda        = Column(String)   # 'pesos' | 'dolares'
    es_exterior   = Column(String, default="no")  # 'si' | 'no'
    declarada_en  = Column(DateTime)
