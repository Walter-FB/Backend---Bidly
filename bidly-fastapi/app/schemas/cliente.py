from pydantic import BaseModel, ConfigDict
from typing import Optional


class ClienteCreate(BaseModel):
    identificador: int
    numeroPais: Optional[int] = None
    verificador: Optional[int] = None


class CategoriaUpdate(BaseModel):
    categoria: str


class AdmitidoUpdate(BaseModel):
    admitido: str


class ClienteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    identificador: int
    numeropais: Optional[int] = None
    admitido: Optional[str] = None
    categoria: Optional[str] = None
    verificador: Optional[int] = None
    nombre: Optional[str] = None
    email: Optional[str] = None
