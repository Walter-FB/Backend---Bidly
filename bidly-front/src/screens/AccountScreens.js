// BIDLY — Perfil, MisSubastas, MisCompras, Historial, Publicar, DatosGanador.
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Image, Modal, Animated } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Header, Title, Sub, SectionLabel, Btn, Chip, Card, Field, Tag, ImgBox, BottomBar, Row, Display } from '../components/ui';
import { colors } from '../theme/theme';
import { AuctionCard } from './HomeScreens';
import { useAuth } from '../context/AuthContext';
import { BASE_URL, getToken } from '../api/client';
import { Clientes, Personas, RegistroSubasta, Subastas, Productos, Subastadores, Catalogos, Multas, Admisiones, Payouts, Seguros } from '../api/endpoints';
import { tituloSubasta, subtituloSubasta, formatFechaSubasta, esSubastaFinalizada, esSubastaEnCursoVendedor, esMiSubasta, tagEstadoSubasta } from '../utils/subasta';
import { useNotifBadge } from '../hooks/useNotifBadge';

const COMISION_BIDLY = 0.10;

function irAMisSubastas(navigation, params = {}) {
  navigation.reset({
    index: 0,
    routes: [
      {
        name: 'Main',
        state: {
          index: 3,
          routes: [
            { name: 'Home' },
            { name: 'Historial' },
            { name: 'Publish' },
            { name: 'Subastas', params },
            { name: 'Perfil' },
          ],
        },
      },
    ],
  });
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const CATEGORIAS_LABEL = {
  comun: 'Cliente COMÚN',
  especial: 'Cliente ESPECIAL',
  plata: 'Cliente PLATA',
  oro: 'Cliente ORO',
  platino: 'Cliente PLATINO',
};
const CATEGORIAS_COLOR = {
  comun: colors.muted,
  especial: colors.blue,
  plata: '#8a93ab',
  oro: colors.oro,
  platino: '#b0c4de',
};

// Mapea un RegistroDeSubasta del backend al shape de ListRow.
function mapRegistro(r) {
  const fecha = r.subasta?.fecha
    ? new Date(r.subasta.fecha).toLocaleDateString('es-AR')
    : '—';
  const reembolsada = r.reembolsada === 'si';
  return {
    id: r.identificador,
    title: tituloSubasta(r.subasta),
    date: fecha,
    sub: subtituloSubasta(r.subasta),
    price: r.importe ? Number(r.importe).toLocaleString('es-AR', { maximumFractionDigits: 2 }) : '—',
    tag: reembolsada ? 'Reembolsada' : 'Ganada',
    tagColor: reembolsada ? colors.red : colors.green,
    registroId: r.identificador,
    importe: r.importe,
    comision: r.comision,
    reembolsada: r.reembolsada,
    subastaId: r.subasta?.identificador,
    productoId: r.producto,
    moneda: r.subasta?.moneda || 'pesos',
  };
}

// ─── PERFIL SCREEN ────────────────────────────────────────────────────────────
export function PerfilScreen({ navigation }) {
  const { user, logout, isSubastador } = useAuth();
  const [persona, setPersona] = useState(null);
  const [cliente, setCliente] = useState(null);

  useEffect(() => {
    if (!user?.clienteId) return;
    Promise.all([
      Clientes.obtener(user.clienteId),
      Personas.obtener(user.clienteId),
    ])
      .then(([c, p]) => {
        setCliente(c);
        setPersona(p);
      })
      .catch(() => {});
  }, [user]);

  const nombre = persona?.nombre || user?.nombre || 'Usuario';
  const email = cliente?.email || user?.email || '';
  const categoria = cliente?.categoria || user?.categoria || 'comun';
  const catLabel = CATEGORIAS_LABEL[categoria] || categoria.toUpperCase();
  const catColor = CATEGORIAS_COLOR[categoria] || colors.muted;

  const rows = [
    ['Mis Productos', 'MisProductos'],
    ['Mis publicaciones', 'MisAdmisiones'],
    ['Mis cobros', 'MisCobros'],
    ['Mis métricas', 'MisMetricas'],
    ['Datos personales', 'DatosPersonales'],
    ['Medios de pago', 'MedioPago'],
    ['Mis compras', 'MisCompras'],
    ['Historial', 'Historial'],
    ['Notificaciones', 'Notificaciones'],
  ];

  return (
    <Screen scroll contentStyle={{ paddingHorizontal: 22, paddingBottom: 40 }}>
      <Header />
      <View style={{ alignItems: 'center', marginTop: 6 }}>
        <View style={s.bigAvatar}><Ionicons name="person" size={46} color="#fff" /></View>
        <Display style={{ fontSize: 22, marginTop: 14 }}>{nombre}</Display>
        <Text style={{ color: colors.muted, fontSize: 13.5 }}>{email}</Text>
        <View style={[s.catBadge, { backgroundColor: catColor }]}>
          <Text style={{ color: '#fff', fontSize: 11.5, fontWeight: '800' }}>{catLabel}</Text>
        </View>
      </View>

      <SectionLabel>Cuenta</SectionLabel>
      <View style={{ gap: 10 }}>
        {rows.map(([t, r]) => (
          <TouchableOpacity key={t} style={s.listItem} onPress={() => navigation.navigate(r)}>
            <Text style={{ color: '#fff', fontSize: 14.5, fontWeight: '600' }}>{t}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </TouchableOpacity>
        ))}
        {isSubastador && (
          <TouchableOpacity style={s.listItem} onPress={() => navigation.navigate('DashboardAdmin')}>
            <Text style={{ color: '#fff', fontSize: 14.5, fontWeight: '600' }}>Panel del subastador</Text>
            <Tag label="SUBASTADOR" color={colors.blue} />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={logout} style={{ marginTop: 6, padding: 12, alignItems: 'center' }}>
          <Text style={{ color: colors.red, fontSize: 14, fontWeight: '800' }}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

// ─── LIST ROW ─────────────────────────────────────────────────────────────────
function ListRow({ item }) {
  return (
    <Card el style={{ flexDirection: 'row', gap: 13, alignItems: 'center' }}>
      <ImgBox style={{ width: 58, height: 58 }} size={22} />
      <View style={{ flex: 1 }}>
        <Display style={{ fontSize: 14.5, lineHeight: 17 }}>{item.title}</Display>
        <Text style={{ color: colors.muted, fontSize: 12, marginVertical: 6 }}>
          {item.date}{item.sub ? ` · ${item.sub}` : ''}
        </Text>
        {item.tag ? <Tag label={item.tag} color={item.tagColor} /> : null}
      </View>
      <Display style={{ color: colors.green, fontSize: 18, textAlign: 'right' }}>$ {item.price}</Display>
    </Card>
  );
}

// ─── MIS COMPRAS ─────────────────────────────────────────────────────────────
export function MisComprasScreen({ navigation }) {
  const { user } = useAuth();
  const [tab, setTab] = useState('compras');
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.clienteId) { setLoading(false); return; }
    RegistroSubasta.porCliente(user.clienteId)
      .then((data) => setRegistros((data || []).map(mapRegistro)))
      .catch(() => setRegistros([]))
      .finally(() => setLoading(false));
  }, [user]);

  const filtrados = registros.filter((r) => {
    if (tab === 'reemb') return r.reembolsada === 'si';
    return true;
  });

  return (
    <Screen scroll contentStyle={{ paddingHorizontal: 22 }}>
      <Header />
      <Title>Mis compras</Title>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 12 }}>
        <View style={{ flexDirection: 'row', gap: 9 }}>
          <Chip label="Compras" active={tab === 'compras'} dot={tab === 'compras'} onPress={() => setTab('compras')} />
          <Chip label="Reembolsos" active={tab === 'reemb'} onPress={() => setTab('reemb')} />
        </View>
      </ScrollView>
      {loading && <ActivityIndicator color={colors.blue} style={{ marginTop: 20 }} />}
      {!loading && filtrados.length === 0 && (
        <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 20 }}>Sin registros.</Text>
      )}
      <View style={{ gap: 12 }}>
        {filtrados.map((r) => (
          <TouchableOpacity
            key={r.id}
            onPress={() => navigation.navigate('CompraDetalle', r)}
          >
            <ListRow item={r} />
          </TouchableOpacity>
        ))}
      </View>
    </Screen>
  );
}

// ─── HISTORIAL ────────────────────────────────────────────────────────────────
export function HistorialScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [tab, setTab] = useState('subastas');
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.clienteId) { setLoading(false); return; }
    RegistroSubasta.porCliente(user.clienteId)
      .then((data) => setRegistros((data || []).map(mapRegistro)))
      .catch(() => setRegistros([]))
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <Header right={<Display style={{ color: colors.blueLogo, fontSize: 19 }}>BIDLY</Display>} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <Title>Historial{'\n'}subastas</Title>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 12 }}>
          <View style={{ flexDirection: 'row', gap: 9 }}>
            <Chip label="Subastas" active={tab === 'subastas'} dot={tab === 'subastas'} onPress={() => setTab('subastas')} />
            <Chip label="Reembolsos" active={tab === 'reemb'} onPress={() => setTab('reemb')} />
          </View>
        </ScrollView>
        {loading && <ActivityIndicator color={colors.blue} style={{ marginTop: 20 }} />}
        {!loading && registros.length === 0 && (
          <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 20 }}>Sin historial.</Text>
        )}
        <View style={{ gap: 12 }}>
          {registros
            .filter((r) => tab === 'reemb' ? r.reembolsada === 'si' : true)
            .map((r) => (
              <TouchableOpacity key={r.id} onPress={() => navigation.navigate('CompraDetalle', r)}>
                <ListRow item={r} />
              </TouchableOpacity>
            ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── MIS SUBASTAS ─────────────────────────────────────────────────────────────
function irAGanaste(navigation, g) {
  navigation.navigate('Ganaste', {
    titulo: g.title,
    moneda: g.moneda,
    importe: g.importe,
    comision: g.comision,
    subastaId: g.subastaId,
    itemId: g.productoId,
    registroId: g.registroId,
  });
}

export function MisSubastasScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { user, isSubastador } = useAuth();
  const { unreadCount } = useNotifBadge();
  const [tab, setTab] = useState(route.params?.initialTab || 'curso');
  const [subastas, setSubastas] = useState([]);
  const [ganadas, setGanadas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [sancion, setSancion] = useState(null);

  const cargar = () => {
    if (!user?.clienteId) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      Subastas.porSubastador(user.clienteId),
      RegistroSubasta.porCliente(user.clienteId),
    ])
      .then(([subs, regs]) => {
        setSubastas(subs || []);
        setGanadas((regs || []).map(mapRegistro));
      })
      .catch(() => {
        setSubastas([]);
        setGanadas([]);
      })
      .finally(() => setLoading(false));
    // Estado de sanción (multas pendientes / derivación a la justicia).
    Multas.estadoSancion(user.clienteId)
      .then((e) => setSancion(e && e.bloqueado ? e : null))
      .catch(() => setSancion(null));
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', cargar);
    return unsubscribe;
  }, [navigation, user]);

  useEffect(() => {
    if (!route.params?.creada) return;
    const titulo = route.params.tituloCreada || 'Tu subasta';
    setToast(`"${titulo}" creada correctamente`);
    setTab('todas');
    cargar();
    const clearParams = () => navigation.setParams({ creada: undefined, tituloCreada: undefined });
    const t = setTimeout(() => { setToast(null); clearParams(); }, 3000);
    return () => { clearTimeout(t); clearParams(); };
  }, [route.params?.creada]);

  useEffect(() => {
    if (route.params?.initialTab) setTab(route.params.initialTab);
  }, [route.params?.initialTab]);

  const mias = subastas.filter((a) => esMiSubasta(a, user?.clienteId));
  const ganadasActivas = ganadas.filter((g) => g.reembolsada !== 'si');

  const filtradas = tab === 'ganadas' ? [] : mias.filter((a) => {
    if (tab === 'curso') return esSubastaEnCursoVendedor(a);
    if (tab === 'fin') return esSubastaFinalizada(a);
    return true;
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, height: 52 }}>
        <Display style={{ color: colors.blueLogo, fontSize: 20 }}>BIDLY</Display>
        <TouchableOpacity onPress={() => navigation.navigate('Notificaciones')}>
          <View>
            <Ionicons name="notifications-outline" size={21} color="#fff" />
            {unreadCount > 0 && (
              <View style={s.badge}>
                <Text style={s.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 170 }} showsVerticalScrollIndicator={false}>
        {toast && (
          <View style={s.toastOk}>
            <Ionicons name="checkmark-circle" size={20} color={colors.green} />
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600', flex: 1 }}>{toast}</Text>
          </View>
        )}
        {sancion && (
          <View style={s.sancionBanner}>
            <Ionicons name={sancion.enJusticia ? 'lock-closed' : 'alert-circle'} size={20} color={colors.red} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.red, fontSize: 13.5, fontWeight: '800' }}>
                {sancion.enJusticia ? 'Cuenta suspendida (derivada a la justicia)' : 'Tenés una multa pendiente'}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                {sancion.enJusticia
                  ? 'No podés participar en subastas hasta regularizar el impago.'
                  : `Adeudás $${Number(sancion.montoAdeudado).toLocaleString('es-AR')}. Debés abonarla antes de participar en otra subasta.`}
              </Text>
            </View>
            {!sancion.enJusticia && sancion.multas?.[0] && (
              <TouchableOpacity
                onPress={() => navigation.navigate('Multa', { multaId: sancion.multas[0].identificador })}
                style={{ backgroundColor: colors.red, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9 }}
              >
                <Text style={{ color: '#fff', fontSize: 12.5, fontWeight: '800' }}>Pagar</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        <Title>Mis subastas</Title>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 12 }}>
          <View style={{ flexDirection: 'row', gap: 9 }}>
            <Chip label={`En curso · ${mias.filter(esSubastaEnCursoVendedor).length}`} active={tab === 'curso'} dot={tab === 'curso'} onPress={() => setTab('curso')} />
            <Chip label="Finalizadas" active={tab === 'fin'} onPress={() => setTab('fin')} />
            <Chip label={`Ganadas · ${ganadasActivas.length}`} active={tab === 'ganadas'} dot={tab === 'ganadas'} onPress={() => setTab('ganadas')} />
            <Chip label={`Todas · ${mias.length}`} active={tab === 'todas'} onPress={() => setTab('todas')} />
          </View>
        </ScrollView>
        {loading && <ActivityIndicator color={colors.blue} style={{ marginTop: 20 }} />}
        {!loading && tab === 'ganadas' && ganadas.length === 0 && (
          <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 20 }}>
            Todavía no ganaste ninguna subasta.{'\n'}Cuando ganes, aparecerá acá para pagar.
          </Text>
        )}
        {!loading && tab !== 'ganadas' && filtradas.length === 0 && (
          <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 20 }}>
            {tab === 'curso'
              ? 'No tenés subastas en vivo.\nEl subastador inicia la puja a la fecha y hora programadas.'
              : tab === 'fin'
                ? 'No tenés subastas finalizadas.'
                : isSubastador
                  ? 'Aún no armaste subastas.\nPresioná "Nueva subasta" para comenzar.'
                  : 'Todavía no participaste de subastas.\nOfrecé un bien desde "Publicar" o sumate a una subasta.'}
          </Text>
        )}
        {tab === 'ganadas' && (
          <View style={{ gap: 14 }}>
            {ganadas.map((g) => (
              <TouchableOpacity
                key={g.registroId}
                activeOpacity={0.85}
                onPress={() => (g.reembolsada === 'si'
                  ? navigation.navigate('CompraDetalle', g)
                  : irAGanaste(navigation, g))}
              >
                <Card el style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <ImgBox
                      style={{ width: 64, height: 64, borderRadius: 10 }}
                      size={22}
                      src={g.subastaId ? `${BASE_URL}/subastas/${g.subastaId}/portada` : undefined}
                    />
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Display style={{ fontSize: 15, flex: 1, paddingRight: 8 }} numberOfLines={2}>
                          {g.title}
                        </Display>
                        <Tag
                          label={g.reembolsada === 'si' ? 'Reembolsada' : '¡Ganaste!'}
                          color={g.reembolsada === 'si' ? colors.red : colors.green}
                        />
                      </View>
                      <Text style={{ color: colors.muted, fontSize: 13 }}>
                        {g.sub} · {g.date}
                      </Text>
                      <Text style={{ color: colors.green, fontSize: 14, fontWeight: '800' }}>
                        $ {g.price}
                      </Text>
                      <Text style={{ color: colors.blue, fontSize: 13, fontWeight: '700', marginTop: 2 }}>
                        {g.reembolsada === 'si' ? 'Ver detalle →' : 'Continuar al pago →'}
                      </Text>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {tab !== 'ganadas' && (
        <View style={{ gap: 14 }}>
          {filtradas.map((a) => {
            const tag = tagEstadoSubasta(a);
            return (
            <TouchableOpacity
              key={a.identificador}
              onPress={() => navigation.navigate('SubastaAdmin', { subastaId: a.identificador, subasta: a })}
              activeOpacity={0.85}
            >
              <Card el style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <ImgBox
                    style={{ width: 64, height: 64, borderRadius: 10 }}
                    size={22}
                    src={`${BASE_URL}/subastas/${a.identificador}/portada`}
                  />
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Display style={{ fontSize: 15, flex: 1, paddingRight: 8 }} numberOfLines={2}>
                        {tituloSubasta(a)}
                      </Display>
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <Tag label={tag.label} color={tag.color} />
                      </View>
                    </View>
                    <Text style={{ color: colors.muted, fontSize: 13 }}>
                      {subtituloSubasta(a)} · {formatFechaSubasta(a.fecha)}
                    </Text>
                    {a.totalItems > 1 ? (
                      <Text style={{ color: colors.muted, fontSize: 12 }}>{a.totalItems} ítems en catálogo</Text>
                    ) : null}
                    <Text style={{ color: colors.blue, fontSize: 13, fontWeight: '700', marginTop: 2 }}>
                      Gestionar →
                    </Text>
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
            );
          })}
        </View>
        )}
      </ScrollView>
      {isSubastador && (
        <BottomBar>
          <Btn title="+ Nueva subasta" onPress={() => navigation.navigate('CrearSubasta')} />
        </BottomBar>
      )}
    </View>
  );
}

// ─── CALENDAR PICKER ─────────────────────────────────────────────────────────
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS_CORTOS = ['Lu','Ma','Mi','Ju','Vi','Sa','Do'];

function minFechaSubasta() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatFechaDisplay(ymd) {
  if (!ymd) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${y}`;
}

function CalendarPicker({ value, onChange }) {
  const minDate = minFechaSubasta();
  const hoy = new Date(); hoy.setHours(0,0,0,0);

  const initDate = value ? new Date(value + 'T00:00:00') : minDate;
  const [visible, setVisible] = useState(false);
  const [viewYear, setViewYear] = useState(initDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initDate.getMonth());

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  // Monday-first offset
  const rawFirst = new Date(viewYear, viewMonth, 1).getDay();
  const offset = rawFirst === 0 ? 6 : rawFirst - 1;

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const onSelectDay = (day) => {
    const selected = new Date(viewYear, viewMonth, day);
    if (selected < minDate) return;
    onChange(toYMD(selected));
    setVisible(false);
  };

  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const openCalendar = () => {
    const start = value ? new Date(value + 'T00:00:00') : minDate;
    setViewYear(start.getFullYear());
    setViewMonth(start.getMonth());
    setVisible(true);
  };

  return (
    <>
      <TouchableOpacity style={cs.dateBtn} onPress={openCalendar} activeOpacity={0.8}>
        <Ionicons name="calendar-outline" size={20} color={value ? colors.blue : colors.muted} />
        <Text style={{ color: value ? '#fff' : colors.muted, fontSize: 15, flex: 1 }}>
          {value ? formatFechaDisplay(value) : 'Seleccionar fecha'}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.muted} />
      </TouchableOpacity>
      <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>
        Seleccioná una fecha futura para la subasta.
      </Text>

      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={cs.modalOverlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={cs.calBox} onPress={() => {}}>
            {/* Nav header */}
            <View style={cs.calHeader}>
              <TouchableOpacity onPress={prevMonth} style={cs.calNavBtn}>
                <Ionicons name="chevron-back" size={22} color="#fff" />
              </TouchableOpacity>
              <Text style={cs.calMonthLabel}>{MESES[viewMonth]} {viewYear}</Text>
              <TouchableOpacity onPress={nextMonth} style={cs.calNavBtn}>
                <Ionicons name="chevron-forward" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Day headers */}
            <View style={cs.calRow}>
              {DIAS_CORTOS.map(d => (
                <Text key={d} style={cs.calDayHeader}>{d}</Text>
              ))}
            </View>

            {/* Day grid */}
            <View style={cs.calGrid}>
              {cells.map((day, i) => {
                if (!day) return <View key={`e-${i}`} style={cs.calCell} />;
                const cellDate = new Date(viewYear, viewMonth, day);
                cellDate.setHours(0,0,0,0);
                const isDisabled = cellDate < minDate;
                const isSelected = value === toYMD(cellDate);
                const isHoy = cellDate.getTime() === hoy.getTime();
                return (
                  <TouchableOpacity
                    key={day}
                    style={[
                      cs.calCell,
                      isSelected && cs.calCellSelected,
                      isHoy && !isSelected && cs.calCellHoy,
                    ]}
                    onPress={() => onSelectDay(day)}
                    disabled={isDisabled}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      cs.calDayText,
                      isDisabled && { color: colors.border },
                      isSelected && { color: '#fff', fontWeight: '800' },
                      isHoy && !isSelected && { color: colors.gold },
                    ]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity onPress={() => setVisible(false)} style={{ marginTop: 14, alignItems: 'center' }}>
              <Text style={{ color: colors.muted, fontSize: 14 }}>Cancelar</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ─── TIME SELECTOR ────────────────────────────────────────────────────────────
const HORAS_OPTS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTOS_OPTS = ['00', '15', '30', '45'];

function TimeSelector({ value, onChange }) {
  const [showHour, setShowHour] = useState(false);
  const [showMin, setShowMin] = useState(false);
  const hh = value ? value.split(':')[0] : null;
  const mm = value ? value.split(':')[1] : null;

  const selectHour = (h) => {
    onChange(`${h}:${mm || '00'}`);
    setShowHour(false);
    if (!mm) setTimeout(() => setShowMin(true), 180);
  };

  const selectMin = (m) => {
    if (!hh) { setShowMin(false); setShowHour(true); return; }
    onChange(`${hh}:${m}`);
    setShowMin(false);
  };

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Ionicons name="time-outline" size={18} color={value ? colors.blue : colors.muted} />
        <TouchableOpacity style={cs.timePicker} onPress={() => setShowHour(true)} activeOpacity={0.8}>
          <Text style={[cs.timePickerText, !hh && { color: colors.muted }]}>{hh ?? 'HH'}</Text>
        </TouchableOpacity>
        <Text style={{ color: colors.muted, fontSize: 20, fontWeight: '800' }}>:</Text>
        <TouchableOpacity style={cs.timePicker} onPress={() => setShowMin(true)} activeOpacity={0.8}>
          <Text style={[cs.timePickerText, !mm && { color: colors.muted }]}>{mm ?? 'MM'}</Text>
        </TouchableOpacity>
        {value && <Text style={{ color: colors.muted, fontSize: 13, marginLeft: 2 }}>hs</Text>}
      </View>

      {/* Modal horas */}
      <Modal visible={showHour} transparent animationType="fade" onRequestClose={() => setShowHour(false)}>
        <TouchableOpacity style={cs.modalOverlay} activeOpacity={1} onPress={() => setShowHour(false)}>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <TouchableOpacity activeOpacity={1} style={cs.pickerBox}>
              <Text style={cs.pickerTitle}>Hora</Text>
              <View style={cs.pickerGrid}>
                {HORAS_OPTS.map((h) => (
                  <TouchableOpacity
                    key={h}
                    style={[cs.pickerCell, hh === h && cs.pickerCellActive]}
                    onPress={() => selectHour(h)}
                  >
                    <Text style={cs.pickerCellText}>{h}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal minutos */}
      <Modal visible={showMin} transparent animationType="fade" onRequestClose={() => setShowMin(false)}>
        <TouchableOpacity style={cs.modalOverlay} activeOpacity={1} onPress={() => setShowMin(false)}>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <TouchableOpacity activeOpacity={1} style={cs.pickerBox}>
              <Text style={cs.pickerTitle}>Minutos</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {MINUTOS_OPTS.map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[cs.pickerMinCell, mm === m && cs.pickerCellActive]}
                    onPress={() => selectMin(m)}
                  >
                    <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── CREAR SUBASTA ────────────────────────────────────────────────────────────
const CATS_SUBASTA = ['comun', 'especial', 'plata', 'oro', 'platino'];
const MONEDAS = ['pesos', 'dolares'];

export function CrearSubastaScreen({ navigation, route }) {
  const { user } = useAuth();
  const [paso, setPaso] = useState(1);
  const [f, setF] = useState({
    fecha: '',
    hora: '',
    categoria: 'comun',
    moneda: 'pesos',
    ubicacion: '',
  });
  // Si viene con un producto pre-cargado desde PublicarScreen
  const productoInicial = route.params?.productoId
    ? [{ productoId: route.params.productoId, titulo: route.params.titulo || '', precioBase: '' }]
    : [];
  const [itemsSeleccionados, setItemsSeleccionados] = useState(productoInicial);
  const [loading, setLoading] = useState(false);
  const [exito, setExito] = useState(null);

  // Recibir producto seleccionado desde MisProductosScreen (evita pasar función como param).
  useEffect(() => {
    const prod = route.params?.productoSeleccionado;
    if (!prod) return;
    setItemsSeleccionados((prev) => {
      if (prev.find((i) => i.productoId === prod.identificador)) return prev;
      return [...prev, {
        productoId: prod.identificador,
        titulo: prod.descripcionCatalogo || `Producto #${prod.identificador}`,
        precioBase: '',
      }];
    });
    navigation.setParams({ productoSeleccionado: undefined });
  }, [route.params?.productoSeleccionado]);
  const exitoScale = useRef(new Animated.Value(0.6)).current;
  const exitoOpacity = useRef(new Animated.Value(0)).current;
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  const setItemField = (productoId, campo, valor) => {
    setItemsSeleccionados((prev) =>
      prev.map((i) => (i.productoId === productoId ? { ...i, [campo]: valor } : i))
    );
  };

  const agregarProducto = (prod) => {
    setItemsSeleccionados((prev) => {
      if (prev.find((i) => i.productoId === prod.identificador)) return prev;
      return [...prev, {
        productoId: prod.identificador,
        titulo: prod.descripcionCatalogo || `Producto #${prod.identificador}`,
        precioBase: '',
      }];
    });
  };

  const onSiguiente = () => {
    if (!f.fecha) return Alert.alert('Fecha requerida', 'Seleccioná una fecha en el calendario.');
    if (!f.hora) return Alert.alert('Hora requerida', 'Ingresá la hora de inicio.');
    if (!f.ubicacion.trim()) return Alert.alert('Ubicación requerida', 'Completá la dirección.');
    setPaso(2);
  };

  const animarExitoYRedirigir = (subasta, titulo) => {
    setExito({ id: subasta.identificador, titulo });
    exitoScale.setValue(0.6);
    exitoOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(exitoScale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
      Animated.timing(exitoOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
    setTimeout(() => {
      try {
        irAMisSubastas(navigation, { creada: subasta.identificador, tituloCreada: titulo });
      } catch {
        navigation.goBack();
      }
    }, 1600);
  };

  const onCrear = async () => {
    // Los ítems son opcionales: el subastador puede crear la subasta vacía y
    // luego asignarle los bienes admitidos desde la pestaña "Admisiones".
    const conItems = itemsSeleccionados.length > 0;
    if (conItems) {
      const sinPrecio = itemsSeleccionados.find((i) => !String(i.precioBase).trim() || parseFloat(i.precioBase) <= 0 || isNaN(parseFloat(i.precioBase)));
      if (sinPrecio) {
        return Alert.alert('Precio faltante', 'Completá el precio base de cada producto con un valor mayor a 0.');
      }
    }
    setLoading(true);
    try {
      const subasta = await Subastas.crear({
        fecha: f.fecha,
        hora: f.hora + ':00',
        estado: 'cerrada', // queda en espera; la puja la inicia el subastador o el scheduler
        subastador: user.clienteId,
        ubicacion: f.ubicacion,
        categoria: f.categoria,
        moneda: f.moneda,
      });

      if (conItems) {
        const catalogo = await Catalogos.crear({
          descripcion: `Catálogo subasta #${subasta.identificador}`,
          subasta: subasta.identificador,
          responsable: user.clienteId,
        });
        await Promise.all(
          itemsSeleccionados.map((it) =>
            Catalogos.agregarItem(catalogo.identificador, {
              producto: it.productoId,
              precioBase: parseFloat(it.precioBase),
            })
          )
        );
      }

      const titulo = itemsSeleccionados[0]?.titulo || tituloSubasta(subasta);
      setLoading(false);
      animarExitoYRedirigir(subasta, titulo);
    } catch (e) {
      Alert.alert('Error al crear subasta', e.message || 'Revisá los datos e intentá nuevamente.');
      setLoading(false);
    }
  };

  if (paso === 1) {
    return (
      <Screen scroll contentStyle={{ paddingHorizontal: 22, paddingBottom: 50 }}>
        <Header />
        <Title>Nueva subasta</Title>
        <Sub>Paso 1 de 2 — Información básica</Sub>

        <SectionLabel>Fecha</SectionLabel>
        <CalendarPicker value={f.fecha} onChange={set('fecha')} />

        <SectionLabel style={{ marginTop: 18 }}>Hora de inicio</SectionLabel>
        <TimeSelector value={f.hora} onChange={set('hora')} />

        <SectionLabel style={{ marginTop: 18 }}>Ubicación</SectionLabel>
        <Field
          placeholder="Dirección donde se realiza la subasta"
          value={f.ubicacion}
          onChangeText={set('ubicacion')}
        />

        <SectionLabel style={{ marginTop: 18 }}>Categoría</SectionLabel>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {CATS_SUBASTA.map((c) => (
              <Chip key={c} label={c.charAt(0).toUpperCase() + c.slice(1)} active={f.categoria === c} onPress={() => set('categoria')(c)} />
            ))}
          </View>
        </ScrollView>

        <SectionLabel style={{ marginTop: 18 }}>Moneda</SectionLabel>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {MONEDAS.map((m) => (
            <Chip key={m} label={m === 'pesos' ? 'Pesos $' : 'Dólares U$D'} active={f.moneda === m} onPress={() => set('moneda')(m)} />
          ))}
        </View>

        <View style={{ marginTop: 32 }}>
          <Btn title="Siguiente → Agregar productos" onPress={onSiguiente} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll contentStyle={{ paddingHorizontal: 22, paddingBottom: 50 }}>
      <Header onBack={() => setPaso(1)} />
      <Title>Nueva subasta</Title>
      <Sub>Paso 2 de 2 — Productos</Sub>

      {/* Resumen de paso 1 */}
      <Card el style={{ flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 18 }}>
        <Ionicons name="calendar" size={22} color={colors.blue} />
        <View>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{formatFechaDisplay(f.fecha)}</Text>
          <Text style={{ color: colors.muted, fontSize: 12.5 }}>{f.hora} hs · {f.ubicacion}</Text>
        </View>
      </Card>

      {/* Lista de productos agregados */}
      {itemsSeleccionados.length === 0 && (
        <Card el style={{ alignItems: 'center', paddingVertical: 20, marginBottom: 14 }}>
          <Ionicons name="cube-outline" size={36} color={colors.muted} />
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 8, textAlign: 'center' }}>
            No hay productos aún.
          </Text>
          <TouchableOpacity
            style={{ marginTop: 12 }}
            onPress={() => navigation.navigate('MisProductos', { modoSeleccion: true })}
          >
            <Text style={{ color: colors.blue, fontWeight: '700', fontSize: 13 }}>Elegir de mis productos →</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ marginTop: 8 }}
            onPress={() => navigation.navigate('Publicar')}
          >
            <Text style={{ color: colors.muted, fontSize: 12 }}>+ Publicar nuevo producto</Text>
          </TouchableOpacity>
        </Card>
      )}

      {itemsSeleccionados.map((item) => (
        <Card key={item.productoId} el style={{ gap: 10, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: colors.blue + '22', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="cube" size={16} color={colors.blue} />
              </View>
              <View>
                <Display style={{ fontSize: 13 }} numberOfLines={2}>
                  {item.titulo || `Producto #${item.productoId}`}
                </Display>
              </View>
            </View>
            <TouchableOpacity onPress={() => setItemsSeleccionados(prev => prev.filter(i => i.productoId !== item.productoId))}>
              <Ionicons name="close-circle" size={22} color={colors.red} />
            </TouchableOpacity>
          </View>
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 2 }}>PRECIO BASE</Text>
            <Field
              placeholder="$ 0.00"
              value={String(item.precioBase)}
              onChangeText={(v) => setItemField(item.productoId, 'precioBase', v)}
              keyboardType="numeric"
            />
            {parseFloat(item.precioBase) > 0 && (() => {
              const base = parseFloat(item.precioBase);
              const retenido = base * COMISION_BIDLY;
              const neta = base - retenido;
              const fmt = (n) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              return (
                <View style={{ backgroundColor: colors.cardEl, borderRadius: 10, padding: 12, gap: 6, marginTop: 2 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>Comisión Bidly (10%)</Text>
                    <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '700' }}>- $ {fmt(retenido)}</Text>
                  </View>
                  <View style={{ height: 1, backgroundColor: colors.border }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Ganancia neta</Text>
                    <Text style={{ color: colors.green, fontSize: 13, fontWeight: '800' }}>$ {fmt(neta)}</Text>
                  </View>
                </View>
              );
            })()}
          </View>
        </Card>
      ))}

      <TouchableOpacity
        style={cs.addProductoBtn}
        onPress={() => navigation.navigate('MisProductos', { modoSeleccion: true })}
        activeOpacity={0.8}
      >
        <Ionicons name="add-circle-outline" size={20} color={colors.blue} />
        <Text style={{ color: colors.blue, fontWeight: '700', fontSize: 14 }}>Elegir de mis productos</Text>
      </TouchableOpacity>

      <View style={{ marginTop: 24 }}>
        <Btn
          title={loading
            ? 'Creando subasta…'
            : itemsSeleccionados.length > 0
              ? `Crear subasta con ${itemsSeleccionados.length} producto(s)`
              : 'Crear subasta vacía (agregás ítems desde Admisiones)'}
          onPress={onCrear}
          disabled={loading || !!exito}
        />
      </View>

      <Modal visible={!!exito} transparent animationType="fade">
        <View style={s.exitoOverlay}>
          <Animated.View style={[s.exitoCard, { opacity: exitoOpacity, transform: [{ scale: exitoScale }] }]}>
            <View style={s.exitoIcon}>
              <Ionicons name="checkmark" size={42} color="#fff" />
            </View>
            <Display style={{ fontSize: 22, textAlign: 'center', marginTop: 16 }}>¡Subasta creada!</Display>
            <Text style={{ color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
              {exito?.titulo}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: 10, lineHeight: 18 }}>
              Queda en espera. La puja se inicia a la fecha y hora, o manualmente desde el panel.
            </Text>
            <Text style={{ color: colors.blue, fontSize: 13, fontWeight: '700', marginTop: 18 }}>
              Yendo a Mis subastas…
            </Text>
          </Animated.View>
        </View>
      </Modal>
    </Screen>
  );
}

// ─── PUBLICAR SCREEN ─────────────────────────────────────────────────────────
const MAX_FOTOS = 6;

export function PublicarScreen({ navigation }) {
  const { user } = useAuth();
  const [f, setF] = useState({ titulo: '', categoria: '', estado: '', precio: '', descripcion: '' });
  const [fotos, setFotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [declaraPropiedad, setDeclaraPropiedad] = useState(false);
  const [declaraOrigen, setDeclaraOrigen] = useState(false);
  const [det, setDet] = useState({ esObraArte: false, artista: '', fechaObra: '', historia: '', cantidadPiezas: '', composicion: '' });
  const setD = (k) => (v) => setDet((s) => ({ ...s, [k]: v }));
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  const elegirFoto = async () => {
    if (fotos.length >= MAX_FOTOS) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para agregar fotos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_FOTOS - fotos.length,
      quality: 0.7,
    });
    if (!result.canceled) {
      setFotos((prev) => [...prev, ...result.assets].slice(0, MAX_FOTOS));
    }
  };

  const quitarFoto = (idx) => setFotos((prev) => prev.filter((_, i) => i !== idx));

  const onPublicar = async () => {
    if (!f.titulo.trim() || !f.descripcion.trim()) {
      return Alert.alert('Campos requeridos', 'Completá al menos el título y la descripción del bien.');
    }
    if (fotos.length < MAX_FOTOS) {
      return Alert.alert('Faltan fotos', `Subí al menos ${MAX_FOTOS} fotos del bien (tenés ${fotos.length}).`);
    }
    if (!declaraPropiedad || !declaraOrigen) {
      return Alert.alert(
        'Declaraciones obligatorias',
        'Debés declarar que el bien te pertenece y que su origen es lícito para enviarlo a admisión.',
      );
    }
    setLoading(true);
    try {
      const producto = await Productos.crear({
        descripcionCatalogo: f.titulo,
        descripcionCompleta: f.descripcion,
        disponible: 'si',
        revisor: null,
        duenio: user?.clienteId || null,
        seguro: null,
      });

      const token = await getToken();
      for (let i = 0; i < fotos.length; i++) {
        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `${BASE_URL}/productos/${producto.identificador}/fotos`);
          if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          xhr.onload = () => xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`));
          xhr.onerror = () => reject(new Error('Error de red al subir foto'));
          const fd = new FormData();
          const fotoAsset = fotos[i];
          if (fotoAsset.file) {
            // Web: expo-image-picker provee un File object real
            fd.append('fotos', fotoAsset.file, `foto_${i}.jpg`);
          } else {
            // Mobile: formato React Native
            fd.append('fotos', { uri: fotoAsset.uri, name: `foto_${i}.jpg`, type: fotoAsset.mimeType || 'image/jpeg' });
          }
          xhr.send(fd);
        });
      }

      // Detalle ampliado: obra de arte/diseñador o pieza compuesta.
      if (det.esObraArte || det.artista || det.historia || det.composicion || det.cantidadPiezas) {
        await Productos.setDetalle(producto.identificador, {
          esObraArte: det.esObraArte,
          artista: det.artista || null,
          fechaObra: det.fechaObra || null,
          historia: det.historia || null,
          cantidadPiezas: det.cantidadPiezas ? parseInt(det.cantidadPiezas, 10) : 1,
          composicion: det.composicion || null,
        }).catch(() => {});
      }

      // Enviar el bien a admisión (la empresa lo inspecciona antes de subastarlo).
      await Admisiones.crear({
        productoId: producto.identificador,
        duenioId: user?.clienteId,
        declaraPropiedad,
        declaraOrigen,
      });

      Alert.alert(
        'Solicitud enviada',
        'Tu bien fue enviado a admisión. La empresa te avisará si debés enviarlo a inspección '
        + 'y, si lo acepta, te propondrá un valor base y comisión para que aceptes o rechaces.',
        [{ text: 'Ver mis publicaciones', onPress: () => navigation.navigate('MisAdmisiones') },
         { text: 'Ir al inicio', style: 'cancel', onPress: () => navigation.navigate('Main') }],
      );
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo enviar la solicitud de admisión.');
    } finally {
      setLoading(false);
    }
  };

  const onBorrador = () => {
    Alert.alert('Próximamente', 'La función de borradores estará disponible en una próxima versión.');
  };

  return (
    <Screen>
      <Header />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        <Title>Publicar{'\n'}producto</Title>
        <Sub>Completá los datos y se enviará a revisión.</Sub>
        <SectionLabel>Fotos ({fotos.length}/{MAX_FOTOS})</SectionLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {fotos.map((foto, i) => (
            <TouchableOpacity key={i} style={s.photo} onPress={() => quitarFoto(i)} activeOpacity={0.8}>
              <Image source={{ uri: foto.uri }} style={{ width: '100%', height: '100%', borderRadius: 10 }} resizeMode="cover" />
              <View style={s.removeOverlay}>
                <Ionicons name="close-circle" size={20} color="#fff" />
              </View>
            </TouchableOpacity>
          ))}
          {fotos.length < MAX_FOTOS && (
            <TouchableOpacity style={[s.photo, s.photoAdd]} onPress={elegirFoto}>
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="add" size={26} color={colors.blue} />
              </View>
            </TouchableOpacity>
          )}
        </View>
        <SectionLabel>Datos del producto</SectionLabel>
        <View style={{ gap: 12 }}>
          <Field placeholder="Título" value={f.titulo} onChangeText={set('titulo')} />
          <Field placeholder="Categoría" value={f.categoria} onChangeText={set('categoria')} />
          <View>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700', marginBottom: 8 }}>ESTADO</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {['nuevo', 'usado'].map((op) => (
                <Chip key={op} label={op.charAt(0).toUpperCase() + op.slice(1)} active={f.estado === op} onPress={() => set('estado')(op)} />
              ))}
            </View>
          </View>
          <Field placeholder="Descripción completa (historia, artista, cantidad de piezas, etc.)" value={f.descripcion} onChangeText={set('descripcion')} multiline />
        </View>

        <SectionLabel>Declaraciones</SectionLabel>
        <TouchableOpacity onPress={() => setDeclaraPropiedad((v) => !v)} activeOpacity={0.8} style={s.decl}>
          <Ionicons name={declaraPropiedad ? 'checkbox' : 'square-outline'} size={22} color={declaraPropiedad ? colors.blue : colors.muted} />
          <Text style={{ color: '#fff', fontSize: 13, flex: 1 }}>Declaro que el bien me pertenece y no tiene impedimentos para subastarse.</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setDeclaraOrigen((v) => !v)} activeOpacity={0.8} style={s.decl}>
          <Ionicons name={declaraOrigen ? 'checkbox' : 'square-outline'} size={22} color={declaraOrigen ? colors.blue : colors.muted} />
          <Text style={{ color: '#fff', fontSize: 13, flex: 1 }}>Declaro el origen lícito del bien y puedo acreditarlo si me lo requieren.</Text>
        </TouchableOpacity>
        <Text style={{ color: colors.muted, fontSize: 11.5, marginTop: 6 }}>
          El valor base y la comisión los definirá la empresa tras la inspección. Vos podrás aceptarlos o rechazarlos.
        </Text>

        <SectionLabel>Detalle (opcional)</SectionLabel>
        <TouchableOpacity onPress={() => setDet((s) => ({ ...s, esObraArte: !s.esObraArte }))} activeOpacity={0.8} style={s.decl}>
          <Ionicons name={det.esObraArte ? 'checkbox' : 'square-outline'} size={22} color={det.esObraArte ? colors.blue : colors.muted} />
          <Text style={{ color: '#fff', fontSize: 13, flex: 1 }}>Es obra de arte / objeto de diseñador</Text>
        </TouchableOpacity>
        <View style={{ gap: 12 }}>
          {det.esObraArte && (
            <>
              <Field placeholder="Artista / diseñador" value={det.artista} onChangeText={setD('artista')} />
              <Field placeholder="Fecha / época" value={det.fechaObra} onChangeText={setD('fechaObra')} />
              <Field placeholder="Historia (dueños anteriores, curiosidades…)" value={det.historia} onChangeText={setD('historia')} multiline />
            </>
          )}
          <Field placeholder="Cantidad de piezas (ej. juego de té = 18)" value={det.cantidadPiezas} onChangeText={setD('cantidadPiezas')} keyboardType="numeric" />
          <Field placeholder="Composición (qué elementos incluye)" value={det.composicion} onChangeText={setD('composicion')} multiline />
        </View>
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 22, paddingBottom: 28, paddingTop: 14 }}>
        <Btn title="Borrador" kind="ghost" onPress={onBorrador} style={{ flex: 1 }} />
        <Btn title={loading ? 'Publicando…' : 'Publicar'} onPress={onPublicar} disabled={loading} style={{ flex: 1 }} />
      </View>
    </Screen>
  );
}

// ─── MIS ADMISIONES (estado de las publicaciones del dueño) ──────────────────
const ADMISION_LABEL = {
  solicitada:       { label: 'EN REVISIÓN', color: colors.gold },
  en_inspeccion:    { label: 'INSPECCIÓN', color: colors.blue },
  rechazada:        { label: 'RECHAZADA', color: colors.red },
  propuesta:        { label: 'PROPUESTA', color: colors.gold },
  aprobada:         { label: 'EN SUBASTA', color: colors.green },
  rechazada_duenio: { label: 'DEVUELTA', color: colors.muted },
};

export function MisAdmisionesScreen({ navigation }) {
  const { user } = useAuth();
  const [admisiones, setAdmisiones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ctrl, setCtrl] = useState(false);

  const cargar = () => {
    if (!user?.clienteId) { setLoading(false); return; }
    setLoading(true);
    Admisiones.porDuenio(user.clienteId)
      .then((data) => setAdmisiones(Array.isArray(data) ? data : []))
      .catch(() => setAdmisiones([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => navigation.addListener('focus', cargar), [navigation, user]);

  const aceptar = (a) => {
    Alert.alert('Aceptar propuesta', `Valor base $${a.valorBase} y comisión $${a.comision}. ¿Aceptás?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Aceptar',
        onPress: async () => {
          setCtrl(true);
          try {
            await Admisiones.aprobarDuenio(a.identificador);
            Alert.alert('Listo', 'Tu bien se incluyó en el catálogo de la subasta.');
            cargar();
          } catch (e) { Alert.alert('Error', e.message || 'No se pudo aceptar.'); }
          finally { setCtrl(false); }
        },
      },
    ]);
  };

  const rechazar = (a) => {
    Alert.alert('Rechazar propuesta', 'Se procederá a la devolución del bien con los gastos a tu cargo. ¿Confirmás?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Rechazar',
        style: 'destructive',
        onPress: async () => {
          setCtrl(true);
          try {
            await Admisiones.rechazarDuenio(a.identificador);
            cargar();
          } catch (e) { Alert.alert('Error', e.message || 'No se pudo rechazar.'); }
          finally { setCtrl(false); }
        },
      },
    ]);
  };

  return (
    <Screen>
      <Header />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Title>Mis{'\n'}publicaciones</Title>
        <Sub>Seguí el estado de admisión de los bienes que ofreciste a subasta.</Sub>
        {loading && <ActivityIndicator color={colors.blue} style={{ marginTop: 20 }} />}
        {!loading && admisiones.length === 0 && (
          <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 20 }}>
            Todavía no ofreciste ningún bien.{'\n'}Usá "Publicar" para enviar uno a admisión.
          </Text>
        )}
        <View style={{ gap: 12, marginTop: 12 }}>
          {admisiones.map((a) => {
            const meta = ADMISION_LABEL[a.estado] || ADMISION_LABEL.solicitada;
            return (
              <Card key={a.identificador} el style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <Display style={{ fontSize: 15, flex: 1, lineHeight: 18 }} numberOfLines={2}>
                    {a.producto?.titulo || `Producto #${a.producto?.identificador}`}
                  </Display>
                  <Tag label={meta.label} color={meta.color} />
                </View>
                {a.estado === 'en_inspeccion' && (
                  <Text style={{ color: colors.muted, fontSize: 12.5 }}>Enviá el bien a: {a.direccionEnvio}</Text>
                )}
                {a.estado === 'rechazada' && (
                  <Text style={{ color: colors.red, fontSize: 12.5 }}>Motivo: {a.observacion}</Text>
                )}
                {a.estado === 'propuesta' && (
                  <>
                    <Row k="Valor base" v={`$${Number(a.valorBase).toLocaleString('es-AR')}`} />
                    <Row k="Comisión" v={`$${Number(a.comision).toLocaleString('es-AR')}`} />
                    {a.subasta?.fecha && <Row k="Subasta" v={`${a.subasta.fecha} · ${a.subasta.ubicacion || ''}`} />}
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                      <Btn title="Aceptar" onPress={() => aceptar(a)} disabled={ctrl} style={{ flex: 1 }} />
                      <Btn title="Rechazar" kind="danger" onPress={() => rechazar(a)} disabled={ctrl} style={{ flex: 1 }} />
                    </View>
                  </>
                )}
                {a.estado === 'aprobada' && (
                  <>
                    <Text style={{ color: colors.green, fontSize: 12.5 }}>Incluido en la subasta. ¡Suerte con el remate!</Text>
                    <Btn
                      title="Ver seguro y depósito"
                      kind="ghost"
                      onPress={() => navigation.navigate('SeguroBien', { productoId: a.producto?.identificador, titulo: a.producto?.titulo })}
                      style={{ marginTop: 6 }}
                    />
                  </>
                )}
              </Card>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}

// ─── MIS COBROS (payout al dueño) ────────────────────────────────────────────
export function MisCobrosScreen({ navigation }) {
  const { user } = useAuth();
  const [payouts, setPayouts] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ctrl, setCtrl] = useState(false);
  const [form, setForm] = useState(false);
  const [nueva, setNueva] = useState({ alias: '', banco: '', pais: '', moneda: 'pesos', esExterior: false });

  const cargar = () => {
    if (!user?.clienteId) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      Payouts.porDuenio(user.clienteId),
      Payouts.cuentas(user.clienteId),
    ])
      .then(([ps, cs]) => {
        setPayouts(Array.isArray(ps) ? ps : []);
        setCuentas(Array.isArray(cs) ? cs : []);
      })
      .catch(() => { setPayouts([]); setCuentas([]); })
      .finally(() => setLoading(false));
  };

  useEffect(() => navigation.addListener('focus', cargar), [navigation, user]);

  const declararCuenta = async () => {
    if (!nueva.alias.trim()) return Alert.alert('Cuenta', 'Ingresá el CBU / IBAN / alias.');
    setCtrl(true);
    try {
      await Payouts.declararCuenta({ duenioId: user.clienteId, ...nueva });
      setForm(false);
      setNueva({ alias: '', banco: '', pais: '', moneda: 'pesos', esExterior: false });
      cargar();
    } catch (e) { Alert.alert('Error', e.message || 'No se pudo declarar la cuenta.'); }
    finally { setCtrl(false); }
  };

  const cobrar = (p) => {
    if (cuentas.length === 0) {
      return Alert.alert('Falta una cuenta', 'Declará una cuenta a la vista antes de cobrar.', [
        { text: 'Declarar', onPress: () => setForm(true) },
        { text: 'Cancelar', style: 'cancel' },
      ]);
    }
    const cuenta = cuentas[0];
    Alert.alert('Cobrar', `Se acreditarán $${Number(p.importeNeto).toLocaleString('es-AR')} en ${cuenta.alias}. ¿Confirmás?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cobrar',
        onPress: async () => {
          setCtrl(true);
          try { await Payouts.cobrar(p.identificador, cuenta.identificador); cargar(); }
          catch (e) { Alert.alert('Error', e.message || 'No se pudo cobrar.'); }
          finally { setCtrl(false); }
        },
      },
    ]);
  };

  return (
    <Screen>
      <Header />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Title>Mis{'\n'}cobros</Title>
        <Sub>El dinero de tus bienes vendidos se acredita en tu cuenta a la vista declarada.</Sub>

        <SectionLabel>Cuentas a la vista</SectionLabel>
        {cuentas.map((c) => (
          <Card key={c.identificador} el style={{ marginBottom: 8 }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>{c.alias}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {c.banco || 'Banco'} · {c.pais || '—'} · {c.moneda} · {c.esExterior === 'si' ? 'Exterior' : 'Nacional'}
            </Text>
          </Card>
        ))}
        {!form && (
          <TouchableOpacity onPress={() => setForm(true)} style={{ paddingVertical: 10 }}>
            <Text style={{ color: colors.blue, fontWeight: '800' }}>+ Declarar cuenta a la vista</Text>
          </TouchableOpacity>
        )}
        {form && (
          <Card el style={{ gap: 10 }}>
            <Field placeholder="CBU / IBAN / alias" value={nueva.alias} onChangeText={(v) => setNueva((n) => ({ ...n, alias: v }))} />
            <Field placeholder="Banco" value={nueva.banco} onChangeText={(v) => setNueva((n) => ({ ...n, banco: v }))} />
            <Field placeholder="País" value={nueva.pais} onChangeText={(v) => setNueva((n) => ({ ...n, pais: v }))} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Chip label="Pesos" active={nueva.moneda === 'pesos'} onPress={() => setNueva((n) => ({ ...n, moneda: 'pesos' }))} />
              <Chip label="Dólares" active={nueva.moneda === 'dolares'} onPress={() => setNueva((n) => ({ ...n, moneda: 'dolares' }))} />
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Chip label="Nacional" active={!nueva.esExterior} onPress={() => setNueva((n) => ({ ...n, esExterior: false }))} />
              <Chip label="Exterior" active={nueva.esExterior} onPress={() => setNueva((n) => ({ ...n, esExterior: true }))} />
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Btn title="Cancelar" kind="ghost" onPress={() => setForm(false)} style={{ flex: 1 }} />
              <Btn title={ctrl ? 'Guardando…' : 'Declarar'} onPress={declararCuenta} disabled={ctrl} style={{ flex: 1 }} />
            </View>
          </Card>
        )}

        <SectionLabel>Cobros</SectionLabel>
        {loading && <ActivityIndicator color={colors.blue} style={{ marginTop: 12 }} />}
        {!loading && payouts.length === 0 && (
          <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 12 }}>
            Todavía no tenés cobros. Cuando se venda un bien tuyo aparecerá acá.
          </Text>
        )}
        <View style={{ gap: 12, marginTop: 8 }}>
          {payouts.map((p) => (
            <Card key={p.identificador} el style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <Display style={{ fontSize: 15, flex: 1, lineHeight: 18 }} numberOfLines={2}>
                  {p.producto?.titulo || `Producto #${p.producto?.identificador}`}
                </Display>
                <Tag label={p.estado === 'pagado' ? 'ACREDITADO' : 'PENDIENTE'} color={p.estado === 'pagado' ? colors.green : colors.gold} />
              </View>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {p.origen === 'empresa' ? 'Comprado por la empresa (sin pujas)' : 'Vendido en subasta'}
              </Text>
              <Row k="Bruto" v={`$${Number(p.importeBruto).toLocaleString('es-AR')}`} />
              <Row k="Comisión" v={`$${Number(p.comision).toLocaleString('es-AR')}`} />
              <Row k="Neto a cobrar" v={`$${Number(p.importeNeto).toLocaleString('es-AR')}`} vc={colors.green} bold />
              {p.estado !== 'pagado' && (
                <Btn title="Cobrar" onPress={() => cobrar(p)} disabled={ctrl} style={{ marginTop: 4 }} />
              )}
            </Card>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

// ─── SEGURO DEL BIEN (póliza + depósito + aumentar) ──────────────────────────
export function SeguroBienScreen({ navigation, route }) {
  const { productoId, titulo } = route.params || {};
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nuevo, setNuevo] = useState('');
  const [ctrl, setCtrl] = useState(false);

  const cargar = () => {
    if (!productoId) { setLoading(false); return; }
    setLoading(true);
    Seguros.polizaProducto(productoId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };
  useEffect(cargar, [productoId]);

  const aumentar = async () => {
    if (!data?.poliza?.nroPoliza) return;
    if (!nuevo || Number(nuevo) <= 0) return Alert.alert('Valor', 'Ingresá el nuevo valor asegurado.');
    setCtrl(true);
    try {
      const res = await Seguros.aumentar(data.poliza.nroPoliza, Number(nuevo));
      Alert.alert('Póliza aumentada', `Nuevo valor $${Number(res.importe).toLocaleString('es-AR')}. Pagaste la diferencia de $${Number(res.diferenciaPagada).toLocaleString('es-AR')}.`);
      setNuevo('');
      cargar();
    } catch (e) { Alert.alert('Error', e.message || 'No se pudo aumentar la póliza.'); }
    finally { setCtrl(false); }
  };

  return (
    <Screen>
      <Header />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Title>Seguro{'\n'}del bien</Title>
        {titulo && <Sub>{titulo}</Sub>}
        {loading && <ActivityIndicator color={colors.blue} style={{ marginTop: 20 }} />}
        {!loading && !data?.poliza && (
          <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 20 }}>
            Este bien todavía no tiene póliza contratada.
          </Text>
        )}
        {!loading && data?.poliza && (
          <>
            <Card el style={{ marginTop: 12 }}>
              <Row k="Póliza" v={data.poliza.nroPoliza} />
              <Row k="Compañía" v={data.poliza.compania} />
              <Row k="Valor asegurado" v={`$${Number(data.poliza.importe).toLocaleString('es-AR')}`} vc={colors.green} />
              <Row k="Depósito" v={data.deposito || '—'} />
            </Card>
            <SectionLabel>Aumentar póliza</SectionLabel>
            <Text style={{ color: colors.muted, fontSize: 12.5, marginBottom: 8 }}>
              Podés aumentar el valor asegurado pagando la diferencia del premio.
            </Text>
            <Field placeholder="Nuevo valor asegurado ($)" value={nuevo} onChangeText={setNuevo} keyboardType="numeric" />
            <Btn title={ctrl ? 'Procesando…' : 'Aumentar póliza'} onPress={aumentar} disabled={ctrl} style={{ marginTop: 10 }} />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

// ─── MIS MÉTRICAS ─────────────────────────────────────────────────────────────
export function MisMetricasScreen({ navigation }) {
  const { user } = useAuth();
  const [m, setM] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.clienteId) { setLoading(false); return; }
    Clientes.metricas(user.clienteId)
      .then(setM)
      .catch(() => setM(null))
      .finally(() => setLoading(false));
  }, [user]);

  const fmt = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`;

  return (
    <Screen>
      <Header />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Title>Mis{'\n'}métricas</Title>
        <Sub>Tu participación en las subastas.</Sub>
        {loading && <ActivityIndicator color={colors.blue} style={{ marginTop: 20 }} />}
        {!loading && m && (
          <>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
              <Card el style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                <Display style={{ fontSize: 26, color: colors.blue }}>{m.asistidas}</Display>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Subastas asistidas</Text>
              </Card>
              <Card el style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                <Display style={{ fontSize: 26, color: colors.green }}>{m.ganadas}</Display>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Veces que ganaste</Text>
              </Card>
            </View>
            <Card el style={{ marginTop: 12 }}>
              <Row k="Pujas realizadas" v={String(m.cantidadPujas)} />
              <Row k="Total ofertado" v={fmt(m.totalOfertado)} />
              <Row k="Total comprado" v={fmt(m.totalComprado)} />
              <Row k="Total pagado" v={fmt(m.totalPagado)} vc={colors.green} />
            </Card>
            <SectionLabel>Asistencias por categoría</SectionLabel>
            <Card el>
              {Object.keys(m.porCategoria || {}).length === 0 && (
                <Text style={{ color: colors.muted, fontSize: 13 }}>Todavía no participaste de subastas.</Text>
              )}
              {Object.entries(m.porCategoria || {}).map(([cat, n]) => (
                <Row key={cat} k={cat.toUpperCase()} v={String(n)} />
              ))}
            </Card>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

// ─── COMPRA DETALLE (acceso al pago post-subasta) ─────────────────────────────
export function CompraDetalleScreen({ navigation, route }) {
  const {
    registroId, title, date, sub, importe, comision, reembolsada,
    subastaId, productoId, moneda = 'pesos',
  } = route.params || {};

  const total = importe != null
    ? Number(importe) + Number(comision || 0)
    : null;
  const simbolo = moneda === 'dolares' ? 'U$D' : '$';
  const puedePagar = reembolsada !== 'si';

  const irAPago = () => {
    navigation.navigate('MedioPago', {
      registroId,
      subastaId,
      itemId: productoId,
      importe,
      comision,
      moneda,
      titulo: title,
    });
  };

  return (
    <Screen>
      <Header />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <Title>Mi compra</Title>
        <Sub>Registro #{registroId || '—'}</Sub>
        <Card el style={{ marginTop: 12, gap: 8 }}>
          <Display style={{ fontSize: 16, lineHeight: 20 }}>{title || 'Artículo'}</Display>
          {sub ? <Text style={{ color: colors.muted, fontSize: 13 }}>{sub}</Text> : null}
          {date ? <Text style={{ color: colors.faint, fontSize: 12 }}>{date}</Text> : null}
        </Card>
        <SectionLabel>Importes</SectionLabel>
        <Card el>
          {importe != null && (
            <Row k="Puja ganadora" v={`${simbolo} ${Number(importe).toLocaleString('es-AR')}`} />
          )}
          {Number(comision) > 0 && (
            <Row k="Comisión" v={`${simbolo} ${Number(comision).toLocaleString('es-AR')}`} />
          )}
          {total != null && (
            <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8, paddingTop: 6 }}>
              <Row k="Total" v={`${simbolo} ${total.toLocaleString('es-AR')}`} vc={colors.green} bold />
            </View>
          )}
        </Card>
        {reembolsada === 'si' && (
          <Card el style={{ marginTop: 12, borderColor: colors.red, borderWidth: 1 }}>
            <Text style={{ color: colors.red, fontWeight: '700', textAlign: 'center' }}>
              Esta compra fue reembolsada
            </Text>
          </Card>
        )}
      </ScrollView>
      <View style={{ gap: 10, paddingHorizontal: 22, paddingBottom: 28, paddingTop: 14 }}>
        {puedePagar && (
          <Btn title="Continuar al pago" onPress={irAPago} />
        )}
        {!puedePagar ? null : (
          <Btn
            title="Solicitar reembolso"
            kind="ghost"
            onPress={() => navigation.navigate('Reembolso', {
              registroId,
              importe: total ?? importe,
              titulo: title,
              reembolsada,
            })}
          />
        )}
      </View>
    </Screen>
  );
}

// ─── DATOS GANADOR ────────────────────────────────────────────────────────────
export function DatosGanadorScreen({ navigation, route }) {
  const { registroId } = route.params || {};
  const [registro, setRegistro] = useState(null);
  const [loading, setLoading] = useState(!!registroId);

  useEffect(() => {
    if (!registroId) return;
    RegistroSubasta.obtener(registroId)
      .then(setRegistro)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [registroId]);

  const nombre = registro?.cliente ? `Cliente #${registro.cliente.identificador}` : 'Ganador';
  const email = registro?.cliente?.email || '—';

  return (
    <Screen>
      <Header />
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.blue} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 22 }} showsVerticalScrollIndicator={false}>
          <Title>Datos del{'\n'}ganador</Title>
          <Card el style={{ flexDirection: 'row', gap: 13, alignItems: 'center', borderColor: colors.borderHi, borderWidth: 1.5, marginTop: 8 }}>
            <View style={s.winnerAvatar}><Ionicons name="person" size={22} color="#fff" /></View>
            <View>
              <Display style={{ fontSize: 16 }}>{nombre}</Display>
              <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 3 }}>
                {registro ? tituloSubasta(registro.subasta) : '—'}
              </Text>
            </View>
          </Card>
          <SectionLabel>Contacto</SectionLabel>
          <Card el>
            <Row k="Email" v={email} />
            {registro?.importe != null && (
              <Row k="Importe" v={`$ ${Number(registro.importe).toLocaleString('es-AR')}`} />
            )}
          </Card>
        </ScrollView>
      )}
      <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 22, paddingBottom: 28, paddingTop: 14 }}>
        <Btn
          title="Reembolso"
          kind="ghost"
          onPress={() => navigation.navigate('Reembolso', { registroId, importe: registro?.importe })}
          style={{ flex: 1 }}
        />
        <Btn
          title="Marcar entregado"
          onPress={() => {
            Alert.alert('Entrega registrada', 'La entrega fue marcada como completada.', [
              { text: 'OK', onPress: () => navigation.goBack() },
            ]);
          }}
          style={{ flex: 1 }}
        />
      </View>
    </Screen>
  );
}

// ─── DATOS PERSONALES ────────────────────────────────────────────────────────
export function DatosPersonalesScreen({ navigation }) {
  const { user } = useAuth();
  const [persona, setPersona] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.clienteId) { setLoading(false); return; }
    Promise.all([
      Personas.obtener(user.clienteId),
      Clientes.obtener(user.clienteId),
    ])
      .then(([p, c]) => { setPersona(p); setCliente(c); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const filas = [
    { label: 'Nombre completo', valor: persona?.nombre || user?.nombre || '—', icon: 'person-outline' },
    { label: 'Email', valor: cliente?.email || user?.email || '—', icon: 'mail-outline' },
    { label: 'Domicilio', valor: persona?.direccion || '—', icon: 'location-outline' },
    { label: 'Documento (DNI)', valor: persona?.documento || '—', icon: 'card-outline' },
    { label: 'Categoría', valor: CATEGORIAS_LABEL[cliente?.categoria || user?.categoria] || '—', icon: 'star-outline' },
    { label: 'Estado de cuenta', valor: cliente?.admitido === 'si' ? 'Admitido ✓' : 'Pendiente de admisión', icon: 'shield-checkmark-outline' },
  ];

  return (
    <Screen scroll contentStyle={{ paddingHorizontal: 22, paddingBottom: 40 }}>
      <Header />
      <Title>Datos{'\n'}personales</Title>
      {loading ? (
        <ActivityIndicator color={colors.blue} size="large" style={{ marginTop: 40 }} />
      ) : (
        <View style={{ gap: 10, marginTop: 8 }}>
          {filas.map(({ label, valor, icon }) => (
            <Card key={label} el style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={s.dpIcon}>
                <Ionicons name={icon} size={20} color={colors.blue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: 3 }}>
                  {label.toUpperCase()}
                </Text>
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>{valor}</Text>
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

// ─── MIS PRODUCTOS SCREEN ────────────────────────────────────────────────────
export function MisProductosScreen({ navigation, route }) {
  const { user } = useAuth();
  const modoSeleccion = !!route.params?.modoSeleccion;
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargar = () => {
      if (!user?.clienteId) { setLoading(false); return; }
      setLoading(true);
      Productos.porDuenio(user.clienteId)
        .then((data) => setProductos(data || []))
        .catch(() => setProductos([]))
        .finally(() => setLoading(false));
    };
    const unsub = navigation.addListener('focus', cargar);
    return unsub;
  }, [navigation, user]);

  const seleccionar = (p) => {
    navigation.navigate('CrearSubasta', { productoSeleccionado: p });
  };

  const confirmarEliminar = (p) => {
    Alert.alert(
      'Eliminar producto',
      `¿Eliminar "${p.descripcionCatalogo || `Producto #${p.identificador}`}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: async () => {
            try {
              await Productos.eliminar(p.identificador);
              setProductos((prev) => prev.filter((x) => x.identificador !== p.identificador));
            } catch (e) {
              Alert.alert('No se pudo eliminar', e.message || 'El producto puede estar asignado a una subasta.');
            }
          },
        },
      ]
    );
  };

  return (
    <Screen scroll contentStyle={{ paddingHorizontal: 22, paddingBottom: 40 }}>
      <Header />
      <Title>{modoSeleccion ? 'Elegir\nproducto' : 'Mis\nproductos'}</Title>
      {modoSeleccion && (
        <Sub>Tocá un producto para agregarlo a la subasta.</Sub>
      )}
      {loading && <ActivityIndicator color={colors.blue} style={{ marginTop: 20 }} />}
      {!loading && productos.length === 0 && (
        <Card el style={{ alignItems: 'center', paddingVertical: 28, gap: 12 }}>
          <Ionicons name="cube-outline" size={44} color={colors.muted} />
          <Text style={{ color: colors.muted, fontSize: 13, textAlign: 'center' }}>
            Todavía no publicaste ningún producto.
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Publicar')}>
            <Text style={{ color: colors.blue, fontWeight: '700', fontSize: 13 }}>+ Publicar mi primer producto</Text>
          </TouchableOpacity>
        </Card>
      )}
      <View style={{ gap: 12 }}>
        {productos.map((p) => {
          const Wrapper = modoSeleccion ? TouchableOpacity : View;
          return (
            <Wrapper
              key={p.identificador}
              {...(modoSeleccion ? { onPress: () => seleccionar(p), activeOpacity: 0.75 } : {})}
            >
              <Card el style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <View style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: colors.cardEl, overflow: 'hidden' }}>
                  <Image
                    source={{ uri: `${BASE_URL}/productos/${p.identificador}/portada` }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <Display style={{ fontSize: 14, flex: 1, marginRight: 8 }} numberOfLines={1}>
                      {p.descripcionCatalogo || `Producto #${p.identificador}`}
                    </Display>
                    <Tag
                      label={p.disponible === 'si' ? 'ACTIVO' : 'INACTIVO'}
                      color={p.disponible === 'si' ? colors.green : colors.muted}
                    />
                  </View>
                  {!!p.descripcionCompleta && (
                    <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={2}>
                      {p.descripcionCompleta}
                    </Text>
                  )}
                  <Text style={{ color: colors.blue, fontSize: 11, fontWeight: '700', marginTop: 4 }}>
                    ID #{p.identificador}
                  </Text>
                </View>
                {modoSeleccion
                  ? <Ionicons name="add-circle" size={28} color={colors.blue} />
                  : (
                    <TouchableOpacity onPress={() => confirmarEliminar(p)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Ionicons name="trash-outline" size={22} color="#ef4444" />
                    </TouchableOpacity>
                  )
                }
              </Card>
            </Wrapper>
          );
        })}
      </View>
      {!modoSeleccion && (
        <View style={{ marginTop: 24 }}>
          <Btn title="+ Publicar nuevo producto" onPress={() => navigation.navigate('Publicar')} />
        </View>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  bigAvatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.cardEl, alignItems: 'center', justifyContent: 'center' },
  catBadge: { marginTop: 10, borderRadius: 6, paddingVertical: 5, paddingHorizontal: 12 },
  listItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 16 },
  photo: { width: '30%', aspectRatio: 1, flexGrow: 1, overflow: 'hidden' },
  removeOverlay: { position: 'absolute', top: 4, right: 4 },
  photoAdd: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.borderHi, backgroundColor: colors.blueSoft,
    alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  photoEmpty: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.card, borderRadius: 12 },
  winnerAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.cardEl, alignItems: 'center', justifyContent: 'center' },
  dpIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(59,130,246,0.12)', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -5, right: -7, minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  toastOk: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(55,214,111,0.12)', borderWidth: 1, borderColor: colors.green,
    borderRadius: 12, padding: 14, marginBottom: 12,
  },
  sancionBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(226,57,80,0.10)', borderWidth: 1, borderColor: colors.red,
    borderRadius: 12, padding: 14, marginBottom: 12,
  },
  decl: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 12, marginBottom: 8,
  },
  exitoOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.88)',
    alignItems: 'center', justifyContent: 'center', padding: 28,
  },
  exitoCard: {
    width: '100%', backgroundColor: colors.card, borderRadius: 20,
    borderWidth: 1, borderColor: colors.borderHi, padding: 28, alignItems: 'center',
  },
  exitoIcon: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: colors.green,
    alignItems: 'center', justifyContent: 'center',
  },
});

// Estilos del calendar picker y time selector
const cs = StyleSheet.create({
  // Calendar
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderWidth: 1,
    borderColor: colors.border, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  calBox: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  calNavBtn: { padding: 6 },
  calMonthLabel: { color: '#fff', fontSize: 17, fontWeight: '800' },
  calRow: { flexDirection: 'row', marginBottom: 8 },
  calDayHeader: { flex: 1, textAlign: 'center', color: colors.muted, fontSize: 12, fontWeight: '700' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: `${100/7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  calCellSelected: { backgroundColor: colors.blue },
  calCellHoy: { borderWidth: 1.5, borderColor: colors.gold, borderRadius: 8 },
  calDayText: { color: '#fff', fontSize: 14 },
  // Time picker
  timePicker: { backgroundColor: colors.cardEl, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8,
    minWidth: 56, alignItems: 'center', justifyContent: 'center' },
  timePickerText: { color: '#fff', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  pickerBox: { backgroundColor: colors.card, borderRadius: 20, padding: 20, margin: 24,
    borderWidth: 1, borderColor: colors.border },
  pickerTitle: { color: '#fff', fontWeight: '800', fontSize: 15, marginBottom: 14 },
  pickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickerCell: { width: 50, height: 38, alignItems: 'center', justifyContent: 'center',
    borderRadius: 8, backgroundColor: colors.cardEl },
  pickerCellActive: { backgroundColor: colors.blue },
  pickerCellText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  pickerMinCell: { flex: 1, paddingVertical: 18, alignItems: 'center', justifyContent: 'center',
    borderRadius: 12, backgroundColor: colors.cardEl },
  addProductoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.blueSoft, borderWidth: 1, borderColor: colors.blue,
    borderRadius: 12, paddingVertical: 14, marginTop: 4 },
});
