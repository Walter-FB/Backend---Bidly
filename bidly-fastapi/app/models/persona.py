from sqlalchemy import Column, Integer, String, LargeBinary
from app.database import Base


class Persona(Base):
    __tablename__ = "personas"

    identificador = Column(Integer, primary_key=True, autoincrement=True)
    documento     = Column(String)
    nombre        = Column(String)
    direccion     = Column(String)
    estado        = Column(String)
    foto          = Column(LargeBinary)
