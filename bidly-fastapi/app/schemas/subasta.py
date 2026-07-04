from pydantic import BaseModel, ConfigDict
from typing import Optional, Any
from datetime import date, time, datetime
from decimal import Decimal


class SubastaCreate(BaseModel):
    fecha: date
    hora: time
    estado: Optional[str] = "cerrada"
    subastador: int
    ubicacion: Optional[str] = None
    capacidadAsistentes: Optional[int] = None
    tieneDeposito: Optional[str] = None
    seguridadPropia: Optional[str] = None
    categoria: Optional[str] = None
    moneda: str


class SubastaEstadoUpdate(BaseModel):
    estado: str


class SesionResponse(BaseModel):
    itemActivoId: Optional[int] = None
    ordenActual: Optional[int] = None
    timerDesde: Optional[datetime] = None
    segundosRestantes: Optional[int] = None


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
    moneda: Optional[str] = None
    precioBase: Optional[Decimal] = None
    totalItems: Optional[int] = None
    titulo: Optional[str] = None
    totalAsistentes: Optional[int] = None
    revisionEstado: Optional[str] = None
    fase: Optional[str] = None
    segundosRestantes: Optional[int] = None
    itemsPendientes: Optional[int] = None
    algunaVezAbierta: Optional[bool] = None
    fechaApertura: Optional[datetime] = None
    estadoSubasta: Optional[str] = None
    fechaInicioReal: Optional[datetime] = None
