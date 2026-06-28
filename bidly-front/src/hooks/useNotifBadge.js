import { useState, useEffect, useRef } from 'react';
import { Vibration } from 'react-native';
import { Notificaciones } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';

const isUnread = (n) => n.leida === false || n.leida === 'no';

export function useNotifBadge() {
  const { user } = useAuth();
  const [notifs, setNotifs] = useState([]);
  const prevCountRef = useRef(null);

  const refresh = async () => {
    if (!user?.clienteId) return;
    try {
      const data = await Notificaciones.porCliente(user.clienteId);
      const list = Array.isArray(data) ? data : data ? [data] : [];
      const unreadCount = list.filter(isUnread).length;
      if (prevCountRef.current !== null && unreadCount > prevCountRef.current) {
        Vibration.vibrate(200);
      }
      prevCountRef.current = unreadCount;
      setNotifs(list);
    } catch { /* silencioso */ }
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, [user?.clienteId]);

  return { unreadCount: notifs.filter(isUnread).length, notifs, refresh };
}
