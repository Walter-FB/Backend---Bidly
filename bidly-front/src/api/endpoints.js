// BIDLY — mapa de endpoints hacia el backend FastAPI.
// Núcleo del profe + features: medios de pago (cheques), multas, moneda dual,
// admisiones (tasación + colecciones), cuentas del dueño (payouts), notificaciones.
import api, { setToken, upload } from './client';

// ─── AUTH ────────────────────────────────────────────────────────────────────
export const Auth = {
  login: (email, password) => api.post('/auth/login', { email, password }, { auth: false }),
  register: (payload) => api.post('/auth/register', payload, { auth: false }),
  me: () => api.get('/auth/me'),
  logout: () => setToken(null),
  sendVerification: (email) => api.post('/auth/send-verification', { email }, { auth: false }),
  verifyCode: (email, code) => api.post('/auth/verify-code', { email, code }, { auth: false }),
};

// ─── SUBASTAS ────────────────────────────────────────────────────────────────
export const Subastas = {
  listar: (params = {}) => {
    const q = new URLSearchParams();
    if (params.estado) q.set('estado', params.estado);
    if (params.categoria) q.set('categoria', params.categoria);
    if (params.moneda) q.set('moneda', params.moneda);
    const s = q.toString();
    return api.get(`/subastas${s ? `?${s}` : ''}`);
  },
  obtener: (id) => api.get(`/subastas/${id}`),
  catalogo: (id) => api.get(`/subastas/${id}/catalogo`),
  catalogos: (id) => api.get(`/subastas/${id}/catalogos`),
  estado: (id) => api.get(`/subastas/${id}/estado`),
  asistentes: (id) => api.get(`/subastas/${id}/asistentes`),
  actualizarEstado: (id, estado) => api.patch(`/subastas/${id}/estado`, { estado }),
  crear: (payload) => api.post('/subastas', payload),  // payload incluye moneda ('pesos'|'dolares')
  porSubastador: (subastadorId) => api.get(`/subastadores/${subastadorId}/subastas`),
};

// ─── PUJAS ───────────────────────────────────────────────────────────────────
export const Pujas = {
  porItem: (itemId) => api.get(`/pujos?item=${itemId}`),
  porAsistente: (asistenteId) => api.get(`/pujos?asistente=${asistenteId}`),
  pujar: (asistenteId, itemId, importe) =>
    api.post('/pujos', { asistente: { identificador: asistenteId }, item: { identificador: itemId }, importe }),
  ganador: (itemId) => api.get(`/pujos/${itemId}/ganador`),
};

// ─── CATÁLOGOS ───────────────────────────────────────────────────────────────
export const Catalogos = {
  items: (catalogoId) => api.get(`/catalogos/${catalogoId}/items`),
  crear: (payload) => api.post('/catalogos', payload),
  agregarItem: (catalogoId, payload) => api.post(`/catalogos/${catalogoId}/items`, payload),
};

// ─── ASISTENTES ──────────────────────────────────────────────────────────────
export const Asistentes = {
  obtener: (id) => api.get(`/asistentes/${id}`),
  pujas: (id) => api.get(`/asistentes/${id}/pujos`),
  inscribir: (clienteId, subastaId) => api.post('/asistentes/inscribir', { clienteId, subastaId }),
};

// ─── CLIENTES / PERFIL + MEDIOS DE PAGO ──────────────────────────────────────
export const Clientes = {
  obtener: (id) => api.get(`/clientes/${id}`),
  actualizarCategoria: (id, categoria) => api.patch(`/clientes/${id}/categoria`, { categoria }),
  admitir: (id, admitido) => api.patch(`/clientes/${id}/admitido`, { admitido }),
  pendientes: () => api.get('/clientes/pendientes/lista'),
  metricas: (id) => api.get(`/clientes/${id}/metricas`),
  saldo: (id) => api.get(`/clientes/${id}/saldo`),
  mediosPago: (id) => api.get(`/clientes/${id}/medios-pago`),
  agregarMedioPago: (id, medioPago) => api.post(`/clientes/${id}/medios-pago`, medioPago),
  verificarMedio: (mpId, verificado = 'si') => api.patch(`/clientes/medios-pago/${mpId}/verificar`, { verificado }),
};

// ─── PERSONAS ────────────────────────────────────────────────────────────────
export const Personas = {
  obtener: (id) => api.get(`/personas/${id}`),
  actualizar: (id, datos) => api.put(`/personas/${id}`, datos),
};

// ─── PRODUCTOS + ESTADO ──────────────────────────────────────────────────────
export const Productos = {
  listar: (estado) => api.get(`/productos${estado ? `?estado=${estado}` : ''}`),
  obtener: (id) => api.get(`/productos/${id}`),
  porDuenio: (duenioId) => api.get(`/productos/duenio/${duenioId}`),
  crear: (formData) => upload('/productos', formData),  // multipart: descripción + fotos + declaraPropiedad
  cambiarEstado: (id, estado, causa) => api.patch(`/productos/${id}/estado`, { estado, causa }),
  fotos: (id) => api.get(`/productos/${id}/fotos`),
  agregarFotos: (id, formData) => upload(`/productos/${id}/fotos`, formData),
  eliminar: (id) => api.del(`/productos/${id}`),
};

// ─── REGISTRO DE VENTA + PAGO ────────────────────────────────────────────────
export const RegistroSubasta = {
  crear: (payload) => api.post('/registro-subasta', payload),
  obtener: (id) => api.get(`/registro-subasta/${id}`),
  porCliente: (clienteId) => api.get(`/registro-subasta/cliente/${clienteId}`),
  porSubasta: (subastaId) => api.get(`/registro-subasta/subasta/${subastaId}`),
  pagar: (id, medioPagoId, opts = {}) => api.post(`/registro-subasta/${id}/pagar`, { medioPagoId, ...opts }),
  // El usuario no dispone de los fondos → multa del 10% y bloqueo.
  impago: (id) => api.post(`/registro-subasta/${id}/impago`, {}),
  reembolso: (id, reembolsada) => api.patch(`/registro-subasta/${id}/reembolso`, { reembolsada }),
};

// ─── MULTAS ──────────────────────────────────────────────────────────────────
export const Multas = {
  obtener: (id) => api.get(`/multas/${id}`),
  porCliente: (clienteId) => api.get(`/multas/cliente/${clienteId}`),
  estadoSancion: (clienteId) => api.get(`/multas/cliente/${clienteId}/estado`),
  pagar: (id) => api.patch(`/multas/${id}`, { pagada: 'si' }),
};

// ─── SEGUROS ─────────────────────────────────────────────────────────────────
export const Seguros = {
  obtener: (nroPoliza) => api.get(`/seguros/${nroPoliza}`),
  crear: (payload) => api.post('/seguros', payload),
  actualizar: (nroPoliza, payload) => api.put(`/seguros/${nroPoliza}`, payload),
  polizaProducto: (productoId) => api.get(`/seguros/producto/${productoId}`),
  aumentar: (nroPoliza, nuevoImporte) => api.patch(`/seguros/${nroPoliza}/aumentar`, { nuevoImporte }),
};

// ─── SUBASTADORES ────────────────────────────────────────────────────────────
export const Subastadores = {
  obtener: (id) => api.get(`/subastadores/${id}`),
  crear: (payload) => api.post('/subastadores', payload),
};

// ─── ÍTEMS DE CATÁLOGO ───────────────────────────────────────────────────────
export const Items = {
  obtener: (id) => api.get(`/items/${id}`),
  adjudicar: (id) => api.patch(`/items/${id}/adjudicar`, {}),
};

// ─── ADMISIÓN DE ARTÍCULOS (tasación interna + colecciones) ──────────────────
export const Admisiones = {
  crear: (payload) => api.post('/admisiones', payload),
  listar: (estado) => api.get(`/admisiones${estado ? `?estado=${estado}` : ''}`),
  porDuenio: (duenioId) => api.get(`/admisiones/duenio/${duenioId}`),
  contarPendientes: () => api.get('/admisiones/pendientes/count'),
  pedirInspeccion: (id, direccionEnvio) => api.patch(`/admisiones/${id}/inspeccion`, { direccionEnvio }),
  rechazar: (id, observacion, gastosDevolucion) => api.patch(`/admisiones/${id}/rechazar`, { observacion, gastosDevolucion }),
  proponer: (id, valorBase, comision, subastaId) => api.patch(`/admisiones/${id}/proponer`, { valorBase, comision, subastaId }),
  aprobarDuenio: (id) => api.patch(`/admisiones/${id}/aprobar-duenio`, {}),
  rechazarDuenio: (id, gastosDevolucion) => api.patch(`/admisiones/${id}/rechazar-duenio`, { gastosDevolucion }),
  crearColeccion: (payload) => api.post('/admisiones/coleccion', payload),
};

// ─── PAYOUTS (cobros del dueño) ──────────────────────────────────────────────
export const Payouts = {
  porDuenio: (duenioId) => api.get(`/payouts/duenio/${duenioId}`),
  cuentas: (duenioId) => api.get(`/payouts/cuentas/duenio/${duenioId}`),
  declararCuenta: (payload) => api.post('/payouts/cuentas', payload),
  cobrar: (id, cuentaId) => api.patch(`/payouts/${id}/pagar`, { cuentaId }),
};

// ─── NOTIFICACIONES ──────────────────────────────────────────────────────────
export const Notificaciones = {
  obtener: (id) => api.get(`/notificaciones/${id}`),
  porCliente: (clienteId) => api.get(`/notificaciones/cliente/${clienteId}`),
  marcarLeida: (id) => api.patch(`/notificaciones/${id}/leer`, {}),
};

export default {
  Auth, Subastas, Pujas, Catalogos, Asistentes, Clientes, Personas,
  Productos, RegistroSubasta, Multas, Seguros, Subastadores, Items,
  Admisiones, Payouts, Notificaciones,
};
