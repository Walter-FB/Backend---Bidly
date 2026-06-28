# BIDLY — Mapa de Funcionalidades
> Dónde está implementada cada función del sistema.

---

## AUTENTICACIÓN

| Funcionalidad | Archivo Frontend | Línea aprox. | Archivo Backend |
|--------------|-----------------|--------------|-----------------|
| Pantalla de login | `AuthScreens.js` | `LoginScreen` | `AuthController.java` → `POST /auth/login` |
| Pantalla de registro | `AuthScreens.js` | `RegistroScreen` | `AuthController.java` → `POST /auth/register` |
| Enviar código por email | `AuthScreens.js` | `RegistroScreen.onSubmit` | `AuthController.java` → `POST /auth/send-verification` + `EmailService.java` |
| Verificar código de 6 dígitos | `AuthScreens.js` | `VerificarEmailScreen` | `AuthController.java` → `POST /auth/verify-code` |
| Crear contraseña | `AuthScreens.js` | `CrearPasswordScreen` | `AuthController.java` → `POST /auth/register` |
| Estado global del usuario | `context/AuthContext.js` | todo el archivo | — |
| Guardar/leer token | `context/AuthContext.js` | `login()`, boot | `AsyncStorage @bidly_token` |
| Validar sesión al arrancar | `context/AuthContext.js` | boot flow | `AuthController.java` → `GET /auth/me` |
| Login como invitado | `context/AuthContext.js` | `loginAsGuest()` | — (solo local) |
| Logout | `context/AuthContext.js` | `logout()` | — (limpia AsyncStorage) |

---

## HOME Y LISTA DE SUBASTAS

| Funcionalidad | Archivo | Línea aprox. |
|--------------|---------|--------------|
| Pantalla principal con tabs | `HomeScreens.js` | `HomeScreen` ~140 |
| Barra superior con logo y badge | `HomeScreens.js` | `HomeTopBar` ~49 |
| Tarjeta de subasta (AuctionCard) | `HomeScreens.js` | `AuctionCard` ~70 |
| Tarjeta de subasta próxima | `HomeScreens.js` | `ProximaCard` ~112 |
| Cargar lista de subastas | `HomeScreens.js` | `cargarSubastas()` ~147 |
| Filtrar por tab (En vivo / Próximas / Terminadas) | `HomeScreens.js` | `subrastasFiltradas` ~214 |
| Polling de detalle en tab "En vivo" (cada 10s) | `HomeScreens.js` | useEffect ~166 |
| Polling de countdown en tab "Próximamente" (cada 30s) | `HomeScreens.js` | useEffect ~187 |
| Recibir filtros desde FiltrosScreen | `HomeScreens.js` | navigation listener ~203 |
| Pantalla de filtros (modal) | `HomeScreens.js` | `FiltrosScreen` ~306 |
| Pantalla de notificaciones | `HomeScreens.js` | `NotificacionesScreen` ~360 |
| Mapeo de tipo → ícono de notificación | `HomeScreens.js` | `iconoNotif()` ~446 |
| Mapeo de subasta del backend al shape de la card | `HomeScreens.js` | `mapSubasta()` ~21 |
| Símbolo de moneda (pesos/dolares) | `HomeScreens.js` | `simboloMoneda()` ~17 |

---

## SUBASTAS — DETALLE Y PUJA

| Funcionalidad | Archivo | Línea aprox. |
|--------------|---------|--------------|
| Detalle de subasta (fotos, precio, catálogo) | `AuctionScreens.js` | `ProductoScreen` ~67 |
| Galería de fotos con lightbox | `AuctionScreens.js` | `ProductoScreen` ~143 |
| Determinar ítem activo (sesión o primer pendiente) | `AuctionScreens.js` | `ProductoScreen` useEffect ~91 |
| **Subasta en vivo (pantalla principal de puja)** | `AuctionScreens.js` | `SubastaEnVivoScreen` ~259 |
| Inscribirse como asistente al entrar | `AuctionScreens.js` | `Asistentes.inscribir` ~335 |
| Polling de pujas cada 1 segundo | `AuctionScreens.js` | `cargarPujas` ~342 + useEffect ~391 |
| Detección automática de ganador | `AuctionScreens.js` | `cargarPujas` → `ganadora` ~350 |
| Countdown sincronizado con servidor | `AuctionScreens.js` | `syncTimer` ~298 + tick ~317 |
| Cálculo de incremento mínimo (1% del precio base) | `AuctionScreens.js` | `minIncremento` ~399 |
| Cálculo de tope máximo por categoría | `AuctionScreens.js` | `maxPuja` ~405 |
| Botones +/− para ajustar el monto | `AuctionScreens.js` | stepRow ~528 |
| Validación del monto ingresado | `AuctionScreens.js` | `montoInvalido` ~432 |
| Ejecutar puja | `AuctionScreens.js` | `onPujar()` ~434 |
| Mensajes de error de puja (MIN_BID, MAX_BID, etc.) | `AuctionScreens.js` | `mensajeError()` ~46 |
| Pantalla "Ganaste" | `AuctionScreens.js` | `GanasteScreen` ~639 |
| Pantalla "Subasta finalizada" (perdiste) | `AuctionScreens.js` | `SubastaFinalizadaScreen` ~689 |
| **Panel del subastador** | `AuctionScreens.js` | `SubastaAdminScreen` ~719 |
| Polling de pujas en panel admin (cada 1s) | `AuctionScreens.js` | `cargarPujas` + useEffect ~767 |
| Adjudicar ítem (operación atómica) | `AuctionScreens.js` | botón "Adjudicar" → `Items.adjudicar` | 

---

## CUENTA — PERFIL Y MIS SUBASTAS

| Funcionalidad | Archivo | Línea aprox. |
|--------------|---------|--------------|
| Pantalla de perfil | `AccountScreens.js` | `PerfilScreen` ~81 |
| Mis compras (historial de victorias) | `AccountScreens.js` | `MisComprasScreen` ~166 |
| Historial de subastas | `AccountScreens.js` | `HistorialScreen` ~214 |
| **Mis subastas como vendedor** | `AccountScreens.js` | `MisSubastasScreen` ~271 |
| Tab "Ganadas" (subastas ganadas como postor) | `AccountScreens.js` | `MisSubastasScreen` tab 'ganadas' ~374 |
| Toast al crear subasta exitosamente | `AccountScreens.js` | `MisSubastasScreen` toast ~305 |
| **Crear subasta — paso 1 (fecha/hora/categoría)** | `AccountScreens.js` | `CrearSubastaScreen` paso 1 ~821 |
| **Crear subasta — paso 2 (productos y precios)** | `AccountScreens.js` | `CrearSubastaScreen` paso 2 ~864 |
| Selector de fecha custom (calendario) | `AccountScreens.js` | `CalendarPicker` ~492 |
| Selector de hora (HH:MM) | `AccountScreens.js` | `TimeSelector` ~615 |
| Preview de comisión Bidly (10%) y ganancia neta | `AccountScreens.js` | `CrearSubastaScreen` ~926 |
| Lógica de creación: subastador→subasta→catálogo→ítems | `AccountScreens.js` | `onCrear()` ~775 |
| Animación de éxito al crear subasta | `AccountScreens.js` | `animarExitoYRedirigir()` ~758 |
| **Publicar producto** | `AccountScreens.js` | `PublicarScreen` ~988 |
| Elegir fotos del dispositivo | `AccountScreens.js` | `elegirFoto()` ~995 |
| Subir fotos al backend (XHR multipart) | `AccountScreens.js` | `onPublicar()` → XHR loop ~1030 |
| Lista de mis productos | `AccountScreens.js` | `MisProductosScreen` ~1324 |
| Modo selección de producto para subasta | `AccountScreens.js` | `MisProductosScreen` `modoSeleccion` ~1326 |
| Eliminar producto con confirmación | `AccountScreens.js` | `confirmarEliminar()` ~1347 |
| Datos personales (readonly) | `AccountScreens.js` | `DatosPersonalesScreen` ~1270 |
| Datos del ganador de una venta | `AccountScreens.js` | `DatosGanadorScreen` ~1204 |
| Detalle de una compra (con opción de pago/reembolso) | `AccountScreens.js` | `CompraDetalleScreen` ~1125 |
| Mapeo de RegistroSubasta al shape de la lista | `AccountScreens.js` | `mapRegistro()` ~57 |
| Colores de categoría de usuario | `AccountScreens.js` | `CATEGORIAS_COLOR` ~49 |

---

## PAGO Y POST-SUBASTA

| Funcionalidad | Archivo | Línea aprox. |
|--------------|---------|--------------|
| Elegir medio de pago | `PaymentScreens.js` | `MedioPagoScreen` ~105 |
| Agregar nueva tarjeta inline | `PaymentScreens.js` | `onAgregarTarjeta()` ~127 |
| Enmascarar número de tarjeta (últimos 4 dígitos) | `PaymentScreens.js` | `maskCard()` ~37 |
| Formatear número de tarjeta (grupos de 4) | `PaymentScreens.js` | `formatCardNumber()` ~70 |
| Formatear vencimiento (MM/AA con auto-slash) | `PaymentScreens.js` | `formatCardExpiry()` ~44 |
| Validar vencimiento (mes 01-12) | `PaymentScreens.js` | `isValidCardExpiry()` ~50 |
| Pantalla de seguro opcional (2.5%) | `PaymentScreens.js` | `SeguroScreen` ~275 |
| Confirmar pago (resumen total) | `PaymentScreens.js` | `ConfirmarPagoScreen` ~343 |
| Buscar registroId para marcar pago | `PaymentScreens.js` | `onPagar()` → busca por subastaId+productoId ~362 |
| Pago confirmado (recibo) | `PaymentScreens.js` | `PagoConfirmadoScreen` ~436 |
| Pantalla de multa pendiente | `PaymentScreens.js` | `MultaScreen` ~468 |
| Solicitar reembolso | `PaymentScreens.js` | `ReembolsoScreen` ~539 |
| Helper formatear importe con símbolo de moneda | `PaymentScreens.js` | `formatImporte()` ~12 |

---

## NOTIFICACIONES Y BADGE

| Funcionalidad | Archivo | Línea aprox. |
|--------------|---------|--------------|
| Hook de badge de notificaciones | `hooks/useNotifBadge.js` | `useNotifBadge()` ~8 |
| Polling de notificaciones (cada 30s) | `hooks/useNotifBadge.js` | useEffect ~27 |
| Vibrar al recibir notificación nueva | `hooks/useNotifBadge.js` | `Vibration.vibrate(200)` ~19 |
| Badge rojo en la campana (top bar) | `HomeScreens.js` | `HomeTopBar` ~55 |
| Badge rojo en tab Subastas | `AccountScreens.js` | `MisSubastasScreen` ~336 |
| Marcar notificación como leída al tocarla | `HomeScreens.js` | `tocarNotif()` ~385 |
| Navegar al pago desde notificación "ganaste" | `HomeScreens.js` | `tocarNotif()` ~391 |

---

## NAVEGACIÓN

| Funcionalidad | Archivo | Línea aprox. |
|--------------|---------|--------------|
| Árbol principal de navegación | `navigation/RootNavigator.js` | todo el archivo |
| Lógica auth/guest/main | `navigation/RootNavigator.js` | usa `user` de AuthContext |
| Barra de tabs inferior | `navigation/TabNavigator.js` | todo el archivo |
| Bloqueo de tabs para invitados | `navigation/TabNavigator.js` | `GuestBlockScreen` |
| Navegar a "Mis Subastas" reseteando el stack | `AccountScreens.js` | `irAMisSubastas()` ~18 |

---

## API — CAPA DE RED

| Funcionalidad | Archivo | Función |
|--------------|---------|---------|
| Cliente HTTP base (fetch + token) | `api/client.js` | `request()` |
| Agregar token Bearer a cada request | `api/client.js` | `request()` → headers |
| Subida de archivos (multipart) | `api/client.js` | `upload()` |
| Todos los endpoints de Auth | `api/endpoints.js` | módulo `Auth` |
| Todos los endpoints de Subastas | `api/endpoints.js` | módulo `Subastas` |
| Todos los endpoints de Pujas | `api/endpoints.js` | módulo `Pujas` |
| Todos los endpoints de Asistentes | `api/endpoints.js` | módulo `Asistentes` |
| Todos los endpoints de Clientes | `api/endpoints.js` | módulo `Clientes` |
| Todos los endpoints de Productos | `api/endpoints.js` | módulo `Productos` |
| Todos los endpoints de Catálogos | `api/endpoints.js` | módulo `Catalogos` |
| Todos los endpoints de RegistroSubasta | `api/endpoints.js` | módulo `RegistroSubasta` |
| Todos los endpoints de Notificaciones | `api/endpoints.js` | módulo `Notificaciones` |

---

## COMPONENTES UI REUTILIZABLES

| Componente | Archivo | Dónde se define |
|-----------|---------|-----------------|
| Todos los componentes base | `components/ui.js` | todo el archivo |
| Paleta de colores | `theme/theme.js` | objeto `colors` |
| Helpers de subasta (título, estado, fase) | `utils/subasta.js` | `tituloSubasta`, `tagEstadoSubasta`, `esSubastaFinalizada`, etc. |
| Helpers de tiempo (countdown, etiqueta) | `utils/tiempo.js` | `etiquetaTiempoSubasta`, `esSubastaEnVivo` |

---

## BACKEND — ARCHIVOS POR DOMINIO

| Dominio | Controller | Modelos principales | Repositorios |
|---------|-----------|---------------------|--------------|
| Auth | `AuthController.java` | `Persona`, `Cliente`, `Credencial` | `CredencialRepository`, `ClienteRepository`, `PersonaRepository` |
| Subastas | `SubastaController.java` | `Subasta`, `SubastaMoneda` | `SubastaRepository`, `SubastaMonedaRepository` |
| Catálogos | `CatalogoController.java` | `Catalogo` | `CatalogoRepository` |
| Ítems | `ItemCatalogoController.java` | `ItemCatalogo` | `ItemCatalogoRepository` |
| Productos | `ProductoController.java` | `Producto`, `Foto` | `ProductoRepository`, `FotoRepository` |
| Pujas | `PujaController.java` | `Puja`, `PujoFecha` | `PujaRepository`, `PujoFechaRepository` |
| Asistentes | `AsistenteController.java` | `Asistente` | `AsistenteRepository` |
| Subastadores | `SubastadorController.java` | `Subastador` | `SubastadorRepository` |
| Clientes | `ClienteController.java` | `Cliente` | `ClienteRepository` |
| Personas | `PersonaController.java` | `Persona` | `PersonaRepository` |
| Registro post-subasta | `RegistroController.java` | `RegistroDeSubasta`, `Reembolso` | `RegistroRepository`, `ReembolsoRepository` |
| Medios de pago | `ClienteController.java` | `MedioPago` | `MedioPagoRepository` |
| Notificaciones | `NotificacionController.java` | `Notificacion` | `NotificacionRepository` |
| Multas | `MultaController.java` | `Multa` | `MultaRepository` |
| Seguros | `SeguroController.java` | `Seguro` | `SeguroRepository` |
| Email | — | — | `EmailService.java` |
| Config CORS | — | — | `CorsConfig.java` |
| Config seguridad | — | — | `SecurityConfig.java` |

---

## OPERACIONES ATÓMICAS CRÍTICAS

Estas son las operaciones más delicadas porque tocan múltiples tablas:

| Operación | Dónde | Qué tablas toca |
|-----------|-------|-----------------|
| **Adjudicar ítem** | `ItemCatalogoController.java` → `PATCH /items/{id}/adjudicar` | `pujos` (ganador='si') + `itemscatalogo` (subastado='si') + `registroDeSubasta` (INSERT) + `reembolsos` (INSERT) |
| **Registrar puja** | `PujaController.java` → `POST /pujos` | `pujos` (INSERT) + `pujo_fecha` (INSERT) |
| **Registrar usuario** | `AuthController.java` → `POST /auth/register` | `personas` (INSERT) + `clientes` (INSERT) + `credenciales` (INSERT) |
| **Crear subasta completa** | Frontend `CrearSubastaScreen.onCrear()` | llama: `/subastadores` + `/subastas` + `/catalogos` + `/catalogos/{id}/items` |
| **Publicar producto** | Frontend `PublicarScreen.onPublicar()` | llama: `/productos` (crea producto, auto-crea duenio si no existe) + `/productos/{id}/fotos` (sube BLOBs) |

---

*Mapa generado el 2026-06-28 — rama SOBRADO*
