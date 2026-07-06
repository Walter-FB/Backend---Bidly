// BIDLY — Toaster global de notificaciones.
// Muestra un banner arriba de CUALQUIER pantalla cuando llega una notificación
// nueva (ganaste, multa, cobro, admisión…), así no se pierde aunque te hayas ido
// de la subasta. Sondea por polling; toca para ir a Notificaciones.
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, Vibration } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { Notificaciones } from '../api/endpoints';
import { navegar } from '../navigation/navRef';

const isUnread = (n) => n?.leida === false || n?.leida === 'no';
const nid = (n) => Number(n?.identificador ?? n?.id ?? 0);

const LABEL = {
  ganaste: '¡Ganaste una subasta!', multa: 'Multa generada', admision: 'Novedad de tu bien',
  seguro: 'Seguro contratado', payout: 'Cobro disponible', medio_pago: 'Medio de pago',
  retiro: 'Retiro personal', reembolso: 'Reembolso', pago: 'Compra pagada',
};
const ICON = {
  ganaste: 'trophy-outline', multa: 'warning-outline', admision: 'cube-outline',
  seguro: 'shield-checkmark-outline', payout: 'cash-outline', medio_pago: 'card-outline',
  retiro: 'walk-outline', reembolso: 'cash-outline', pago: 'checkmark-circle-outline',
};
const ACCENT = {
  ganaste: colors.gold, multa: colors.red, payout: colors.green, reembolso: colors.green,
  seguro: colors.blue, pago: colors.green,
};

export default function NotifToaster() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(null);

  const anim = useRef(new Animated.Value(0)).current;
  const lastSeenId = useRef(null);     // mayor id ya "visto" (baseline)
  const initialized = useRef(false);   // baseline tomado tras el login
  const hideTimer = useRef(null);
  const queue = useRef([]);

  const dismiss = useCallback(() => {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
    Animated.timing(anim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
      const next = queue.current.shift();
      if (next) mostrar(next);
      else setCurrent(null);
    });
  }, [anim]); // eslint-disable-line react-hooks/exhaustive-deps

  const mostrar = useCallback((n) => {
    setCurrent(n);
    anim.setValue(0);
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 8, tension: 70 }).start();
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(dismiss, 4800);
  }, [anim, dismiss]);

  // Reset al cambiar de usuario / cerrar sesión.
  useEffect(() => {
    lastSeenId.current = null;
    initialized.current = false;
    queue.current = [];
    setCurrent(null);
  }, [user?.clienteId]);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      if (!user?.clienteId || user?.isGuest) return;
      try {
        const data = await Notificaciones.porCliente(user.clienteId);
        const list = Array.isArray(data) ? data : data ? [data] : [];
        const maxId = list.length ? Math.max(...list.map(nid)) : 0;
        // Primera lectura tras el login: fija baseline y no muestra nada viejo.
        if (!initialized.current) { lastSeenId.current = maxId; initialized.current = true; return; }
        const nuevos = list
          .filter((n) => nid(n) > lastSeenId.current && isUnread(n))
          .sort((a, b) => nid(a) - nid(b));
        if (nuevos.length && alive) {
          lastSeenId.current = Math.max(lastSeenId.current, ...nuevos.map(nid));
          Vibration.vibrate(200);
          const [primero, ...resto] = nuevos;
          queue.current.push(...resto);
          mostrar(primero);
        } else {
          lastSeenId.current = Math.max(lastSeenId.current, maxId);
        }
      } catch { /* silencioso */ }
    };
    poll();
    const id = setInterval(poll, 7000);
    return () => { alive = false; clearInterval(id); if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [user?.clienteId, user?.isGuest, mostrar]);

  if (!current) return null;

  const tipo = current.tipo;
  const titulo = LABEL[tipo] || 'Notificación';
  const icono = ICON[tipo] || 'notifications-outline';
  const acc = ACCENT[tipo] || colors.blue;
  const mensaje = current.mensaje || '';

  const onPress = () => { dismiss(); navegar('Notificaciones'); };

  return (
    <View pointerEvents="box-none" style={[st.wrap, { top: insets.top + 8 }]}>
      <Animated.View style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-26, 0] }) }],
      }}>
        <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={[st.card, { borderColor: acc }]}>
          <View style={[st.icon, { backgroundColor: acc + '22' }]}>
            <Ionicons name={icono} size={20} color={acc} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.title} numberOfLines={1}>{titulo}</Text>
            {!!mensaje && <Text style={st.msg} numberOfLines={2}>{mensaje}</Text>}
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, paddingHorizontal: 14, zIndex: 9999, elevation: 24 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.cardEl,
    borderWidth: 1.5, borderRadius: 14, padding: 12,
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
  },
  icon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 14, fontWeight: '800' },
  msg: { color: colors.muted, fontSize: 12.5, marginTop: 2 },
});
