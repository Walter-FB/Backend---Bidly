from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import date


class ProductoCreate(BaseModel):
    descripcionCatalogo: Optional[str] = None
    descripcionCompleta: Optional[str] = None
    disponible: Optional[str] = "si"
    duenio: int
    seguro: Optional[str] = None


class DisponibleUpdate(BaseModel):
    disponible: str


class ProductoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    identificador: int
    fecha: Optional[date] = None
    disponible: Optional[str] = None
    descripcioncatalogo: Optional[str] = Field(default=None, serialization_alias="descripcionCatalogo")
    descripcioncompleta: Optional[str] = Field(default=None, serialization_alias="descripcionCompleta")
    revisor: Optional[int] = None
    duenio: Optional[int] = None
    seguro: Optional[str] = None
