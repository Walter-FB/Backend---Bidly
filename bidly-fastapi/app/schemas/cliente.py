from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from decimal import Decimal


class ClienteCreate(BaseModel):
    identificador: int
    numeroPais: Optional[int] = None
    verificador: Optional[int] = None


class CategoriaUpdate(BaseModel):
    categoria: str


class AdmitidoUpdate(BaseModel):
    admitido: str


class MedioPagoCreate(BaseModel):
    tipo: str
    numeroTarjeta: Optional[str] = None
    vencimiento: Optional[str] = None
    titular: Optional[str] = None
    numeroCuenta: Optional[str] = None
    banco: Optional[str] = None
    numeroCheque: Optional[str] = None
    montoCheque: Optional[Decimal] = None
    verificado: Optional[str] = "no"


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
    verificado: Optional[str] = None


class ClienteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    identificador: int
    numeropais: Optional[int] = None
    admitido: Optional[str] = None
    categoria: Optional[str] = None
    verificador: Optional[int] = None
    nombre: Optional[str] = None
    email: Optional[str] = None
