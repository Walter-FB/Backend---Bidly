from sqlalchemy import Column, Integer, LargeBinary, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class Foto(Base):
    __tablename__ = "fotos"

    identificador = Column(Integer, primary_key=True, autoincrement=True)
    producto      = Column(Integer, ForeignKey("productos.identificador"))
    foto          = Column(LargeBinary)

    producto_rel  = relationship("Producto", back_populates="fotos_rel")
