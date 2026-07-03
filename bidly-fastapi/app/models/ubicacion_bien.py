from sqlalchemy import Column, Integer, String, ForeignKey
from app.database import Base


class UbicacionBien(Base):
    """Depósito donde se guarda un bien entregado para subasta (tabla nueva).

    La póliza del seguro se guarda en `productos.seguro` (nropoliza); acá va el
    depósito físico para que el dueño pueda verlo desde la app.
    """
    __tablename__ = "ubicacion_bien"

    producto = Column(Integer, ForeignKey("productos.identificador"), primary_key=True)
    deposito = Column(String)
