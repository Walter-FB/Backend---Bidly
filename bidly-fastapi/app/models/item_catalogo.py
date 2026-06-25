from sqlalchemy import Column, Integer, String, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class ItemCatalogo(Base):
    __tablename__ = "itemscatalogo"

    identificador = Column(Integer, primary_key=True, autoincrement=True)
    catalogo      = Column(Integer, ForeignKey("catalogos.identificador"))
    producto      = Column(Integer, ForeignKey("productos.identificador"))
    preciobase    = Column(Numeric(precision=12, scale=2))
    comision      = Column(Numeric(precision=12, scale=2))
    subastado     = Column(String, default="no")

    catalogo_rel  = relationship("Catalogo", back_populates="items_rel")
    producto_rel  = relationship("Producto")
    pujas_rel     = relationship("Puja", back_populates="item_rel")
