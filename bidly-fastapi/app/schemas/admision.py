from pydantic import BaseModel
from typing import Optional
from decimal import Decimal
from datetime import date, time


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
    # None = tasar el bien y dejarlo SIN ASIGNAR (esperando; se mete a un catálogo
    # después desde el armador).
    subastaId: Optional[int] = None
    # Fecha/hora opcionales: si la empresa las manda en la propuesta, se le fijan a
    # la subasta asignada (subastas.fecha). Regla del profe: ≥10 días de anticipación.
    fecha: Optional[date] = None
    hora: Optional[time] = None


class RechazarDuenioRequest(BaseModel):
    gastosDevolucion: Optional[Decimal] = None


class AprobarDuenioRequest(BaseModel):
    # Cobertura Premium Bidly: cobertura reforzada por 5% del valor base, que se
    # descuenta del cobro del dueño al vender.
    garantiaPremium: bool = False
