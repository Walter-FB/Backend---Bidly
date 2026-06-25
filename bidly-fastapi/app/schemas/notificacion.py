from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


class NotificacionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    identificador: int
    cliente: Optional[int] = None
    tipo: Optional[str] = None
    mensaje: Optional[str] = None
    leida: Optional[str] = None
    fechahora: Optional[datetime] = None
