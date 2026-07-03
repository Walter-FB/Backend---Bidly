from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Sin Alembic: la app crea sola SOLO sus tablas propias (idempotente):
    #   producto_estado (SPEC) + las 9 tablas de features restauradas.
    # NO toca las 16 tablas del profe ni auth (esas ya existen en la base).
    from app.database import engine, Base
    from sqlalchemy import text
    import app.models as models  # registra todos los modelos en Base.metadata

    # producto_estado (SPEC): CREATE con CHECK + backfill desde `disponible`.
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS producto_estado (
                producto      integer      NOT NULL,
                estado        varchar(20)  NOT NULL DEFAULT 'solicitado'
                              CONSTRAINT chk_pe_estado CHECK (estado IN
                              ('solicitado','en_inspeccion','aceptado','rechazado')),
                causa_rechazo varchar(300) NULL,
                fecha_cambio  timestamp    NOT NULL DEFAULT now(),
                CONSTRAINT pk_producto_estado PRIMARY KEY (producto),
                CONSTRAINT fk_producto_estado_productos
                    FOREIGN KEY (producto) REFERENCES productos (identificador)
            )
        """))
        conn.execute(text("""
            INSERT INTO producto_estado (producto, estado)
            SELECT identificador,
                   CASE WHEN disponible = 'si' THEN 'aceptado' ELSE 'solicitado' END
            FROM productos
            WHERE identificador NOT IN (SELECT producto FROM producto_estado)
        """))
        conn.commit()

    # Las 9 tablas de features (checkfirst=True → no recrea si ya existen).
    feature_tables = [
        models.MedioPago.__table__, models.Multa.__table__,
        models.RegistroPago.__table__, models.Reembolso.__table__,
        models.Payout.__table__, models.CuentaDuenio.__table__,
        models.Admision.__table__, models.SubastaMoneda.__table__,
        models.Notificacion.__table__,
    ]
    Base.metadata.create_all(bind=engine, tables=feature_tables)

    # Backfill de moneda: cada subasta sin fila en subasta_moneda → 'pesos'.
    with engine.connect() as conn:
        conn.execute(text("""
            INSERT INTO subasta_moneda (subasta, moneda)
            SELECT identificador, 'pesos' FROM subastas
            WHERE identificador NOT IN (SELECT subasta FROM subasta_moneda)
        """))
        # Flujo de solicitud de reembolso (el comprador pide, la empresa acepta/rechaza).
        conn.execute(text("ALTER TABLE reembolsos ADD COLUMN IF NOT EXISTS estado VARCHAR DEFAULT 'ninguno'"))
        conn.execute(text("ALTER TABLE reembolsos ADD COLUMN IF NOT EXISTS motivo VARCHAR"))
        conn.commit()
    yield


app = FastAPI(title="Bidly API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class MaxBodySizeMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_size: int):
        super().__init__(app)
        self.max_size = max_size

    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > self.max_size:
            return JSONResponse(
                status_code=413,
                content={"message": "Request demasiado grande", "error": "Payload Too Large"},
            )
        return await call_next(request)


app.add_middleware(MaxBodySizeMiddleware, max_size=settings.MAX_REQUEST_SIZE_BYTES)


# ── Manejo de errores compatible con el frontend ──────────────────────────────
# El front (api/client.js) lee message/error/code en el NIVEL SUPERIOR del body,
# no anidados bajo "detail". Aplanamos las respuestas de error para respetar ese contrato.
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    detail = exc.detail
    if isinstance(detail, dict):
        content = dict(detail)
        content.setdefault("message", content.get("error") or "Error")
        content.setdefault("error", content.get("message"))
    else:
        content = {"message": str(detail), "error": str(detail)}
    return JSONResponse(status_code=exc.status_code, content=content, headers=getattr(exc, "headers", None))


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "message": "Datos inválidos en la solicitud",
            "error": "Validation error",
            "code": "VALIDATION_ERROR",
            "detail": [{"campo": ".".join(str(x) for x in e.get("loc", [])), "msg": e.get("msg")} for e in exc.errors()],
        },
    )


# Registrar routers — núcleo del profe + features restauradas.
from app.routers import (
    auth, personas, clientes, subastas, catalogos, items,
    pujas, asistentes, subastadores,
    productos, fotos, registro, seguros, sectores,
    multas, admisiones, payouts, notificaciones,
    admin_web,
)

prefix = "/api"
app.include_router(auth.router,             prefix=f"{prefix}/auth",             tags=["Auth"])
app.include_router(personas.router,         prefix=f"{prefix}/personas",         tags=["Personas"])
app.include_router(clientes.router,         prefix=f"{prefix}/clientes",         tags=["Clientes"])
app.include_router(subastas.router,         prefix=f"{prefix}/subastas",         tags=["Subastas"])
app.include_router(catalogos.router,        prefix=f"{prefix}/catalogos",        tags=["Catálogos"])
app.include_router(items.router,            prefix=f"{prefix}/items",            tags=["Items"])
app.include_router(pujas.router,            prefix=f"{prefix}/pujos",            tags=["Pujas"])
app.include_router(asistentes.router,       prefix=f"{prefix}/asistentes",       tags=["Asistentes"])
app.include_router(subastadores.router,     prefix=f"{prefix}/subastadores",     tags=["Subastadores"])
app.include_router(productos.router,        prefix=f"{prefix}/productos",        tags=["Productos"])
app.include_router(fotos.router,            prefix=f"{prefix}/fotos",            tags=["Fotos"])
app.include_router(registro.router,         prefix=f"{prefix}/registro-subasta", tags=["Registro"])
app.include_router(seguros.router,          prefix=f"{prefix}/seguros",          tags=["Seguros"])
app.include_router(sectores.router,         prefix=f"{prefix}/sectores",         tags=["Sectores"])
app.include_router(multas.router,           prefix=f"{prefix}/multas",           tags=["Multas"])
app.include_router(admisiones.router,       prefix=f"{prefix}/admisiones",       tags=["Admisiones"])
app.include_router(payouts.router,          prefix=f"{prefix}/payouts",          tags=["Payouts"])
app.include_router(notificaciones.router,   prefix=f"{prefix}/notificaciones",   tags=["Notificaciones"])
# Panel de administración como WEB (no /api): se abre en el navegador en /admin.
app.include_router(admin_web.router,         tags=["Admin Web"])
