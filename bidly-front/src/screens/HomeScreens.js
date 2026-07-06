// BIDLY — Home, Filtros, Notificaciones (+ shared AuctionCard).
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Header, Title, SectionLabel, Btn, Chip, Card, LiveBadge, Tag, ImgBox, Display } from '../components/ui';
import { colors } from '../theme/theme';
import { Subastas, Notificaciones } from '../api/endpoints';
import { BASE_URL } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNotifBadge } from '../hooks/useNotifBadge';
import { tituloSubasta, subtituloSubasta, esSubastaFinalizada, esSubastaProxima } from '../utils/subasta';
import { etiquetaTiempoSubasta, esSubastaEnVivo, formatDuracion } from '../utils/tiempo';

// Texto sin acentos/mayúsculas, para comparar en la búsqueda.
function normalizar(texto) {
  return (texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Convierte una Subasta del backend al shape que espera AuctionCard.
function mapSubasta(s) {
  return {
    id: s.identificador,
    subastaId: s.identificador,
    title: tituloSubasta(s),
    cat: subtituloSubasta(s),
    puja: s.precioBase ? Number(s.precioBase).toLocaleString('es-AR') : '—',
    ppl: s.totalAsistentes || 0,
    time: etiquetaTiempoSubasta(s),
    segundosRestantes: s.segundosRestantes,
    totalItems: s.totalItems,
    itemsPendientes: s.itemsPendientes,
    estado: s.estado,
    simbolo: '$',
    portadaUrl: `${BASE_URL}/subastas/${s.identificador}/portada`,
    ubicacion: s.ubicacion,
    subastador: s.subastador,
    fecha: s.fecha,
    hora: s.hora,
    categoria: s.categoria,
  };
}

// ─── HOME TOP BAR ─────────────────────────────────────────────────────────────
function HomeTopBar({ navigation, onBlocked }) {
  const insets = useSafeAreaInsets();
  const { unreadCount } = useNotifBadge();
  const { user } = useAuth();
  return (
    <View style={[s.topbar, { paddingTop: insets.top + 8 }]}>
      <Display style={{ color: colors.blueLogo, fontSize: 20 }}>BIDLY</Display>
      <TouchableOpacity onPress={() => (user?.isGuest ? onBlocked?.() : navigation.navigate('Notificaciones'))}>
        <View>
          <Ionicons name="notifications-outline" size={21} color="#fff" />
          {unreadCount > 0 && (
            <View style={s.badge}><Text style={s.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}

// Countdown que tickea localmente entre cada refetch de la lista (el server
// solo manda segundosRestantes cada tanto; acá lo bajamos de a 1s para que se
// vea "vivo" sin tener que pollear el detalle de cada subasta).
function useCountdown(segundosRestantes) {
  const [restante, setRestante] = useState(segundosRestantes);
  useEffect(() => {
    setRestante(segundosRestantes);
  }, [segundosRestantes]);
  useEffect(() => {
    if (restante == null || restante <= 0) return;
    const id = setInterval(() => setRestante((r) => (r == null ? r : Math.max(0, r - 1))), 1000);
    return () => clearInterval(id);
  }, [restante == null]);
  return restante;
}

// ─── AUCTION CARD ─────────────────────────────────────────────────────────────
export function AuctionCard({ a, onPress }) {
  const viva = esSubastaEnVivo(a);
  const restante = useCountdown(a.segundosRestantes);
  const tiempoLabel = viva && restante != null ? formatDuracion(restante) : a.time;
  return (
    <Card el style={{ padding: 14 }}>
      {viva && <LiveBadge style={{ marginBottom: 10 }} />}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <ImgBox style={{ width: 74, height: 74 }} size={26} src={a.portadaUrl} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Display style={{ fontSize: 15 }} numberOfLines={1}>{a.title}</Display>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{a.cat}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 8 }}>
            <Text>
              <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '700' }}>PUJA </Text>
              <Text style={{ color: colors.green, fontSize: 20, fontWeight: '800' }}>{a.simbolo || '$'} {a.puja}</Text>
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="person-outline" size={13} color={colors.muted} />
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>{a.ppl}</Text>
            </View>
          </View>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Ionicons name="time-outline" size={14} color={colors.gold} />
          <Text style={{ color: colors.gold, fontSize: 13, fontWeight: '800' }}>{tiempoLabel}</Text>
        </View>
        <Btn title="Ver subasta" onPress={onPress} style={{ paddingVertical: 9, paddingHorizontal: 18 }} />
      </View>
    </Card>
  );
}

// ─── HOME SCREEN ─────────────────────────────────────────────────────────────
export function HomeScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState('vivo');
  const [subastas, setSubastas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtros, setFiltros] = useState({});
  const [busqueda, setBusqueda] = useState('');

  const cargarSubastas = useCallback(async (params = {}, silencioso = false) => {
    if (!silencioso) setLoading(true);
    setError(null);
    try {
      const resultado = await Subastas.listar(params);
      setSubastas((resultado || []).map(mapSubasta));
    } catch (e) {
      if (!silencioso) setError(e.message || 'No se pudieron cargar las subastas.');
    } finally {
      if (!silencioso) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const estadoParam = tab === 'vivo' ? 'abierta' : (tab === 'term' || tab === 'prox') ? 'cerrada' : undefined;
    cargarSubastas({ ...(estadoParam ? { estado: estadoParam } : {}), ...filtros });
  }, [tab, filtros, cargarSubastas]);

  // Resincroniza el reloj del remate (y detecta adjudicaciones/próximo ítem)
  // mientras se está viendo la tab "En vivo".
  useEffect(() => {
    if (tab !== 'vivo') return;
    const id = setInterval(() => {
      cargarSubastas({ estado: 'abierta', ...filtros }, true);
    }, 8000);
    return () => clearInterval(id);
  }, [tab, filtros, cargarSubastas]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      const params = navigation.getState?.()?.routes?.slice(-1)?.[0]?.params;
      if (params?.filtrosAplicados) setFiltros(params.filtrosAplicados);
    });
    return unsubscribe;
  }, [navigation]);

  const query = normalizar(busqueda);
  const subastasFiltradas = subastas.filter((a) => {
    if (tab === 'vivo' && !esSubastaEnVivo(a)) return false;
    if (tab === 'prox' && !esSubastaProxima(a)) return false;
    if (tab === 'term' && !esSubastaFinalizada(a)) return false;
    if (!query) return true;
    const texto = normalizar([a.title, a.cat, a.categoria, a.ubicacion].filter(Boolean).join(' '));
    return texto.includes(query);
  });

  const tituloTab = { vivo: 'En vivo', prox: 'Próximas', term: 'Finalizadas', todas: 'Todas' };

  // Modo visita: el invitado solo ve el listado. Abrir una subasta (o cualquier otra
  // acción) lo empuja a crear cuenta.
  const bloquearInvitado = () => {
    Alert.alert(
      'Necesitás una cuenta',
      'Como invitado solo podés ver el listado de subastas. Creá una cuenta para abrir una subasta, pujar y participar.',
      [{ text: 'Cancelar', style: 'cancel' }, { text: 'Crear cuenta', onPress: logout }],
    );
  };
  const abrirSubasta = (a) => {
    if (user?.isGuest) return bloquearInvitado();
    navigation.navigate('Producto', { subastaId: a.id, subasta: a });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <HomeTopBar navigation={navigation} onBlocked={bloquearInvitado} />
      <View style={{ paddingHorizontal: 22, paddingTop: 12 }}>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <View style={s.search}>
            <Ionicons name="search" size={18} color={colors.muted} />
            <TextInput
              value={busqueda}
              onChangeText={setBusqueda}
              placeholder="Buscar subastas, categorías…"
              placeholderTextColor={colors.muted}
              style={{ flex: 1, color: '#fff', fontSize: 14, paddingVertical: 0 }}
              returnKeyType="search"
            />
            {busqueda.length > 0 && (
              <TouchableOpacity onPress={() => setBusqueda('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.muted} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Filtros', { filtrosActuales: filtros })} style={s.filterBtn}>
            <Ionicons name="options-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }}>
          <View style={{ flexDirection: 'row', gap: 9 }}>
            <Chip label="Todas" active={tab === 'todas'} onPress={() => setTab('todas')} />
            <Chip label="En vivo" active={tab === 'vivo'} dot onPress={() => setTab('vivo')} />
            <Chip label="Próximas" active={tab === 'prox'} onPress={() => setTab('prox')} />
            <Chip label="Terminadas" active={tab === 'term'} onPress={() => setTab('term')} />
          </View>
        </ScrollView>
      </View>
      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <Display style={{ fontSize: 18 }}>{tituloTab[tab] || 'Todas'} · {subastasFiltradas.length}</Display>
          <Text style={{ color: colors.muted, fontSize: 13 }}>Más recientes ↓</Text>
        </View>

        {loading && (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator color={colors.blue} />
            <Text style={{ color: colors.muted, marginTop: 10 }}>Cargando subastas…</Text>
          </View>
        )}

        {!loading && error && (
          <Card el style={{ padding: 18, alignItems: 'center', gap: 10 }}>
            <Ionicons name="cloud-offline-outline" size={32} color={colors.muted} />
            <Text style={{ color: colors.muted, textAlign: 'center' }}>{error}</Text>
            <Btn title="Reintentar" onPress={() => cargarSubastas()} style={{ marginTop: 4 }} />
          </Card>
        )}

        {!loading && !error && (
          <View style={{ gap: 14 }}>
            {subastasFiltradas.length === 0 ? (
              <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 30 }}>
                {query ? `Sin resultados para "${busqueda}".` : 'No hay subastas disponibles.'}
              </Text>
            ) : (
              subastasFiltradas.map((a) => (
                <AuctionCard key={a.id} a={a} onPress={() => abrirSubasta(a)} />
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── FILTROS SCREEN ───────────────────────────────────────────────────────────
export function FiltrosScreen({ navigation, route }) {
  const filtrosActuales = route.params?.filtrosActuales || {};
  const [estado, setEstado] = useState(filtrosActuales.estado || 'abierta');
  const [cat, setCat] = useState(filtrosActuales.categoria || '');

  const aplicar = () => {
    const filtros = {};
    if (estado) filtros.estado = estado;
    if (cat) filtros.categoria = cat;
    navigation.navigate('Home', { filtrosAplicados: filtros });
  };

  const limpiar = () => {
    setEstado('abierta');
    setCat('');
    navigation.navigate('Home', { filtrosAplicados: {} });
  };

  return (
    <Screen>
      <Header right={<Display style={{ color: colors.blueLogo, fontSize: 19 }}>BIDLY</Display>} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        <Title>Filtros</Title>
        <SectionLabel style={{ marginTop: 8 }}>Estado</SectionLabel>
        <View style={{ flexDirection: 'row', gap: 9 }}>
          {[['abierta', 'En vivo'], ['', 'Todas'], ['cerrada', 'Finalizadas']].map(([k, l]) => (
            <Chip key={k} label={l} active={estado === k} dot={estado === k && k === 'abierta'} onPress={() => setEstado(k)} />
          ))}
        </View>
        <SectionLabel>Categoría</SectionLabel>
        <View style={{ flexDirection: 'row', gap: 9, flexWrap: 'wrap' }}>
          {[['', 'Todas'], ['comun', 'Común'], ['especial', 'Especial'], ['plata', 'Plata'], ['oro', 'Oro'], ['platino', 'Platino']].map(([k, l]) => (
            <Chip key={k || 'todas'} label={l} active={cat === k} onPress={() => setCat(k)} />
          ))}
        </View>
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 22, paddingBottom: 28, paddingTop: 14 }}>
        <Btn title="Limpiar" kind="ghost" onPress={limpiar} style={{ flex: 1 }} />
        <Btn title="Aplicar" onPress={aplicar} style={{ flex: 1 }} />
      </View>
    </Screen>
  );
}

// ─── NOTIFICACIONES SCREEN ────────────────────────────────────────────────────
export function NotificacionesScreen({ navigation }) {
  const { user } = useAuth();
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.clienteId) { setLoading(false); return; }
    Notificaciones.porCliente(user.clienteId)
      .then((data) => setNotifs(Array.isArray(data) ? data : data ? [data] : []))
      .catch(() => setNotifs([]))
      .finally(() => setLoading(false));
  }, [user]);

  const tocar = async (n) => {
    if ((n.leida === false || n.leida === 'no') && n.identificador) {
      Notificaciones.marcarLeida(n.identificador).catch(() => {});
      setNotifs((prev) => prev.map((x) => x.identificador === n.identificador ? { ...x, leida: 'si' } : x));
    }
  };

  return (
    <Screen scroll contentStyle={{ paddingHorizontal: 22 }}>
      <Header />
      <Title>Notificaciones</Title>
      {loading && <ActivityIndicator color={colors.blue} style={{ marginTop: 20 }} />}
      {!loading && notifs.length === 0 && (
        <Text style={{ color: colors.muted, marginTop: 20, textAlign: 'center' }}>Sin notificaciones.</Text>
      )}
      <View style={{ gap: 12, marginTop: 8 }}>
        {notifs.map((n, i) => {
          const unread = n.leida === false || n.leida === 'no';
          return (
            <TouchableOpacity key={n.identificador ?? i} activeOpacity={0.82} onPress={() => tocar(n)}>
              <Card el={unread} style={{ opacity: unread ? 1 : 0.7, flexDirection: 'row', gap: 12 }}>
                <View style={s.notifIcon}><Ionicons name={iconoNotif(n.tipo)} size={18} color={colors.blue} /></View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Display style={{ fontSize: 13.5, flex: 1 }}>{tipoLabel(n.tipo)}</Display>
                    {unread && <View style={{ width: 8, height: 8, borderRadius: 8, backgroundColor: colors.red, marginTop: 3 }} />}
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 13, marginVertical: 4, lineHeight: 18 }}>{n.mensaje}</Text>
                  <Text style={{ color: colors.faint, fontSize: 11.5 }}>
                    {n.fechahora ? new Date(n.fechahora).toLocaleString('es-AR') : ''}
                  </Text>
                </View>
              </Card>
            </TouchableOpacity>
          );
        })}
      </View>
    </Screen>
  );
}

function tipoLabel(tipo) {
  const l = {
    ganaste: '¡Ganaste una subasta!', multa: 'Multa generada', admision: 'Admisión de tu bien',
    seguro: 'Seguro contratado', payout: 'Cobro disponible', medio_pago: 'Medio de pago', retiro: 'Retiro personal',
  };
  return l[tipo] || tipo || 'Notificación';
}
function iconoNotif(tipo) {
  const i = {
    ganaste: 'trophy-outline', multa: 'warning-outline', admision: 'cube-outline',
    seguro: 'shield-checkmark-outline', payout: 'cash-outline', medio_pago: 'card-outline',
  };
  return i[tipo] || 'notifications-outline';
}

const s = StyleSheet.create({
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingBottom: 4 },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingVertical: 12, paddingHorizontal: 14 },
  filterBtn: { width: 46, height: 46, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1,
    borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  notifIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -5, right: -7, minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
});
