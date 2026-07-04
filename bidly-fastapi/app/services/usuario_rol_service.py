from sqlalchemy.orm import Session
from app.models.usuario_rol import UsuarioRol


def obtener_rol(cliente_id: int, db: Session) -> str:
    rol = db.query(UsuarioRol).filter(UsuarioRol.cliente == cliente_id).first()
    return rol.rol if rol else "postor"
