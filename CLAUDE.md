# Bidly — Instrucciones para Claude Code

## Tablas protegidas (Railway / EstructuraActual.sql)

Las siguientes tablas son el esquema original del profesor y **NO pueden ser modificadas, eliminadas, renombradas ni alteradas de ninguna forma** (ni con migraciones, ni con scripts SQL, ni con cambios en entidades JPA que impliquen DDL):

- `paises`
- `personas`
- `empleados`
- `sectores`
- `seguros`
- `clientes`
- `duenios`
- `subastadores`
- `subastas`
- `productos`
- `fotos`
- `catalogos`
- `itemsCatalogo`
- `asistentes`
- `pujos`
- `registroDeSubasta`

### Regla obligatoria

Si una tarea requiere cambiar la estructura de alguna tabla de esta lista (agregar columna, cambiar tipo, añadir FK, borrar columna, etc.), **STOP — preguntar al usuario cómo quiere proceder** antes de hacer cualquier cosa.

Las alternativas permitidas sin preguntar son:
1. Crear una **tabla nueva** que no esté en la lista de arriba y relacionarla con las existentes via foreign key.
2. Modificar código Java/frontend sin tocar el DDL de las tablas listadas.

## Stack

- **Backend:** Spring Boot 3.5 (Java 21), JPA/Hibernate, PostgreSQL (Railway), puerto 8083
- **Frontend:** React Native Expo SDK 54, React Navigation 6
- **DB DDL de referencia:** `EstructuraActual.sql` en la raíz del repo
- **Documentación completa del sistema:** `DOCUMENTACION.md` en la raíz del repo — leer antes de explorar archivos, tiene todo el mapa del sistema

## Deploy

- **Backend Railway:** `https://backend-bidly.up.railway.app` (PORT env var, interno 8083)
- **DB Railway:** `trolley.proxy.rlwy.net:53193/railway`
- **Variables de entorno Railway:** `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, `PORT`

## Gotchas críticos de la DB

### FK NOT NULL a empleados
Las columnas `revisor` (productos), `verificador` (clientes, duenios), `responsable` (catalogos) son FK NOT NULL a la tabla `empleados`. En Railway existe el empleado `identificador = 1` que se usa como sistema.

**Workaround ya aplicado en `ProductoController.java`:**
- `revisor` siempre se setea a `EMPLEADO_SISTEMA = 1L` (ignorar lo que mande el front)
- Si el `duenio` del producto no existe en tabla `duenios`, se auto-crea con `verificador = 1`

Si se crean endpoints nuevos que inserten en estas tablas, aplicar el mismo patrón.

### Constraint chkFecha en subastas
```sql
fecha > CURRENT_DATE + 10  -- ESTRICTO, no >=
```
El mínimo válido es **hoy + 11 días**. El `CalendarPicker` del front ya lo tiene correcto (`minDate = hoy + 11`).

### Tablas propias del equipo (no son del profe, sí se pueden modificar)
- `credenciales` — auth: email + passwordHash por cliente
- `subasta_moneda` — extiende subastas con campo moneda (pesos/dolares)
- `pujo_fecha` — timestamp de cada puja (pujos no tiene fecha en el esquema original)
- `reembolsos` — estado de reembolso (registroDeSubasta no tiene reembolsada en el original)
- `medios_pago` — medios de pago del cliente
- `notificaciones` — notificaciones push
- `multas` — multas a clientes

Estos campos aparecen como `@Transient` en los modelos JPA correspondientes y se inyectan manualmente al serializar.

## Auth — Tokens en memoria

`AuthController` guarda tokens en `ConcurrentHashMap` (en memoria del proceso). **Cada reinicio del backend en Railway invalida todos los tokens.** El front detecta el 401 en `Auth.me()` al arrancar y hace logout automático.

## Patrones de polling

`SubastaEnVivoScreen` y `SubastaAdminScreen` hacen polling cada 5 segundos:
```javascript
const mounted = useRef(true);
useEffect(() => () => { mounted.current = false; }, []);
// En polling: if (!mounted.current) return;
```
En `SubastaEnVivoScreen` también: `asistenteIdRef = useRef(null)` (evita stale closure) y `navegado = useRef(false)` (evita doble navegación al detectar ganador).

## Fotos

- Almacenadas como BLOB en tabla `fotos`
- `GET /api/productos/{id}/portada` → primera foto como `image/jpeg`
- `GET /api/fotos/{id}` → foto específica como `image/jpeg`
- El front usa `${BASE_URL}/productos/${productoId}/portada` (importado de `api/client.js`)

## Empleado sistema

En Railway se asume que existe `empleados.identificador = 1`. Si la DB se resetea, hay que recrearlo antes de que la app funcione. Es el valor por defecto para todos los campos FK NOT NULL a empleados.
