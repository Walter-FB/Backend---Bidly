"""Modelos del dominio de pagos (postor) y cobros (dueño).

Agrupa 6 tablas de features restauradas, todas chicas:
  - mediosdepago   (MedioPago)    medios que registra el postor (tarjeta/cuenta/cheque)
  - multas         (Multa)        multa del 10% por impago + 72hs de límite
  - registro_pago  (RegistroPago) pago de la compra adjudicada (envío/retiro)
  - reembolsos     (Reembolso)    reembolso de una compra
  - payouts        (Payout)       pago al dueño por lo vendido (neto = bruto − comisión)
  - cuentas_duenio (CuentaDuenio) cuenta a la vista donde el dueño cobra

Ninguna toca la estructura de las 16 tablas del profe (sólo las referencian por FK).
"""
from sqlalchemy import Column, Integer, String, Numeric, Date, DateTime, ForeignKey
from app.database import Base


class MedioPago(Base):
    __tablename__ = "mediosdepago"

    identificador = Column(Integer, primary_key=True, autoincrement=True)
    cliente       = Column(Integer, ForeignKey("clientes.identificador"))
    tipo          = Column(String)          # 'tarjeta' | 'cuenta' | 'cheque'
    numerotarjeta = Column(String)
    vencimiento   = Column(String)
    titular       = Column(String)
    numerocuenta  = Column(String)
    banco         = Column(String)
    numerocheque  = Column(String)
    montocheque   = Column(Numeric(precision=12, scale=2))
    # Presupuesto del medio (imita la cuenta/tarjeta del usuario, en PESOS):
    #   - debito  -> 100.000 por defecto
    #   - credito -> 200.000 por defecto
    #   - cuenta / cheque -> el monto que declara el usuario
    # `limite` es el presupuesto original; `saldo` es lo que queda (se gasta al pagar).
    # En cheque/cuenta el `saldo` también funciona como tope de puja (garantía).
    limite        = Column(Numeric(precision=12, scale=2))
    saldo         = Column(Numeric(precision=12, scale=2))
    verificado    = Column(String, default="no")


class Multa(Base):
    __tablename__ = "multas"

    identificador = Column(Integer, primary_key=True, autoincrement=True)
    cliente       = Column(Integer, ForeignKey("clientes.identificador"))
    pujo          = Column(Integer, ForeignKey("pujos.identificador"))
    # 18,2 para no desbordar con pujas grandes (igual que pujos/registrodesubasta).
    importe       = Column(Numeric(precision=18, scale=2))
    pagada        = Column(String, default="no")
    fechagenerada = Column(Date)
    # Vencimiento de las 72hs para presentar los fondos. Pasado este límite con la
    # multa impaga, el caso se considera "derivado a la justicia" (cuenta suspendida).
    fecha_limite  = Column(DateTime, nullable=True)


class RegistroPago(Base):
    __tablename__ = "registro_pago"

    registro        = Column(Integer, ForeignKey("registrodesubasta.identificador"), primary_key=True)
    estado          = Column(String, default="pendiente")   # 'pendiente' | 'pagado' | 'impago'
    medio_pago      = Column(Integer, ForeignKey("mediosdepago.identificador"))
    # 18,2 (como pujos/registrodesubasta/payouts): con 12,2 desbordaba al cerrar una
    # subasta con puja grande (importe_total = puja + comisión) → 500 y quedaba clavada.
    importe_total   = Column(Numeric(precision=18, scale=2))
    fecha_pago      = Column(DateTime)
    envio           = Column(Numeric(precision=18, scale=2))
    direccion_envio = Column(String)
    retiro_personal = Column(String, default="no")


class Reembolso(Base):
    __tablename__ = "reembolsos"

    registro    = Column(Integer, ForeignKey("registrodesubasta.identificador"), primary_key=True)
    reembolsada = Column(String, default="no")   # 'si' cuando la empresa lo acredita
    # Flujo de solicitud: ninguno → solicitado → aceptado | rechazado.
    estado      = Column(String, default="ninguno")
    motivo      = Column(String)


class Payout(Base):
    """Pago al dueño por un bien vendido (o comprado por la empresa si nadie pujó).

    Neto = importe bruto − comisión. Se acredita en una cuenta a la vista declarada.
    """
    __tablename__ = "payouts"

    identificador  = Column(Integer, primary_key=True, autoincrement=True)
    duenio         = Column(Integer, ForeignKey("duenios.identificador"))
    producto       = Column(Integer, ForeignKey("productos.identificador"))
    subasta        = Column(Integer, ForeignKey("subastas.identificador"))
    importe_bruto  = Column(Numeric(precision=18, scale=2))
    comision       = Column(Numeric(precision=18, scale=2))
    # Costo de la Cobertura Premium Bidly (5% del valor base) descontado del cobro.
    premium        = Column(Numeric(precision=18, scale=2))
    importe_neto   = Column(Numeric(precision=18, scale=2))   # bruto − comisión − premium
    origen         = Column(String, default="venta")      # 'venta' | 'empresa'
    cuenta         = Column(Integer, ForeignKey("cuentas_duenio.identificador"))
    estado         = Column(String, default="pendiente")  # 'pendiente' | 'pagado'
    creado_en      = Column(DateTime)
    pagado_en      = Column(DateTime)


class CuentaDuenio(Base):
    """Cuenta a la vista donde el dueño recibe el dinero de lo vendido.

    Puede ser del exterior y debe declararse antes del inicio de la subasta.
    """
    __tablename__ = "cuentas_duenio"

    identificador = Column(Integer, primary_key=True, autoincrement=True)
    duenio        = Column(Integer, ForeignKey("duenios.identificador"))
    alias         = Column(String)   # CBU / IBAN / alias
    banco         = Column(String)
    pais          = Column(String)
    moneda        = Column(String)   # 'pesos' | 'dolares'
    es_exterior   = Column(String, default="no")   # 'si' | 'no'
    declarada_en  = Column(DateTime)
