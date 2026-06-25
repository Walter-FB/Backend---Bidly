// BIDLY — Home, Filtros, Notificaciones (+ shared AuctionCard).
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Header, Title, Sub, SectionLabel, Btn, Chip, Card, Field, LiveBadge, Tag, ImgBox, Display } from '../components/ui';
import { colors } from '../theme/theme';
import { Subastas, Notificaciones } from '../api/endpoints';
import { BASE_URL } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { tituloSubasta, subtituloSubasta, esSubastaFinalizada } from '../utils/subasta';
import { etiquetaTiempoSubasta, esSubastaEnVivo } from '../utils/tiempo';

// Convierte una Subasta del backend al shape que espera AuctionCard.
// Mapea el valor de moneda de la BD ('pesos'/'dolares') al símbolo de pantalla
function simboloMoneda(moneda) {
  return moneda === 'dolares' ? 'U$D' : '$';
}

function mapSubasta(s) {
  return {
    id: s.identificador,
    subastaId: s.identificador,
    title: tituloSubasta(s),
    cat: subtituloSubasta(s),
    puja: s.precioBase ? s.precioBase.toLocaleString('es-AR') : '—',
    ppl: s.totalAsistentes || 0,
    time: etiquetaTiempoSubasta(s),
    estadoSubasta: s.estadoSubasta,
    fase: s.fase,
    fechaInicioReal: s.fechaInicioReal,
    segundosRestantes: s.segundosRestantes,
    totalItems: s.totalItems,
    itemsPendientes: s.itemsPendientes,
    lead: false,
    estado: s.estado,
    moneda: s.moneda || 'pesos',
    simbolo: simboloMoneda(s.moneda),
    portadaUrl: `${BASE_URL}/subastas/${s.identificador}/portada`,
    ubicacion: s.ubicacion,
    subastador: s.subastador,
    fecha: s.fecha,
    hora: s.hora,
  };
}

// ─── HOME TOP BAR ─────────────────────────────────────────────────────────────
function HomeTopBar({ navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.topbar, { paddingTop: insets.top + 8 }]}>
      <Display style={{ color: colors.blueLogo, fontSize: 20 }}>BIDLY</Display>
      <TouchableOpacity onPress={() => navigation.navigate('Notificaciones')}>
        <Ionicons name="notifications-outline" size={21} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

// ─── AUCTION CARD ─────────────────────────────────────────────────────────────
export function AuctionCard({ a, onPress }) {
  const viva = esSubastaEnVivo(a);
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
              <Text style={{ color: colors.green, fontSize: 20, fontWeight: '800' }}>
                {a.simbolo || '$'} {a.puja}
              </Text>
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
          <Text style={{ color: colors.gold, fontSize: 13, fontWeight: '800' }}>{a.time}</Text>
        </View>
        {a.lead
          ? <Tag label="✓ Liderando" color={colors.green} fill={colors.green} />
          : <Btn title="Ver subasta" onPress={onPress} style={{ paddingVertical: 9, paddingHorizontal: 18 }} />}
      </View>
    </Card>
  );
}

// ─── HOME SCREEN ─────────────────────────────────────────────────────────────
export function HomeScreen({ navigation }) {
  const [tab, setTab] = useState('vivo');
  const [subastas, setSubastas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtros, setFiltros] = useState({});

  const cargarSubastas = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const resultado = await Subastas.listar(params);
      setSubastas((resultado || []).map(mapSubasta));
    } catch (e) {
      setError(e.message || 'No se pudieron cargar las subastas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const estadoParam = tab === 'vivo' ? 'abierta' : tab === 'term' ? 'cerrada' : undefined;
    cargarSubastas({ ...(estadoParam ? { estado: estadoParam } : {}), ...filtros });
  }, [tab, filtros, cargarSubastas]);

  // En tab En vivo, refrescar detalle para fase y timer correctos.
  useEffect(() => {
    if (tab !== 'vivo' || subastas.length === 0) return;
    let cancelled = false;
    const refreshDetalle = async () => {
      try {
        const detalles = await Promise.all(
          subastas.map((a) => Subastas.obtener(a.id).catch(() => null))
        );
        if (cancelled) return;
        setSubastas((prev) => prev.map((a, i) => {
          const det = detalles[i];
          return det ? mapSubasta(det) : a;
        }));
      } catch { /* silencioso */ }
    };
    refreshDetalle();
    const id = setInterval(refreshDetalle, 15000);
    return () => { cancelled = true; clearInterval(id); };
  }, [tab, subastas.length]);

  // Recibir filtros aplicados desde FiltrosScreen
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      const params = navigation.getState?.()?.routes?.slice(-1)?.[0]?.params;
      if (params?.filtrosAplicados) {
        setFiltros(params.filtrosAplicados);
      }
    });
    return unsubscribe;
  }, [navigation]);

  const subrastasFiltradas = subastas.filter((a) => {
    if (tab === 'vivo') return esSubastaEnVivo(a);
    if (tab === 'term') return esSubastaFinalizada(a);
    return true;
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <HomeTopBar navigation={navigation} />
      <View style={{ paddingHorizontal: 22, paddingTop: 12 }}>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <TouchableOpacity
            style={s.search}
            onPress={() => Alert.alert('Próximamente', 'La búsqueda estará disponible en una próxima versión.')}
            activeOpacity={0.7}
          >
            <Ionicons name="search" size={18} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 14 }}>Buscar subastas, categorías…</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Filtros', { filtrosActuales: filtros })} style={s.filterBtn}>
            <Ionicons name="options-outline" size={20} color="#fff" /></TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }}>
          <View style={{ flexDirection: 'row', gap: 9 }}>
            <Chip label="Todas" active={tab === 'todas'} onPress={() => setTab('todas')} />
            <Chip label="En vivo" active={tab === 'vivo'} dot onPress={() => setTab('vivo')} />
            <Chip label="Terminadas" active={tab === 'term'} onPress={() => setTab('term')} />
          </View>
        </ScrollView>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 22, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        onRefresh={undefined}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <Display style={{ fontSize: 18 }}>
            {tab === 'vivo' ? 'En vivo' : tab === 'term' ? 'Finalizadas' : 'Todas'} · {subrastasFiltradas.length}
          </Display>
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
            {subrastasFiltradas.length === 0 ? (
              <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 30 }}>
                No hay subastas disponibles.
              </Text>
            ) : (
              subrastasFiltradas.map((a) => (
                <AuctionCard
                  key={a.id}
                  a={a}
                  onPress={() => navigation.navigate('Producto', { subastaId: a.id, subasta: a })}
                />
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
  const [mon, setMon] = useState(filtrosActuales.moneda || 'pesos');

  const aplicar = () => {
    const filtros = {};
    if (estado) filtros.estado = estado;
    if (cat) filtros.categoria = cat;
    if (mon) filtros.moneda = mon;
    navigation.navigate('Home', { filtrosAplicados: filtros });
  };

  const limpiar = () => {
    setEstado('abierta');
    setCat('');
    setMon('pesos');
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
        <SectionLabel>Moneda</SectionLabel>
        <View style={{ flexDirection: 'row', gap: 9 }}>
          <Chip label="Todas" active={mon === ''} onPress={() => setMon('')} />
          <Chip label="Pesos $" active={mon === 'pesos'} dot={mon === 'pesos'} onPress={() => setMon('pesos')} />
          <Chip label="Dólares U$D" active={mon === 'dolares'} dot={mon === 'dolares'} onPress={() => setMon('dolares')} />
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
export function NotificacionesScreen() {
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

  const mapNotif = (n, i) => ({
    key: n.identificador ?? i,
    t: n.tipo || 'Notificación',
    d: n.mensaje || '',
    a: n.fechaHora ? new Date(n.fechaHora).toLocaleString('es-AR') : '',
    unread: n.leida === false || n.leida === 'no',
  });

  const lista = notifs.map(mapNotif);

  return (
    <Screen scroll contentStyle={{ paddingHorizontal: 22 }}>
      <Header />
      <Title>Notificaciones</Title>
      {loading && <ActivityIndicator color={colors.blue} style={{ marginTop: 20 }} />}
      {!loading && lista.length === 0 && (
        <Text style={{ color: colors.muted, marginTop: 20, textAlign: 'center' }}>Sin notificaciones.</Text>
      )}
      <View style={{ gap: 12, marginTop: 8 }}>
        {lista.map((n) => (
          <Card key={n.key} el={n.unread} style={{ opacity: n.unread ? 1 : 0.7 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={s.notifIcon}><Ionicons name="notifications-outline" size={18} color={colors.blue} /></View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Display style={{ fontSize: 13.5, flex: 1 }}>{n.t}</Display>
                  {n.unread && <View style={{ width: 8, height: 8, borderRadius: 8, backgroundColor: colors.blue, marginTop: 3 }} />}
                </View>
                <Text style={{ color: colors.muted, fontSize: 13, marginVertical: 4, lineHeight: 18 }}>{n.d}</Text>
                <Text style={{ color: colors.faint, fontSize: 11.5 }}>{n.a}</Text>
              </View>
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}


const s = StyleSheet.create({
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingBottom: 4 },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingVertical: 12, paddingHorizontal: 14 },
  filterBtn: { width: 46, height: 46, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1,
    borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  notifIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' },
});
