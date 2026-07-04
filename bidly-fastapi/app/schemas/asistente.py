from pydantic import BaseModel, ConfigDict
from typing import Optional


class InscribirRequest(BaseModel):
    clienteId: int
    subastaId: int


class AsistenteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    identificador: int
    numeropostor: Optional[int] = None
    cliente: Optional[int] = None
    subasta: Optional[int] = None
