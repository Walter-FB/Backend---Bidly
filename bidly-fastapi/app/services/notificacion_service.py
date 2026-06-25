from datetime import datetime
from sqlalchemy.orm import Session
from app.models.notificacion import Notificacion
from app.models.asistente import Asistente


def crear(cliente_id: int, tipo: str, mensaje: str, db: Session) -> Notificacion:
    n = Notificacion(
        cliente=cliente_id,
        tipo=tipo,
        mensaje=mensaje,
        leida="no",
        fechahora=datetime.utcnow(),
    )
    db.add(n)
    db.flush()
    return n


def notificar_asistentes_subasta(subasta_id: int, tipo: str, mensaje: str, db: Session) -> None:
    asistentes = db.query(Asistente).filter(Asistente.subasta == subasta_id).all()
    for a in asistentes:
        crear(a.cliente, tipo, mensaje, db)


def notificar_lider(asistente_id: int, importe, db: Session) -> None:
    a = db.query(Asistente).filter(Asistente.identificador == asistente_id).first()
    if a:
        crear(a.cliente, "lider", f"Eres el líder con ${importe}", db)


def notificar_desplazado(item_id: int, excepto_asistente_id: int, db: Session) -> None:
    from app.models.puja import Puja
    puja_anterior = (
        db.query(Puja)
        .filter(Puja.item == item_id, Puja.asistente != excepto_asistente_id)
        .order_by(Puja.importe.desc())
        .first()
    )
    if puja_anterior:
        a = db.query(Asistente).filter(Asistente.identificador == puja_anterior.asistente).first()
        if a:
            crear(a.cliente, "perdiste", "Alguien superó tu oferta", db)
