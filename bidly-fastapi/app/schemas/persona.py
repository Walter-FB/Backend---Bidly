from pydantic import BaseModel, ConfigDict
from typing import Optional


class PersonaCreate(BaseModel):
    documento: Optional[str] = None
    nombre: Optional[str] = None
    direccion: Optional[str] = None
    estado: Optional[str] = None


class PersonaUpdate(BaseModel):
    documento: Optional[str] = None
    nombre: Optional[str] = None
    direccion: Optional[str] = None
    estado: Optional[str] = None


class PersonaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    identificador: int
    documento: Optional[str] = None
    nombre: Optional[str] = None
    direccion: Optional[str] = None
    estado: Optional[str] = None
