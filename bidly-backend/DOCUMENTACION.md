# BIDLY Backend — Documentación del Proyecto

## Descripción general

BIDLY es una aplicación de subastas en línea. Este backend provee la API REST que consume la app Android de BIDLY. Está desarrollado con **Spring Boot 3.5**, **Java 21** y **PostgreSQL**, y expone todos sus endpoints bajo el prefijo `/api`.

- **Puerto:** 8083
- **Base de datos:** `bidly` en `localhost:5432`
- **URL base de la API:** `http://localhost:8083/api`

---

## Stack tecnológico

| Tecnología | Versión | Rol |
|---|---|---|
| Java | 21 | Lenguaje principal |
| Spring Boot | 3.5 | Framework web y DI |
| Spring Data JPA | (incluido en Boot) | Capa de acceso a datos (ORM) |
| Spring Security | (incluido en Boot) | Seguridad (deshabilitada en dev) |
| PostgreSQL | 16 | Base de datos relacional |
| Lombok | (incluido en Boot) | Reducción de código boilerplate |
| Maven | Wrapper incluido | Gestión de dependencias y build |

---

## Arquitectura del proyecto

El proyecto sigue una arquitectura en capas estándar de Spring Boot:

```
src/main/java/com/bidly/bidly_backend/
├── BidlyBackendApplication.java   ← Punto de entrada
├── config/
│   ├── SecurityConfig.java        ← Configuración de seguridad
│   └── CorsConfig.java            ← Configuración de CORS
├── model/                         ← Entidades JPA (mapean tablas de la BD)
├── repository/                    ← Interfaces de acceso a datos (Spring Data)
└── controller/                    ← Controladores REST (endpoints HTTP)
```

**Flujo de una petición:**
```
App Android → HTTP → Controller → Repository → Base de datos PostgreSQL
```

---

## Configuración

### SecurityConfig.java

Deshabilita Spring Security para el entorno de desarrollo. Sin esta clase, Spring Security bloquearía todas las peticiones por defecto. Permite todas las peticiones sin autenticación y deshabilita CSRF.

```java
// Permite todo sin token ni sesión
http.csrf(csrf -> csrf.disable())
    .authorizeHttpRequests(auth -> auth.anyRequest().permitAll());
```

### CorsConfig.java

Habilita CORS (Cross-Origin Resource Sharing) para todos los endpoints bajo `/api/**`. Esto es necesario para que la app Android pueda consumir la API desde un dominio/origen distinto.

---

## Modelos (Entidades JPA)

Cada modelo es una clase Java que representa una tabla de la base de datos. Spring Data JPA se encarga de traducir automáticamente las operaciones Java a SQL.

### Persona
**Tabla:** `personas`  
Representa a cualquier persona en el sistema (cliente, empleado, dueño, subastador). Es la entidad base del sistema.

| Campo Java | Columna BD | Tipo | Descripción |
|---|---|---|---|
| identificador | identificador | Long (PK, auto) | ID único |
| documento | documento | String | CUIT/DNI |
| nombre | nombre | String | Nombre completo |
| direccion | direccion | String | Dirección postal |
| estado | estado | String | `activo` / `inactivo` |
| foto | foto | byte[] | Foto de perfil (binario) |

### Cliente
**Tabla:** `clientes`  
Extiende a `Persona` (comparten el mismo ID). Representa a los compradores que participan en subastas.

| Campo Java | Columna BD | Tipo | Descripción |
|---|---|---|---|
| identificador | identificador | Long (PK, FK→personas) | Mismo ID que la persona |
| numeroPais | numeropais | Integer | FK a tabla paises |
| admitido | admitido | String | `si` / `no` |
| categoria | categoria | String | `comun`, `especial`, `plata`, `oro`, `platino` |
| verificador | verificador | Long | FK al empleado que verificó |
| email | email | String | Email de acceso (único) |
| passwordHash | passwordhash | String | Contraseña (sin hashear en dev) |

### Subasta
**Tabla:** `subastas`  
Representa una sesión de subasta con fecha, hora y lugar.

| Campo Java | Columna BD | Tipo | Descripción |
|---|---|---|---|
| identificador | identificador | Long (PK, auto) | ID único |
| fecha | fecha | LocalDate | Fecha de la subasta |
| hora | hora | LocalTime | Hora de inicio |
| estado | estado | String | `abierta` / `cerrada` |
| subastador | subastador | Long | FK al subastador responsable |
| ubicacion | ubicacion | String | Lugar físico |
| categoria | categoria | String | Categoría de clientes que puede participar |
| moneda | moneda | String | `pesos` / `dolares` |

### Producto
**Tabla:** `productos`  
Representa un artículo que puede ser subastado.

| Campo Java | Columna BD | Tipo | Descripción |
|---|---|---|---|
| identificador | identificador | Long (PK, auto) | ID único |
| fecha | fecha | LocalDate | Fecha de ingreso al sistema |
| disponible | disponible | String | `si` / `no` |
| descripcionCatalogo | descripcioncatalogo | String | Descripción corta para el catálogo |
| descripcionCompleta | descripcioncompleta | String | URL al documento con descripción completa |
| revisor | revisor | Long | FK al empleado revisor |
| duenio | duenio | Long | FK al dueño del producto |
| seguro | seguro | String | FK (nroPoliza) al seguro |

### Catalogo
**Tabla:** `catalogos`  
Agrupa ítems de una subasta bajo un catálogo.

| Campo Java | Columna BD | Tipo | Descripción |
|---|---|---|---|
| identificador | identificador | Long (PK, auto) | ID único |
| descripcion | descripcion | String | Descripción del catálogo |
| subasta | subasta | Subasta (FK) | Subasta a la que pertenece |
| responsable | responsable | Long | FK al empleado responsable |

### ItemCatalogo
**Tabla:** `itemscatalogo`  
Representa un producto dentro de un catálogo, con su precio base y comisión.

| Campo Java | Columna BD | Tipo | Descripción |
|---|---|---|---|
| identificador | identificador | Long (PK, auto) | ID único |
| catalogo | catalogo | Catalogo (FK) | Catálogo al que pertenece |
| producto | producto | Producto (FK) | Producto referenciado |
| precioBase | preciobase | BigDecimal | Precio de salida |
| comision | comision | BigDecimal | Comisión de la casa de subastas |
| subastado | subastado | String | `si` / `no` |

### Asistente
**Tabla:** `asistentes`  
Representa la inscripción de un cliente a una subasta específica.

| Campo Java | Columna BD | Tipo | Descripción |
|---|---|---|---|
| identificador | identificador | Long (PK, auto) | ID único |
| numeroPostor | numeropostor | Integer | Número asignado en la subasta |
| cliente | cliente | Cliente (FK) | Cliente inscripto |
| subasta | subasta | Subasta (FK) | Subasta a la que asiste |

### Puja
**Tabla:** `pujos`  
Registra cada oferta realizada sobre un ítem de catálogo.

| Campo Java | Columna BD | Tipo | Descripción |
|---|---|---|---|
| identificador | identificador | Long (PK, auto) | ID único |
| asistente | asistente | Asistente (FK) | Asistente que puja |
| item | item | ItemCatalogo (FK) | Ítem sobre el que se puja |
| importe | importe | BigDecimal | Monto ofertado |
| ganador | ganador | String | `si` / `no` |
| fechaHora | fechahora | LocalDateTime | Fecha y hora exacta de la puja |

### RegistroDeSubasta
**Tabla:** `registrodesubasta`  
Tabla de ventas: registra el resultado final cuando un ítem es vendido.

| Campo Java | Columna BD | Tipo | Descripción |
|---|---|---|---|
| identificador | identificador | Long (PK, auto) | ID único |
| subasta | subasta | Subasta (FK) | Subasta donde ocurrió la venta |
| duenio | duenio | Long | FK al dueño del producto vendido |
| producto | producto | Long | FK al producto vendido |
| cliente | cliente | Cliente (FK) | Cliente comprador |
| importe | importe | BigDecimal | Precio final de venta |
| comision | comision | BigDecimal | Comisión cobrada |
| reembolsada | reembolsada | String | `si` / `no` — si la venta fue reembolsada |

### MedioPago
**Tabla:** `mediosdepago`  
Medios de pago registrados por un cliente.

| Campo Java | Columna BD | Tipo | Descripción |
|---|---|---|---|
| identificador | identificador | Long (PK, auto) | ID único |
| cliente | cliente | Cliente (FK) | Cliente dueño del medio |
| tipo | tipo | String | `tarjeta` / `cuenta` / `cheque` |
| numeroTarjeta | numerotarjeta | String | Número de tarjeta (si aplica) |
| vencimiento | vencimiento | String | Vencimiento en formato `MM/YYYY` |
| titular | titular | String | Nombre del titular |
| numeroCuenta | numerocuenta | String | Número de cuenta bancaria (si aplica) |
| banco | banco | String | Banco (si aplica) |
| numeroCheque | numerocheque | String | Número de cheque (si aplica) |
| montoCheque | montocheque | BigDecimal | Monto del cheque (si aplica) |
| verificado | verificado | String | `si` / `no` |

### Multa
**Tabla:** `multas`  
Multas generadas cuando un cliente gana una puja pero no paga.

| Campo Java | Columna BD | Tipo | Descripción |
|---|---|---|---|
| identificador | identificador | Long (PK, auto) | ID único |
| cliente | cliente | Cliente (FK) | Cliente multado |
| pujo | pujo | Puja (FK) | Puja que originó la multa |
| importe | importe | BigDecimal | Monto de la multa |
| pagada | pagada | String | `si` / `no` |
| fechaGenerada | fechagenerada | LocalDateTime | Cuándo se generó la multa |

### Notificacion
**Tabla:** `notificaciones`  
Notificaciones enviadas a clientes sobre eventos de la subasta.

| Campo Java | Columna BD | Tipo | Descripción |
|---|---|---|---|
| identificador | identificador | Long (PK, auto) | ID único |
| cliente | cliente | Cliente (FK) | Cliente destinatario |
| tipo | tipo | String | `lider`, `perdiste`, `ganaste`, `multa`, `subasta_por_cerrar` |
| mensaje | mensaje | String | Texto de la notificación |
| leida | leida | String | `si` / `no` |
| fechaHora | fechahora | LocalDateTime | Cuándo se generó |

### Seguro
**Tabla:** `seguros`  
Pólizas de seguro que cubren los productos durante la subasta.

| Campo Java | Columna BD | Tipo | Descripción |
|---|---|---|---|
| nroPoliza | nropoliza | String (PK) | Número de póliza (ej: `POL-001`) |
| compania | compania | String | Nombre de la aseguradora |
| polizaCombinada | polizacombinada | String | `si` / `no` |
| importe | importe | BigDecimal | Monto cubierto |

### Foto
**Tabla:** `fotos`  
Fotos asociadas a un producto.

| Campo Java | Columna BD | Tipo | Descripción |
|---|---|---|---|
| identificador | identificador | Long (PK, auto) | ID único |
| producto | producto | Producto (FK) | Producto al que pertenece |
| foto | foto | byte[] | Datos de la imagen o nombre de archivo como bytes |

---

## Repositorios

Los repositorios son interfaces que extienden `JpaRepository`. Spring Data JPA genera automáticamente el SQL necesario a partir del nombre de los métodos. No hay código SQL escrito a mano (excepto una query con `@Query` en `SubastaRepository`).

| Repositorio | Métodos destacados |
|---|---|
| `PersonaRepository` | CRUD estándar |
| `ClienteRepository` | `findByEmail(email)` — usado en login |
| `SubastaRepository` | `findByEstado`, `findBySubastador`, `findByFiltros` (query JPQL con filtros opcionales) |
| `ProductoRepository` | CRUD estándar |
| `AsistenteRepository` | CRUD estándar |
| `CatalogoRepository` | `findBySubastaIdentificador` |
| `ItemCatalogoRepository` | `findByCatalogoIdentificador`, `findByCatalogoSubastaIdentificador` |
| `PujaRepository` | `findTopByItemIdentificadorOrderByImporteDesc` (última puja), `findByItemIdentificadorAndGanador`, `findByItemIdentificadorOrderByImporteDesc`, `findByAsistenteIdentificadorOrderByImporteDesc` |
| `RegistroDeSubastaRepository` | `findByClienteIdentificador`, `findBySubastaIdentificador` |
| `MedioPagoRepository` | `findByClienteIdentificador` |
| `MultaRepository` | CRUD estándar |
| `NotificacionRepository` | `findByClienteIdentificador` |
| `SeguroRepository` | CRUD estándar (PK es String) |
| `FotoRepository` | `findByProductoIdentificador` |

---

## Endpoints de la API

### Personas — `/api/personas`

| Método | URL | Descripción | Request Body | Response |
|---|---|---|---|---|
| GET | `/api/personas/{id}` | Obtener persona por ID | — | `200 Persona` / `404` |
| POST | `/api/personas` | Crear nueva persona | `{documento, nombre, direccion, estado}` | `201 Persona` |
| PUT | `/api/personas/{id}` | Reemplazar todos los datos de una persona | `{documento, nombre, direccion, estado}` | `200 Persona` / `404` |
| PATCH | `/api/personas/{id}` | Actualizar campos específicos | `{campo: valor, ...}` | `200 Persona` / `404` |

---

### Clientes — `/api/clientes`

| Método | URL | Descripción | Request Body | Response |
|---|---|---|---|---|
| GET | `/api/clientes/{id}` | Obtener cliente por ID | — | `200 Cliente` / `404` |
| POST | `/api/clientes` | Crear nuevo cliente (la persona debe existir previamente) | `{identificador, numeroPais, admitido, categoria, verificador, email, passwordHash}` | `201 Cliente` / `400` |
| PATCH | `/api/clientes/{id}/categoria` | Cambiar categoría del cliente | `{categoria}` | `200 Cliente` / `400` / `404` |
| PATCH | `/api/clientes/{id}/admitido` | Admitir o rechazar a un cliente | `{admitido}` | `200 Cliente` / `400` / `404` |
| POST | `/api/clientes/{id}/medios-pago` | Agregar un medio de pago al cliente | `{tipo, numeroTarjeta, vencimiento, titular, verificado}` | `201 MedioPago` / `404` |

> El POST de clientes valida que la persona con ese `identificador` ya exista en la tabla `personas`.

---

### Autenticación — `/api/auth`

| Método | URL | Descripción | Request Body | Response |
|---|---|---|---|---|
| POST | `/api/auth/login` | Login del cliente | `{email, password}` | `200 {token}` / `401 {error}` |

> El token devuelto es un UUID aleatorio (sistema simplificado para desarrollo, sin JWT real).  
> La comparación es directa entre el password recibido y el `passwordHash` almacenado.

---

### Subastas — `/api/subastas`

| Método | URL | Descripción | Query Params | Response |
|---|---|---|---|---|
| GET | `/api/subastas` | Listar subastas (sin filtros: solo abiertas) | `?estado=&categoria=&moneda=` | `200 [Subasta]` |
| GET | `/api/subastas/{id}` | Obtener subasta por ID | — | `200 Subasta` / `404` |
| POST | `/api/subastas` | Crear nueva subasta | `{fecha, hora, estado, subastador, ubicacion, categoria, moneda}` | `201 Subasta` |
| GET | `/api/subastas/{id}/estado` | Obtener solo el estado actual | — | `200 {estado}` / `404` |
| PATCH | `/api/subastas/{id}/estado` | Cambiar estado (abrir/cerrar) | — | `200 Subasta` / `400` / `404` |
| GET | `/api/subastas/{id}/catalogos` | Listar todos los ítems de todos los catálogos de la subasta | — | `200 [ItemCatalogo]` / `404` |

> Sin parámetros, `GET /api/subastas` devuelve únicamente las subastas con `estado=abierta`. Pasando cualquier filtro (`?categoria=comun&moneda=pesos`), filtra sobre todas las subastas.

---

### Subastadores — `/api/subastadores`

| Método | URL | Descripción | Response |
|---|---|---|---|
| GET | `/api/subastadores/{id}/subastas` | Listar subastas a cargo de un subastador | `200 [Subasta]` |

---

### Productos — `/api/productos`

| Método | URL | Descripción | Request Body | Response |
|---|---|---|---|---|
| GET | `/api/productos/{id}` | Obtener producto por ID | — | `200 Producto` / `404` |
| POST | `/api/productos` | Crear nuevo producto | `{fecha, disponible, descripcionCompleta, revisor, duenio}` | `201 Producto` |
| PATCH | `/api/productos/{id}/disponible` | Alternar disponibilidad (`si`↔`no`) | — | `200 Producto` / `404` |
| POST | `/api/productos/{id}/fotos` | Cargar fotos del producto | `{fotos: ["url1", "url2", ...]}` | `201 {guardadas: N}` / `404` |

---

### Catálogos — `/api/catalogos`

| Método | URL | Descripción | Response |
|---|---|---|---|
| GET | `/api/catalogos/{id}/items` | Listar ítems de un catálogo específico | `200 [ItemCatalogo]` / `404` |

---

### Asistentes — `/api/asistentes`

| Método | URL | Descripción | Response |
|---|---|---|---|
| GET | `/api/asistentes/{id}` | Obtener asistente por ID | `200 Asistente` / `404` |
| GET | `/api/asistentes/{id}/pujos` | Listar todas las pujas de un asistente | `200 [Puja]` / `404` |

---

### Pujas — `/api/pujos`

| Método | URL | Descripción | Query Params / Body | Response |
|---|---|---|---|---|
| GET | `/api/pujos` | Listar pujas por ítem o por asistente | `?item={id}` o `?asistente={id}` | `200 [Puja]` / `400` |
| POST | `/api/pujos` | Realizar una nueva puja | `{asistente: {identificador}, item: {identificador}, importe}` | `201 Puja` / `400` / `422` |
| GET | `/api/pujos/{itemId}/ganador` | Obtener la puja ganadora de un ítem | — | `200 Puja` / `404` |

> **Lógica de validación en POST /api/pujos:**
> 1. El ítem debe existir en `itemscatalogo`.
> 2. Se calcula el incremento mínimo como el 1% del precio base del ítem.
> 3. Si es la primera puja: el importe mínimo aceptado es el `precioBase`.
> 4. Si ya hay pujas: el importe mínimo es `última puja + incremento mínimo`.
> 5. Si el importe enviado está por debajo del mínimo, devuelve `422` con el mínimo aceptable.

---

### Seguros — `/api/seguros`

| Método | URL | Descripción | Request Body | Response |
|---|---|---|---|---|
| GET | `/api/seguros/{nroPoliza}` | Obtener póliza por número | — | `200 Seguro` / `404` |
| POST | `/api/seguros` | Crear nueva póliza | `{nroPoliza, compania, polizaCombinada, importe}` | `201 Seguro` |
| PUT | `/api/seguros/{nroPoliza}` | Actualizar datos de una póliza | `{compania, polizaCombinada, importe}` | `200 Seguro` / `404` |

---

### Registro de Subasta — `/api/registro-subasta`

| Método | URL | Descripción | Request Body | Response |
|---|---|---|---|---|
| POST | `/api/registro-subasta` | Registrar una venta | `{subasta: {id}, duenio, producto, cliente: {id}, importe, comision}` | `201 RegistroDeSubasta` |
| GET | `/api/registro-subasta/{id}` | Obtener un registro por ID | — | `200 RegistroDeSubasta` / `404` |
| GET | `/api/registro-subasta/cliente/{id}` | Historial de compras de un cliente | — | `200 [RegistroDeSubasta]` / `404` |
| GET | `/api/registro-subasta/subasta/{id}` | Ventas de una subasta específica | — | `200 [RegistroDeSubasta]` / `404` |
| PATCH | `/api/registro-subasta/{id}/reembolso` | Marcar una venta como reembolsada | `{reembolsada: "si"/"no"}` | `200 RegistroDeSubasta` / `400` / `404` |

---

### Multas — `/api/multas`

| Método | URL | Descripción | Request Body | Response |
|---|---|---|---|---|
| GET | `/api/multas/{id}` | Obtener multa por ID | — | `200 Multa` / `404` |
| PATCH | `/api/multas/{id}` | Marcar multa como pagada/impaga | `{pagada: "si"/"no"}` | `200 Multa` / `400` / `404` |

---

### Notificaciones — `/api/notificaciones`

| Método | URL | Descripción | Response |
|---|---|---|---|
| GET | `/api/notificaciones/{id}` | Obtener notificación por ID | `200 Notificacion` / `404` |

---

## Relaciones entre tablas (esquema de la BD)

```
paises
  └── clientes.numeropais → paises.numero

personas
  ├── clientes.identificador → personas.identificador
  ├── duenios.identificador  → personas.identificador
  └── subastadores.identificador → personas.identificador

empleados
  └── clientes.verificador → empleados.identificador

seguros
  └── productos.seguro → seguros.nropoliza

subastadores
  └── subastas.subastador → subastadores.identificador

subastas
  ├── asistentes.subasta → subastas.identificador
  ├── catalogos.subasta  → subastas.identificador
  └── registrodesubasta.subasta → subastas.identificador

clientes
  ├── asistentes.cliente → clientes.identificador
  ├── mediosdepago.cliente → clientes.identificador
  ├── multas.cliente → clientes.identificador
  ├── notificaciones.cliente → clientes.identificador
  └── registrodesubasta.cliente → clientes.identificador

productos
  └── fotos.producto → productos.identificador

catalogos (FK a subastas)
  └── itemscatalogo.catalogo → catalogos.identificador

itemscatalogo (FK a catalogos + productos)
  ├── pujos.item → itemscatalogo.identificador
  └── multas.pujo → pujos.identificador (transitivo)

asistentes (FK a clientes + subastas)
  └── pujos.asistente → asistentes.identificador

pujos
  └── multas.pujo → pujos.identificador
```

---

## Reglas de negocio implementadas

### Pujas
- El importe mínimo de la primera puja es el `precioBase` del ítem.
- Cada puja siguiente debe superar la anterior en al menos el 1% del `precioBase`.
- Si el importe no cumple el mínimo, se devuelve HTTP 422 con el mínimo aceptable.
- Toda puja nueva se guarda con `ganador = "no"` y timestamp automático.

### Clientes
- No se puede crear un cliente si la persona (mismo ID) no existe previamente en `personas`.
- Las categorías válidas son: `comun`, `especial`, `plata`, `oro`, `platino`.
- El campo `admitido` solo acepta `si` o `no`.

### Subastas
- Sin filtros, el listado devuelve solo subastas `abierta`.
- El campo `estado` solo acepta `abierta` o `cerrada`.

### Medios de pago
- El tipo puede ser `tarjeta`, `cuenta` o `cheque`. Cada tipo usa campos distintos.

### Auth
- Login por email + password. Comparación directa (no hay hash real en esta versión).
- Devuelve un token UUID aleatorio por sesión.

---

## Cómo levantar el proyecto

```bash
# Clonar/ubicarse en el directorio del proyecto
cd bidly-backend

# Levantar (compila y arranca en el puerto 8083)
./mvnw spring-boot:run

# O compilar sin levantar
./mvnw compile
```

**Requisito previo:** PostgreSQL corriendo en `localhost:5432` con la base de datos `bidly` creada y el usuario `postgres` con contraseña `bidly2026`.
