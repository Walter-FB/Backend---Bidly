from pydantic import BaseModel
from typing import Optional
from datetime import date, time
from decimal import Decimal


class SubastaCreate(BaseModel):
    # Opcionales: una subasta puede crearse sin fecha ("a confirmar") y definirse
    # después (o al aceptar la propuesta el dueño, según el modo de la admisión).
    fecha: Optional[date] = None
    hora: Optional[time] = None
    estado: Optional[str] = "cerrada"
    subastador: int
    ubicacion: Optional[str] = None
    capacidadAsistentes: Optional[int] = None
    tieneDeposito: Optional[str] = None
    seguridadPropia: Optional[str] = None
    categoria: Optional[str] = None
    moneda: Optional[str] = "pesos"  # 'pesos' | 'dolares' → subasta_moneda


class SubastaEstadoUpdate(BaseModel):
    estado: str  # 'abierta' | 'cerrada'


class SubastaResponse(BaseModel):
    identificador: int
    fecha: Optional[date] = None
    hora: Optional[time] = None
    estado: Optional[str] = None
    subastador: Optional[int] = None
    ubicacion: Optional[str] = None
    capacidadasistentes: Optional[int] = None
    tienedeposito: Optional[str] = None
    seguridadpropia: Optional[str] = None
    categoria: Optional[str] = None
    precioBase: Optional[Decimal] = None
    totalItems: Optional[int] = None
    itemsPendientes: Optional[int] = None
    titulo: Optional[str] = None
    totalAsistentes: Optional[int] = None
