import logging
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler

logger = logging.getLogger(__name__)
scheduler = BackgroundScheduler(timezone="UTC")


@scheduler.scheduled_job("interval", seconds=60, id="finalizar_items_vencidos")
def finalizar_items_vencidos():
    from app.database import SessionLocal
    from app.models.subasta_estado_admin import SubastaEstadoAdmin
    from app.models.subasta_sesion import SubastaSesion
    from app.services import subasta_service, item_adjudicacion_service

    db = SessionLocal()
    try:
        admins = (
            db.query(SubastaEstadoAdmin)
            .filter(SubastaEstadoAdmin.estado_subasta == "iniciada")
            .all()
        )
        for admin in admins:
            try:
                sid = admin.subasta
                now = datetime.utcnow()
                if subasta_service.inactividad_vencida(sid, now, db):
                    sesion = db.query(SubastaSesion).filter(SubastaSesion.subasta == sid).first()
                    if sesion and sesion.item_activo:
                        logger.info(
                            f"[Scheduler] Finalizando item {sesion.item_activo} "
                            f"de subasta {sid} por inactividad"
                        )
                        item_adjudicacion_service.finalizar_item(
                            sesion.item_activo, notificar=True, db=db
                        )
                        db.commit()
            except Exception as e:
                logger.error(f"[Scheduler] Error en subasta {admin.subasta}: {e}")
                db.rollback()
    except Exception as e:
        logger.error(f"[Scheduler] Error general en finalizar_items_vencidos: {e}")
    finally:
        db.close()


@scheduler.scheduled_job("interval", seconds=30, id="iniciar_subastas_programadas")
def iniciar_subastas_programadas():
    from app.database import SessionLocal
    from sqlalchemy import text
    from app.services import subasta_estado_service

    db = SessionLocal()
    try:
        result = db.execute(text("""
            SELECT s.identificador
            FROM subastas s
            JOIN subasta_estado_admin sea ON s.identificador = sea.subasta
            LEFT JOIN subasta_revision sr ON s.identificador = sr.subasta
            WHERE sea.estado_subasta = 'esperando'
              AND (s.fecha + s.hora) <= NOW()
              AND (sr.estado = 'aprobada' OR sr.estado IS NULL)
        """))
        ids = [row[0] for row in result]

        for subasta_id in ids:
            try:
                logger.info(f"[Scheduler] Auto-iniciando subasta {subasta_id}")
                subasta_estado_service.iniciar_subasta(subasta_id, db)
                db.commit()
            except Exception as e:
                logger.error(f"[Scheduler] Error iniciando subasta {subasta_id}: {e}")
                db.rollback()
    except Exception as e:
        logger.error(f"[Scheduler] Error general en iniciar_subastas_programadas: {e}")
    finally:
        db.close()
