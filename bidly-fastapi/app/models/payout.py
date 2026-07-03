from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey
from app.database import Base


class Payout(Base):
    """Pago al dueño por un bien vendido (o comprado por la empresa si nadie pujó).

    Neto = importe bruto − comisión. Se acredita en una cuenta a la vista declarada.
    Tabla nueva, no protegida (registrodesubasta no se toca).
    """
    __tablename__ = "payouts"

    identificador  = Column(Integer, primary_key=True, autoincrement=True)
    duenio         = Column(Integer, ForeignKey("duenios.identificador"))
    producto       = Column(Integer, ForeignKey("productos.identificador"))
    subasta        = Column(Integer, ForeignKey("subastas.identificador"))
    importe_bruto  = Column(Numeric(precision=18, scale=2))
    comision       = Column(Numeric(precision=18, scale=2))
    importe_neto   = Column(Numeric(precision=18, scale=2))
    origen         = Column(String, default="venta")   # 'venta' | 'empresa'
    cuenta         = Column(Integer, ForeignKey("cuentas_duenio.identificador"))
    estado         = Column(String, default="pendiente")  # 'pendiente' | 'pagado'
    creado_en      = Column(DateTime)
    pagado_en      = Column(DateTime)
