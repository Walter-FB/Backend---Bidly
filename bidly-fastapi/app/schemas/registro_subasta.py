from pydantic import BaseModel, ConfigDict
from typing import Optional
from decimal import Decimal


class RegistroCreate(BaseModel):
    subasta: int
    duenio: int
    producto: int
    cliente: int
    importe: Decimal
    comision: Decimal


class PagarRequest(BaseModel):
    medioPagoId: int


class ReembolsoUpdate(BaseModel):
    reembolsada: str


class RegistroResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    identificador: int
    subasta: Optional[int] = None
    duenio: Optional[int] = None
    producto: Optional[int] = None
    cliente: Optional[int] = None
    importe: Optional[Decimal] = None
    comision: Optional[Decimal] = None
    reembolsada: Optional[str] = None
    estadoPago: Optional[str] = None
    medioPago: Optional[int] = None
    importeTotal: Optional[Decimal] = None
    fechaPago: Optional[str] = None
