# BIDLY — Documento de Estudio Técnico

> Generado exclusivamente leyendo el código fuente. No se usó documentación externa.

---

## 1. Arquitectura general

```
bidly-fastapi/          ← Backend Python (FastAPI)
bidly-front/            ← Frontend React Native (Expo SDK 54)
EstructuraActual.sql    ← DDL original del profesor (NO modificar)
```

**Backend:** FastAPI + Python 3, SQLAlchemy ORM, PostgreSQL, Uvicorn  
**Puerto:** 8083  
**Deploy:** Railway → `https://backend-bidly.up.railway.app/api`  
**Frontend:** React Native Expo SDK 54, React Navigation 6  
**DB local:** `localhost:5432`, base `railway`  
**DB Railway:** `trolley.proxy.rlwy.net:53193/railway`

---

## 2. Estructura del backend (`bidly-fastapi/`)

```
app/
  main.py               ← FastAPI app, middleware, registro de routers
  auth.py               ← Token store en memoria, verificación de email
  config.py             ← Settings (pydantic-settings, lee .env)
  database.py           ← Engine SQLAlchemy, SessionLocal, Base

  models/               ← Clases ORM (una por tabla)
  routers/              ← Un archivo por recurso REST
  schemas/              ← Pydantic models (request/response)
  services/             ← Lógica de negocio (no mezclar con routers)
  serializers.py        ← Helpers de serialización compartidos (camelCase)
```

---

## 3. Tablas de la base de datos

### 3.1 Tablas del profesor (NO tocar)
```
paises, personas, empleados, sectores, seguros, clientes, duenios,
subastadores, subastas, productos, fotos, catalogos, itemsCatalogo,
asistentes, pujos, registroDeSubasta
```

### 3.2 Tablas propias (creadas por nosotros)

| Tabla | Propósito |
|---|---|
| `credenciales` | Email + password del cliente |
| `usuario_rol` | Rol del cliente: `postor` o `admin` |
| `subasta_estado_admin` | Estado real de la subasta (máquina de estados) |
| `subasta_revision` | Revisión/aprobación por parte del admin |
| `subasta_sesion` | Sesión activa: item activo, timer, orden |
| `subasta_moneda` | Moneda de la subasta (`pesos` o `dolares`) |
| `cliente_push_tokens` | Token Expo Push por cliente |
| `mediosdepago` | Tarjeta / cuenta / cheque del cliente |
| `multas` | Multa asociada a un pujo |
| `notificaciones` | Notificaciones in-app del cliente |
| `registro_pago` | Estado de pago de un RegistroDeSubasta |
| `reembolso` | Si el ítem fue reembolsado |
| `dni_verificacion` | Fotos de DNI (base64) para verificación |

> La tabla `cliente_push_tokens` se crea en `main.py` al arrancar el servidor si no existe.

---

## 4. Autenticación

**Mecanismo:** Token UUID en memoria (NO JWT).

```
auth.py:
  _token_store       → dict: token → { clienteId, email, nombre, categoria, admitido, rol }
  _verification_codes → dict: email → (code, expires_at)  [TTL 10 min]
  _verification_tokens → dict: token → email
```

**Flujo de registro (3 pasos):**
1. `POST /api/auth/send-verification` → genera código 6 dígitos, lo envía por email (Brevo)
2. `POST /api/auth/verify-code` → valida código → devuelve `verificationToken`
3. `POST /api/auth/register` → usa `verificationToken` → crea Persona + Cliente + Credencial + UsuarioRol("postor")

**Flujo de login:**
- `POST /api/auth/login` → compara `passwordhash` (texto plano, sin hashing real) → genera token → lo guarda en `_token_store`

**Importante:** El token store es **en memoria**. Si el servidor se reinicia, todas las sesiones se pierden y los usuarios tienen que volver a loguearse.

**Header en requests autenticados:**
```
Authorization: Bearer <uuid-token>
```

---

## 5. Roles

Tabla `usuario_rol`: `cliente` (FK) + `rol` (string).

| Rol | Acceso |
|---|---|
| `postor` | Rol por defecto al registrarse. Puede pujar. |
| `admin` | Accede al DashboardAdmin. Puede aprobar/pausar/rechazar subastas e iniciar/cerrar pujas. |

En el frontend, `isAdmin = user?.rol === 'admin'` habilita la pantalla de administración.

---

## 6. Máquina de estados de la subasta

La tabla `subasta_estado_admin` tiene el campo `estado_subasta`. El campo `estado` en la tabla `subastas` es secundario.

```
[creada] → pendiente
[admin aprueba] → esperando
[scheduler o admin inicia] → iniciada   ← se crea SubastaSesion
[todos los items adjudicados o admin cierra] → finalizada   ← se borra SubastaSesion
[admin rechaza o pausa] → fin (subasta cerrada)
```

**Servicio:** `services/subasta_estado_service.py`

- `crear_estado_pendiente()` → al crear subasta
- `pasar_a_esperando()` → cuando admin aprueba la revisión
- `iniciar_subasta()` → crea sesión, marca `estado = "abierta"` en `subastas`
- `finalizar_subasta()` → borra sesión, marca `estado = "cerrada"` en `subastas`

**Estado efectivo** que ve el frontend:
- `iniciada` → se muestra como `abierta`
- todo lo demás → `cerrada`

---

## 7. Sesión de subasta y timer

**Tabla `subasta_sesion`:** `subasta`, `item_activo`, `orden_actual`, `timer_desde`, `iniciada_en`

**Timer:** 1800 segundos (30 minutos) por ítem.

- Al iniciar la subasta → se crea sesión con el primer ítem pendiente.
- Cada puja nueva → se resetea `timer_desde = NOW()`.
- El scheduler corre cada **60 segundos** y finaliza los ítems cuyo timer venció.
- Al finalizar un ítem → se avanza al próximo ítem pendiente.
- Si no hay más ítems → se finaliza la subasta.

**`segundosRestantes`** que devuelve el backend: `max(0, 1800 - (NOW - timer_desde).seconds)`

---

## 8. Scheduler (APScheduler)

`services/scheduler.py` — BackgroundScheduler en UTC.

| Job | Intervalo | Qué hace |
|---|---|---|
| `finalizar_items_vencidos` | 60 s | Busca subastas `iniciada`, verifica si el timer venció (sin pujas por 30 min), finaliza el ítem activo |
| `iniciar_subastas_programadas` | 30 s | Busca subastas en estado `esperando` cuya `fecha+hora <= NOW` y revisión `aprobada`, las inicia automáticamente |

---

## 9. Pujas (lógica de negocio)

**Router:** `routers/pujas.py`  
**Endpoint:** `POST /api/pujos`

**Validaciones en orden:**
1. Item existe y no está adjudicado
2. La subasta está en estado `iniciada`
3. El ítem es el activo en la sesión
4. El asistente está inscripto en esa subasta
5. El asistente tiene medio de pago registrado
6. El importe está dentro del rango válido

**Cálculo del rango:**
```python
referencia = max(ultima_puja, precio_base)
minimo = max(ultima_puja + precio_base * 0.01, precio_base)
maximo = referencia + precio_base * 0.20
```

**Excepción:** Clientes de categoría `oro` o `platino` no tienen tope máximo.

**Locking:** `SELECT FOR UPDATE` sobre `ItemCatalogo` para evitar race conditions.

---

## 10. Adjudicación de ítems

`services/item_adjudicacion_service.py`

Al finalizar un ítem (por timer o por acción del admin):
1. Busca la puja de mayor importe
2. Marca esa puja como `ganador = "si"` e `item.subastado = "si"`
3. Crea `RegistroDeSubasta` (subasta, duenio, producto, cliente, importe, comision)
4. Crea `RegistroPago` con estado `pendiente` e importe total = importe + comision
5. Crea `Reembolso` con `reembolsada = "no"`
6. Notifica al ganador ("ganaste")
7. Avanza al próximo ítem o finaliza la subasta

Si el ítem no tuvo pujas → se marca como adjudicado igualmente (sin ganador).

---

## 11. Revisión de subastas (moderación)

**Tabla:** `subasta_revision`  
**Router:** `routers/subasta_revision.py`

| Estado revisión | Qué significa |
|---|---|
| `pendiente` | Recién creada, espera aprobación del admin |
| `aprobada` | Admin aprobó → subasta_estado pasa a `esperando` |
| `pausada` | Admin pausó → si estaba iniciada se finaliza, si no se cierra |
| `rechazada` | Admin rechazó → se notifica a los asistentes |

Solo subastas con revisión `aprobada` son visibles en el home del frontend (parámetro `publico=true`).

---

## 12. Notificaciones

**Tabla:** `notificaciones` (`cliente`, `tipo`, `mensaje`, `leida`, `fechahora`)  
**Push:** Expo Push API (`https://exp.host/--/expo-push/api/v2/push/send`)

| Tipo | Cuándo se dispara |
|---|---|
| `subasta_creada` | Al crear una subasta (al dueño) |
| `lider` | Al pujar exitosamente |
| `perdiste` | Cuando alguien supera tu puja |
| `ganaste` | Al adjudicarse el ítem al ganador |
| `subasta_por_cerrar` | Al finalizar todos los ítems |
| `subasta_rechazada` | Al rechazar una subasta |
| `medio_pago_agregado` | Al agregar un medio de pago |

---

## 13. Serialización y contrato con el frontend

El frontend espera objetos con relaciones anidadas en camelCase. El backend FastAPI mantiene ese contrato a través de `serializers.py`:

- `item_to_dict()` → devuelve `producto` como objeto anidado con `descripcionCatalogo`, `descripcionCompleta`
- `puja_to_dict()` → devuelve `asistente` como objeto con `numeroPostor`
- Los errores HTTP tienen `message`/`error`/`code` en el nivel superior (no en `detail` como FastAPI por defecto)

---

## 14. Endpoints REST (resumen)

| Prefijo | Router | Qué maneja |
|---|---|---|
| `/api/auth` | auth.py | Login, register, verificación email, `/me` |
| `/api/personas` | personas.py | GET/PUT persona |
| `/api/clientes` | clientes.py | CRUD cliente, medios de pago, DNI fotos |
| `/api/subastas` | subastas.py | CRUD subastas, estado, catálogo, portada, sesión |
| `/api/catalogos` | catalogos.py | Crear catálogo, agregar ítems |
| `/api/items` | items.py | GET ítem, PATCH adjudicar |
| `/api/pujos` | pujas.py | Listar, crear puja, GET ganador |
| `/api/asistentes` | asistentes.py | GET asistente, pujos del asistente, inscribir |
| `/api/subasta-revision` | subasta_revision.py | Listar revisiones, aprobar/pausar/rechazar |
| `/api/subastadores` | subastadores.py | GET/POST subastador, subastas por subastador |
| `/api/productos` | productos.py | CRUD productos, fotos, portada |
| `/api/fotos` | fotos.py | GET foto por ID |
| `/api/registro-subasta` | registro.py | Crear registro, por cliente, por subasta, pagar, reembolso |
| `/api/notificaciones` | notificaciones.py | Por cliente, marcar leída, push token |
| `/api/seguros` | seguros.py | CRUD seguros |
| `/api/multas` | multas.py | GET multa, PATCH pagada |

---

## 15. Frontend — estructura de pantallas

### Navegación (React Navigation 6)

**Root Stack → Tab Navigator (5 tabs):**

```
Home          → HomeScreen (subastas en vivo, próximas, finalizadas)
Historial     → HistorialScreen (compras ganadas, reembolsos)
Publish       → PublicarScreen (publicar producto)
Subastas      → MisSubastasScreen (mis subastas como vendedor + ganadas)
Perfil        → PerfilScreen (datos, medios de pago, admin)
```

**Pantallas del stack principal:**

| Nombre | Archivo | Descripción |
|---|---|---|
| `Splash` | AuthScreens | Pantalla de carga inicial |
| `Login` | AuthScreens | Login con email/contraseña + modo invitado |
| `FotoDNI` | AuthScreens | Subir fotos del DNI (paso 0 del registro) |
| `Registro` | AuthScreens | Datos personales + email |
| `VerificarEmail` | AuthScreens | Código 6 dígitos por email |
| `CrearPassword` | AuthScreens | Contraseña + aceptar términos |
| `Home` | HomeScreens | Listado subastas con tabs: En vivo / Próximas / Terminadas |
| `Filtros` | HomeScreens | Modal de filtros (estado, categoría, moneda) |
| `Notificaciones` | HomeScreens | Lista de notificaciones del usuario |
| `Producto` | AuctionScreens | Detalle de subasta, fotos, ítems, botón "Ir en vivo" |
| `SubastaEnVivo` | AuctionScreens | Puja en tiempo real, countdown, historial de pujas |
| `Ganaste` | AuctionScreens | Pantalla de victoria, total a pagar |
| `SubastaFinalizada` | AuctionScreens | Pantalla de fin de subasta (no ganaste) |
| `SubastaAdmin` | AuctionScreens | Panel del subastador para ver su subasta |
| `MedioPago` | PaymentScreens | Selección/alta de medio de pago |
| `Seguro` | PaymentScreens | Datos del seguro |
| `ConfirmarPago` | PaymentScreens | Confirmación antes de pagar |
| `PagoConfirmado` | PaymentScreens | Confirmación de pago exitoso |
| `Multa` | PaymentScreens | Vista de multa |
| `Reembolso` | PaymentScreens | Solicitud de reembolso |
| `Perfil` | AccountScreens | Avatar, categoría, menú de cuenta |
| `DatosPersonales` | AccountScreens | Ver nombre, email, DNI, domicilio, categoría |
| `MisCompras` | AccountScreens | Compras ganadas y reembolsos |
| `CompraDetalle` | AccountScreens | Detalle de una compra específica |
| `Historial` | AccountScreens | Historial de subastas ganadas |
| `MisSubastas` | AccountScreens | Subastas creadas + ítems ganados |
| `Publicar` | AccountScreens | Crear nuevo producto con fotos |
| `CrearSubasta` | AccountScreens | Formulario 2 pasos: datos → productos |
| `MisProductos` | AccountScreens | Gestionar/elegir productos propios |
| `DatosGanador` | AccountScreens | Datos del cliente que ganó (para el vendedor) |
| `DashboardAdmin` | AdminScreens | Panel admin: subastas + revisiones |

---

## 16. AuthContext (estado global de autenticación)

`src/context/AuthContext.js`

**Shape del usuario en memoria:**
```js
{
  clienteId: number,
  email: string,
  nombre: string,
  categoria: 'comun' | 'especial' | 'plata' | 'oro' | 'platino',
  admitido: 'si' | 'no',
  rol: 'postor' | 'admin' | null,
}
```

**Funciones disponibles:** `login`, `register`, `logout`, `loginAsGuest`, `isAdmin`

Al arrancar la app en frío: llama a `GET /api/auth/me` para validar el token almacenado en AsyncStorage. Si falla (servidor reiniciado, token inválido) → limpia la sesión.

---

## 17. Cliente HTTP (`src/api/client.js`)

- `BASE_URL`: `https://backend-bidly.up.railway.app/api` (o lo que configure `app.json → extra.apiBaseUrl`)
- Token almacenado en AsyncStorage con clave `@bidly_token`
- Timeout: 60 segundos (mensaje especial para Railway cold start)
- Los errores del backend tienen `message`/`error` en el nivel superior del body

---

## 18. Polling en el frontend

| Pantalla | Qué consulta | Frecuencia |
|---|---|---|
| `SubastaEnVivo` | Pujas del ítem activo | 1 segundo |
| `SubastaEnVivo` | Timer (sesión + subasta detalle) | 10 segundos |
| `DashboardAdmin` | Estado subasta + ítems + asistentes | 5 segundos |
| `DashboardAdmin` | Pujas del ítem activo | 5 segundos |
| `SubastaAdmin` | Pujas del ítem activo | 1 segundo |
| `HomeScreen` (tab En vivo) | Detalle de cada subasta | 10 segundos |
| `HomeScreen` (tab Próximas) | Lista de subastas | 30 segundos |

---

## 19. Flujo completo: crear y subastar

### Como vendedor (subastador):
1. `Publicar` → crea Producto + sube fotos
2. `CrearSubasta` paso 1 → elige fecha, hora, ubicación, categoría, moneda
3. `CrearSubasta` paso 2 → elige productos de `MisProductos`, define precio base
4. Al crear: llama a `POST /api/subastadores`, luego `POST /api/subastas`, luego `POST /api/catalogos`, luego `POST /api/catalogos/{id}/items` por cada ítem
5. La subasta queda en estado `pendiente`, revisión `pendiente`
6. Esperar aprobación del admin

### Como admin:
1. `DashboardAdmin` → tab "Solicitudes" → aprobar/pausar/rechazar
2. Al aprobar → subasta pasa a `esperando`
3. El scheduler la inicia automáticamente cuando llega la fecha/hora
4. O el admin puede ir a la subasta y darle "Iniciar puja" desde `EstadoSection`

### Como postor (comprador):
1. `Home` → ver subastas en vivo
2. `Producto` → ver detalle → "Ir a la subasta en vivo"
3. `SubastaEnVivo` → auto-inscribe como asistente → puede pujar
4. Si gana → navega a `Ganaste` → continúa a `MedioPago` → `ConfirmarPago` → `PagoConfirmado`

---

## 20. Detalles técnicos importantes

- **Passwords:** Se guardan como texto plano en el campo `passwordhash`. `passlib` está instalado pero no se usa.
- **CORS:** Abierto a todos los orígenes (`allow_origins=["*"]`).
- **Tamaño máximo de request:** 50 MB. Tamaño máximo de archivo: 15 MB.
- **Comisión Bidly:** 10% (definido en el frontend en `AccountScreens.js`, constante `COMISION_BIDLY = 0.10`).
- **Moneda:** Valores en DB: `pesos` o `dolares`. El frontend convierte a símbolo: `$` o `U$D`.
- **Categorías de clientes:** `comun`, `especial`, `plata`, `oro`, `platino`. Oro y platino no tienen tope máximo de puja.
- **Startup:** Al arrancar, `main.py` altera columnas y crea `cliente_push_tokens` si no existe.
- **Email:** Se envía con Brevo API (clave `BREVO_API_KEY` en `.env`).
- **Empleado sistema:** Existe un empleado especial (`EMPLEADO_SISTEMA`) usado como verificador por defecto al registrar clientes.
- **Invitado:** El frontend permite entrar como invitado (`loginAsGuest`). Puede ver subastas pero no pujar.
