from sqlalchemy import Column, Integer, String, ForeignKey
from app.database import Base


class SubastaMoneda(Base):
    __tablename__ = "subasta_moneda"

    subasta = Column(Integer, ForeignKey("subastas.identificador"), primary_key=True)
    moneda  = Column(String)
