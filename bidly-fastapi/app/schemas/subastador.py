from pydantic import BaseModel, ConfigDict
from typing import Optional


class SubastadorCreate(BaseModel):
    identificador: int
    matricula: Optional[str] = None
    region: Optional[str] = None


class SubastadorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    identificador: int
    matricula: Optional[str] = None
    region: Optional[str] = None
    nombre: Optional[str] = None
