from sqlalchemy import Column, Integer, String, ForeignKey
from app.database import Base


class ProductoCategoria(Base):
    __tablename__ = "producto_categoria"

    producto  = Column(Integer, ForeignKey("productos.identificador"), primary_key=True)
    categoria = Column(String, nullable=False)
