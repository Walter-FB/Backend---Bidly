# BIDLY — Mapa de Funcionalidades

> Generado exclusivamente leyendo el código fuente.

---

## AUTENTICACIÓN

### Registro de usuario
- **Pantalla:** FotoDNI → Registro → VerificarEmail → CrearPassword
- **Backend:** `POST /api/auth/send-verification` → `POST /api/auth/verify-code` → `POST /api/auth/register`
- **Qué hace:** Sube fotos de DNI, ingresa datos personales, verifica email con código de 6 dígitos (10 min), crea contraseña. Genera Persona + Cliente + Credencial + UsuarioRol("postor") en la DB.
- **Estado:** FUNCIONA

### Login
- **Pantalla:** Login
- **Backend:** `POST /api/auth/login`
- **Qué hace:** Email + contraseña → devuelve token UUID que se guarda en AsyncStorage. Incluye rol del usuario.
- **Estado:** FUNCIONA

### Modo invitado
- **Pantalla:** Login → botón "Entrar como invitado"
- **Qué hace:** Acceso solo lectura. Puede ver subastas pero no pujar.
- **Estado:** FUNCIONA

### Logout
- **Frontend:** `Auth.logout()` → borra token de AsyncStorage
- **Estado:** FUNCIONA

### Restaurar sesión al arrancar
- **Backend:** `GET /api/auth/me`
- **Qué hace:** Al abrir la app, valida el token contra el backend. Si el servidor reinició, limpia la sesión.
- **Estado:** FUNCIONA (limitación: el store es en memoria, se pierde al reiniciar el servidor)

### Verificación de identidad (DNI)
- **Backend:** `POST /api/clientes/{id}/dni-fotos`
- **Qué hace:** Sube frente y dorso del DNI en FormData. Se guarda en base64 en `dni_verificacion`.
- **Estado:** FUNCIONA (sube en segundo plano al completar el registro; si falla, no bloquea)

---

## SUBASTAS — VISTA PÚBLICA

### Listar subastas
- **Pantalla:** HomeScreen (tabs: En vivo / Próximas / Terminadas / Todas)
- **Backend:** `GET /api/subastas?estado=abierta|cerrada&categoria=&moneda=pesos|dolares&publico=true`
- **Qué hace:** Muestra subastas filtradas. Solo las aprobadas son visibles con `publico=true`. Refresca el detalle cada 10 s (tab En vivo) y 30 s (tab Próximas).
- **Estado:** FUNCIONA

### Filtrar subastas
- **Pantalla:** FiltrosScreen (modal)
- **Qué hace:** Filtros por estado, categoría y moneda. Al aplicar, navega de vuelta al Home con los filtros como params.
- **Estado:** FUNCIONA

### Ver detalle de subasta
- **Pantalla:** ProductoScreen
- **Backend:** `GET /api/subastas/{id}`, `GET /api/subastas/{id}/catalogos`, `GET /api/subastas/{id}/sesion`
- **Qué hace:** Muestra foto de portada, precio base, countdown, descripción, lista de ítems del catálogo.
- **Estado:** FUNCIONA

### Foto de portada de subasta
- **Backend:** `GET /api/subastas/{id}/portada`
- **Qué hace:** Devuelve la foto del primer ítem del catálogo en bytes (JPEG).
- **Estado:** FUNCIONA

---

## SUBASTAS — EN VIVO (PUJAS)

### Subasta en tiempo real
- **Pantalla:** SubastaEnVivoScreen
- **Backend:** `GET /api/pujos?item={id}` (polling 1 s), `GET /api/subastas/{id}/sesion` (sync timer 10 s)
- **Qué hace:** Muestra puja actual, countdown local calculado desde baseline del backend, historial de pujas, botón de pujar.
- **Estado:** FUNCIONA

### Inscribirse como asistente
- **Backend:** `POST /api/asistentes/inscribir` con `{ clienteId, subastaId }`
- **Qué hace:** Al entrar a SubastaEnVivo, se auto-inscribe. Si ya está inscripto, devuelve el existente (idempotente). Asigna `numeropostor` correlativo.
- **Estado:** FUNCIONA

### Colocar puja
- **Backend:** `POST /api/pujos` con `{ asistente: {identificador}, item: {identificador}, importe }`
- **Validaciones:** asistente inscripto, ítem activo en sesión, subasta iniciada, tiene medio de pago, importe dentro del rango (mín: última puja + 1% precio base, máx: referencia + 20% precio base). Sin tope para `oro`/`platino`.
- **Efecto:** Resetea el timer de 30 min. Notifica al lider actual y al desplazado.
- **Estado:** FUNCIONA

### Detectar ganador automáticamente
- **Qué hace:** El frontend poll de pujas detecta cuando aparece una puja con `ganador === "si"` y navega automáticamente a `Ganaste` o `SubastaFinalizada`.
- **Estado:** FUNCIONA

### Ver subasta como subastador
- **Pantalla:** SubastaAdminScreen
- **Qué hace:** Vista del propietario de la subasta. Ve el ítem activo, pujas, lista de todos los ítems. No puede iniciar la puja desde aquí (solo desde DashboardAdmin).
- **Estado:** FUNCIONA

---

## SUBASTAS — ADMINISTRACIÓN

### Dashboard Admin
- **Pantalla:** DashboardAdminScreen (solo rol `admin`)
- **Tabs:** "Subastas" + "Solicitudes a confirmar"
- **Estado:** FUNCIONA

### Listar y filtrar subastas (admin)
- **Qué hace:** Muestra todas las subastas con filtros: Todas / Abiertas / Cerradas / Con ítems. Refresca cada 5 s cuando hay una seleccionada.
- **Estado:** FUNCIONA

### Ver solicitudes de revisión
- **Backend:** `GET /api/subasta-revision?estado=pendiente`, `GET /api/subasta-revision/pendientes/count`
- **Qué hace:** Muestra subastas pendientes de aprobación con contador de badge.
- **Estado:** FUNCIONA

### Aprobar subasta
- **Backend:** `PATCH /api/subasta-revision/{subastaId}/aprobar`
- **Efecto:** Revisión pasa a `aprobada`, subasta_estado_admin pasa a `esperando`. El scheduler la iniciará automáticamente cuando llegue la fecha/hora.
- **Estado:** FUNCIONA

### Pausar subasta
- **Backend:** `PATCH /api/subasta-revision/{subastaId}/pausar`
- **Efecto:** Si estaba iniciada, la finaliza. Si no, la cierra. Revisión pasa a `pausada`.
- **Estado:** FUNCIONA

### Rechazar subasta
- **Backend:** `PATCH /api/subasta-revision/{subastaId}/rechazar` con `{ observacion }`
- **Efecto:** Revisión pasa a `rechazada`. Notifica a todos los asistentes.
- **Estado:** FUNCIONA

### Iniciar puja (admin)
- **Backend:** `PATCH /api/subastas/{id}/estado` con `{ estado: "abierta" }`
- **Requiere:** Revisión aprobada, subasta en estado `esperando`.
- **Efecto:** Crea SubastaSesion, inicia timer, subasta pasa a `iniciada`.
- **Estado:** FUNCIONA

### Cerrar subasta manualmente (admin)
- **Backend:** `PATCH /api/subastas/{id}/estado` con `{ estado: "cerrada" }`
- **Efecto:** Adjudica todos los ítems pendientes, finaliza la subasta, borra sesión.
- **Estado:** FUNCIONA

### Adjudicar ítem activo manualmente (admin)
- **Backend:** `PATCH /api/items/{id}/adjudicar`
- **Efecto:** Marca ganador de ese ítem, crea RegistroDeSubasta + RegistroPago + Reembolso, avanza al siguiente ítem.
- **Estado:** FUNCIONA

---

## SUBASTAS — AUTOMATISMOS (scheduler)

### Auto-inicio de subastas
- **Job:** `iniciar_subastas_programadas` (cada 30 s)
- **Condición:** Estado `esperando`, revisión `aprobada`, `fecha + hora <= NOW()`
- **Estado:** FUNCIONA

### Auto-finalización de ítems por inactividad
- **Job:** `finalizar_items_vencidos` (cada 60 s)
- **Condición:** Subasta `iniciada`, sin pujas por 1800 s (30 min) desde la última puja (o desde que se inició la sesión si no hubo pujas)
- **Estado:** FUNCIONA

---

## CREACIÓN DE CONTENIDO

### Publicar producto
- **Pantalla:** PublicarScreen
- **Backend:** `POST /api/productos`, luego `POST /api/productos/{id}/fotos` (XHR, FormData)
- **Qué hace:** Crea producto con título, descripción, categoría, estado. Sube hasta 6 fotos. Al terminar pregunta si quiere crear una subasta con ese producto.
- **Estado:** FUNCIONA

### Mis productos
- **Pantalla:** MisProductosScreen
- **Backend:** `GET /api/productos/duenio/{clienteId}`
- **Qué hace:** Lista los productos propios. Puede eliminarlos (`DELETE /api/productos/{id}`). Tiene modo selección para agregar a subasta.
- **Estado:** FUNCIONA

### Crear subasta (2 pasos)
- **Pantalla:** CrearSubastaScreen
- **Paso 1:** Fecha (calendario nativo), hora (picker), ubicación, categoría, moneda
- **Paso 2:** Selecciona productos de "Mis Productos", define precio base por ítem (muestra comisión 10% y ganancia neta)
- **Backend:**
  1. `POST /api/subastadores` (crea subastador si no existe, idempotente)
  2. `POST /api/subastas`
  3. `POST /api/catalogos`
  4. `POST /api/catalogos/{id}/items` por cada producto
- **Estado:** FUNCIONA

---

## PAGOS (post-subasta)

### Medios de pago
- **Pantalla:** MedioPagoScreen (también desde Perfil)
- **Backend:** `GET /api/clientes/{id}/medios-pago`, `POST /api/clientes/{id}/medios-pago`
- **Tipos:** tarjeta (crédito/débito), cuenta bancaria, cheque
- **Estado:** FUNCIONA

### Confirmar pago
- **Pantalla:** ConfirmarPagoScreen
- **Backend:** `POST /api/registro-subasta/{id}/pagar` con `{ medioPagoId }`
- **Estado:** FUNCIONA

### Seguros
- **Backend:** `GET/POST/PUT /api/seguros/{nroPoliza}`
- **Pantalla:** SeguroScreen
- **Estado:** FUNCIONA

### Multas
- **Backend:** `GET /api/multas/{id}`, `PATCH /api/multas/{id}` con `{ pagada: "si" }`
- **Pantalla:** MultaScreen
- **Estado:** FUNCIONA

### Reembolso
- **Backend:** `PATCH /api/registro-subasta/{id}/reembolso` con `{ reembolsada }`
- **Pantalla:** ReembolsoScreen
- **Estado:** FUNCIONA

---

## PERFIL Y CUENTA

### Ver perfil
- **Pantalla:** PerfilScreen
- **Backend:** `GET /api/clientes/{id}`, `GET /api/personas/{id}`
- **Muestra:** Nombre, email, categoría (comun/especial/plata/oro/platino), menú de navegación
- **Estado:** FUNCIONA

### Ver datos personales
- **Pantalla:** DatosPersonalesScreen
- **Muestra:** nombre, email, domicilio, DNI, categoría, estado de admisión
- **Estado:** FUNCIONA (solo lectura por ahora)

### Mis compras
- **Pantalla:** MisComprasScreen
- **Backend:** `GET /api/registro-subasta/cliente/{clienteId}`
- **Muestra:** Subastas ganadas + reembolsos con detalle de importe y estado
- **Estado:** FUNCIONA

### Historial
- **Pantalla:** HistorialScreen
- **Igual a MisCompras** pero desde el tab de navegación
- **Estado:** FUNCIONA

### Mis subastas (como vendedor)
- **Pantalla:** MisSubastasScreen
- **Backend:** `GET /api/subastadores/{id}/subastas`, `GET /api/registro-subasta/cliente/{id}`
- **Tabs:** En curso / Finalizadas / Ganadas / Todas
- **Estado:** FUNCIONA

---

## NOTIFICACIONES

### Ver notificaciones
- **Pantalla:** NotificacionesScreen (campanita en el header)
- **Backend:** `GET /api/notificaciones/cliente/{clienteId}`
- **Badge:** hook `useNotifBadge` cuenta las no leídas y muestra número rojo
- **Estado:** FUNCIONA

### Marcar como leída
- **Backend:** `PATCH /api/notificaciones/{id}/leer`
- **Estado:** FUNCIONA

### Push notifications
- **Backend:** `POST /api/notificaciones/push-token` con `{ cliente, token }`
- **Qué hace:** Registra el token Expo Push del dispositivo. Las notificaciones se envían con `httpx` a `exp.host/--/expo-push/api/v2/push/send`.
- **Estado:** FUNCIONA

---

## FUNCIONALIDADES INCOMPLETAS / PENDIENTES

| Funcionalidad | Estado | Dónde está |
|---|---|---|
| Búsqueda de subastas | UI placeholder (`Alert.alert("Próximamente")`) | HomeScreen.js |
| Recuperación de contraseña | UI placeholder | LoginScreen |
| Borradores de producto | UI placeholder | PublicarScreen |
| Hash de contraseñas | No implementado — se guarda texto plano | auth.py / routers/auth.py |
| Admitir cliente manualmente | PATCH `/clientes/{id}/admitido` existe, sin UI | routers/clientes.py |
| Cambio de categoría de cliente | PATCH `/clientes/{id}/categoria` existe, sin UI | routers/clientes.py |
| Marcar entrega como completada | `Alert.alert("Entrega registrada")` sin llamada al backend | DatosGanadorScreen |
| Editar datos personales | UI muestra datos pero no tiene formulario de edición | DatosPersonalesScreen |

---

## RESUMEN DE ROLES Y PERMISOS

| Acción | Invitado | Postor | Admin |
|---|---|---|---|
| Ver subastas públicas | ✓ | ✓ | ✓ |
| Ver detalle de subasta | ✓ | ✓ | ✓ |
| Pujar en subasta | ✗ | ✓* | ✓* |
| Crear subasta | ✗ | ✓ | ✓ |
| Publicar producto | ✗ | ✓ | ✓ |
| Aprobar/rechazar subastas | ✗ | ✗ | ✓ |
| Iniciar/cerrar puja | ✗ | ✗ | ✓ |
| Dashboard Admin | ✗ | ✗ | ✓ |
| Ver mis compras | ✗ | ✓ | ✓ |
| Agregar medio de pago | ✗ | ✓ | ✓ |

*Requiere estar inscripto como asistente y tener al menos un medio de pago registrado.

---

## FLUJOS PRINCIPALES DE PUNTA A PUNTA

### Flujo del comprador
```
Login → Home → ver subasta en vivo → ProductoScreen → SubastaEnVivo
→ [inscripción automática como asistente]
→ pujar → [timer se resetea] → [scheduler o timer expira] → ganador detectado
→ Ganaste → MedioPago → ConfirmarPago → PagoConfirmado
```

### Flujo del vendedor
```
Publicar → sube producto + fotos → CrearSubasta (2 pasos) → subasta pendiente
→ [admin aprueba en DashboardAdmin] → subasta pasa a "esperando"
→ [scheduler la inicia en la fecha/hora] o [admin la inicia manualmente]
→ SubastaEnVivo activa → scheduler adjudica ítems al expirar el timer
→ subasta finalizada → RegistroDeSubasta creado por cada ítem con puja
```

### Flujo del admin
```
DashboardAdmin → tab "Solicitudes" → ver pendientes → Aprobar / Pausar / Rechazar
→ tab "Subastas" → seleccionar subasta aprobada → "Iniciar puja"
→ monitorear pujas del ítem activo (refresh cada 5 s)
→ "Adjudicar ítem activo" (manual) o dejar que el scheduler lo haga
→ "Cerrar" para finalizar la subasta
```
