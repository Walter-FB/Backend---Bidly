import { useState, useEffect } from 'react';
import { Notificaciones } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';

// Solo el contador del badge. El aviso "llegó algo nuevo" (banner + vibración) lo
// maneja el toaster global (NotifToaster), así no se duplica la vibración.
const isUnread = (n) => n.leida === false || n.leida === 'no';

export function useNotifBadge() {
  const { user } = useAuth();
  const [notifs, setNotifs] = useState([]);

  const refresh = async () => {
    if (!user?.clienteId) return;
    try {
      const data = await Notificaciones.porCliente(user.clienteId);
      const list = Array.isArray(data) ? data : data ? [data] : [];
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
