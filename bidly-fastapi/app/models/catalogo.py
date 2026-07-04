from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class Catalogo(Base):
    __tablename__ = "catalogos"

    identificador = Column(Integer, primary_key=True, autoincrement=True)
    descripcion   = Column(String)
    subasta       = Column(Integer, ForeignKey("subastas.identificador"))
    responsable   = Column(Integer, ForeignKey("empleados.identificador"), nullable=False)

    subasta_rel   = relationship("Subasta", back_populates="catalogos_rel")
    items_rel     = relationship("ItemCatalogo", back_populates="catalogo_rel")
