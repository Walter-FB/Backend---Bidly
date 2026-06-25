from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from app.database import Base


class SubastaEstadoAdmin(Base):
    __tablename__ = "subasta_estado_admin"

    subasta            = Column(Integer, ForeignKey("subastas.identificador"), primary_key=True)
    estado             = Column(String)
    alguna_vez_abierta = Column(Boolean, default=False)
    fecha_apertura     = Column(DateTime)
    estado_subasta     = Column(String, default="pendiente")
    fecha_inicio_real  = Column(DateTime)
    fecha_finalizacion = Column(DateTime)
