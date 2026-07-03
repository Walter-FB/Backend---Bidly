from pydantic import BaseModel
from typing import Optional
from decimal import Decimal


class AsistenteRef(BaseModel):
    identificador: int


class ItemRef(BaseModel):
    identificador: int


class PujaCreate(BaseModel):
    asistente: AsistenteRef
    item: ItemRef
    importe: Decimal


class PujaResponse(BaseModel):
    identificador: int
    asistente: Optional[int] = None
    item: Optional[int] = None
    importe: Optional[Decimal] = None
    ganador: Optional[str] = None
