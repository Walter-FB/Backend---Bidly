from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from app.database import Base


class ClientePushToken(Base):
    __tablename__ = "cliente_push_tokens"

    id        = Column(Integer, primary_key=True, autoincrement=True)
    cliente   = Column(Integer, ForeignKey("clientes.identificador"), unique=True, nullable=False)
    token     = Column(String, nullable=False)
    creado_en = Column(DateTime, default=datetime.utcnow)
