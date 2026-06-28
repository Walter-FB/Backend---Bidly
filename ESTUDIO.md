# BIDLY — Documentación de Estudio Completa

> Guía para entender el código de principio a fin, capa por capa.

---

## ÍNDICE

1. [Stack y arquitectura general](#1-stack-y-arquitectura-general)
2. [Base de datos — diseño completo](#2-base-de-datos--diseño-completo)
3. [Backend — Spring Boot](#3-backend--spring-boot)
   - 3.1 Configuración y arranque
   - 3.2 Modelos (entidades JPA)
   - 3.3 Repositorios
   - 3.4 Controladores (API REST)
   - 3.5 Servicio de email
4. [Frontend — React Native](#4-frontend--react-native)
   - 4.1 Cliente HTTP y endpoints
   - 4.2 AuthContext — estado global
   - 4.3 Hook useNotifBadge
   - 4.4 Componentes UI reutilizables
   - 4.5 Navegación (árbol de pantallas)
   - 4.6 Pantallas — detalle de cada una
5. [Flujos completos de punta a punta](#5-flujos-completos-de-punta-a-punta)
6. [Patrones de código importantes](#6-patrones-de-código-importantes)
7. [Gotchas y trampas conocidas](#7-gotchas-y-trampas-conocidas)

---

## 1. Stack y arquitectura general

```
┌──────────────────────────────────────────────────────────┐
│  FRONTEND — React Native + Expo SDK 54                   │
│  bidly-front/src/                                        │
│    api/client.js  →  BASE_URL/api (+ Bearer JWT)         │
└────────────────────────┬─────────────────────────────────┘
                         │ HTTP (JSON)
                         ▼
┌──────────────────────────────────────────────────────────┐
│  BACKEND — Spring Boot 3.5 / Java 21                     │
│  Puerto 8083 (Railway expone 80/443)                     │
│  /api/** — CORS abierto, sin roles                       │
└────────────────────────┬─────────────────────────────────┘
                         │ JPA / Hibernate (SQL nativo)
                         ▼
┌──────────────────────────────────────────────────────────┐
│  PostgreSQL en Railway                                   │
│  trolley.proxy.rlwy.net:53193/railway                    │
│  Esquema original (profesor) + tablas propias            │
└──────────────────────────────────────────────────────────┘
```

**Tecnologías clave:**
- **Auth:** Tokens UUID guardados en `ConcurrentHashMap` en memoria (no JWT real). Se pierden si el backend reinicia.
- **Email:** API REST de Brevo (no SMTP). Variables de entorno: `BREVO_API_KEY`, `BREVO_FROM_EMAIL`.
- **Imágenes:** Guardadas como BLOB en tabla `fotos`. El backend las sirve como `image/jpeg`.
- **Push notifications:** Expo Notifications API (en el código FastAPI también hay integración).
- **Deploy:** Railway para backend + DB. Frontend corre local con Expo Go.

---

## 2. Base de datos — diseño completo

### 2.1 Tablas del profesor (NUNCA modificar estructura)

#### `paises`
```sql
numero (PK int)
nombre varchar(250)
nombreCorto varchar(250)
capital varchar(250)
nacionalidad varchar(250)
idiomas varchar(150)
```
Catálogo estático de países. Se usa en clientes y dueños.

---

#### `personas`
```sql
identificador (PK identity/autoincrement)
documento varchar(20)       -- DNI
nombre varchar(150)
direccion varchar(250)
estado varchar(15)          -- 'activo' | 'incativo' (typo original)
foto varbinary(max)         -- BLOB, no se usa en el front actual
```
**Tabla base.** Todos los actores del sistema (clientes, empleados, dueños, subastadores) extienden `personas` por FK con el mismo `identificador`.

---

#### `empleados`
```sql
identificador (PK FK→personas)
cargo varchar(100)
sector int (FK→sectores)
```
**Empleado sistema:** El empleado con `identificador = 1` es el "sistema". Se usa para cumplir FK NOT NULL en `revisor`, `verificador`, `responsable`.

---

#### `sectores`
```sql
identificador (PK identity)
nombreSector varchar(150)
codigoSector varchar(10)
responsableSector int (FK→empleados)
```

---

#### `clientes`
```sql
identificador (PK FK→personas)
numeroPais int (FK→paises)
admitido varchar(2)         -- 'si' | 'no'
categoria varchar(10)       -- 'comun' | 'especial' | 'plata' | 'oro' | 'platino'
verificador int NOT NULL    -- FK→empleados (siempre = 1 al crear)
```
**Importante:** `admitido` no es automático. Un admin lo cambia manualmente.

---

#### `duenios`
```sql
identificador (PK FK→personas)
numeroPais int (FK→paises)
verificacionFinanciera varchar(2)   -- 'si' | 'no'
verificacionJudicial varchar(2)     -- 'si' | 'no'
calificacionRiesgo int              -- 1 a 6
verificador int NOT NULL            -- FK→empleados (siempre = 1)
```
Un cliente puede ser dueño al mismo tiempo (mismo `identificador`). El backend lo crea automáticamente si no existe cuando alguien publica un producto.

---

#### `subastadores`
```sql
identificador (PK FK→personas)
matricula varchar(15)
region varchar(50)
```
Al igual que dueños, cualquier cliente puede ser subastador. El backend lo crea idempotentemente (si ya existe, retorna el existente).

---

#### `subastas`
```sql
identificador (PK identity)
fecha date
hora time NOT NULL
estado varchar(10)          -- 'abierta' | 'cerrada' (en Railway: correcto)
subastador int (FK→subastadores)
ubicacion varchar(350)
capacidadAsistentes int
tieneDeposito varchar(2)    -- 'si' | 'no'
seguridadPropia varchar(2)  -- 'si' | 'no'
categoria varchar(10)       -- 'comun' | 'especial' | 'plata' | 'oro' | 'platino'
```
**Importante:** La tabla NO tiene columna `moneda`. Eso se guarda en la tabla propia `subasta_moneda`.

---

#### `productos`
```sql
identificador (PK identity)
fecha date
disponible varchar(2)           -- 'si' | 'no'
descripcionCatalogo varchar(500) DEFAULT 'No Posee'   -- título corto
descripcionCompleta varchar(300) NOT NULL             -- descripción larga
revisor int NOT NULL            -- FK→empleados (siempre = 1)
duenio int NOT NULL             -- FK→duenios
seguro varchar(30)              -- FK→seguros (nullable)
```

---

#### `fotos`
```sql
identificador (PK identity)
producto int NOT NULL (FK→productos)
foto varbinary(max) NOT NULL    -- BLOB de la imagen
```
Puede haber muchas fotos por producto.

---

#### `catalogos`
```sql
identificador (PK identity)
descripcion varchar(250) NOT NULL
subasta int (FK→subastas)
responsable int NOT NULL        -- FK→empleados (siempre = 1)
```
Cada subasta tiene un catálogo. El catálogo tiene muchos `itemsCatalogo`.

---

#### `itemsCatalogo`
```sql
identificador (PK identity)
catalogo int NOT NULL (FK→catalogos)
producto int NOT NULL (FK→productos)
precioBase decimal(18,2) NOT NULL   -- > 0.01
comision decimal(18,2) NOT NULL     -- > 0.01
subastado varchar(2)                -- 'si' | 'no'
```
Un ítem representa un producto dentro de un catálogo, con su precio base y comisión.

---

#### `asistentes`
```sql
identificador (PK identity)
numeroPostor int NOT NULL       -- número único dentro de la subasta
cliente int NOT NULL (FK→clientes)
subasta int NOT NULL (FK→subastas)
```
Cuando un usuario entra a una subasta en vivo, se lo inscribe automáticamente como asistente.

---

#### `pujos`
```sql
identificador (PK identity)
asistente int NOT NULL (FK→asistentes)
item int NOT NULL (FK→itemsCatalogo)
importe decimal(18,2) NOT NULL  -- > 0.01
ganador varchar(2) DEFAULT 'no' -- 'si' | 'no'
```
Cada oferta del usuario. Solo una puja tiene `ganador = 'si'` por ítem (la que adjudica el subastador).

---

#### `registroDeSubasta`
```sql
identificador (PK identity)
subasta int NOT NULL (FK→subastas)
duenio int NOT NULL (FK→duenios)
producto int NOT NULL (FK→productos)
cliente int NOT NULL (FK→clientes)
importe decimal(18,2) NOT NULL  -- > 0.01
comision decimal(18,2) NOT NULL -- > 0.01
```
Se crea automáticamente al adjudicar un ítem. Representa la venta concretada.

---

### 2.2 Tablas propias del equipo (pueden modificarse)

#### `credenciales`
```sql
cliente (PK FK→clientes)
email varchar UNIQUE NOT NULL
passwordHash varchar NOT NULL   -- SHA-256 o similar
```
Separada de `personas/clientes` para no tocar el esquema original.

---

#### `subasta_moneda`
```sql
subasta (PK FK→subastas)
moneda varchar                  -- 'pesos' | 'dolares'
```
Extiende `subastas` con el campo moneda que el esquema original no tiene.

---

#### `pujo_fecha`
```sql
pujo (PK FK→pujos)
fechaHora timestamp
```
Guarda cuándo se hizo cada puja (el esquema original no tiene timestamp en `pujos`).

---

#### `reembolsos`
```sql
registro (PK FK→registroDeSubasta)
reembolsada varchar(2)          -- 'si' | 'no'
```

---

#### `medios_pago`
```sql
identificador (PK identity)
cliente int (FK→clientes)
tipo varchar                    -- 'tarjeta' | 'credito' | 'debito'
numeroTarjeta varchar
vencimiento varchar             -- formato MM/AA o YYYY-MM
titular varchar
numeroCuenta varchar
banco varchar
numeroCheque varchar
montoCheque decimal
verificado varchar(2)           -- 'si' | 'no'
```

---

#### `notificaciones`
```sql
identificador (PK identity)
cliente int (FK→clientes)
tipo varchar                    -- 'ganaste' | 'lider' | 'perdiste' | 'subasta_creada' | etc.
mensaje varchar
leida varchar(2) / boolean      -- 'si' | 'no' o true/false
fechaHora timestamp
```

---

#### `multas`
```sql
identificador (PK identity)
cliente int (FK→clientes)
pujo int (FK→pujos)
importe decimal
pagada varchar(2)               -- 'si' | 'no'
fechaGenerada timestamp
```

---

### 2.3 Diagrama de relaciones simplificado

```
personas
  ├── clientes ──── credenciales
  │       ├── asistentes ──── pujos ──── pujo_fecha
  │       ├── medios_pago
  │       ├── notificaciones
  │       └── multas
  │
  ├── empleados
  │
  ├── duenios ──── productos ──── fotos
  │                    │
  │              itemsCatalogo ──── catalogos ──── subastas ──── subasta_moneda
  │                    │                               │
  │                  pujos                       asistentes
  │                    │
  │             registroDeSubasta ──── reembolsos
  │
  └── subastadores ──── subastas
```

---

## 3. Backend — Spring Boot

**Ubicación del código:** `bidly-backend/src/main/java/com/bidly/bidly_backend/`

```
bidly_backend/
  ├── BidlyBackendApplication.java    ← entry point
  ├── config/
  │   ├── CorsConfig.java             ← permite todos los orígenes
  │   └── SecurityConfig.java         ← desactiva CSRF, permite todo
  ├── controller/                     ← 14 controllers (API REST)
  ├── model/                          ← 21 entidades JPA
  ├── repository/                     ← 22 repositorios JPA
  └── service/
      └── EmailService.java           ← Brevo API
```

---

### 3.1 Configuración y arranque

#### `BidlyBackendApplication.java`
- Entry point con `@SpringBootApplication`
- En el arranque fuerza `TimeZone.setDefault(TimeZone.getTimeZone("UTC"))` para consistencia de timestamps
- Ejecuta SQL de inicialización (quitar constraints problemáticas, crear tablas propias si no existen)

#### `application.properties` — valores clave
```properties
server.port=${PORT:8083}
spring.datasource.url=jdbc:postgresql://trolley.proxy.rlwy.net:53193/railway
spring.jpa.hibernate.ddl-auto=none        # Hibernate no toca el DDL (NUNCA)
spring.hikari.maximum-pool-size=5         # Pool pequeño para Railway free tier
```

#### `SecurityConfig.java`
```java
// Desactiva CSRF totalmente
// Permite TODAS las rutas sin autenticación
// La auth se maneja manualmente en AuthController
http.csrf().disable().authorizeHttpRequests().anyRequest().permitAll();
```

#### `CorsConfig.java`
```java
// Permite todos los orígenes para /api/**
// Permite todos los métodos y headers
// Esto es necesario para que el front en Expo pueda hacer requests
```

---

### 3.2 Modelos (entidades JPA)

Todos los modelos usan Lombok: `@Getter @Setter @NoArgsConstructor @AllArgsConstructor`

#### Patrón de herencia (tabla única, no herencia JPA)
```
Persona    →  @Entity @Table(name="personas")
Cliente    →  @Entity @Table(name="clientes")
              identificador es FK a personas (mismo valor)
              Se crean en dos pasos: primero Persona, luego Cliente
```

#### Campos `@Transient` — datos que NO están en la tabla pero viajan en el JSON

| Modelo | Campo @Transient | De dónde se lee |
|--------|-----------------|-----------------|
| `Subasta` | `moneda` | Tabla `subasta_moneda` |
| `Puja` | `fechaHora` | Tabla `pujo_fecha` |
| `RegistroDeSubasta` | `reembolsada` | Tabla `reembolsos` |
| `Cliente` | `email`, `passwordHash` | Tabla `credenciales` |

**¿Por qué @Transient?** Porque esos campos no están en las tablas originales del profesor. Se guardan en tablas propias, pero se inyectan en el objeto al serializar para que el frontend los reciba sin tener que hacer requests extra.

#### Modelo `Producto`
```java
// revisor y duenio son Long (IDs), NO @ManyToOne
// Esto evita que Hibernate intente cargar empleados/duenios en cada query
private Long revisor;   // siempre = 1L (EMPLEADO_SISTEMA)
private Long duenio;    // ID del cliente/dueño
// Fotos: OneToMany lazy (solo se cargan cuando se piden explícitamente)
@OneToMany(mappedBy="producto", fetch=FetchType.LAZY)
@JsonIgnore
private List<Foto> fotos;
```

---

### 3.3 Repositorios

Todos extienden `JpaRepository<T, ID>`. Los métodos con nombre especial usan **query derivada** de Spring Data.

#### Métodos más importantes

```java
// PujaRepository — consultas para el sistema de pujas
findTopByItemIdentificadorOrderByImporteDesc(Long itemId)
// → Retorna la puja más alta de un ítem (para saber el precio actual)

findByItemIdentificadorOrderByImporteDesc(Long itemId)
// → Historial completo de pujas de un ítem, ordenado de mayor a menor

findByItemIdentificadorAndGanador(Long itemId, String ganador)
// → Busca la puja ganadora ('si') de un ítem

findByAsistenteIdentificadorOrderByImporteDesc(Long asistenteId)
// → Pujas de un asistente específico

// AsistenteRepository
findByClienteIdentificadorAndSubastaIdentificador(Long clienteId, Long subastaId)
// → Para el find-or-create: chequeamos si ya está inscripto

findBySubastaIdentificador(Long subastaId)
// → Todos los asistentes de una subasta (para el contador en vivo)

// SubastaRepository — con filtros opcionales
findByFiltros(@Param("estado") String estado, @Param("categoria") String cat, @Param("moneda") String mon)
// → JPQL con JOIN a subasta_moneda, WHERE condicional según qué params vienen

// CredencialRepository
findByEmail(String email)
// → Para el login
```

---

### 3.4 Controladores (API REST)

**Constante global:**
```java
static final Long EMPLEADO_SISTEMA = 1L;
// Se usa en todos los lugares donde una FK NOT NULL a empleados requiere un valor
```

---

#### `AuthController` — `/api/auth`

**POST `/send-verification`**
```
Body: { email: string }
Acción:
  1. Genera código de 6 dígitos aleatorio
  2. Lo guarda en ConcurrentHashMap pendingCodes con TTL 10 minutos
  3. Llama a EmailService.sendVerificationCode(email, code)
Retorna: 200 OK
```

**POST `/verify-code`**
```
Body: { email: string, code: string }
Acción:
  1. Busca el código en pendingCodes
  2. Si coincide → genera verifiedToken (UUID) y lo guarda en verifiedTokens
  3. Elimina el código de pendingCodes
Retorna: { verifiedToken: string }
```

**POST `/register`**
```
Body: { nombre, apellido, dni, direccion, email, password, verifiedToken }
Acción:
  1. Valida verifiedToken en verifiedTokens
  2. Crea Persona (nombre completo = nombre + " " + apellido)
  3. Crea Cliente (verificador=1, admitido='no', categoria='comun')
  4. Crea Credencial (email, passwordHash)
Retorna: { clienteId, email, nombre }
```

**POST `/login`**
```
Body: { email: string, password: string }
Acción:
  1. Busca Credencial por email
  2. Compara passwordHash
  3. Si válido → genera token UUID → guarda en tokenStore
Retorna: { token, clienteId, email, nombre, categoria, admitido }
```

**GET `/me`**
```
Header: Authorization: Bearer <token>
Acción: Busca token en tokenStore → retorna datos del usuario
Retorna: { clienteId, email, nombre, categoria, admitido }
```

**⚠️ Trampas del auth:**
- `tokenStore`, `pendingCodes`, `verifiedTokens` son ConcurrentHashMap **en memoria**
- Si Railway reinicia el backend → TODOS los tokens se invalidan
- El front maneja esto: al arrancar llama a `/me`, si falla 401 → logout automático

---

#### `SubastaController` — `/api/subastas`

**GET `/`** — Listar subastas
```
Query params opcionales: ?estado=abierta&categoria=comun&moneda=pesos
Acción: JPQL con JOIN a subasta_moneda y WHERE condicional
Retorna: [Subasta] (con campo moneda inyectado desde subasta_moneda)
```

**GET `/{id}`** — Detalle de subasta
```
Retorna: Subasta con moneda + campos calculados del fastapi si está disponible:
  - estadoSubasta: 'esperando' | 'iniciada' | 'finalizada'
  - fase: 'programada' | 'en_curso' | 'cerrada'
  - segundosRestantes: número (para el countdown)
  - totalItems, itemsPendientes, precioBase, totalAsistentes
```

**POST `/`** — Crear subasta
```
Body: { fecha, hora, estado, subastador (id), ubicacion, categoria, moneda }
Acción:
  1. Crea la Subasta (sin moneda, está en otra tabla)
  2. Crea SubastaMoneda { subastaId, moneda }
Retorna: Subasta con moneda inyectada
```

**GET `/{id}/catalogos`** — Items con productos
```
Retorna: [ItemCatalogo] con producto anidado (descripcion, fotos, etc.)
```

**GET `/{id}/portada`** — Imagen JPEG de portada
```
Retorna: bytes JPEG (Content-Type: image/jpeg)
Origen: primer foto BLOB del primer producto del catálogo
```

**PATCH `/{id}/estado`** — Cambiar estado
```
Body: { estado: "abierta" | "cerrada" }
Acción: UPDATE en tabla subastas
```

---

#### `ProductoController` — `/api/productos`

**POST `/`** — Crear producto
```
Body: { descripcionCatalogo, descripcionCompleta, disponible, duenio (clienteId) }
Acción:
  1. revisor = EMPLEADO_SISTEMA (1L) — siempre
  2. Busca si el cliente ya existe en tabla 'duenios'
     Si NO existe → crea Duenio con verificador=1, valores por defecto
  3. Crea el Producto
Retorna: Producto creado
```

**POST `/{id}/fotos`** — Subir fotos
```
Content-Type: multipart/form-data
Campo: 'fotos' (puede ser múltiple)
Acción: Lee los bytes de cada archivo → guarda como BLOB en tabla fotos
```

**GET `/{id}/portada`** — Primera foto como JPEG
```
Retorna: bytes JPEG del primer BLOB en fotos del producto
```

**GET `/{id}/fotos`** — Lista de IDs
```
Retorna: [Long] — lista de IDs de fotos
(El front construye las URLs: /api/fotos/{id} para cada una)
```

---

#### `ItemCatalogoController`

**POST `/catalogos/{catalogoId}/items`** — Agregar ítem
```
Body: { producto (id), precioBase, comision }
```

**PATCH `/items/{id}/adjudicar`** — OPERACIÓN ATÓMICA
```
Acción (todo en una transacción):
  1. Busca la puja más alta del ítem (findTopByItemIdentificadorOrderByImporteDesc)
  2. Marca esa puja como ganador='si'
  3. Marca el ítem como subastado='si'
  4. Crea RegistroDeSubasta { subasta, duenio, producto, cliente, importe, comision }
  5. Crea Reembolso { registro, reembolsada='no' } (registro de reembolso vacío)
Retorna: { ganadorClienteId, importeFinal, comision, itemId }
Si no hay pujas → 400 Bad Request
```

---

#### `PujaController` — `/api/pujos`

**POST `/`** — Crear puja
```
Body: { asistente: { identificador }, item: { identificador }, importe }
Validaciones:
  - Busca última puja del ítem
  - Si no hay pujas: importe >= precioBase del ítem
  - Si hay pujas: importe >= ultimaPuja + (precioBase * 0.01)
  - Si supera el tope según categoría: rechaza
Acción: Crea Puja + crea PujoFecha con timestamp actual
```

**GET `/?item={id}`** — Historial del ítem
```
Retorna: [Puja] ordenadas por importe DESC, cada una con fechaHora inyectada
```

**GET `/{itemId}/ganador`** — Puja ganadora
```
Retorna: Puja con ganador='si' para ese ítem
```

---

#### `AsistenteController` — `/api/asistentes`

**POST `/inscribir`** — Find-or-create
```
Body: { clienteId, subastaId }
Acción:
  Si ya existe asistente (cliente+subasta) → retorna el existente (idempotente)
  Si no → crea con numeroPostor = max(existentes)+1
Retorna: Asistente con identificador
```

---

#### `SubastadorController` — `/api/subastadores`

**POST `/`** — Idempotente
```
Body: { identificador, matricula?, region? }
Si ya existe → retorna el existente sin error
Si no → crea nuevo Subastador (el identificador debe existir como Persona)
```

---

#### `RegistroController` — `/api/registro-subasta`

**GET `/cliente/{id}`** — Historial de compras
```
Retorna: [RegistroDeSubasta] del cliente con reembolsada inyectada
Incluye subasta anidada (con moneda)
```

**PATCH `/{id}/reembolso`** — Marcar reembolso
```
Body: { reembolsada: 'si' | 'no' }
Actualiza tabla reembolsos
```

---

#### `NotificacionController` — `/api/notificaciones`

**GET `/cliente/{clienteId}`**
```
Retorna: [Notificacion] del cliente, ordenadas por fechaHora DESC
Tipos: 'ganaste' | 'lider' | 'perdiste' | 'subasta_creada' | 'subasta_por_cerrar'
```

---

### 3.5 Servicio de email

#### `EmailService.java`
```java
// Usa Brevo API REST (NO JavaMail/SMTP)
// Endpoint: https://api.brevo.com/v3/smtp/email
// Headers: api-key: {BREVO_API_KEY}
// Body JSON: { sender, to, subject, htmlContent }

sendVerificationCode(String toEmail, String code)
// Envía email con código formateado en HTML
// El código tiene TTL de 10 minutos (se maneja en AuthController)
```

---

## 4. Frontend — React Native

**Ubicación del código:** `bidly-front/src/`

```
src/
  api/
    client.js         ← cliente HTTP base
    endpoints.js      ← todos los módulos de funciones de API
  components/
    ui.js             ← librería completa de componentes
  context/
    AuthContext.js    ← estado global de autenticación
  hooks/
    useNotifBadge.js  ← badge de notificaciones no leídas
  navigation/
    RootNavigator.js  ← árbol principal
    TabNavigator.js   ← barra inferior
  screens/
    AuthScreens.js    ← login, registro, verificación
    HomeScreens.js    ← home, filtros, notificaciones
    AuctionScreens.js ← producto, subasta en vivo, admin
    AccountScreens.js ← perfil, subastas, publicar, crear
    PaymentScreens.js ← pago, seguro, multa, reembolso
    AdminScreens.js   ← dashboard admin (placeholder)
  theme/
    theme.js          ← paleta de colores y estilos
  utils/
    subasta.js        ← helpers para datos de subasta
    tiempo.js         ← helpers para fechas y countdown
```

---

### 4.1 Cliente HTTP y endpoints

#### `api/client.js` — Cliente HTTP base

```javascript
// Constante base
const BASE_URL = 'https://backend-bidly.up.railway.app/api';

// Función principal — usada por todas las llamadas
async function request(path, options = {}) {
  const token = await AsyncStorage.getItem('@bidly_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  const response = await fetch(BASE_URL + path, { ...options, headers });
  if (!response.ok) throw await response.json(); // lanza el error del backend
  return response.json();
}

// Exports: api.get(path), api.post(path, body), api.put, api.patch, api.del
// También: upload(path, formData), setToken(token), getToken(), BASE_URL
```

**¿Cómo se maneja el token?**
```javascript
// Al hacer login:
await AsyncStorage.setItem('@bidly_token', token);
setToken(token); // también lo guarda en memoria para requests inmediatos

// En cada request:
// client.js lee @bidly_token de AsyncStorage y lo pone en el header
```

---

#### `api/endpoints.js` — Módulos de funciones

Cada módulo agrupa las llamadas de un dominio:

```javascript
// AUTH
Auth.login(email, password)         // POST /auth/login
Auth.register(payload)              // POST /auth/register
Auth.me()                           // GET /auth/me
Auth.logout()                       // limpia AsyncStorage local
Auth.sendVerification(email)        // POST /auth/send-verification
Auth.verifyCode(email, code)        // POST /auth/verify-code

// SUBASTAS
Subastas.listar(params)             // GET /subastas?estado=...
Subastas.obtener(id)                // GET /subastas/{id}
Subastas.catalogo(id)               // GET /subastas/{id}/catalogo
Subastas.catalogos(id)              // GET /subastas/{id}/catalogos
Subastas.estado(id)                 // GET /subastas/{id}/estado
Subastas.actualizarEstado(id, est)  // PATCH /subastas/{id}/estado
Subastas.crear(payload)             // POST /subastas
Subastas.porSubastador(subId)       // GET /subastadores/{id}/subastas
Subastas.asistentes(id)             // GET /subastas/{id}/asistentes
Subastas.sesion(id)                 // GET /subastas/{id}/sesion (fastapi)

// PUJAS
Pujas.porItem(itemId)               // GET /pujos?item={id}
Pujas.porAsistente(asisId)          // GET /pujos?asistente={id}
Pujas.pujar(asisId, itemId, imp)    // POST /pujos
Pujas.ganador(itemId)               // GET /pujos/{itemId}/ganador

// ASISTENTES
Asistentes.obtener(id)              // GET /asistentes/{id}
Asistentes.pujas(id)                // GET /asistentes/{id}/pujos
Asistentes.inscribir(clienteId, subastaId)  // POST /asistentes/inscribir

// CLIENTES
Clientes.obtener(id)                // GET /clientes/{id}
Clientes.mediosPago(id)             // GET /clientes/{id}/medios-pago
Clientes.agregarMedioPago(id, mp)   // POST /clientes/{id}/medios-pago

// PRODUCTOS
Productos.obtener(id)               // GET /productos/{id}
Productos.crear(payload)            // POST /productos
Productos.disponible(id, disp)      // PATCH /productos/{id}/disponible
Productos.fotos(id)                 // GET /productos/{id}/fotos
Productos.agregarFotos(id, formData)// POST /productos/{id}/fotos
Productos.porDuenio(clienteId)      // GET /productos?duenio={id}
Productos.eliminar(id)              // DELETE /productos/{id}

// CATALOGOS
Catalogos.items(catalogoId)         // GET /catalogos/{id}/items
Catalogos.crear(payload)            // POST /catalogos
Catalogos.agregarItem(catalogoId, p)// POST /catalogos/{id}/items

// ITEMS
Items.obtener(id)                   // GET /items/{id}
Items.adjudicar(id)                 // PATCH /items/{id}/adjudicar

// REGISTRO
RegistroSubasta.porCliente(id)      // GET /registro-subasta/cliente/{id}
RegistroSubasta.reembolso(id, val)  // PATCH /registro-subasta/{id}/reembolso
RegistroSubasta.pagar(id, mpId)     // PATCH /registro-subasta/{id}/pagar

// NOTIFICACIONES
Notificaciones.porCliente(id)       // GET /notificaciones/cliente/{id}
Notificaciones.marcarLeida(id)      // PATCH /notificaciones/{id}/leida

// MULTAS
Multas.obtener(id)                  // GET /multas/{id}
Multas.pagar(id)                    // PATCH /multas/{id}

// SUBASTADORES
Subastadores.obtener(id)            // GET /subastadores/{id}
Subastadores.crear(payload)         // POST /subastadores (idempotente)
```

---

### 4.2 AuthContext — estado global

**Archivo:** `context/AuthContext.js`

Es el corazón del estado de autenticación. Usa `React.createContext` + `useContext`.

#### Shape del objeto `user`
```javascript
{
  clienteId: Number,       // identificador en tabla clientes
  email: String,
  nombre: String,
  categoria: 'comun' | 'especial' | 'plata' | 'oro' | 'platino',
  admitido: 'si' | 'no',
  isGuest: Boolean         // true cuando entró como invitado sin cuenta
}
```

#### Flujo de boot (arranque de la app)
```javascript
// 1. booting = true → RootNavigator muestra SplashScreen
// 2. Lee @bidly_token de AsyncStorage
// 3. Si hay token → llama Auth.me() para validarlo
//    ✓ Válido → setUser(data) con los datos del servidor
//    ✗ Inválido (401) → clearStorage(), setUser(null)
// 4. booting = false → RootNavigator decide qué mostrar
```

#### Métodos del contexto
```javascript
login(email, password)
// → llama Auth.login
// → guarda token en AsyncStorage
// → setUser(userData)

register(payload)
// → llama Auth.register

logout()
// → borra @bidly_token y @bidly_user de AsyncStorage
// → setUser(null) → vuelve a pantallas de auth

loginAsGuest()
// → setUser({ isGuest: true })
// → puede ver subastas pero no pujar
```

---

### 4.3 Hook `useNotifBadge`

**Archivo:** `hooks/useNotifBadge.js`

Se usa en la tab bar y en HomeTopBar para mostrar el badge rojo con cantidad de notificaciones no leídas.

```javascript
export function useNotifBadge() {
  // Cada 30 segundos hace polling de /notificaciones/cliente/{id}
  // Detecta cuando llegan nuevas notificaciones (unreadCount aumenta)
  // y vibra el teléfono 200ms para avisar
  
  return {
    unreadCount: Number,  // cantidad de notificaciones sin leer
    notifs: Array,        // lista completa
    refresh: Function,    // refrescar manualmente
  };
}
```

---

### 4.4 Componentes UI reutilizables

**Archivo:** `components/ui.js`

#### Sistema de colores (theme.js)
```javascript
colors = {
  bg: '#0b1022',          // fondo oscuro general
  card: '#161d33',        // card base
  cardEl: '#1b2440',      // card elevada (más oscura)
  input: '#26314c',       // fondo de TextInput
  blue: '#3a8fd6',        // acción principal, botones
  blueLogo: '#3f9ae0',    // color del logo BIDLY
  green: '#37d66f',       // éxito, precio, ganó
  gold: '#e89a3c',        // timer, advertencias, en vivo
  red: '#e23950',         // error, peligro, badge
  muted: '#8a93ab',       // texto secundario
  border: 'rgba(255,255,255,0.08)',
  borderHi: 'rgba(59,130,246,0.45)',  // borde resaltado (azul)
}
```

#### Componentes principales

| Componente | Props clave | Uso |
|-----------|-------------|-----|
| `<Screen>` | `scroll`, `contentStyle` | Contenedor base con SafeArea |
| `<Header>` | `right`, `onBack` | Barra superior con botón atrás + logo |
| `<Display>` | `style` | Texto con fuente ArchivoBlack |
| `<Title>` | — | Título de página, 33px, Display |
| `<Sub>` | — | Subtítulo, texto muted 14.5px |
| `<SectionLabel>` | — | Separador de sección, 14px |
| `<Btn>` | `kind` (primary/danger/ghost), `disabled`, `onPress` | Botón |
| `<Chip>` | `active`, `dot`, `onPress` | Toggle pill (tabs, filtros) |
| `<Card>` | `el`, `style` | Contenedor con borde radius 16 |
| `<Field>` | `multiline`, `keyboardType` | TextInput estilizado |
| `<LiveBadge>` | — | Badge rojo "EN VIVO" con punto |
| `<Tag>` | `label`, `color` | Etiqueta pequeña de estado |
| `<ImgBox>` | `src`, `style`, `onPress` | Imagen con fallback a ícono |
| `<BottomBar>` | — | Barra fija al fondo con safe area |
| `<Row>` | `k`, `v`, `vc`, `bold` | Fila key/value para resúmenes |
| `<ImageLightbox>` | `visible`, `images`, `initialIndex`, `onClose` | Galería full screen |
| `<SuccessBanner>` | `message`, `onDismiss` | Banner verde temporal |

---

### 4.5 Navegación (árbol de pantallas)

#### `RootNavigator.js` — árbol completo
```
Stack Navigator (RootNavigator)
│
├── Splash          (booting = true)
│
├── Grupo auth (user = null)
│   ├── Login
│   ├── Registro
│   ├── VerificarEmail
│   └── CrearPassword
│
└── Grupo principal (user != null)
    ├── Main (TabNavigator)
    │
    ├── Filtros        (modal, acceso desde Home)
    ├── Notificaciones
    ├── Favoritos
    ├── Producto       (detalle de subasta)
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
    ├── CompraDetalle
    ├── Historial
    ├── Publicar
    ├── MisProductos
    ├── DatosGanador
    ├── DatosPersonales
    ├── CrearSubasta
    ├── SubastaAdmin
    └── DashboardAdmin  (solo si isAdmin = true)
```

#### `TabNavigator.js` — barra inferior
```
Tab 1: Home (icono home)           → HomeScreen
Tab 2: Historial (icono time)      → HistorialScreen  [bloqueado para invitados]
Tab 3: + FAB central (icono add)   → PublicarScreen   [bloqueado para invitados]
Tab 4: Subastas (icono hammer)     → MisSubastasScreen [bloqueado para invitados]
Tab 5: Perfil (icono person)       → PerfilScreen     [bloqueado para invitados]
```

Si el usuario es invitado y toca un tab bloqueado → `GuestBlockScreen` con botón para ir a login.

---

### 4.6 Pantallas — detalle de cada una

---

#### `SplashScreen`
- Solo muestra el logo BIDLY y un spinner
- Se muestra mientras `booting = true` en AuthContext
- No tiene interacción, desaparece sola cuando termina el boot

---

#### `LoginScreen`
- Campos: email + password
- Botón "Ingresar como invitado" → `loginAsGuest()`
- Link "Registrarse" → navega a RegistroScreen
- Al hacer login exitoso → AuthContext actualiza → RootNavigator cambia a Main automáticamente

---

#### `RegistroScreen`
- Campos: nombre, apellido, domicilio, DNI, email
- Al submit → llama `Auth.sendVerification(email)` → navega a VerificarEmailScreen pasando todos los datos como params

---

#### `VerificarEmailScreen`
- 6 inputs de un dígito cada uno (o un input con validación)
- Botón "Reenviar código" → llama `Auth.sendVerification` de nuevo
- Al completar → llama `Auth.verifyCode(email, code)` → recibe `verifiedToken`
- Navega a CrearPasswordScreen con todos los datos + verifiedToken

---

#### `CrearPasswordScreen`
- Campos: password, confirmar password, checkbox TyC
- Al submit → llama `Auth.register({ ...todosLosDatos, verifiedToken })`
- Si éxito → navega a Login (no loguea automáticamente, debe hacer login manual)

---

#### `HomeScreen`
- Tabs: Todas / En vivo / Próximamente / Terminadas
- Barra superior con badge de notificaciones (useNotifBadge)
- Buscador de UI (no funcional, aviso "próximamente")
- Botón filtro → navega a FiltrosScreen (modal)
- Polling de detalle en tab "En vivo": cada 10 segundos actualiza campos de tiempo/fase
- Polling de countdown en tab "Próximamente": cada 30 segundos
- Al volver de FiltrosScreen: lee params de navegación para aplicar filtros

**Componente `AuctionCard`:**
```
┌──────────────────────────────────────┐
│ [EN VIVO] (si está abierta)          │
│ [foto 74x74]  Título             │
│               categoría          │
│               PUJA $X.XXX    N 👤 │
│         ⏱ 02:34              [Ver] │
└──────────────────────────────────────┘
```

**Componente `ProximaCard`:** (tab Próximamente)
- Muestra fecha/hora en lugar de precio de puja
- Botón "Ver detalles" en lugar de "Ver subasta"

---

#### `FiltrosScreen`
- Modal (presentation: modal)
- Chips para: Estado (En vivo / Todas / Finalizadas), Categoría, Moneda
- "Aplicar" → navega de vuelta a Home con params `filtrosAplicados`
- "Limpiar" → resetea a valores default y vuelve a Home

---

#### `NotificacionesScreen`
- Lista de notificaciones del usuario
- Cada notificación muestra ícono según tipo, título, mensaje, fecha
- Tipos y sus íconos:
  - `ganaste` → trophy-outline
  - `lider` → trending-up-outline
  - `perdiste` → arrow-down-outline
  - `subasta_creada` → add-circle-outline
  - otros → notifications-outline
- Al tocar una notificación → la marca como leída (PATCH)
- Si tipo = 'ganaste' → navega a la tab Subastas en modo "ganadas"

---

#### `ProductoScreen`
- Params: `subastaId` (obligatorio) o `subasta` (preview opcional)
- Carga en paralelo: detalle de subasta + catálogo de ítems + sesión (fastapi)
- Muestra galería de fotos con lightbox (toca para abrir full screen)
- Determina el ítem activo:
  1. Si la sesión del fastapi indica `itemActivoId` → usa ese
  2. Si no → primer ítem no adjudicado (`subastado !== 'si'`)
- Muestra lista de todos los ítems del catálogo
- Botón "Ir a la subasta en vivo" solo aparece si `estado = 'abierta'`

---

#### `SubastaEnVivoScreen`
La pantalla más compleja del frontend.

**Params recibidos:** `subastaId, itemId, productoId, precioBase, titulo, moneda, comision, fecha, hora, categoriaSubasta`

**Estados locales:**
```javascript
pujas          // historial de pujas del ítem, se actualiza cada 1 segundo
asistenteId    // ID del asistente (se obtiene al inscribirse)
loadingPujas   // spinner inicial
pujando        // mientras se procesa la puja
pollingError   // si hay error de red
timeLeft       // segundos restantes (countdown local)
montoIngresado // lo que el usuario escribió/ajustó
```

**Refs (para evitar problemas de stale closure):**
```javascript
mounted        // false si el componente se desmontó → no hacer setState
asistenteIdRef // copia del asistenteId para usarlo en callbacks
navegado       // true si ya navegó (evita doble navegación)
baselineRef    // { fetchedAt, segundos } — punto de referencia para el countdown
ultimaPujaTopRef // fingerprint de la última puja líder (evita resetear el input en cada poll)
```

**Flujo de inscripción:**
```javascript
// Al montar → intenta inscribir al usuario como asistente
Asistentes.inscribir(user.clienteId, subastaId)
  .then(a => setAsistenteId(a.identificador))
// Es idempotente: si ya estaba inscripto, retorna el existente
```

**Flujo de countdown:**
```javascript
// Cada 10 segundos: sincroniza con el servidor (Subastas.sesion o Subastas.obtener)
// Guarda { fetchedAt: Date.now(), segundos: N } en baselineRef
// Cada 1 segundo: calcula timeLeft = segundos - (Date.now() - fetchedAt) / 1000
// → countdown preciso sin depender de un intervalo exacto
```

**Flujo de detección de ganador:**
```javascript
// En cada poll (cada 1 segundo):
const ganadora = lista.find(p => p.ganador === 'si');
if (ganadora && !navegado.current) {
  // Espera a que asistenteId esté disponible (puede tardar si es nueva inscripción)
  if (asistenteIdRef.current == null) return; // todavía no sabemos quién somos
  
  navegado.current = true; // evita doble navegación
  const yoGane = ganadora.asistente?.identificador === asistenteIdRef.current;
  
  if (yoGane) {
    // Busca el registroId para pasarlo a la pantalla de pago
    buscarRegistroId(clienteId, subastaId, productoId).then(registroId => {
      navigation.replace('Ganaste', { titulo, moneda, importe, registroId, ... });
    });
  } else {
    navigation.replace('SubastaFinalizada', { titulo, moneda, importe, totalPostores, ... });
  }
}
```

**Lógica de importes:**
```javascript
// Incremento mínimo = 1% del precio base (redondeado a 2 decimales)
const minIncremento = Math.ceil(precioBase * 0.01 * 100) / 100;

// Próxima puja mínima
const proximaPuja = pujaActual != null
  ? pujaActual + minIncremento
  : precioBase;

// Tope máximo (según categoría)
// Categorías sin límite: 'oro' y 'platino'
const maxPuja = CATS_SIN_LIMITE.has(categoriaSubasta)
  ? null                                    // sin tope
  : pujaActual != null
    ? pujaActual + precioBase * 0.20        // hasta 20% más que la actual
    : precioBase * 1.20;                    // hasta 20% más que el base
```

**Input de monto:**
- Botones − / + para ajustar en incrementos de `minIncremento`
- Se sincroniza automáticamente cuando cambia la puja líder (solo si el monto actual ya no es válido)
- Muestra rojo si el monto es inválido (menor que mínimo o mayor que tope)

---

#### `SubastaAdminScreen`
Panel del subastador para gestionar su subasta.

**Funcionalidades:**
- Carga subasta + catálogo + asistentes (1 sola llamada al montar)
- Polling de pujas del ítem activo: cada 1 segundo
- Permite cambiar el ítem activo tocando en la lista
- Botón "Adjudicar ítem" → `Items.adjudicar(itemActivo.id)` → operación atómica en el servidor
- Muestra puja más alta en tiempo real + historial
- Lista de ítems: el activo resaltado en azul, los adjudicados con ✓ verde

**⚠️ Nota:** El subastador NO abre/cierra la subasta desde esta pantalla. Eso lo hace un administrador del sistema. Esta pantalla es solo para adjudicar ítems.

---

#### `GanasteScreen`
- Muestra pantalla de victoria con el monto ganado + comisión
- Calcula `total = importe + comision`
- Botón "Continuar al pago" → navega a MedioPagoScreen con todos los parámetros de pago

---

#### `SubastaFinalizadaScreen`
- Muestra que otro ganó
- Muestra el importe final y cantidad de postores
- Solo tiene botón "Volver al Home"

---

#### `MisSubastasScreen`
Tabs: En curso / Finalizadas / Ganadas / Todas

- **En curso:** subastas donde el usuario es subastador y están activas
- **Finalizadas:** subastas cerradas
- **Ganadas:** registros de compra del usuario (cuando ganó como postor)
- Recarga en `focus` (navigation listener)
- Toast de éxito cuando se acaba de crear una subasta (param `creada` en route)

---

#### `CrearSubastaScreen`
Proceso en 2 pasos:

**Paso 1 — Información básica:**
- CalendarPicker: selector de fecha custom (sin deps externas), modal con grilla de días
  - Deshabilita fechas pasadas
  - Semanas empiezan el lunes
- TimeSelector: dos botones HH:MM
  - Modal hora: grilla 0-23
  - Modal minutos: 4 opciones (00, 15, 30, 45)
  - Al elegir hora, auto-abre modal de minutos si no tiene minutos
- Chips de categoría y moneda

**Paso 2 — Productos:**
- Lista de productos seleccionados con precio base editable
- Preview de comisión Bidly (10%) y ganancia neta en tiempo real
- Botón "Elegir de mis productos" → navega a MisProductosScreen en `modoSeleccion: true`
- El producto seleccionado regresa por `route.params.productoSeleccionado`

**Al crear:**
```javascript
// 1. Crear/obtener subastador (idempotente)
await Subastadores.crear({ identificador: user.clienteId });

// 2. Crear subasta (estado: 'cerrada' — admin la aprueba)
const subasta = await Subastas.crear({ fecha, hora, estado: 'cerrada', ... });

// 3. Crear catálogo para esa subasta
const catalogo = await Catalogos.crear({ descripcion, subasta: subasta.id, responsable: user.clienteId });

// 4. Agregar ítems al catálogo (en paralelo)
await Promise.all(items.map(it => Catalogos.agregarItem(catalogo.id, { producto: it.id, precioBase })));

// 5. Animación de éxito → redirige a MisSubastasScreen con toast
```

---

#### `PublicarScreen`
- Selector de fotos (máx 6, usa expo-image-picker)
- Campos: título, categoría, estado (nuevo/usado), precio, descripción
- **Al publicar:**
  ```javascript
  // 1. Crea el Producto en el backend
  const producto = await Productos.crear({ ... });
  
  // 2. Sube fotos una a una usando XMLHttpRequest (no fetch)
  // ¿Por qué XHR y no fetch? Porque en React Native,
  // fetch no soporta bien multipart/form-data con archivos binarios
  for (const foto of fotos) {
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${BASE_URL}/productos/${id}/fotos`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      const fd = new FormData();
      fd.append('fotos', { uri: foto.uri, name: 'foto.jpg', type: 'image/jpeg' });
      xhr.send(fd);
    });
  }
  
  // 3. Alert con opción de crear subasta con este producto
  ```

---

#### `MisProductosScreen`
- Modo normal: lista de productos del usuario con opción de eliminar
- Modo selección (`modoSeleccion: true`): toque en un producto lo agrega a CrearSubastaScreen
- La navegación de regreso usa `navigation.navigate('CrearSubasta', { productoSeleccionado: p })`

---

#### `PerfilScreen`
- Muestra avatar, nombre, email, badge de categoría con color
- Lista de opciones: Mis Productos, Datos Personales, Medios de Pago, Mis Compras, Historial, Notificaciones
- Si `isAdmin = true` → muestra "Administración" con tag ADMIN
- Botón "Cerrar sesión"

---

#### `MedioPagoScreen`
- Se usa en dos contextos:
  - **Flujo de pago** (`esFlujoPago = true`): viene de GanasteScreen, hay datos de subasta/importe
  - **Administrar tarjetas** (`esFlujoPago = false`): acceso desde Perfil
- Lista medios de pago del usuario con radio button
- Formulario inline para agregar nueva tarjeta
  - Validación de número (13-19 dígitos), vencimiento (mes 01-12), titular
  - Formato automático: `XXXX XXXX XXXX XXXX` y `MM/AA`
  - Muestra últimos 4 dígitos enmascarados
- Si flujo de pago → "Continuar" navega a SeguroScreen

---

#### `SeguroScreen`
- Toggle Switch para activar/desactivar seguro
- Si activo: input de valor a asegurar
- Prima = 2.5% del valor declarado
- "Omitir" → navega a ConfirmarPago sin seguro
- "Contratar" → genera nroPoliza temporal (`POL-${Date.now()}`) → navega a ConfirmarPago con importeSeguro

---

#### `ConfirmarPagoScreen`
- Resumen: importe ganado + comisión + seguro (si aplica) = total
- Muestra el medio de pago seleccionado
- Al confirmar:
  ```javascript
  // 1. Busca el registroId si no lo tiene (fallback)
  const registros = await RegistroSubasta.porCliente(clienteId);
  registroId = registros.find(r => r.subasta.id === subastaId && r.producto === productoId)?.id;
  
  // 2. Marca el pago en el backend (soft-commit)
  await RegistroSubasta.pagar(registroId, medioPagoId);
  
  // 3. Navega a PagoConfirmado
  ```

---

#### `ReembolsoScreen`
- Radio buttons con 3 motivos (el elegido no se envía al backend, es solo UX)
- Al confirmar → `RegistroSubasta.reembolso(registroId, 'si')`
- Si ya está reembolsado → botón deshabilitado
- Aviso: 5-10 días hábiles

---

#### `MultaScreen`
- Carga la multa por ID
- Muestra ítem, importe y fecha de generación
- Botón "Pagar multa" → `Multas.pagar(multaId)` → navega a PagoConfirmado

---

## 5. Flujos completos de punta a punta

### 5.1 Registro de usuario nuevo
```
LoginScreen
  → tap "Registrarse"
RegistroScreen (nombre, apellido, DNI, domicilio, email)
  → Auth.sendVerification(email)
  → email con código de 6 dígitos llega por Brevo
VerificarEmailScreen (ingresar código)
  → Auth.verifyCode(email, code)
  → recibe verifiedToken
CrearPasswordScreen (password + TyC)
  → Auth.register({ nombre, apellido, dni, direccion, email, password, verifiedToken })
  → Backend: crea Persona + Cliente (verificador=1, admitido='no') + Credencial
LoginScreen (post-registro exitoso)
  → usuario debe hacer login manualmente
```

### 5.2 Flujo postor — ver y pujar en una subasta
```
HomeScreen → tab "En vivo"
  → AuctionCard.onPress → navigate('Producto', { subastaId })

ProductoScreen
  → carga: Subastas.obtener + Subastas.catalogos + Subastas.sesion
  → muestra fotos, precio base, ítems
  → tap "Ir a la subasta en vivo"
  → navigate('SubastaEnVivo', { subastaId, itemId, precioBase, titulo, moneda, comision, ... })

SubastaEnVivoScreen
  → Asistentes.inscribir(clienteId, subastaId) → obtiene asistenteId
  → Polling cada 1s: Pujas.porItem(itemId) → actualiza lista de pujas
  → Polling cada 10s: Subastas.sesion → actualiza countdown
  → Usuario ajusta monto con − / + botones
  → tap "Pujar $ X"
  → Pujas.pujar(asistenteId, itemId, monto)
  → Si el subastador adjudica el ítem:
     - poll detecta ganador='si'
     - Si yoGane → buscarRegistroId → navigate.replace('Ganaste', ...)
     - Si otro ganó → navigate.replace('SubastaFinalizada', ...)

GanasteScreen
  → Muestra importe + comisión + total
  → tap "Continuar al pago" → navigate('MedioPago', { registroId, subastaId, importe, comision, ... })

MedioPagoScreen → SeguroScreen → ConfirmarPagoScreen → PagoConfirmadoScreen
```

### 5.3 Flujo subastador — publicar y gestionar subasta
```
Tab "+" → PublicarScreen
  → Elegir fotos (máx 6)
  → Completar datos del producto
  → tap "Publicar"
  → Productos.crear({ descripcionCatalogo, descripcionCompleta, duenio: clienteId })
  → Subir fotos una a una (XHR multipart)
  → Alert: "¿Crear subasta con este producto?"
  → tap "Crear subasta" → navigate('CrearSubasta', { productoId, titulo })

CrearSubastaScreen — Paso 1
  → CalendarPicker (fecha)
  → TimeSelector (hora)
  → Field (ubicación)
  → Chips (categoría, moneda)
  → tap "Siguiente"

CrearSubastaScreen — Paso 2
  → Producto pre-cargado (viene de PublicarScreen)
  → O tap "Elegir de mis productos" → MisProductosScreen → seleccionar → regresa
  → Ingresar precioBase (se muestra comisión 10% y ganancia neta)
  → tap "Crear subasta"
  → Subastadores.crear({ identificador: clienteId }) — idempotente
  → Subastas.crear({ fecha, hora, estado: 'cerrada', categoria, moneda, ... })
  → Catalogos.crear({ descripcion, subasta: id, responsable: clienteId })
  → Catalogos.agregarItem(catalogoId, { producto: id, precioBase })
  → Animación de éxito
  → Navega a MisSubastasScreen con toast "subasta creada"

[Admin aprueba y abre la subasta — cambia estado a 'abierta']

MisSubastasScreen → tap la subasta → SubastaAdminScreen
  → Carga subasta + catálogo + asistentes
  → Polling de pujas del ítem activo (cada 1s)
  → Ve en tiempo real la puja más alta y el historial
  → tap "Adjudicar ítem"
  → Items.adjudicar(itemActivo.id)
    → Backend: marca puja ganadora, ítem adjudicado, crea RegistroDeSubasta
  → Selecciona siguiente ítem manualmente (tap en la lista)
  → Cuando termina → admin cierra la subasta (Subastas.actualizarEstado(id, 'cerrada'))
```

---

## 6. Patrones de código importantes

### 6.1 `mounted.current` — evitar setState en componentes desmontados
```javascript
// Al inicio del componente
const mounted = useRef(true);
useEffect(() => () => { mounted.current = false; }, []);

// En cualquier callback asíncrono
.then(data => {
  if (!mounted.current) return; // componente ya no existe
  setDatos(data);
})
```
**¿Por qué?** Si el usuario navega hacia atrás mientras hay un request en vuelo, el componente se desmonta. Sin esta guardia, React tira un warning y puede haber bugs de estado.

---

### 6.2 Ref para asistenteId en callbacks de polling
```javascript
const asistenteIdRef = useRef(null);
useEffect(() => { asistenteIdRef.current = asistenteId; }, [asistenteId]);

// En el callback del poll:
const yoGane = asistenteIdRef.current != null &&
  ganadora.asistente?.identificador === asistenteIdRef.current;
```
**¿Por qué ref y no el state directo?** El closure del `setInterval` captura el valor de `asistenteId` del momento en que se creó. Si `asistenteId` cambia después (cuando llega la respuesta de inscribir), el intervalo sigue viendo `null`. La ref siempre tiene el valor actual.

---

### 6.3 Countdown local con baseline del servidor
```javascript
// En lugar de confiar en un setInterval exacto (que puede desviarse):
baselineRef.current = { fetchedAt: Date.now(), segundos: N }; // del servidor

// Cada 1 segundo:
const elapsed = (Date.now() - baselineRef.current.fetchedAt) / 1000;
const timeLeft = Math.max(0, Math.floor(baselineRef.current.segundos - elapsed));
```
**¿Por qué?** Los intervalos de JS no son exactos (el navegador puede throtlear si la tab está en fondo). Este patrón sincroniza con el servidor cada 10s y usa tiempo real del sistema operativo entre sincronizaciones.

---

### 6.4 Polling con cancelación
```javascript
useEffect(() => {
  let cancelled = false;
  
  const poll = async () => {
    const data = await Subastas.listar();
    if (cancelled) return; // resultado llegó después de que el efecto se limpió
    setSubastas(data);
  };
  
  poll();
  const id = setInterval(poll, 10000);
  return () => { cancelled = true; clearInterval(id); };
}, []);
```
El flag `cancelled` evita actualizar state si el componente se desmontó entre el fetch y la respuesta.

---

### 6.5 Navigation listener para recibir params al hacer focus
```javascript
useEffect(() => {
  const unsubscribe = navigation.addListener('focus', () => {
    const params = navigation.getState?.()?.routes?.slice(-1)?.[0]?.params;
    if (params?.filtrosAplicados) {
      setFiltros(params.filtrosAplicados);
    }
  });
  return unsubscribe;
}, [navigation]);
```
Se usa en HomeScreen para recibir filtros desde FiltrosScreen sin necesitar callback.

---

### 6.6 Idempotencia en el backend
```java
// SubastadorController.crear()
Optional<Subastador> existente = subastadorRepository.findById(body.getIdentificador());
if (existente.isPresent()) return ResponseEntity.ok(existente.get()); // ya existe, retorna

// AsistenteController.inscribir()
Optional<Asistente> existente = asistente.findByClienteAndSubasta(clienteId, subastaId);
if (existente.isPresent()) return ResponseEntity.ok(existente.get()); // ya está inscripto
```
El frontend llama estos endpoints sin saber si ya existe el recurso. El backend lo maneja limpiamente.

---

### 6.7 XHR para subida de fotos (no fetch)
```javascript
// PublicarScreen usa XMLHttpRequest porque React Native no soporta bien
// multipart/form-data con fetch en todas las plataformas

const xhr = new XMLHttpRequest();
xhr.open('POST', `${BASE_URL}/productos/${id}/fotos`);
xhr.setRequestHeader('Authorization', `Bearer ${token}`);
const fd = new FormData();
// En mobile: objeto { uri, name, type }
// En web: objeto File real (expo-image-picker.file)
fd.append('fotos', { uri: foto.uri, name: 'foto.jpg', type: 'image/jpeg' });
xhr.send(fd);
```

---

### 6.8 Campos @Transient en el backend
```java
// Subasta.java
@Transient
private String moneda; // no está en la tabla subastas

// SubastaController.obtener(id)
Subasta s = subastaRepo.findById(id).orElseThrow();
SubastaMoneda sm = subMonRepo.findById(id).orElse(null);
if (sm != null) s.setMoneda(sm.getMoneda()); // inyección manual
return s; // el JSON incluye "moneda" gracias al @Transient
```

---

## 7. Gotchas y trampas conocidas

### 7.1 Tokens en memoria — logout al reiniciar Railway
- `tokenStore` es ConcurrentHashMap **en memoria**
- Si Railway reinicia el proceso → todos los tokens se invalidan
- El front lo maneja: al arrancar, `Auth.me()` falla con 401 → logout automático
- **Consecuencia:** si el usuario tenía sesión y Railway reinició, tendrá que hacer login de nuevo

---

### 7.2 FK NOT NULL a empleados (EMPLEADO_SISTEMA = 1)
Estas tablas tienen columna NOT NULL que referencia a un empleado:
- `productos.revisor` → siempre 1
- `clientes.verificador` → siempre 1
- `duenios.verificador` → siempre 1
- `catalogos.responsable` → siempre 1

El empleado con `identificador = 1` debe existir en Railway. Si no existe → todo falla.

---

### 7.3 admitido = 'no' por defecto
Los clientes nuevos tienen `admitido = 'no'`. En el flujo actual, esto no bloquea nada en la app (el frontend no verifica admitido para permitir pujar). Es un campo que existe pero no tiene lógica de negocio implementada en el front.

---

### 7.4 Estado de subasta en Railway vs SQL original
- El SQL original del profesor tiene typo: `'carrada'` en el CHECK constraint
- En Railway, la tabla fue creada correctamente con `'cerrada'`
- El backend usa `'cerrada'` (correcto)
- Si ejecutás el SQL original en otra DB → el backend no puede actualizar el estado

---

### 7.5 moneda no está en subastas
```javascript
// El front hace:
const simbolo = moneda === 'dolares' ? 'U$D' : '$';
// Si moneda es null/undefined → simbolo = '$' (pesos por defecto)
```
La moneda viene de la tabla `subasta_moneda`. Si una subasta fue creada sin moneda (o falla el join), el campo llega como null y se trata como pesos.

---

### 7.6 precioBase no está en subastas
El `precioBase` que muestra el front en la `AuctionCard` viene del primer ítem del catálogo, no de la tabla `subastas`. Si la subasta no tiene ítems, aparece `—`.

---

### 7.7 Regla de incremento mínimo
```
primera puja: importe >= precioBase
siguientes:   importe >= ultimaPuja + (precioBase * 0.01)
```
El frontend Y el backend calculan esto por separado. Si hay diferencia de redondeo → el backend rechaza con error `MIN_BID`.

---

### 7.8 Validación de monto máximo según categoría
```javascript
const CATS_SIN_LIMITE = new Set(['oro', 'platino']);
// oro y platino pueden pujar sin límite superior
// el resto: máximo = ultima_puja + 20% del precio_base
```
Esta lógica también existe en el backend. El front la implementa para mostrar el tope en tiempo real sin necesidad de hacer un request.

---

### 7.9 Fotos: BLOB vs URL
```javascript
// El front NUNCA guarda la URL de la foto en la DB
// Solo guarda el BLOB en la tabla fotos
// Al necesitar mostrar la foto:
const portadaUrl = `${BASE_URL}/productos/${productoId}/portada`;
// o por foto individual:
const fotoUrl = `${BASE_URL}/fotos/${fotoId}`;

// ImgBox recibe la URL y hace un fetch (con el token si aplica)
// El backend retorna el BLOB con Content-Type: image/jpeg
```

---

### 7.10 Simulación de pago
El pago en Bidly es **simulado**. No hay integración con una pasarela real. Al "confirmar el pago":
1. Se llama `RegistroSubasta.pagar(registroId, medioPagoId)` para registrar la intención
2. Se navega a PagoConfirmado
3. El dinero no se mueve realmente

---

### 7.11 Seguro simulado
El número de póliza es `POL-${Date.now()}` — generado en el front, no es un seguro real. Se pasa a ConfirmarPago pero no se guarda en ninguna tabla del backend (el endpoint de seguros existe pero no se llama en este flujo).

---

*Documentación generada el 2026-06-28 — corresponde al código en rama SOBRADO*
