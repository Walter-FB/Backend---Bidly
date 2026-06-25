from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.database import get_db
from app.auth import (
    generate_token, store_token, get_current_client,
    generate_verification_code, store_verification_code, validate_verification_code,
    consume_verification_code, store_verification_token,
    get_email_from_verification_token, consume_verification_token,
)
from app.schemas.auth import (
    SendVerificationRequest, VerifyCodeRequest, VerifyCodeResponse,
    RegisterRequest, LoginRequest, AuthResponse,
)
from app.models.credencial import Credencial
from app.models.persona import Persona
from app.models.cliente import Cliente
from app.models.usuario_rol import UsuarioRol
from app.models.empleado import Empleado, EMPLEADO_SISTEMA
from app.services.email_service import send_verification_code
from app.services.usuario_rol_service import obtener_rol

router = APIRouter()


@router.post("/send-verification")
async def send_verification(body: SendVerificationRequest, db: Session = Depends(get_db)):
    code = generate_verification_code()
    store_verification_code(body.email, code)
    await send_verification_code(body.email, code)
    return {}


@router.post("/verify-code", response_model=VerifyCodeResponse)
def verify_code(body: VerifyCodeRequest, db: Session = Depends(get_db)):
    if not validate_verification_code(body.email, body.code):
        raise HTTPException(400, detail={"message": "Código incorrecto o expirado", "code": "INVALID_CODE"})
    consume_verification_code(body.email)
    token = generate_token()
    store_verification_token(token, body.email)
    return VerifyCodeResponse(verificationToken=token)


@router.post("/register", response_model=AuthResponse)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    email = get_email_from_verification_token(body.verificationToken)
    if not email:
        raise HTTPException(400, detail={"message": "Token de verificación inválido", "code": "INVALID_VERIFICATION_TOKEN"})

    existing = db.query(Credencial).filter(Credencial.email == email).first()
    if existing:
        raise HTTPException(409, detail={"message": "Email ya registrado", "code": "EMAIL_TAKEN"})

    # Usar el primer empleado disponible como verificador
    empleado = db.query(Empleado).filter(Empleado.identificador == EMPLEADO_SISTEMA).first()
    verificador_id = empleado.identificador if empleado else EMPLEADO_SISTEMA

    persona = Persona(
        nombre=body.nombre,
        documento=body.documento,
        direccion=body.direccion,
        estado="activo",
    )
    db.add(persona)
    db.flush()

    cliente = Cliente(
        identificador=persona.identificador,
        numeropais=body.numeroPais,
        admitido="no",
        categoria="comun",
        verificador=verificador_id,
    )
    db.add(cliente)
    db.flush()

    cred = Credencial(
        cliente=cliente.identificador,
        email=email,
        passwordhash=body.password,
    )
    db.add(cred)

    rol_obj = UsuarioRol(cliente=cliente.identificador, rol="postor")
    db.add(rol_obj)
    db.commit()

    consume_verification_token(body.verificationToken)

    token = generate_token()
    data = {
        "clienteId": cliente.identificador,
        "email": email,
        "nombre": persona.nombre,
        "categoria": cliente.categoria,
        "admitido": cliente.admitido,
        "rol": "postor",
    }
    store_token(token, data)
    return AuthResponse(token=token, **data)


@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    cred = db.query(Credencial).filter(Credencial.email == body.email).first()
    if not cred or cred.passwordhash != body.password:
        raise HTTPException(401, detail={"message": "Credenciales inválidas", "code": "INVALID_CREDENTIALS"})

    cliente = db.query(Cliente).filter(Cliente.identificador == cred.cliente).first()
    persona = db.query(Persona).filter(Persona.identificador == cred.cliente).first()
    rol = obtener_rol(cred.cliente, db)

    token = generate_token()
    data = {
        "clienteId": cred.cliente,
        "email": cred.email,
        "nombre": persona.nombre if persona else None,
        "categoria": cliente.categoria if cliente else None,
        "admitido": cliente.admitido if cliente else None,
        "rol": rol,
    }
    store_token(token, data)
    return AuthResponse(token=token, **data)


@router.get("/me", response_model=AuthResponse)
def me(
    current: dict = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    cliente_id = current["clienteId"]
    cred    = db.query(Credencial).filter(Credencial.cliente == cliente_id).first()
    cliente = db.query(Cliente).filter(Cliente.identificador == cliente_id).first()
    persona = db.query(Persona).filter(Persona.identificador == cliente_id).first()
    rol     = obtener_rol(cliente_id, db)

    # Actualizar token store con datos frescos
    from app.auth import _token_store
    for token, tdata in _token_store.items():
        if tdata.get("clienteId") == cliente_id:
            tdata["categoria"] = cliente.categoria if cliente else None
            tdata["admitido"]  = cliente.admitido if cliente else None
            tdata["rol"]       = rol
            break

    return AuthResponse(
        token="",
        clienteId=cliente_id,
        email=cred.email if cred else current.get("email", ""),
        nombre=persona.nombre if persona else None,
        categoria=cliente.categoria if cliente else None,
        admitido=cliente.admitido if cliente else None,
        rol=rol,
    )
