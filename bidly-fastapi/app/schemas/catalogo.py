from pydantic import BaseModel, ConfigDict
from typing import Optional
from decimal import Decimal


class CatalogoCreate(BaseModel):
    descripcion: Optional[str] = None
    subasta: int
    responsable: Optional[int] = None


class CatalogoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    identificador: int
    descripcion: Optional[str] = None
    subasta: Optional[int] = None
    responsable: Optional[int] = None


class ItemCatalogoCreate(BaseModel):
    producto: int
    precioBase: Decimal


class ItemCatalogoResponse(BaseModel):
    identificador: int
    catalogo: Optional[int] = None
    producto: Optional[int] = None
    preciobase: Optional[Decimal] = None
    comision: Optional[Decimal] = None
    subastado: Optional[str] = None
    descripcionCatalogo: Optional[str] = None
    descripcionCompleta: Optional[str] = None
