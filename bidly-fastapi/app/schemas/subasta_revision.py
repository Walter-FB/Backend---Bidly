from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


class RechazarRequest(BaseModel):
    observacion: Optional[str] = None


class SubastaRevisionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    identificador: int
    subasta: Optional[int] = None
    solicitante: Optional[int] = None
    estado: Optional[str] = None
    fechasolicitud: Optional[datetime] = None
    fecharevision: Optional[datetime] = None
    observacion: Optional[str] = None
