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

---

## Arquitectura

- **Backend:** Spring Boot 3.5 (Java 21), JPA/Hibernate, PostgreSQL, puerto 8083
- **Frontend:** React Native Expo SDK 54, React Navigation 6
- **DB local:** PostgreSQL en `localhost:5432`
- **DB Railway:** `trolley.proxy.rlwy.net:53193/railway`
- **DDL de referencia:** `EstructuraActual.sql` en la raíz del repo
- **Documentación completa:** `DOCUMENTACION.md` en la raíz del repo — leer antes de explorar archivos

---

## Cómo levantar en local

### Backend
```bash
cd bidly-backend
./mvnw spring-boot:run
# O desde IntelliJ: run BidlyBackendApplication
# Queda en http://localhost:8083
```

### Frontend
```bash
cd bidly-front
npx expo start
# Escanear QR con Expo Go en el celular
```

### Cambiar IP del front (celular físico)
Editar `bidly-front/src/api/client.js` línea 7:
```js
// Cambiar la IP según la red local actual:
export const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.15:8083/api';
```
- **Celular físico:** usar IP de la máquina en la red local (ej. `192.168.1.15`)
- **Emulador Android:** usar `10.0.2.2:8083`
- **iOS simulator:** usar `localhost:8083`

---

## URLs

| Entorno | URL |
|---|---|
| Producción (Railway) | `https://backend-bidly.up.railway.app/api` |
| Local | `http://localhost:8083/api` |
| Local celular físico (IP actual) | `http://192.168.1.15:8083/api` |

**Railway puede estar caído** — probar todo en local primero. Para volver a Railway, editar `client.js` línea 7.

---

## Usuario de prueba

| Campo | Valor |
|---|---|
| Email | `juan.garcia@bidly.com` |
| Contraseña | `pass1234` |
| Cliente ID | `5` |

**Importante:** las contraseñas se guardan en **texto plano** (sin BCrypt). `AuthController` compara `password.equals(cred.getPasswordHash())` directamente. No usar BCrypt en la DB.

---

## Deploy Railway

- **URL:** `https://backend-bidly.up.railway.app`
- **Variables de entorno:** `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, `PORT`
- **Tokens en memoria:** `AuthController` usa `ConcurrentHashMap`. Cada reinicio del backend en Railway invalida todos los tokens — el front detecta el 401 en `Auth.me()` al arrancar y hace logout automático.

---

## Fixes aplicados el 22/06/2026

1. **BASE_URL `http` → `https`** (`client.js:7`): Railway hacía redirect 301 HTTP→HTTPS, convirtiendo POST en GET y descartando el body. Fix aplicado y luego revertido a IP local para desarrollo.

2. **`tipo: 'credito'` → `tipo: 'tarjeta'`** (`PaymentScreens.js:53,80`): el campo `tipo` en `mediosdepago` solo acepta `'tarjeta'`, `'cuenta'` o `'cheque'`. El estado inicial y el reset tras guardar usaban `'credito'`, causando error de constraint en la DB.

---

## Bugs pendientes (al 22/06/2026)

| Bug | Pantalla/Archivo | Prioridad |
|---|---|---|
| **R2 puja máxima** (última + 20% base) no implementada | `PujaController.java` + `AuctionScreens.js` | Alta |
| **R3 excepción oro/platino** no implementada | `PujaController.java` | Alta |
| **R4 control de categoría** usuario vs subasta | `AsistenteController.java` + front | Alta |
| **R5 medio de pago verificado** requerido para pujar | `AuctionScreens.js` + `PujaController` | Alta |
| Moneda no se guarda al crear subasta | `CrearSubastaScreen` / `SubastaController` | Media |
| Producto creado no aparece en Mis Subastas | `MisSubastasScreen` / relación subasta-producto | Media |
| Dashboard Admin con datos hardcodeados `—` | `AdminScreens.js` / endpoints admin inexistentes | Baja |

---

## Gotchas críticos de la DB

### FK NOT NULL a empleados
Las columnas `revisor` (productos), `verificador` (clientes, duenios), `responsable` (catalogos) son FK NOT NULL a la tabla `empleados`. En Railway existe el empleado `identificador = 1` que se usa como sistema.

**Workaround ya aplicado en `ProductoController.java`:**
- `revisor` siempre se setea a `1L` (ignorar lo que mande el front)
- Si el `duenio` del producto no existe en tabla `duenios`, se auto-crea con `verificador = 1`

Si se crean endpoints nuevos que inserten en estas tablas, aplicar el mismo patrón.

### Constraint chkFecha en subastas
El constraint original era `fecha > CURRENT_DATE + 10` pero **no está activo en Railway** (sintaxis SQL Server, no migrada a PostgreSQL).
El frontend usa `minDate = hoy + 1`. Si el constraint volviera a activarse, consultar al usuario antes de modificar.

### Tablas propias del equipo (sí se pueden modificar)
- `credenciales` — auth: email + passwordHash (texto plano) por cliente
- `subasta_moneda` — extiende subastas con campo moneda (pesos/dolares)
- `pujo_fecha` — timestamp de cada puja
- `reembolsos` — estado de reembolso
- `mediosdepago` — medios de pago del cliente (tabla real en DB, entity `MedioPago.java`)
- `notificaciones` — notificaciones push
- `multas` — multas a clientes

**Nota:** el CLAUDE.md anterior documentaba esta tabla como `medios_pago` pero el nombre real en la DB y en la entity JPA es `mediosdepago`.

---

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
