from pydantic import BaseModel
from typing import Optional


class CuentaCreate(BaseModel):
    duenioId: int
    alias: str
    banco: Optional[str] = None
    pais: Optional[str] = None
    moneda: Optional[str] = "pesos"
    esExterior: Optional[bool] = False


class PagarPayoutRequest(BaseModel):
    cuentaId: int
