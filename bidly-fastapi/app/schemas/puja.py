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
    medioPagoId: Optional[int] = None  # medio con el que pagaría si gana (limita la puja)


class PujaResponse(BaseModel):
    identificador: int
    asistente: Optional[int] = None
    item: Optional[int] = None
    importe: Optional[Decimal] = None
    ganador: Optional[str] = None
