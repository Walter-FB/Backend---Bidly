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
    from app.database import engine
    from sqlalchemy import text
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE subasta_estado_admin DROP CONSTRAINT IF EXISTS chk_subasta_estado_admin_estado"))
        conn.execute(text("ALTER TABLE subasta_estado_admin ALTER COLUMN estado DROP NOT NULL"))
        conn.execute(text("ALTER TABLE notificaciones DROP CONSTRAINT IF EXISTS chktiponot"))
        # subasta_revision quemada: el usuario ya no crea subastas (las arma el
        # subastador), así que no hay moderación de subastas.
        conn.execute(text("DROP TABLE IF EXISTS subasta_revision"))
        # El rol 'admin' genérico no existe en el enunciado: el intermediario es
        # el subastador. Migramos cualquier cuenta admin previa a subastador.
        conn.execute(text("UPDATE usuario_rol SET rol='subastador' WHERE rol='admin'"))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS cliente_push_tokens (
                id SERIAL PRIMARY KEY,
                cliente INTEGER UNIQUE NOT NULL REFERENCES clientes(identificador),
                token VARCHAR NOT NULL,
                creado_en TIMESTAMP DEFAULT NOW()
            )
        """))
        # Multas por impago (10% de lo ofertado). fecha_limite = 72hs para presentar fondos.
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS multas (
                identificador SERIAL PRIMARY KEY,
                cliente INTEGER REFERENCES clientes(identificador),
                pujo INTEGER REFERENCES pujos(identificador),
                importe DECIMAL(12,2),
                pagada VARCHAR DEFAULT 'no',
                fechagenerada DATE
            )
        """))
        conn.execute(text("ALTER TABLE multas ADD COLUMN IF NOT EXISTS fecha_limite TIMESTAMP"))
        # Admisión de artículos a subasta (inspección → aceptación → propuesta → catálogo).
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS admisiones (
                identificador SERIAL PRIMARY KEY,
                producto INTEGER REFERENCES productos(identificador),
                duenio INTEGER REFERENCES duenios(identificador),
                estado VARCHAR DEFAULT 'solicitada',
                declara_propiedad VARCHAR DEFAULT 'no',
                declara_origen VARCHAR DEFAULT 'no',
                direccion_envio VARCHAR,
                observacion VARCHAR,
                valor_base DECIMAL(18,2),
                comision DECIMAL(18,2),
                subasta INTEGER REFERENCES subastas(identificador),
                gastos_devolucion DECIMAL(18,2),
                es_coleccion VARCHAR DEFAULT 'no',
                nombre_coleccion VARCHAR,
                creado_en TIMESTAMP DEFAULT NOW(),
                actualizado_en TIMESTAMP
            )
        """))
        # Cuenta a la vista del dueño (declarada antes de la subasta).
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS cuentas_duenio (
                identificador SERIAL PRIMARY KEY,
                duenio INTEGER REFERENCES duenios(identificador),
                alias VARCHAR,
                banco VARCHAR,
                pais VARCHAR,
                moneda VARCHAR,
                es_exterior VARCHAR DEFAULT 'no',
                declarada_en TIMESTAMP DEFAULT NOW()
            )
        """))
        # Pago al dueño por lo vendido (o comprado por la empresa si nadie pujó).
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS payouts (
                identificador SERIAL PRIMARY KEY,
                duenio INTEGER REFERENCES duenios(identificador),
                producto INTEGER REFERENCES productos(identificador),
                subasta INTEGER REFERENCES subastas(identificador),
                importe_bruto DECIMAL(18,2),
                comision DECIMAL(18,2),
                importe_neto DECIMAL(18,2),
                origen VARCHAR DEFAULT 'venta',
                cuenta INTEGER REFERENCES cuentas_duenio(identificador),
                estado VARCHAR DEFAULT 'pendiente',
                creado_en TIMESTAMP DEFAULT NOW(),
                pagado_en TIMESTAMP
            )
        """))
        # Ubicación del bien en depósito (el dueño puede verla junto a la póliza).
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS ubicacion_bien (
                producto INTEGER PRIMARY KEY REFERENCES productos(identificador),
                deposito VARCHAR
            )
        """))
        # Detalle ampliado del producto: obra de arte/diseñador y piezas compuestas.
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS producto_detalle (
                producto INTEGER PRIMARY KEY REFERENCES productos(identificador),
                es_obra_arte VARCHAR DEFAULT 'no',
                artista VARCHAR,
                fecha_obra VARCHAR,
                historia VARCHAR,
                cantidad_piezas INTEGER DEFAULT 1,
                composicion VARCHAR
            )
        """))
        # Envío / retiro para la factura del comprador.
        conn.execute(text("ALTER TABLE registro_pago ADD COLUMN IF NOT EXISTS envio DECIMAL(12,2)"))
        conn.execute(text("ALTER TABLE registro_pago ADD COLUMN IF NOT EXISTS direccion_envio VARCHAR"))
        conn.execute(text("ALTER TABLE registro_pago ADD COLUMN IF NOT EXISTS retiro_personal VARCHAR DEFAULT 'no'"))
        # Saldo/límite de los medios de pago (tarjetas y cuentas). El cheque usa
        # montocheque. Backfill de tarjetas/cuentas existentes para no romper datos.
        conn.execute(text("ALTER TABLE mediosdepago ADD COLUMN IF NOT EXISTS saldo DECIMAL(12,2)"))
        conn.execute(text("UPDATE mediosdepago SET saldo = 500000 WHERE tipo IN ('tarjeta','cuenta') AND saldo IS NULL"))
        conn.commit()
    from app.services.scheduler import scheduler
    scheduler.start()
    yield
    scheduler.shutdown()


app = FastAPI(title="Bidly API", version="1.0.0", lifespan=lifespan)

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
# El front (api/client.js) lee message/error/code/etc. en el NIVEL SUPERIOR del
# body, no anidados bajo "detail" como hace FastAPI por defecto.
# Aplanamos las respuestas de error para respetar ese contrato.
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


# Registrar routers
from app.routers import (
    auth, personas, clientes, subastas, catalogos, items,
    pujas, asistentes, subastadores,
    productos, fotos, registro, notificaciones, seguros, multas,
    admisiones, payouts, sectores,
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
app.include_router(notificaciones.router,   prefix=f"{prefix}/notificaciones",   tags=["Notificaciones"])
app.include_router(seguros.router,          prefix=f"{prefix}/seguros",          tags=["Seguros"])
app.include_router(multas.router,           prefix=f"{prefix}/multas",           tags=["Multas"])
app.include_router(admisiones.router,       prefix=f"{prefix}/admisiones",       tags=["Admisiones"])
app.include_router(payouts.router,          prefix=f"{prefix}/payouts",          tags=["Payouts"])
app.include_router(sectores.router,         prefix=f"{prefix}/sectores",         tags=["Sectores"])
