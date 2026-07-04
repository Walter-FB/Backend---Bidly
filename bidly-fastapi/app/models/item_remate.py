from sqlalchemy import Column, Integer, DateTime, ForeignKey
from app.database import Base


class ItemRemate(Base):
    """Timer del ítem que se está rematando (tabla propia — no toca las 16 del profe).

    Un ítem "activo" (el que se está subastando ahora) tiene acá su `termina_en`.
    El remate arranca con 3 minutos y suma 15s por cada puja; al llegar a 0 el ítem
    se adjudica solo y arranca el siguiente del catálogo. PK = item, así que hay
    a lo sumo una fila por ítem (y el catálogo va de a uno).
    """
    __tablename__ = "item_remate"

    item       = Column(Integer, ForeignKey("itemscatalogo.identificador"), primary_key=True)
    termina_en = Column(DateTime)
