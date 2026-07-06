// BIDLY — HTTP client with JWT (AsyncStorage) for FastAPI backend.
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Siempre HTTPS en Railway. En local: app.json → expo.extra.apiBaseUrl (ej. http://192.168.x.x:8083/api)
export const BASE_URL =
  (Constants?.expoConfig?.extra?.apiBaseUrl) || 'https://backend-bidly.up.railway.app/api';

const TOKEN_KEY = '@bidly_token';
const DEFAULT_TIMEOUT_MS = 60000;

// Reintentos automáticos: celus lentos suelen fallar la 1ra conexión (TLS/DNS frío)
// y Railway se "duerme" (cold start → 502/503). Reintentamos antes de molestar al usuario.
const MAX_RETRIES = 2;              // 2 reintentos extra = 3 intentos en total
const RETRY_BASE_DELAY_MS = 700;    // espera creciente entre intentos (0.7s, 1.4s)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function getToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}
export async function setToken(token) {
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

function buildHttpError(res, data) {
  const message = (data && (data.message || data.error)) || `HTTP ${res.status}`;
  const err = new Error(message);
  err.status = res.status;
  err.data = data;
  return err;
}

// ¿Conviene reintentar este fallo?
// - 502/503/504: el server (Railway) está despertando y NO procesó nada → seguro reintentar, incluso POST.
// - fallo de red / timeout: sólo en lecturas (GET). En escrituras es ambiguo (podría haber
//   llegado igual) y reintentar duplicaría productos/pujas/pagos → no se reintenta.
function isTransient(err, isRead) {
  if (err?.status === 502 || err?.status === 503 || err?.status === 504) return true;
  const netFail = err?.name === 'AbortError' || String(err?.message || '').includes('Network request failed');
  return netFail && isRead;
}

// Un intento de request (sin reintentos). Adds Authorization: Bearer <jwt> when present.
async function attempt(path, { method, body, auth, headers, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const token = auth ? await getToken() : null;
    const hasBody = body !== undefined && body !== null;
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: hasBody ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        if (!res.ok) {
          throw buildHttpError(res, { error: text.slice(0, 120) || `HTTP ${res.status}` });
        }
      }
    }

    if (!res.ok) {
      throw buildHttpError(res, data);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

// Traduce el error crudo al mensaje amigable (misma lógica de siempre).
function toFriendlyError(e) {
  if (e?.status) return e;
  if (e?.name === 'AbortError') {
    const err = new Error(`El servidor tardó en responder (Railway puede estar iniciando). Reintentá en unos segundos.`);
    err.status = 0;
    err.isTimeout = true;
    return err;
  }
  if (String(e?.message || '').includes('Network request failed')) {
    const err = new Error(`Sin conexión al servidor.\n${BASE_URL}`);
    err.status = 0;
    return err;
  }
  const err = new Error(e?.message || 'Error de red desconocido');
  err.status = 0;
  return err;
}

// Core request helper con reintento automático ante fallos transitorios.
export async function request(path, { method = 'GET', body, auth = true, headers = {}, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const isRead = method === 'GET';
  let lastErr;
  for (let i = 0; i <= MAX_RETRIES; i++) {
    try {
      return await attempt(path, { method, body, auth, headers, timeoutMs });
    } catch (e) {
      lastErr = e;
      if (i === MAX_RETRIES || !isTransient(e, isRead)) break;
      await sleep(RETRY_BASE_DELAY_MS * (i + 1));
    }
  }
  throw toFriendlyError(lastErr);
}

export async function upload(path, formData) {
  // Subir archivo es una escritura: sólo reintentamos si Railway respondió 502/503/504
  // (no procesó nada). Ante fallo de red NO reintentamos para no duplicar la subida.
  let lastErr;
  for (let i = 0; i <= MAX_RETRIES; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}${path}`, {
        method: 'POST',
        signal: controller.signal,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const text = await res.text();
      let data = null;
      if (text) {
        try { data = JSON.parse(text); } catch { /* ignore */ }
      }
      if (!res.ok) throw buildHttpError(res, data);
      return data;
    } catch (e) {
      lastErr = e;
      const coldStart = e?.status === 502 || e?.status === 503 || e?.status === 504;
      if (i === MAX_RETRIES || !coldStart) break;
      await sleep(RETRY_BASE_DELAY_MS * (i + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  if (lastErr?.status) throw lastErr;
  if (lastErr?.name === 'AbortError') {
    const err = new Error(`Tiempo de espera al subir archivo. ${BASE_URL}`);
    err.status = 0;
    throw err;
  }
  throw lastErr;
}

// "Toque de despertador": al abrir la app, abre una conexión temprana con Railway para
// que la primera pantalla ya encuentre el server despierto y el TLS/DNS "caliente" en
// celus lentos. Fire-and-forget: no importa la respuesta (hasta un 404 sirve para despertar),
// tragamos cualquier error para no molestar al usuario ni bloquear el arranque.
export async function warmup() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    await fetch(BASE_URL, { method: 'GET', signal: controller.signal });
    clearTimeout(timer);
  } catch {
    /* no-op: es solo para abrir la conexión y despertar Railway */
  }
}

export const api = {
  get: (p, opts) => request(p, { ...opts, method: 'GET' }),
  post: (p, body, opts) => request(p, { ...opts, method: 'POST', body }),
  put: (p, body, opts) => request(p, { ...opts, method: 'PUT', body }),
  patch: (p, body, opts) => request(p, { ...opts, method: 'PATCH', body }),
  del: (p, opts) => request(p, { ...opts, method: 'DELETE' }),
};

export default api;
