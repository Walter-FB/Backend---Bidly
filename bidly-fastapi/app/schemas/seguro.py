from pydantic import BaseModel, ConfigDict
from typing import Optional
from decimal import Decimal


class SeguroCreate(BaseModel):
    nroPoliza: str
    compania: Optional[str] = None
    polizaCombinada: Optional[str] = None
    importe: Optional[Decimal] = None


class SeguroUpdate(BaseModel):
    compania: Optional[str] = None
    polizaCombinada: Optional[str] = None
    importe: Optional[Decimal] = None


class SeguroResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    nropoliza: str
    compania: Optional[str] = None
    polizacombinada: Optional[str] = None
    importe: Optional[Decimal] = None
