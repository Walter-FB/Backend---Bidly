from sqlalchemy import Column, Integer, String, ForeignKey
from app.database import Base


class SubastaVentaModo(Base):
    """Modo de venta del catálogo de una subasta (tabla propia, patrón subasta_moneda).

    'individual' (default) → se remata pieza por pieza (timer por ítem).
    'bloque'               → única venta: una sola ronda de pujas sobre la base total
                             y el mejor postor se lleva TODAS las piezas. El importe se
                             prorratea por base entre las piezas (cada producto conserva
                             su registro, payout y seguro, como exige la DDL del profe).
    Sin fila = 'individual'.
    """
    __tablename__ = "subasta_venta_modo"

    subasta = Column(Integer, ForeignKey("subastas.identificador"), primary_key=True)
    modo    = Column(String, default="individual")  # 'individual' | 'bloque'
