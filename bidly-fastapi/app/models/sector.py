from sqlalchemy import Column, Integer, String
from app.database import Base


class Sector(Base):
    """Sector/región de la empresa (tabla protegida de Godio, ahora con uso real).

    Agrupa empleados (empleados.sector → sectores) y se relaciona con los
    subastadores por región (subastadores.region == sectores.nombresector).

    `responsablesector` se declara sin ForeignKey en el modelo a propósito: la
    FK real a empleados ya existe en la DB (EstructuraActual.sql), pero declararla
    acá crearía un ciclo empleados↔sectores que rompe create_all en local.
    """
    __tablename__ = "sectores"

    identificador     = Column(Integer, primary_key=True, autoincrement=True)
    nombresector      = Column(String, nullable=False)
    codigosector      = Column(String)
    responsablesector = Column(Integer)
