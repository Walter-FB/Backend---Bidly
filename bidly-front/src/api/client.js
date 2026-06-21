// BIDLY — HTTP client with JWT (AsyncStorage) for Spring Boot backend.
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Base URL of the Spring Boot API.
// Android emulator reaches host machine via 10.0.2.2; iOS simulator via localhost.
// Override here or via app.json -> expo.extra.apiBaseUrl.
export const BASE_URL =
  (Constants?.expoConfig?.extra?.apiBaseUrl) || 'http://backend-bidly.up.railway.app/api';

const TOKEN_KEY = '@bidly_token';

export async function getToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}
export async function setToken(token) {
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

// Core request helper. Adds Authorization: Bearer <jwt> when present.
export async function request(path, { method = 'GET', body, auth = true, headers = {} } = {}) {
  const token = auth ? await getToken() : null;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message = (data && (data.message || data.error)) || `HTTP ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// Multipart upload — no fija Content-Type para que fetch añada el boundary automáticamente.
export async function upload(path, formData) {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = (data && (data.message || data.error)) || `HTTP ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  get: (p, opts) => request(p, { ...opts, method: 'GET' }),
  post: (p, body, opts) => request(p, { ...opts, method: 'POST', body }),
  put: (p, body, opts) => request(p, { ...opts, method: 'PUT', body }),
  patch: (p, body, opts) => request(p, { ...opts, method: 'PATCH', body }),
  del: (p, opts) => request(p, { ...opts, method: 'DELETE' }),
};

export default api;
