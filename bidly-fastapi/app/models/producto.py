from sqlalchemy import Column, Integer, String, Date, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class Producto(Base):
    __tablename__ = "productos"

    identificador       = Column(Integer, primary_key=True, autoincrement=True)
    fecha               = Column(Date)
    disponible          = Column(String, default="si")
    descripcioncatalogo = Column(String)
    descripcioncompleta = Column(String)
    revisor             = Column(Integer, ForeignKey("empleados.identificador"), nullable=False)
    duenio              = Column(Integer, ForeignKey("duenios.identificador"), nullable=False)
    seguro              = Column(String, ForeignKey("seguros.nropoliza"))

    fotos_rel           = relationship("Foto", back_populates="producto_rel")
