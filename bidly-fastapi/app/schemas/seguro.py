from pydantic import BaseModel, ConfigDict, Field
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
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    nropoliza: str = Field(serialization_alias="nroPoliza")
    compania: Optional[str] = None
    polizacombinada: Optional[str] = Field(default=None, serialization_alias="polizaCombinada")
    importe: Optional[Decimal] = None
