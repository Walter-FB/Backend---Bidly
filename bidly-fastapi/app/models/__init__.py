# Esquema final = 28 tablas:
#   16 del profe (EstructuraActual.sql)
#   auth: credenciales, usuario_rol  (el esquema del profe no tiene login)
#   producto_estado                  (aprobación interna de productos, SPEC)
#   9 features restauradas: mediosdepago, multas, subasta_moneda, admisiones,
#   cuentas_duenio, payouts, notificaciones, registro_pago, reembolsos.
from app.models.persona import Persona
from app.models.sector import Sector
from app.models.empleado import Empleado
from app.models.duenio import Duenio
from app.models.cliente import Cliente
from app.models.subastador import Subastador
from app.models.seguro import Seguro
from app.models.subasta import Subasta
from app.models.catalogo import Catalogo
from app.models.item_catalogo import ItemCatalogo
from app.models.producto import Producto
from app.models.foto import Foto
from app.models.asistente import Asistente
from app.models.puja import Puja
from app.models.registro_subasta import RegistroDeSubasta
from app.models.credencial import Credencial
from app.models.usuario_rol import UsuarioRol
from app.models.producto_estado import ProductoEstado
# Features restauradas
from app.models.pagos import (
    MedioPago, Multa, RegistroPago, Reembolso, Payout, CuentaDuenio,
)
from app.models.admision import Admision
from app.models.subasta_moneda import SubastaMoneda
from app.models.notificacion import Notificacion
from app.models.ubicacion_bien import UbicacionBien
from app.models.item_remate import ItemRemate
from app.models.venta_modo import SubastaVentaModo

__all__ = [
    "Persona", "Sector", "Empleado", "Duenio", "Cliente", "Subastador", "Seguro",
    "Subasta", "Catalogo", "ItemCatalogo", "Producto", "Foto",
    "Asistente", "Puja", "RegistroDeSubasta",
    "Credencial", "UsuarioRol", "ProductoEstado",
    "MedioPago", "Multa", "RegistroPago", "Reembolso", "Payout", "CuentaDuenio",
    "Admision", "SubastaMoneda", "Notificacion", "UbicacionBien", "ItemRemate",
    "SubastaVentaModo",
]
