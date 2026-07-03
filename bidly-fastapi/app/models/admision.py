from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey
from app.database import Base


class Admision(Base):
    """Solicitud de admisión de un artículo a subasta (tabla nueva, no protegida).

    Ciclo de vida (columna `estado`):
      solicitada        → el dueño cargó el bien y las declaraciones
      en_inspeccion     → la empresa pidió enviar el bien a inspección
      rechazada         → la empresa no lo acepta (observacion = causas)
      propuesta         → la empresa lo aceptó y propone valor base + comisión
      aprobada          → el dueño aceptó valor base/comisión → pasa al catálogo
      rechazada_duenio  → el dueño no aceptó valor/comisión (devolución con gastos)
    """
    __tablename__ = "admisiones"

    identificador     = Column(Integer, primary_key=True, autoincrement=True)
    producto          = Column(Integer, ForeignKey("productos.identificador"))
    duenio            = Column(Integer, ForeignKey("duenios.identificador"))
    estado            = Column(String, default="solicitada")

    # Declaraciones obligatorias del dueño.
    declara_propiedad = Column(String, default="no")   # 'si' | 'no'
    declara_origen    = Column(String, default="no")   # 'si' | 'no' (origen lícito)

    # Datos del proceso.
    direccion_envio   = Column(String)                 # a dónde enviar para inspección
    observacion       = Column(String)                 # causas de rechazo
    valor_base        = Column(Numeric(precision=18, scale=2))   # propuesto por la empresa
    comision          = Column(Numeric(precision=18, scale=2))   # propuesta por la empresa
    subasta           = Column(Integer, ForeignKey("subastas.identificador"))  # asignada al aceptar
    gastos_devolucion = Column(Numeric(precision=18, scale=2))

    # Colección: si son muchos ítems de un mismo dueño se agrupan en una subasta.
    es_coleccion      = Column(String, default="no")
    nombre_coleccion  = Column(String)

    creado_en         = Column(DateTime)
    actualizado_en    = Column(DateTime)
