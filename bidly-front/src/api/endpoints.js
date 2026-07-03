// BIDLY — mapa de endpoints hacia el backend FastAPI (puerto 8083).
// Todos los paths son relativos al BASE_URL definido en client.js.
import api, { setToken, upload } from './client';

// ─── AUTH ────────────────────────────────────────────────────────────────────
// POST /api/auth/login   → { token, clienteId, email, nombre, categoria, admitido }
// POST /api/auth/register → mismo shape
// GET  /api/auth/me      → mismo shape (valida token en backend)
export const Auth = {
  login: (email, password) =>
    api.post('/auth/login', { email, password }, { auth: false }),
  register: (payload) =>
    api.post('/auth/register', payload, { auth: false }),
  me: () => api.get('/auth/me'),
  logout: () => setToken(null),
  sendVerification: (email) =>
    api.post('/auth/send-verification', { email }, { auth: false }),
  verifyCode: (email, code) =>
    api.post('/auth/verify-code', { email, code }, { auth: false }),
  uploadDni: (clienteId, formData) =>
    upload(`/clientes/${clienteId}/dni-fotos`, formData),
};

// ─── SUBASTAS ────────────────────────────────────────────────────────────────
// GET  /api/subastas?estado=abierta&categoria=&moneda=ARS
// GET  /api/subastas/{id}
// POST /api/subastas
// GET  /api/subastas/{id}/catalogo   → primer item del catálogo
// GET  /api/subastas/{id}/catalogos  → todos los catálogos
// GET  /api/subastas/{id}/estado
// PATCH /api/subastas/{id}/estado
// GET  /api/subastas/{id}/sesion   → { itemActivoId, ordenActual, timerDesde, segundosRestantes }
// GET  /api/subastadores/{subastadorId}/subastas
export const Subastas = {
  listar: (params = {}) => {
    // mapear filtros front → backend
    const backendParams = {};
    if (params.estado) backendParams.estado = params.estado;     // 'abierta' | 'cerrada'
    if (params.categoria) backendParams.categoria = params.categoria;
    if (params.moneda) backendParams.moneda = params.moneda;
    if (params.publico === false) backendParams.publico = 'false';
    const q = new URLSearchParams(backendParams).toString();
    return api.get(`/subastas${q ? `?${q}` : ''}`);
  },
  obtener: (id) => api.get(`/subastas/${id}`),
  catalogo: (id) => api.get(`/subastas/${id}/catalogo`),
  catalogos: (id) => api.get(`/subastas/${id}/catalogos`),
  estado: (id) => api.get(`/subastas/${id}/estado`),
  sesion: (id) => api.get(`/subastas/${id}/sesion`),
  actualizarEstado: (id, estado) =>
    api.patch(`/subastas/${id}/estado`, { estado }),
  crear: (payload) => api.post('/subastas', payload),
  porSubastador: (subastadorId) =>
    api.get(`/subastadores/${subastadorId}/subastas`),
  asistentes: (id) => api.get(`/subastas/${id}/asistentes`),
};

// ─── PUJAS ───────────────────────────────────────────────────────────────────
// GET  /api/pujos?item={itemId}          → lista de pujas por item
// GET  /api/pujos?asistente={asisId}     → pujas del asistente
// POST /api/pujos                        → { asistente: {identificador}, item: {identificador}, importe }
// GET  /api/pujos/{itemId}/ganador       → puja ganadora
export const Pujas = {
  porItem: (itemId) => api.get(`/pujos?item=${itemId}`),
  porAsistente: (asistenteId) => api.get(`/pujos?asistente=${asistenteId}`),
  pujar: (asistenteId, itemId, importe) =>
    api.post('/pujos', {
      asistente: { identificador: asistenteId },
      item: { identificador: itemId },
      importe,
    }),
  ganador: (itemId) => api.get(`/pujos/${itemId}/ganador`),
};

// ─── CATÁLOGOS ───────────────────────────────────────────────────────────────
// GET  /api/catalogos/{id}/items
// POST /api/catalogos
// POST /api/catalogos/{id}/items
export const Catalogos = {
  items: (catalogoId) => api.get(`/catalogos/${catalogoId}/items`),
  crear: (payload) => api.post('/catalogos', payload),
  agregarItem: (catalogoId, payload) => api.post(`/catalogos/${catalogoId}/items`, payload),
};

// ─── ASISTENTES ──────────────────────────────────────────────────────────────
// GET  /api/asistentes/{id}
// GET  /api/asistentes/{id}/pujos
// POST /api/asistentes/inscribir  → { clienteId, subastaId } → Asistente (find or create)
export const Asistentes = {
  obtener: (id) => api.get(`/asistentes/${id}`),
  pujas: (id) => api.get(`/asistentes/${id}/pujos`),
  inscribir: (clienteId, subastaId) =>
    api.post('/asistentes/inscribir', { clienteId, subastaId }),
};

// ─── CLIENTES / PERFIL ───────────────────────────────────────────────────────
// GET   /api/clientes/{id}
// PATCH /api/clientes/{id}/categoria
// GET   /api/clientes/{id}/medios-pago
// POST  /api/clientes/{id}/medios-pago
export const Clientes = {
  obtener: (id) => api.get(`/clientes/${id}`),
  actualizarCategoria: (id, categoria) =>
    api.patch(`/clientes/${id}/categoria`, { categoria }),
  admitir: (id, admitido) => api.patch(`/clientes/${id}/admitido`, { admitido }),
  pendientes: () => api.get('/clientes/pendientes/lista'),
  metricas: (id) => api.get(`/clientes/${id}/metricas`),
  saldo: (id) => api.get(`/clientes/${id}/saldo`),
  mediosPago: (id) => api.get(`/clientes/${id}/medios-pago`),
  agregarMedioPago: (id, medioPago) =>
    api.post(`/clientes/${id}/medios-pago`, medioPago),
};

// ─── PERSONAS ────────────────────────────────────────────────────────────────
// GET /api/personas/{id}
// PUT /api/personas/{id}
export const Personas = {
  obtener: (id) => api.get(`/personas/${id}`),
  actualizar: (id, datos) => api.put(`/personas/${id}`, datos),
};

// ─── PRODUCTOS ───────────────────────────────────────────────────────────────
// GET   /api/productos/{id}
// POST  /api/productos
// PATCH /api/productos/{id}/disponible
// POST  /api/productos/{id}/fotos
export const Productos = {
  obtener: (id) => api.get(`/productos/${id}`),
  porDuenio: (duenioId) => api.get(`/productos/duenio/${duenioId}`),
  crear: (payload) => api.post('/productos', payload),
  disponible: (id, disponible) =>
    api.patch(`/productos/${id}/disponible`, { disponible }),
  fotos: (id) => api.get(`/productos/${id}/fotos`),
  agregarFotos: (id, formData) => upload(`/productos/${id}/fotos`, formData),
  eliminar: (id) => api.del(`/productos/${id}`),
  detalle: (id) => api.get(`/productos/${id}/detalle`),
  setDetalle: (id, payload) => api.put(`/productos/${id}/detalle`, payload),
};

// ─── REGISTRO DE SUBASTA ─────────────────────────────────────────────────────
// POST  /api/registro-subasta
// GET   /api/registro-subasta/{id}
// GET   /api/registro-subasta/cliente/{id}
// GET   /api/registro-subasta/subasta/{id}
// PATCH /api/registro-subasta/{id}/reembolso
export const RegistroSubasta = {
  crear: (payload) => api.post('/registro-subasta', payload),
  obtener: (id) => api.get(`/registro-subasta/${id}`),
  porCliente: (clienteId) => api.get(`/registro-subasta/cliente/${clienteId}`),
  porSubasta: (subastaId) => api.get(`/registro-subasta/subasta/${subastaId}`),
  pagar: (id, medioPagoId, opts = {}) =>
    api.post(`/registro-subasta/${id}/pagar`, { medioPagoId, ...opts }),
  // El usuario no dispone de los fondos → genera multa del 10% y lo bloquea.
  impago: (id) => api.post(`/registro-subasta/${id}/impago`, {}),
  reembolso: (id, reembolsada) =>
    api.patch(`/registro-subasta/${id}/reembolso`, { reembolsada }),
};

// ─── MULTAS ──────────────────────────────────────────────────────────────────
// GET   /api/multas/{id}
// GET   /api/multas/cliente/{clienteId}          → lista de multas del cliente
// GET   /api/multas/cliente/{clienteId}/estado   → { bloqueado, enJusticia, montoAdeudado, multas }
// PATCH /api/multas/{id}  → { pagada: 'si' | 'no' }
export const Multas = {
  obtener: (id) => api.get(`/multas/${id}`),
  porCliente: (clienteId) => api.get(`/multas/cliente/${clienteId}`),
  estadoSancion: (clienteId) => api.get(`/multas/cliente/${clienteId}/estado`),
  pagar: (id) => api.patch(`/multas/${id}`, { pagada: 'si' }),
};

// ─── SEGUROS ─────────────────────────────────────────────────────────────────
// GET  /api/seguros/{nroPoliza}
// POST /api/seguros
// PUT  /api/seguros/{nroPoliza}
export const Seguros = {
  obtener: (nroPoliza) => api.get(`/seguros/${nroPoliza}`),
  crear: (payload) => api.post('/seguros', payload),
  actualizar: (nroPoliza, payload) => api.put(`/seguros/${nroPoliza}`, payload),
  polizaProducto: (productoId) => api.get(`/seguros/producto/${productoId}`),
  aumentar: (nroPoliza, nuevoImporte) =>
    api.patch(`/seguros/${nroPoliza}/aumentar`, { nuevoImporte }),
};

// ─── SUBASTADORES ────────────────────────────────────────────────────────────
// GET  /api/subastadores/{id}
// POST /api/subastadores  → { identificador, matricula?, region? }
export const Subastadores = {
  obtener: (id) => api.get(`/subastadores/${id}`),
  crear: (payload) => api.post('/subastadores', payload),
};

// ─── ADMISIÓN DE ARTÍCULOS ───────────────────────────────────────────────────
// POST  /api/admisiones                         → { productoId, duenioId, declaraPropiedad, declaraOrigen }
// GET   /api/admisiones?estado=solicitada       → panel admin
// GET   /api/admisiones/duenio/{duenioId}       → publicaciones del dueño
// GET   /api/admisiones/pendientes/count
// PATCH /api/admisiones/{id}/inspeccion          → { direccionEnvio }
// PATCH /api/admisiones/{id}/rechazar            → { observacion, gastosDevolucion? }
// PATCH /api/admisiones/{id}/proponer            → { valorBase, comision?, subastaId }
// PATCH /api/admisiones/{id}/aprobar-duenio      → pasa al catálogo
// PATCH /api/admisiones/{id}/rechazar-duenio     → { gastosDevolucion? }
export const Admisiones = {
  crear: (payload) => api.post('/admisiones', payload),
  listar: (estado) => api.get(`/admisiones${estado ? `?estado=${estado}` : ''}`),
  porDuenio: (duenioId) => api.get(`/admisiones/duenio/${duenioId}`),
  contarPendientes: () => api.get('/admisiones/pendientes/count'),
  pedirInspeccion: (id, direccionEnvio) => api.patch(`/admisiones/${id}/inspeccion`, { direccionEnvio }),
  rechazar: (id, observacion, gastosDevolucion) =>
    api.patch(`/admisiones/${id}/rechazar`, { observacion, gastosDevolucion }),
  proponer: (id, valorBase, comision, subastaId) =>
    api.patch(`/admisiones/${id}/proponer`, { valorBase, comision, subastaId }),
  aprobarDuenio: (id) => api.patch(`/admisiones/${id}/aprobar-duenio`, {}),
  rechazarDuenio: (id, gastosDevolucion) =>
    api.patch(`/admisiones/${id}/rechazar-duenio`, { gastosDevolucion }),
  crearColeccion: (payload) => api.post('/admisiones/coleccion', payload),
};

// ─── PAYOUTS (cobros del dueño) ──────────────────────────────────────────────
// GET   /api/payouts/duenio/{duenioId}
// POST  /api/payouts/cuentas                → { duenioId, alias, banco?, pais?, moneda?, esExterior? }
// GET   /api/payouts/cuentas/duenio/{id}
// PATCH /api/payouts/{id}/pagar             → { cuentaId }
export const Payouts = {
  porDuenio: (duenioId) => api.get(`/payouts/duenio/${duenioId}`),
  cuentas: (duenioId) => api.get(`/payouts/cuentas/duenio/${duenioId}`),
  declararCuenta: (payload) => api.post('/payouts/cuentas', payload),
  cobrar: (id, cuentaId) => api.patch(`/payouts/${id}/pagar`, { cuentaId }),
};

// ─── ÍTEMS DE CATÁLOGO ───────────────────────────────────────────────────────
// GET   /api/items/{id}
// PATCH /api/items/{id}/adjudicar  → cierra pujas, marca ganador, crea registro
export const Items = {
  obtener: (id) => api.get(`/items/${id}`),
  adjudicar: (id) => api.patch(`/items/${id}/adjudicar`, {}),
};

// ─── NOTIFICACIONES ──────────────────────────────────────────────────────────
// GET /api/notificaciones/{id}
// GET /api/notificaciones/cliente/{clienteId}
export const Notificaciones = {
  obtener: (id) => api.get(`/notificaciones/${id}`),
  porCliente: (clienteId) => api.get(`/notificaciones/cliente/${clienteId}`),
  marcarLeida: (id) => api.patch(`/notificaciones/${id}/leer`, {}),
};

export default {
  Auth,
  Subastas,
  Pujas,
  Catalogos,
  Asistentes,
  Clientes,
  Personas,
  Productos,
  RegistroSubasta,
  Multas,
  Seguros,
  Notificaciones,
  Subastadores,
  Items,
  Admisiones,
  Payouts,
};
