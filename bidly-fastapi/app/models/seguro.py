from sqlalchemy import Column, String, Numeric
from app.database import Base


class Seguro(Base):
    __tablename__ = "seguros"

    nropoliza       = Column(String, primary_key=True)
    compania        = Column(String)
    polizacombinada = Column(String)
    importe         = Column(Numeric(precision=12, scale=2))
