from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey
from app.database import Base


class RegistroPago(Base):
    __tablename__ = "registro_pago"

    registro     = Column(Integer, ForeignKey("registrodesubasta.identificador"), primary_key=True)
    estado       = Column(String, default="pendiente")
    medio_pago   = Column(Integer, ForeignKey("mediosdepago.identificador"))
    importe_total= Column(Numeric(precision=12, scale=2))
    fecha_pago   = Column(DateTime)
