from pydantic import BaseModel
from typing import Optional
from decimal import Decimal


class AdmisionCreate(BaseModel):
    productoId: int
    duenioId: int
    declaraPropiedad: bool = False
    declaraOrigen: bool = False


class InspeccionRequest(BaseModel):
    direccionEnvio: str


class RechazarAdmisionRequest(BaseModel):
    observacion: str
    gastosDevolucion: Optional[Decimal] = None


class ProponerRequest(BaseModel):
    valorBase: Decimal
    comision: Optional[Decimal] = None
    subastaId: int


class RechazarDuenioRequest(BaseModel):
    gastosDevolucion: Optional[Decimal] = None


class AprobarDuenioRequest(BaseModel):
    # Cobertura Premium Bidly: cobertura reforzada por 5% del valor base, que se
    # descuenta del cobro del dueño al vender.
    garantiaPremium: bool = False
