from pydantic import BaseModel
from typing import Optional


class SendVerificationRequest(BaseModel):
    email: str


class VerifyCodeRequest(BaseModel):
    email: str
    code: str


class VerifyCodeResponse(BaseModel):
    verificationToken: str


class RegisterRequest(BaseModel):
    email: str
    password: str
    verificationToken: str
    nombre: Optional[str] = None
    documento: Optional[str] = None
    direccion: Optional[str] = None
    numeroPais: Optional[int] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    token: str
    clienteId: int
    email: str
    nombre: Optional[str] = None
    categoria: Optional[str] = None
    admitido: Optional[str] = None
    rol: Optional[str] = "postor"
