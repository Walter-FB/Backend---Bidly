from pydantic import BaseModel, ConfigDict
from typing import Optional
from decimal import Decimal
from datetime import date


class MultaUpdate(BaseModel):
    pagada: str


class MultaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    identificador: int
    cliente: Optional[int] = None
    pujo: Optional[int] = None
    importe: Optional[Decimal] = None
    pagada: Optional[str] = None
    fechagenerada: Optional[date] = None
