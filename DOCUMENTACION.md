# Bidly — Documentación del Sistema

> Proyecto académico UADE — Materia: Análisis y Diseño de Sistemas / Lab de Software  
> Sistema de subastas online con roles de subastador y postor en tiempo real.

---

## 1. Overview

Bidly es una plataforma de subastas online. Cualquier usuario registrado puede actuar como vendedor (subastador) o comprador (postor). Las subastas tienen una sesión en vivo con polling cada 5 segundos; el subastador adjudica ítems manualmente.

**Stack:**
- Backend: Spring Boot 3.5 · Java 21 · JPA/Hibernate · PostgreSQL
- Frontend: React Native · Expo SDK 54 · React Navigation 6
- Base de datos: PostgreSQL en Railway (esquema original del profesor, no modificable)
- Emails: Brevo API REST (reemplazó SMTP)
- Deploy: Railway (backend + DB), frontend corriendo local/Expo Go

**Repo:** https://github.com/Walter-FB/Backend---Bidly  
**Backend Railway:** `https://backend-bidly.up.railway.app` (puerto interno 8083, externo 80/443)  
**DB Railway:** `trolley.proxy.rlwy.net:53193/railway`

---

## 2. Arquitectura General

```
┌─────────────────────────────────────┐
│  React Native App (Expo)            │
│  bidly-front/src/                   │
│    api/client.js  →  BASE_URL/api   │
└──────────────┬──────────────────────┘
               │ HTTP + Bearer JWT
               ▼
┌─────────────────────────────────────┐
│  Spring Boot (bidly-backend)        │
│  Puerto: 8083 (Railway: 80)         │
│  /api/**  (CORS abierto)            │
│  Security: permitAll (sin roles)    │
└──────────────┬──────────────────────┘
               │ JPA/Hibernate
               ▼
┌─────────────────────────────────────┐
│  PostgreSQL en Railway              │
│  Esquema: EstructuraActual.sql      │
│  + tablas propias (ver sección DB)  │
└─────────────────────────────────────┘
```

**Auth flow:**
1. Frontend envía email + password → backend valida → retorna token UUID
2. Token se guarda en `AsyncStorage` → se incluye como `Authorization: Bearer <token>` en cada request
3. Backend tiene `tokenStore` (ConcurrentHashMap en memoria) → si el proceso reinicia, todos los tokens se invalidan

---

## 3. Base de Datos

### 3.1 Tablas del Profesor (NO tocar DDL)

| Tabla | Descripción |
|-------|-------------|
| `paises` | Catálogo de países (numero PK, nombre, capital, nacionalidad, idiomas) |
| `personas` | Base de todos los actores (identificador IDENTITY, documento, nombre, dirección, estado, foto BLOB) |
| `empleados` | Subtipo de persona (cargo, sector FK→sectores) |
| `sectores` | Sectores de la empresa (responsableSector FK→empleados) |
| `clientes` | Subtipo de persona (admitido si/no, categoría comun/especial/plata/oro/platino, verificador FK→empleados NOT NULL) |
| `duenios` | Subtipo de persona (verificaciones financiera/judicial si/no, calificacionRiesgo 1-6, verificador FK→empleados NOT NULL) |
| `subastadores` | Subtipo de persona (matrícula, región) |
| `seguros` | Pólizas de seguro (nroPoliza PK texto, compania, polizaCombinada si/no, importe) |
| `productos` | Artículos a subastar (disponible si/no, descripcionCatalogo, descripcionCompleta, revisor FK→empleados NOT NULL, duenio FK→duenios NOT NULL) |
| `fotos` | Imágenes de productos (producto FK→productos, foto BLOB) |
| `catalogos` | Catálogos de subasta (descripcion, subasta FK→subastas, responsable FK→empleados NOT NULL) |
| `itemsCatalogo` | Ítems dentro de un catálogo (catalogo, producto, precioBase >0.01, comision >0.01, subastado si/no) |
| `subastas` | Subastas (fecha, hora, estado abierta/cerrada, subastador FK→subastadores, ubicacion, categoria) |
| `asistentes` | Postores inscritos a una subasta (numeroPostor, cliente FK→clientes, subasta FK→subastas) |
| `pujos` | Pujas realizadas (asistente FK, item FK, importe >0.01, ganador si/no default 'no') |
| `registroDeSubasta` | Registro post-adjudicación (subasta, duenio, producto, cliente FK, importe, comision) |

**Constraints importantes:**
- `chkFecha` en `subastas`: `fecha > CURRENT_DATE + 10` → mínimo válido = hoy + 11 días (estricto)
- `revisor`, `verificador`, `responsable`: todos FK NOT NULL a `empleados` → se usa `EMPLEADO_SISTEMA = 1L` como valor por defecto
- `estado` en `subastas`: typo en SQL original → `'carrada'` en vez de `'cerrada'`, pero el backend usa `'cerrada'` (la tabla en Railway fue creada correctamente)

### 3.2 Tablas Propias del Equipo (pueden modificarse)

| Tabla | Descripción |
|-------|-------------|
| `credenciales` | Auth: (cliente PK FK→clientes, email UNIQUE, passwordHash) |
| `subasta_moneda` | Extiende subastas con campo moneda (subasta PK FK→subastas, moneda varchar) |
| `pujo_fecha` | Timestamp de cada puja (pujo PK FK→pujos, fechaHora timestamp) |
| `reembolsos` | Estado de reembolso por registro (registro PK FK→registroDeSubasta, reembolsada si/no) |
| `medios_pago` | Medios de pago del cliente (cliente FK, tipo, numeroTarjeta, vencimiento, titular, numeroCuenta, banco, numeroCheque, montoCheque, verificado) |
| `notificaciones` | Notificaciones push (cliente FK, tipo, mensaje, leida si/no, fechaHora) |
| `multas` | Multas a clientes (cliente FK, pujo FK, importe, pagada si/no, fechaGenerada) |

### 3.3 Relaciones Clave

```
personas ←── clientes ←── asistentes ←── pujos
         ←── empleados
         ←── duenios ←── productos ←── fotos
         ←── subastadores ←── subastas ←── catalogos ←── itemsCatalogo
                                                              ↑
                                                           pujos
```

---

## 4. Backend

**Ubicación:** `bidly-backend/src/main/java/com/bidly/bidly_backend/`

### 4.1 Controllers

#### `AuthController.java` — `/api/auth`

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/send-verification` | Genera código 6 dígitos, lo guarda en `pendingCodes` (10 min TTL), envía email via Brevo |
| POST | `/verify-code` | Valida código → genera `verifiedToken` UUID para usar en register |
| POST | `/register` | Crea Persona + Cliente + Credencial. Requiere `verifiedToken` válido en body |
| POST | `/login` | Valida email+passwordHash → genera token UUID → guarda en `tokenStore` en memoria → retorna `{token, clienteId, email, nombre, categoria, admitido}` |
| GET | `/me` | Lee `Authorization: Bearer <token>` → busca en tokenStore → retorna datos del usuario |

**Nota:** `tokenStore`, `pendingCodes`, `verifiedTokens` son `ConcurrentHashMap` en memoria. Se limpian al reiniciar el proceso.

#### `SubastaController.java` — `/api/subastas`

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | Lista subastas. Filtros opcionales: `?estado=abierta&categoria=comun&moneda=pesos` |
| GET | `/{id}` | Detalle de subasta (incluye campo `moneda` via SubastaMoneda) |
| POST | `/` | Crea subasta. Body: `{fecha, hora, estado, subastador, ubicacion, categoria, moneda}`. Guarda moneda en tabla `subasta_moneda` |
| GET | `/{id}/catalogo` | Retorna primer ItemCatalogo de la subasta (para ProductoScreen) |
| GET | `/{id}/catalogos` | Retorna todos los ItemCatalogos de la subasta (con producto anidado) |
| GET | `/{id}/estado` | Retorna `{estado}` |
| PATCH | `/{id}/estado` | Cambia estado. Body: `{estado: "abierta"|"cerrada"}` |
| GET | `/{id}/portada` | Retorna imagen JPEG del primer producto del catálogo |
| GET | `/{id}/asistentes` | Lista asistentes (para SubastaAdminScreen: contador en vivo) |

#### `ProductoController.java` — `/api/productos`

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/{id}` | Obtiene producto |
| POST | `/` | Crea producto. Auto-asigna `revisor = EMPLEADO_SISTEMA (1L)`. Si `duenio` no existe en tabla `duenios`, lo crea automáticamente con valores por defecto |
| PATCH | `/{id}/disponible` | Toggle disponibilidad (si↔no) |
| GET | `/{id}/fotos` | Retorna lista de IDs de fotos `[Long]` |
| GET | `/{id}/portada` | Retorna primera foto como `image/jpeg` |
| POST | `/{id}/fotos` | Recibe `multipart/form-data` con campo `fotos` (lista de archivos) → guarda como BLOB |

#### `CatalogoController.java` — `/api/catalogos`

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/` | Crea catálogo. Body: `{descripcion, subasta (id), responsable (id)}`. Auto-usa `EMPLEADO_SISTEMA` si responsable no existe |
| GET | `/{id}/items` | Lista items del catálogo |

#### `ItemCatalogoController.java`

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/catalogos/{catalogoId}/items` | Agrega ítem. Body: `{producto (id), precioBase, comision}` |
| GET | `/items/{id}` | Obtiene ítem |
| PATCH | `/items/{id}/adjudicar` | **Operación atómica:** busca puja más alta → marca `puja.ganador='si'` → marca `item.subastado='si'` → crea `RegistroDeSubasta` → retorna `{ganadorClienteId, importeFinal, comision, itemId}`. Retorna 400 si no hay pujas |

#### `PujaController.java` — `/api/pujos`

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | Requiere `?item={id}` o `?asistente={id}`. Retorna lista ordenada por importe DESC. Cada puja incluye `fechaHora` via PujoFecha |
| POST | `/` | Crea puja. Body: `{asistente: {identificador}, item: {identificador}, importe}`. Valida que importe ≥ última puja + 1% del precioBase |
| GET | `/{itemId}/ganador` | Retorna puja con `ganador='si'` para ese ítem |

#### `AsistenteController.java` — `/api/asistentes`

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/{id}` | Obtiene asistente |
| GET | `/{id}/pujos` | Lista pujas del asistente ordenadas por importe DESC |
| POST | `/inscribir` | Body: `{clienteId, subastaId}`. Find-or-create: si ya existe, retorna el existente. Si no, crea con `numeroPostor` autoincremental |

#### `SubastadorController.java` — `/api/subastadores`

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/{id}` | Obtiene subastador o 404 |
| POST | `/` | Idempotente: si ya existe retorna el existente. Body: `{identificador, matricula?, region?}` |
| GET | `/{id}/subastas` | Lista subastas del subastador (incluye moneda via SubastaMoneda) |

#### `PersonaController.java` — `/api/personas`

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/` | Crea persona |
| GET | `/{id}` | Obtiene persona |
| PUT | `/{id}` | Reemplaza persona completa |
| PATCH | `/{id}` | Actualización parcial de documento/nombre/dirección/estado |

#### `ClienteController.java` — `/api/clientes`

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/` | Crea cliente (persona debe existir) |
| GET | `/{id}` | Obtiene cliente |
| PATCH | `/{id}/categoria` | Body: `{categoria}` |
| PATCH | `/{id}/admitido` | Body: `{admitido}` |
| GET | `/{id}/medios-pago` | Lista medios de pago |
| POST | `/{id}/medios-pago` | Agrega medio de pago |

#### Otros controllers

| Controller | Ruta base | Funciones clave |
|-----------|-----------|-----------------|
| `FotoController` | `/api/fotos` | `GET /{id}` → retorna BLOB como `image/jpeg` |
| `RegistroController` | `/api/registro-subasta` | CRUD + `GET /cliente/{id}` + `GET /subasta/{id}` + `PATCH /{id}/reembolso` |
| `MultaController` | `/api/multas` | `GET /{id}` + `PATCH /{id}` (pagada si/no) |
| `NotificacionController` | `/api/notificaciones` | `GET /{id}` + `GET /cliente/{clienteId}` |
| `SeguroController` | `/api/seguros` | CRUD por nroPoliza |

### 4.2 Models

Todos en `model/`. Usan Lombok (`@Getter @Setter @NoArgsConstructor @AllArgsConstructor`).

| Modelo | Tabla | Notas |
|--------|-------|-------|
| `Persona` | `personas` | Base. Foto como `byte[]` |
| `Cliente` | `clientes` | `email` y `passwordHash` son `@Transient` (no se persisten aquí, van en Credencial) |
| `Credencial` | `credenciales` | PK = clienteId, tiene email + passwordHash |
| `Empleado` | `empleados` | Cargo + sector |
| `Duenio` | `duenios` | Verificaciones financiera/judicial, calificacionRiesgo |
| `Subastador` | `subastadores` | Matrícula + región |
| `Subasta` | `subastas` | `moneda` es `@Transient` (se lee de SubastaMoneda) |
| `SubastaMoneda` | `subasta_moneda` | PK = subastaId |
| `Catalogo` | `catalogos` | |
| `ItemCatalogo` | `itemscatalogo` | `precioBase` y `comision` son `BigDecimal` |
| `Producto` | `productos` | `revisor` y `duenio` son `Long` (no `@ManyToOne`). OneToMany lazy con Foto |
| `Foto` | `fotos` | `foto` (byte[]) con `@JsonIgnore` para no serializar en JSON |
| `Asistente` | `asistentes` | |
| `Puja` | `pujos` | `fechaHora` es `@Transient` (se lee de PujoFecha y se inyecta al serializar) |
| `PujoFecha` | `pujo_fecha` | PK = pujoId |
| `RegistroDeSubasta` | `registrodesubasta` | `reembolsada` es `@Transient` (se lee de Reembolso) |
| `Reembolso` | `reembolsos` | PK = registroId |
| `MedioPago` | `medios_pago` | Soporta tarjeta, cuenta bancaria, cheque |
| `Multa` | `multas` | |
| `Notificacion` | `notificaciones` | |
| `Seguro` | `seguros` | PK es String (nroPoliza), no auto-increment |

### 4.3 Repositories

Todos extienden `JpaRepository<T, ID>`. Métodos custom relevantes:

```java
// SubastaRepository
findByEstado(String estado)
findBySubastador(Long subastadorId)
// JPQL con filtros opcionales (estado, categoria, moneda via JOIN SubastaMoneda)
findByFiltros(@Param estado, @Param categoria, @Param moneda)

// PujaRepository
findTopByItemIdentificadorOrderByImporteDesc(Long itemId)  // puja más alta
findByItemIdentificadorOrderByImporteDesc(Long itemId)      // historial del ítem
findByItemIdentificadorAndGanador(Long itemId, String ganador)
findByAsistenteIdentificadorOrderByImporteDesc(Long asistenteId)

// AsistenteRepository
findByClienteIdentificadorAndSubastaIdentificador(Long clienteId, Long subastaId)
findBySubastaIdentificador(Long subastaId)

// ItemCatalogoRepository
findByCatalogoIdentificador(Long catalogoId)
findByCatalogoSubastaIdentificador(Long subastaId)

// CredencialRepository
findByEmail(String email)
```

### 4.4 Services

**`EmailService.java`**  
Usa Brevo API REST (no SMTP). Requiere variables de entorno en Railway:
- `BREVO_API_KEY` — clave API de Brevo
- `BREVO_FROM_EMAIL` — email remitente verificado

Método principal: `sendVerificationCode(String toEmail, String code)` — envía código con HTML formateado.

### 4.5 Config

**`SecurityConfig.java`** — Desactiva CSRF, `permitAll()` para todas las rutas. La autenticación se maneja manualmente en `AuthController` (no usa Spring Security para validar tokens).

**`CorsConfig.java`** — Permite todos los orígenes, métodos y headers para `/api/**`.

**`BidlyBackendApplication.java`** — Entry point. Fuerza `TimeZone = "UTC"` al arrancar.

**`application.properties`** clave:
```properties
server.port=${PORT:8083}
spring.datasource.url=jdbc:postgresql://trolley.proxy.rlwy.net:53193/railway
spring.jpa.hibernate.ddl-auto=none
spring.hikari.maximum-pool-size=5
```

---

## 5. Frontend

**Ubicación:** `bidly-front/src/`

### 5.1 API Layer

#### `api/client.js`
- `BASE_URL` = `https://backend-bidly.up.railway.app/api`
- Lee token de `AsyncStorage` (`@bidly_token`) y lo adjunta como `Authorization: Bearer`
- Función `request(path, options)` — core de todas las llamadas
- Función `upload(path, formData)` — para multipart (fotos)
- Exports: `api.get`, `api.post`, `api.put`, `api.patch`, `api.del`, `setToken`, `upload`, `BASE_URL`

#### `api/endpoints.js`
Módulos exportados:

```javascript
Auth        → login, register, me, logout, sendVerification, verifyCode
Subastas    → listar(params), obtener(id), catalogo(id), catalogos(id),
              estado(id), actualizarEstado(id, estado), crear(payload),
              porSubastador(subastadorId), asistentes(id)
Pujas       → porItem(itemId), porAsistente(asisId), pujar(asisId, itemId, importe), ganador(itemId)
Catalogos   → items(catalogoId), crear(payload), agregarItem(catalogoId, payload)
Asistentes  → obtener(id), pujas(id), inscribir(clienteId, subastaId)
Clientes    → obtener(id), actualizarCategoria(id, cat), mediosPago(id), agregarMedioPago(id, mp)
Personas    → obtener(id), actualizar(id, datos)
Productos   → obtener(id), crear(payload), disponible(id, disp), fotos(id), agregarFotos(id, formData)
RegistroSubasta → crear, obtener, porCliente, porSubasta, reembolso
Multas      → obtener(id), pagar(id)
Seguros     → obtener, crear, actualizar
Subastadores → obtener(id), crear(payload)
Items       → obtener(id), adjudicar(id)
Notificaciones → obtener(id), porCliente(clienteId)
```

### 5.2 Context

#### `context/AuthContext.js`

**Shape del objeto `user`:**
```javascript
{
  clienteId: Number,
  email: String,
  nombre: String,
  categoria: 'comun'|'especial'|'plata'|'oro'|'platino',
  admitido: 'si'|'no',
  isGuest: Boolean  // true cuando entra como invitado
}
```

**Métodos del contexto:**
- `login(email, password)` → llama `Auth.login` → guarda token en AsyncStorage + user
- `register(payload)` → llama `Auth.register`
- `logout()` → limpia AsyncStorage + setUser(null)
- `loginAsGuest()` → setUser({ isGuest: true })
- `isAdmin` — siempre `false` (reservado para futuro)

**Boot flow:**
1. `booting = true` al arrancar
2. Lee `@bidly_token` y `@bidly_user` de AsyncStorage
3. Si tiene token → llama `Auth.me()` para validarlo
4. Si válido → setUser(data); si falla → limpia storage
5. `booting = false` → RootNavigator decide qué mostrar

### 5.3 Theme

#### `theme/theme.js`

```javascript
colors = {
  bg: '#0b1022',          // fondo general
  card: '#161d33',        // card base
  cardEl: '#1b2440',      // card elevada
  input: '#26314c',       // fondo inputs
  blue: '#3a8fd6',        // acción principal
  blueLogo: '#3f9ae0',    // logo BIDLY
  green: '#37d66f',       // success / precio
  gold: '#e89a3c',        // timer / advertencias
  red: '#e23950',         // danger / badge en vivo
  muted: '#8a93ab',       // texto secundario
  border: 'rgba(255,255,255,0.08)',
  borderHi: 'rgba(59,130,246,0.45)',
}
```

Fuente display: `ArchivoBlack_400Regular` (Google Fonts via expo-google-fonts).

### 5.4 Componentes UI

#### `components/ui.js` — Exports:

| Componente | Descripción |
|-----------|-------------|
| `Screen` | Contenedor base con SafeArea, fondo `colors.bg`, scroll opcional via prop `scroll` |
| `Header` | 52px de alto, botón atrás (goBack) + logo BIDLY centrado (o `right` custom) |
| `Display` | Texto con fuente ArchivoBlack. Usado para títulos y números |
| `Title` | Display 33px para encabezados de página |
| `Sub` | Texto muted 14.5px para subtítulos |
| `SectionLabel` | Display 14px para separadores de sección |
| `Btn` | Botón: `kind` = primary (azul, default) / danger (rojo) / ghost (sin fondo). Prop `disabled` |
| `Chip` | Toggle pill: `active` → borde dorado. Prop `dot` → punto animado (para "en vivo") |
| `Card` | Contenedor con border-radius 16 y borde. Prop `el` → usa `cardEl` (más oscuro) |
| `Field` | TextInput estilizado, soporte `multiline`, `keyboardType` |
| `LiveBadge` | Badge rojo "EN VIVO" con punto blanco |
| `Tag` | Etiqueta pequeña: `label` + `color`. Prop `filled` → fondo coloreado |
| `ImgBox` | Image con fallback: si tiene `src` (URI) la muestra, si no muestra icono `image-outline` |
| `BottomBar` | View anclada al fondo con padding por insets (safe area) |
| `Row` | Fila key/value: `k` izquierda (muted), `v` derecha (blanco) |

### 5.5 Navegación

#### `navigation/RootNavigator.js`

```
RootNavigator (Stack)
├── booting → Splash
├── !user   → Login, Registro, VerificarEmail, CrearPassword
└── user    → TabNavigator (Main)
              ├── Filtros (modal)
              ├── Notificaciones
              ├── Favoritos
              ├── Producto
              ├── SubastaEnVivo
              ├── Ganaste
              ├── SubastaFinalizada
              ├── MedioPago
              ├── Seguro
              ├── ConfirmarPago
              ├── PagoConfirmado
              ├── Multa
              ├── Reembolso
              ├── MisCompras
              ├── Historial
              ├── Publicar
              ├── DatosGanador
              ├── DatosPersonales
              ├── CrearSubasta
              ├── SubastaAdmin
              └── DashboardAdmin (solo si isAdmin)
```

#### `navigation/TabNavigator.js`

5 tabs en la barra inferior:
1. **Home** (icono home) → `HomeScreen`
2. **Historial** (icono time) → `HistorialScreen` (bloqueado para invitados)
3. **+** (FAB central, icono add) → `PublicarScreen` (bloqueado para invitados con alert)
4. **Subastas** (icono hammer) → `MisSubastasScreen` (bloqueado para invitados)
5. **Perfil** (icono person) → `PerfilScreen` (bloqueado para invitados)

`GuestBlockScreen` — pantalla genérica que muestra cuando el invitado intenta acceder a tabs protegidas.

### 5.6 Pantallas

#### `screens/AuthScreens.js`

| Screen | Descripción | Navega a |
|--------|-------------|----------|
| `SplashScreen` | Logo + spinner. Espera boot de AuthContext | Auto (RootNavigator) |
| `LoginScreen` | Email + password. Link registro. Botón "invitado" | Registro, VerificarEmail, Main |
| `RegistroScreen` | Nombre, apellido, domicilio, DNI, email → `Auth.sendVerification` | VerificarEmail |
| `VerificarEmailScreen` | 6 dígitos. Reenviar código. → `Auth.verifyCode` | CrearPassword |
| `CrearPasswordScreen` | Nueva password + TyC. → `Auth.register` | Login (post-registro) |

#### `screens/HomeScreens.js`

| Screen/Componente | Descripción |
|------------------|-------------|
| `HomeScreen` | Lista de subastas con tabs Todas/En vivo/Terminadas. Filtros por categoría/moneda. `useFocusEffect` para recargar al volver |
| `AuctionCard` | Componente reutilizable de tarjeta de subasta. Recibe `subasta` objeto → navega a `Producto` |
| `FiltrosScreen` | Modal (presentation: modal) con chips de estado, categoría, moneda |
| `NotificacionesScreen` | Lista notificaciones del usuario con ícono por tipo |
| `FavoritosScreen` | Placeholder — muestra subastas abiertas (favoritos reales no implementados) |

#### `screens/AuctionScreens.js`

| Screen | Params recibidos | Descripción |
|--------|-----------------|-------------|
| `ProductoScreen` | `subastaId` o `subasta` (preview) | Detalle completo: fotos, precio base, ítems del catálogo. Botón "Ir a la subasta en vivo" (solo si `estado='abierta'`) |
| `SubastaEnVivoScreen` | `subastaId, itemId, productoId, precioBase, titulo, moneda, comision, fecha, hora` | Puja en tiempo real. Polling 5s (`Pujas.porItem`). Auto-inscripción como asistente. Countdown. Detecta puja ganadora → navega a `Ganaste` o `SubastaFinalizada` |
| `GanasteScreen` | `titulo, moneda, importe, subastaId, itemId, comision` | Confirmación victoria. Botón → `MedioPago` |
| `SubastaFinalizadaScreen` | `titulo, moneda, importe, totalPostores, subastaId` | Pantalla cuando otro ganó. Botón → `Main` |
| `SubastaAdminScreen` | `subastaId` | Panel del subastador. Carga subasta + catálogo + asistentes. Polling 5s pujas del ítem activo. Adjudicar/Siguiente/Abrir-Cerrar |

**Patrón polling en SubastaEnVivoScreen:**
```javascript
// Ref para evitar stale closure en callbacks
const asistenteIdRef = useRef(null);
const navegado = useRef(false);
useEffect(() => { asistenteIdRef.current = asistenteId; }, [asistenteId]);
// Detecta ganador en cada poll
const ganadora = lista.find((p) => p.ganador === 'si');
if (ganadora && !navegado.current) {
  navegado.current = true;
  const yoGane = asistenteIdRef.current === ganadora.asistente?.identificador;
  navigation.replace(yoGane ? 'Ganaste' : 'SubastaFinalizada', {...});
}
```

#### `screens/AccountScreens.js`

| Screen/Componente | Descripción |
|------------------|-------------|
| `PerfilScreen` | Datos del usuario, avatar, categoría con color, menú de opciones |
| `MisComprasScreen` | Historial de `RegistroSubasta` del cliente. Tabs Compras/Reembolsos |
| `HistorialScreen` | Similar a MisCompras pero orientado a subastas |
| `MisSubastasScreen` | Mis subastas como vendedor. Tabs En curso/Finalizadas/Todas. Recarga en `focus`. Botón → `CrearSubasta` |
| `CrearSubastaScreen` | **Paso 1:** CalendarPicker + TimeSelector + Ubicación + Categoría chips + Moneda chips. **Paso 2:** Lista de productos, precios, comisiones. Al crear: auto-crea subastador → crea subasta → crea catálogo → agrega ítems |
| `PublicarScreen` | Fotos (max 6, solo fotos + botón +), título/categoría/estado/precio/descripción. Al publicar: crea Producto → sube fotos → alert con opción "Crear subasta" |
| `DatosGanadorScreen` | Datos del ganador de un registro de subasta |
| `DatosPersonalesScreen` | Readonly: nombre, email, domicilio, DNI, categoría, admitido |
| `CalendarPicker` | Componente custom (sin deps extra): modal con calendario mensual. Deshabilita fechas < hoy+11. Selección retorna string 'YYYY-MM-DD' |
| `TimeSelector` | Dos botones [HH] : [MM] que abren modales. Modal hora: grilla 00-23. Modal minutos: 4 opciones (00/15/30/45). Auto-abre minutos tras elegir hora |

**Nota route params en `CrearSubastaScreen`:**
- `route.params.productoId` + `route.params.titulo` → pre-carga el producto (viene de `PublicarScreen` alert "Crear subasta")

#### `screens/PaymentScreens.js`

| Screen | Params | Descripción |
|--------|--------|-------------|
| `MedioPagoScreen` | `subastaId, itemId, moneda, importe, comision, titulo` | Lista medios de pago + opción agregar nuevo. Selección → `Seguro` |
| `SeguroScreen` | `+ medioPagoId` | Toggle seguro (2.5% del importe). → `ConfirmarPago` |
| `ConfirmarPagoScreen` | `+ seguro, nroPoliza` | Resumen total. Botón confirmar → `PagoConfirmado` |
| `PagoConfirmadoScreen` | | Recibo post-pago. → `Main` |
| `MultaScreen` | `multaId` | Detalle multa + botón pagar |
| `ReembolsoScreen` | `registroId, importe, titulo` | Formulario motivo + confirmación reembolso |

#### `screens/AdminScreens.js`

| Screen | Descripción |
|--------|-------------|
| `DashboardAdminScreen` | Panel admin placeholder. Stats mock. Accesible solo si `isAdmin=true` |

---

## 6. Flujos Completos

### 6.1 Auth — Registro nuevo usuario
```
LoginScreen → "Registrarse"
→ RegistroScreen (nombre, apellido, DNI, domicilio, email)
  → Auth.sendVerification(email) → código llega por email (Brevo)
→ VerificarEmailScreen (ingresar 6 dígitos)
  → Auth.verifyCode(email, code) → retorna verifiedToken
→ CrearPasswordScreen (password, TyC)
  → Auth.register({nombre, apellido, dni, direccion, email, password, verifiedToken})
    → backend crea: Persona + Cliente (verificador=1) + Credencial
→ LoginScreen (post-registro exitoso)
```

### 6.2 Flujo Postor (comprar)
```
HomeScreen (lista subastas abiertas)
→ tap AuctionCard → ProductoScreen (detalle, fotos, ítems)
→ "Ir a la subasta en vivo" → SubastaEnVivoScreen
  - Asistentes.inscribir(clienteId, subastaId) → auto-inscripción
  - Polling 5s: Pujas.porItem(itemId)
  - "Pujar $X" → Pujas.pujar(asistenteId, itemId, importe)
  - Poll detecta ganador → navigation.replace(...)
→ GanasteScreen → "Continuar al pago" → MedioPagoScreen
→ SeguroScreen → ConfirmarPagoScreen → PagoConfirmadoScreen
```

### 6.3 Flujo Subastador (vender)
```
TabNavigator → "Mis subastas" → MisSubastasScreen
→ "Nueva subasta" → CrearSubastaScreen
  Paso 1: fecha (CalendarPicker, mín hoy+11) + hora + ubicación + categoría + moneda
  Paso 2: productos (ID manual o desde PublicarScreen), precioBase, comisión
  → Subastadores.crear({identificador: clienteId})  [idempotente]
  → Subastas.crear({fecha, hora, estado:'cerrada', ...})
  → Catalogos.crear({descripcion, subasta: id, responsable: clienteId})
  → Catalogos.agregarItem(catalogoId, {producto, precioBase, comision}) × N
→ MisSubastasScreen → tap subasta → SubastaAdminScreen
  - "Abrir subasta" → Subastas.actualizarEstado(id, 'abierta')
  - Polling 5s: Pujas.porItem(itemActivo.id)
  - "Adjudicar ítem" → Items.adjudicar(itemActivo.id)
    → backend atómico: marca ganador + crea RegistroDeSubasta
  - "Siguiente ítem →" → auto-selecciona próximo con subastado≠'si'
  - "Cerrar subasta" → Subastas.actualizarEstado(id, 'cerrada')
```

### 6.4 Flujo Publicar producto
```
TabNavigator → FAB "+" → PublicarScreen
→ elegir fotos (ImagePicker, max 6)
→ completar título/categoría/estado/precio/descripción
→ "Publicar" → Productos.crear({descripcionCatalogo, descripcionCompleta, duenio: clienteId})
              → Productos.agregarFotos(id, formData)
→ Alert: "¿Crear subasta con este producto?"
  → "Crear subasta" → navigate('CrearSubasta', {productoId, titulo})
  → "Ir al inicio" → navigate('Main')
```

---

## 7. Gotchas y Constraints Conocidos

### 7.1 FK NOT NULL a empleados
Las tablas `productos` (`revisor`), `clientes` (`verificador`), `duenios` (`verificador`), `catalogos` (`responsable`) tienen FK NOT NULL a `empleados`. En Railway existe el empleado con `identificador = 1` que se usa como sistema.

**Workaround aplicado:**
- `ProductoController.crear()`: siempre asigna `revisor = EMPLEADO_SISTEMA (1L)`. Si el `duenio` no existe en `duenios`, lo auto-crea con `verificador = 1`.
- Para creación de `catalogos` y `clientes`: se asume que el `responsable/verificador = 1` ya existe.

### 7.2 Tokens en memoria
`AuthController` usa `ConcurrentHashMap` para `tokenStore`. **Cada vez que Railway reinicia el backend, todos los tokens se invalidan.** Los usuarios verán un error 401 y tendrán que hacer login de nuevo. AsyncStorage del front tiene el token viejo pero `Auth.me()` falla → logout automático al arrancar la app.

### 7.3 chkFecha constraint
La DB PostgreSQL tiene: `fecha > CURRENT_DATE + 10` (estricto). El front usa `minDate = hoy + 11` en `CalendarPicker` para no permitir fechas que fallarían el INSERT. Si cambia la fecha del servidor o hay desfase de zona horaria, puede fallar igual.

### 7.4 moneda es @Transient en Subasta
El campo `moneda` no está en la tabla `subastas` del esquema original. Se almacena en tabla propia `subasta_moneda`. En el modelo `Subasta.java`, `moneda` es `@Transient` y se inyecta al serializar desde `SubastaMoneda`. El `SubastaController` maneja el guardado manual.

### 7.5 fechaHora en Puja
Similar a moneda: `fechaHora` no está en `pujos`. Está en tabla `pujo_fecha`. En `Puja.java`, `fechaHora` es `@Transient`. `PujaController` guarda el timestamp en `PujoFecha` al crear la puja.

### 7.6 reembolsada en RegistroDeSubasta
`reembolsada` está en tabla `reembolsos`, no en `registroDeSubasta`. Es `@Transient` en el modelo y se inyecta al serializar.

### 7.7 Importe mínimo de puja
`PujaController` valida: `importe ≥ últimaPuja + 1% del precioBase` (o `≥ precioBase` si es la primera puja). El front calcula el mismo valor en `SubastaEnVivoScreen` para mostrar la próxima mínima.

### 7.8 Foto portada
- `GET /api/productos/{id}/portada` → primer BLOB de `fotos` como `image/jpeg`
- `GET /api/fotos/{id}` → BLOB por ID específico
- `GET /api/productos/{id}/fotos` → lista de IDs `[Long]`
- El front construye URLs: `` `${BASE_URL}/productos/${productoId}/portada` ``

### 7.9 Polling y refs en componentes de subasta
Patrón en `SubastaEnVivoScreen` y `SubastaAdminScreen`:
```javascript
const mounted = useRef(true);
useEffect(() => () => { mounted.current = false; }, []);
// En callbacks: if (!mounted.current) return;
```
Esto evita `setState` después de unmount. Adicionalmente `asistenteIdRef` y `navegado` en `SubastaEnVivoScreen` evitan stale closures y doble navegación.

---

## 8. Datos de Prueba y Ambiente

- En Railway existe al menos 1 empleado con `identificador = 1` (EMPLEADO_SISTEMA)
- La DB en Railway se conecta con las credenciales en `application.properties`
- Variables de entorno en Railway: `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, `PORT`
- El frontend apunta a `https://backend-bidly.up.railway.app/api` (hardcoded en `client.js`)

---

## 9. Estructura de archivos del repositorio

```
/ (raíz)
├── CLAUDE.md                    ← instrucciones para Claude
├── DOCUMENTACION.md             ← este archivo
├── EstructuraActual.sql         ← esquema original del profesor (referencia)
│
├── bidly-backend/
│   └── src/main/java/com/bidly/bidly_backend/
│       ├── BidlyBackendApplication.java
│       ├── config/
│       │   ├── CorsConfig.java
│       │   └── SecurityConfig.java
│       ├── controller/          ← 14 controllers (ver sección 4.1)
│       ├── model/               ← 21 entidades (ver sección 4.2)
│       ├── repository/          ← 22 repositorios (ver sección 4.3)
│       └── service/
│           └── EmailService.java
│
└── bidly-front/
    └── src/
        ├── api/
        │   ├── client.js        ← HTTP client, token management
        │   └── endpoints.js     ← todos los módulos de endpoints
        ├── components/
        │   └── ui.js            ← librería de componentes reutilizables
        ├── context/
        │   └── AuthContext.js   ← estado global de auth
        ├── navigation/
        │   ├── RootNavigator.js ← árbol completo de navegación
        │   └── TabNavigator.js  ← barra inferior con 5 tabs
        ├── screens/
        │   ├── AuthScreens.js   ← Login, Registro, VerificarEmail, CrearPassword
        │   ├── HomeScreens.js   ← Home, Filtros, Notificaciones, Favoritos
        │   ├── AuctionScreens.js ← Producto, SubastaEnVivo, Ganaste, SubastaFinalizada, SubastaAdmin
        │   ├── AccountScreens.js ← Perfil, MisSubastas, CrearSubasta, Publicar, + utilidades
        │   ├── PaymentScreens.js ← MedioPago, Seguro, ConfirmarPago, PagoConfirmado, Multa, Reembolso
        │   └── AdminScreens.js  ← DashboardAdmin (placeholder)
        └── theme/
            └── theme.js         ← colores, radii, spacing, fuentes
```
