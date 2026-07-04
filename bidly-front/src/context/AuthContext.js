// BIDLY — auth state: user + token, persiste ambos en AsyncStorage.
// user shape: { clienteId, email, nombre, categoria, admitido, rol? }
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Auth } from '../api/endpoints';
import { setToken, getToken } from '../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_KEY = '@bidly_user';
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  // Restaurar sesión al arrancar la app en frío.
  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (token) {
          // Validar el token contra el backend. Si expira o el server reinició, limpiamos.
          const data = await Auth.me();
          await AsyncStorage.setItem(USER_KEY, JSON.stringify(data));
          setUser(normalizeUser(data));
        }
      } catch {
        await setToken(null);
        await AsyncStorage.removeItem(USER_KEY);
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await Auth.login(email, password);
    await setToken(data.token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(data));
    const u = normalizeUser(data);
    setUser(u);
    return u;
  }, []);

  const register = useCallback(async (payload) => {
    const data = await Auth.register(payload);
    await setToken(data.token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(data));
    const u = normalizeUser(data);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    await setToken(null);
    await AsyncStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const loginAsGuest = useCallback(() => {
    setUser({ isGuest: true, nombre: 'Invitado', clienteId: null });
  }, []);

  const isAdmin = user?.rol === 'admin';

  return (
    <AuthContext.Provider value={{ user, setUser, booting, login, register, logout, loginAsGuest, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

// Normaliza la respuesta del backend al shape interno de la app.
function normalizeUser(data) {
  return {
    clienteId: data.clienteId,
    email: data.email,
    nombre: data.nombre || '',
    categoria: data.categoria || 'comun',
    admitido: data.admitido || 'no',
    rol: data.rol || null,
  };
}

export default AuthProvider;
