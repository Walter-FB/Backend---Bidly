from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import datetime


class NotificacionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    identificador: int
    cliente: Optional[int] = None
    tipo: Optional[str] = None
    mensaje: Optional[str] = None
    leida: Optional[str] = None
    fechahora: Optional[datetime] = Field(default=None, serialization_alias="fechaHora")
