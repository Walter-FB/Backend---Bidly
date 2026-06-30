// BIDLY — HTTP client with JWT (AsyncStorage) for FastAPI backend.
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Siempre HTTPS en Railway. En local: app.json → expo.extra.apiBaseUrl (ej. http://192.168.x.x:8083/api)
export const BASE_URL =
  (Constants?.expoConfig?.extra?.apiBaseUrl) || 'https://backend-bidly-copy-production.up.railway.app/api';

const TOKEN_KEY = '@bidly_token';
const DEFAULT_TIMEOUT_MS = 60000;

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

// Core request helper. Adds Authorization: Bearer <jwt> when present.
export async function request(path, { method = 'GET', body, auth = true, headers = {}, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
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
  } catch (e) {
    if (e?.status) throw e;
    if (e?.name === 'AbortError') {
      const err = new Error(`El servidor tardó en responder (Railway puede estar iniciando). Reintentá en unos segundos.`);
      err.status = 0;
      err.isTimeout = true;
      throw err;
    }
    if (String(e?.message || '').includes('Network request failed')) {
      const err = new Error(`Sin conexión al servidor.\n${BASE_URL}`);
      err.status = 0;
      throw err;
    }
    const err = new Error(e?.message || 'Error de red desconocido');
    err.status = 0;
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function upload(path, formData) {
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
    if (e?.status) throw e;
    if (e?.name === 'AbortError') {
      const err = new Error(`Tiempo de espera al subir archivo. ${BASE_URL}`);
      err.status = 0;
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timer);
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
