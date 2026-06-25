import uuid
import secrets
from datetime import datetime, timedelta
from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session
from app.database import get_db

# token UUID → { clienteId, email, nombre, categoria, admitido, rol }
_token_store: dict[str, dict] = {}

# email → (code: str, expires_at: datetime)
_verification_codes: dict[str, tuple[str, datetime]] = {}

# token UUID → email
_verification_tokens: dict[str, str] = {}


def generate_token() -> str:
    return str(uuid.uuid4())


def store_token(token: str, data: dict) -> None:
    _token_store[token] = data


def get_token_data(token: str) -> dict | None:
    return _token_store.get(token)


def invalidate_token(token: str) -> None:
    _token_store.pop(token, None)


def generate_verification_code() -> str:
    return str(secrets.randbelow(900000) + 100000)


def store_verification_code(email: str, code: str, minutes: int = 10) -> None:
    expires = datetime.utcnow() + timedelta(minutes=minutes)
    _verification_codes[email] = (code, expires)


def validate_verification_code(email: str, code: str) -> bool:
    entry = _verification_codes.get(email)
    if not entry:
        return False
    stored_code, expires = entry
    if datetime.utcnow() > expires:
        _verification_codes.pop(email, None)
        return False
    return stored_code == code


def consume_verification_code(email: str) -> None:
    _verification_codes.pop(email, None)


def store_verification_token(token: str, email: str) -> None:
    _verification_tokens[token] = email


def get_email_from_verification_token(token: str) -> str | None:
    return _verification_tokens.get(token)


def consume_verification_token(token: str) -> None:
    _verification_tokens.pop(token, None)


def get_current_client(
    authorization: str = Header(default=None),
    db: Session = Depends(get_db),
) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token requerido")
    token = authorization.split(" ", 1)[1].strip()
    data = get_token_data(token)
    if not data:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")
    return data
