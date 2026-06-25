from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
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


# Registrar routers
from app.routers import (
    auth, personas, clientes, subastas, catalogos, items,
    pujas, asistentes, subasta_revision, subastadores,
    productos, fotos, registro, notificaciones, seguros, multas,
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
app.include_router(subasta_revision.router, prefix=f"{prefix}/subasta-revision", tags=["Revisión"])
app.include_router(subastadores.router,     prefix=f"{prefix}/subastadores",     tags=["Subastadores"])
app.include_router(productos.router,        prefix=f"{prefix}/productos",        tags=["Productos"])
app.include_router(fotos.router,            prefix=f"{prefix}/fotos",            tags=["Fotos"])
app.include_router(registro.router,         prefix=f"{prefix}/registro-subasta", tags=["Registro"])
app.include_router(notificaciones.router,   prefix=f"{prefix}/notificaciones",   tags=["Notificaciones"])
app.include_router(seguros.router,          prefix=f"{prefix}/seguros",          tags=["Seguros"])
app.include_router(multas.router,           prefix=f"{prefix}/multas",           tags=["Multas"])
