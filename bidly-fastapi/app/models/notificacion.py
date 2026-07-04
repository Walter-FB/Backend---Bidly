from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from app.database import Base


class Notificacion(Base):
    __tablename__ = "notificaciones"

    identificador = Column(Integer, primary_key=True, autoincrement=True)
    cliente       = Column(Integer, ForeignKey("clientes.identificador"))
    tipo          = Column(String)
    mensaje       = Column(String)
    leida         = Column(String, default="no")
    fechahora     = Column(DateTime)
