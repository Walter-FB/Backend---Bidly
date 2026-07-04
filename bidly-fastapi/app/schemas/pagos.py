"""Schemas del dominio de pagos: medios de pago, multas, cuentas y payouts."""
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from decimal import Decimal
from datetime import date


# ── Medios de pago (postor) ───────────────────────────────────────────────────
class MedioPagoCreate(BaseModel):
    # tipo: 'debito' | 'credito' | 'cuenta' | 'cheque' (legacy 'tarjeta' -> debito)
    tipo: str
    subtipo: Optional[str] = None          # 'debito' | 'credito' cuando tipo='tarjeta'
    numeroTarjeta: Optional[str] = None
    vencimiento: Optional[str] = None
    titular: Optional[str] = None
    numeroCuenta: Optional[str] = None
    banco: Optional[str] = None
    numeroCheque: Optional[str] = None
    montoCheque: Optional[Decimal] = None   # monto certificado del cheque (lo elige el usuario)
    monto: Optional[Decimal] = None         # monto reservado de la cuenta (lo elige el usuario)
    saldo: Optional[Decimal] = None
    verificado: Optional[str] = None


class MedioPagoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    identificador: int
    cliente: Optional[int] = None
    tipo: Optional[str] = None
    numerotarjeta: Optional[str] = Field(default=None, serialization_alias="numeroTarjeta")
    vencimiento: Optional[str] = None
    titular: Optional[str] = None
    numerocuenta: Optional[str] = Field(default=None, serialization_alias="numeroCuenta")
    banco: Optional[str] = None
    numerocheque: Optional[str] = Field(default=None, serialization_alias="numeroCheque")
    montocheque: Optional[Decimal] = Field(default=None, serialization_alias="montoCheque")
    limite: Optional[Decimal] = None
    saldo: Optional[Decimal] = None
    verificado: Optional[str] = None


class VerificarMedioRequest(BaseModel):
    verificado: str = "si"


# ── Multas ────────────────────────────────────────────────────────────────────
class MultaUpdate(BaseModel):
    pagada: str


class MultaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    identificador: int
    cliente: Optional[int] = None
    pujo: Optional[int] = None
    importe: Optional[Decimal] = None
    pagada: Optional[str] = None
    fechagenerada: Optional[date] = Field(default=None, serialization_alias="fechaGenerada")


# ── Cuentas del dueño + payouts ───────────────────────────────────────────────
class CuentaCreate(BaseModel):
    duenioId: int
    alias: str
    banco: Optional[str] = None
    pais: Optional[str] = None
    moneda: Optional[str] = "pesos"
    esExterior: Optional[bool] = False


class PagarPayoutRequest(BaseModel):
    cuentaId: int
