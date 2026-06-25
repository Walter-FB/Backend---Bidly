from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from app.database import Base


class SubastaRevision(Base):
    __tablename__ = "subasta_revision"

    identificador  = Column(Integer, primary_key=True, autoincrement=True)
    subasta        = Column(Integer, ForeignKey("subastas.identificador"), unique=True)
    solicitante    = Column(Integer, ForeignKey("clientes.identificador"))
    estado         = Column(String, default="pendiente")
    fechasolicitud = Column(DateTime)
    fecharevision  = Column(DateTime)
    observacion    = Column(String)
