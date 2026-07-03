// BIDLY — Perfil, MisSubastas, MisCompras, Historial, Publicar, MisProductos.
// Sin admisiones, cobros/payouts, medios de pago, multas ni notificaciones.
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Image, Modal, Animated } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Header, Title, Sub, SectionLabel, Btn, Chip, Card, Field, Tag, ImgBox, BottomBar, Row, Display } from '../components/ui';
import { colors } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { BASE_URL, getToken } from '../api/client';
import { Clientes, Personas, RegistroSubasta, Subastas, Productos, Catalogos, Admisiones, Payouts } from '../api/endpoints';
import { useNotifBadge } from '../hooks/useNotifBadge';
import { tituloSubasta, subtituloSubasta, formatFechaSubasta, esSubastaFinalizada, esSubastaEnCursoVendedor, esMiSubasta, tagEstadoSubasta } from '../utils/subasta';

const COMISION_BIDLY = 0.10;

function irAMisSubastas(navigation, params = {}) {
  navigation.reset({
    index: 0,
    routes: [{
      name: 'Main',
      state: {
        index: 3,
        routes: [
          { name: 'Home' }, { name: 'Historial' }, { name: 'Publish' },
          { name: 'Subastas', params }, { name: 'Perfil' },
        ],
      },
    }],
  });
}

const CATEGORIAS_LABEL = {
  comun: 'Cliente COMÚN', especial: 'Cliente ESPECIAL', plata: 'Cliente PLATA',
  oro: 'Cliente ORO', platino: 'Cliente PLATINO',
};
const CATEGORIAS_COLOR = {
  comun: colors.muted, especial: colors.blue, plata: '#8a93ab', oro: colors.oro, platino: '#b0c4de',
};

// Estado de aprobación interna → etiqueta para el dueño.
const ESTADO_PRODUCTO_LABEL = {
  solicitado:    { label: 'SOLICITADO', color: colors.gold },
  en_inspeccion: { label: 'EN INSPECCIÓN', color: colors.blue },
  aceptado:      { label: 'ACEPTADO', color: colors.green },
  rechazado:     { label: 'RECHAZADO', color: colors.red },
};

// Mapea un RegistroDeSubasta del backend al shape de ListRow.
function mapRegistro(r) {
  const fecha = r.subasta?.fecha ? new Date(r.subasta.fecha).toLocaleDateString('es-AR') : '—';
  const pagada = r.estadoPago === 'pagado';
  const reembolsada = r.reembolsada === 'si';
  return {
    id: r.identificador,
    title: tituloSubasta(r.subasta),
    date: fecha,
    sub: subtituloSubasta(r.subasta),
    price: r.importe ? Number(r.importe).toLocaleString('es-AR', { maximumFractionDigits: 2 }) : '—',
    tag: reembolsada ? 'Reembolsada' : pagada ? 'Pagada' : 'A pagar',
    tagColor: reembolsada ? colors.muted : pagada ? colors.green : colors.gold,
    registroId: r.identificador,
    importe: r.importe,
    comision: r.comision,
    subastaId: r.subasta?.identificador,
    productoId: r.producto,
    estadoPago: r.estadoPago,
    reembolsada: r.reembolsada,
    moneda: r.subasta?.moneda || 'pesos',
  };
}

// ─── PERFIL SCREEN ────────────────────────────────────────────────────────────
export function PerfilScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [persona, setPersona] = useState(null);
  const [cliente, setCliente] = useState(null);

  useEffect(() => {
    if (!user?.clienteId) return;
    Promise.all([Clientes.obtener(user.clienteId), Personas.obtener(user.clienteId)])
      .then(([c, p]) => { setCliente(c); setPersona(p); })
      .catch(() => {});
  }, [user]);

  const nombre = persona?.nombre || user?.nombre || 'Usuario';
  const email = cliente?.email || user?.email || '';
  const categoria = cliente?.categoria || user?.categoria || 'comun';
  const catLabel = CATEGORIAS_LABEL[categoria] || categoria.toUpperCase();
  const catColor = CATEGORIAS_COLOR[categoria] || colors.muted;

  const rows = [
    ['Mis productos', 'MisProductos'],
    ['Medios de pago', 'MedioPago'],
    ['Mis cobros', 'MisCobros'],
    ['Mis métricas', 'MisMetricas'],
    ['Mis compras', 'MisCompras'],
    ['Datos personales', 'DatosPersonales'],
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
    <Screen scroll contentStyle={{ paddingHorizontal: 22 }}>
      <Header />
      <Title>Mis compras</Title>
      {loading && <ActivityIndicator color={colors.blue} style={{ marginTop: 20 }} />}
      {!loading && registros.length === 0 && (
        <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 20 }}>Sin compras aún.</Text>
      )}
      <View style={{ gap: 12, marginTop: 12 }}>
        {registros.map((r) => (
          <TouchableOpacity key={r.id} onPress={() => navigation.navigate('CompraDetalle', r)}>
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
        {loading && <ActivityIndicator color={colors.blue} style={{ marginTop: 20 }} />}
        {!loading && registros.length === 0 && (
          <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 20 }}>Sin historial.</Text>
        )}
        <View style={{ gap: 12, marginTop: 12 }}>
          {registros.map((r) => (
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
    titulo: g.title, importe: g.importe, comision: g.comision,
    subastaId: g.subastaId, itemId: g.productoId, registroId: g.registroId,
  });
}

export function MisSubastasScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [tab, setTab] = useState(route.params?.initialTab || 'curso');
  const [subastas, setSubastas] = useState([]);
  const [ganadas, setGanadas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

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
      .catch(() => { setSubastas([]); setGanadas([]); })
      .finally(() => setLoading(false));
  };

  useEffect(() => navigation.addListener('focus', cargar), [navigation, user]);

  useEffect(() => {
    if (!route.params?.creada) return;
    setToast(`"${route.params.tituloCreada || 'Tu subasta'}" creada correctamente`);
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
  const ganadasActivas = ganadas;

  const filtradas = tab === 'ganadas' ? [] : mias.filter((a) => {
    if (tab === 'curso') return esSubastaEnCursoVendedor(a);
    if (tab === 'fin') return esSubastaFinalizada(a);
    return true;
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, height: 52 }}>
        <Display style={{ color: colors.blueLogo, fontSize: 20 }}>BIDLY</Display>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 170 }} showsVerticalScrollIndicator={false}>
        {toast && (
          <View style={s.toastOk}>
            <Ionicons name="checkmark-circle" size={20} color={colors.green} />
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600', flex: 1 }}>{toast}</Text>
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
            Todavía no ganaste ninguna subasta.
          </Text>
        )}
        {!loading && tab !== 'ganadas' && filtradas.length === 0 && (
          <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 20 }}>
            {tab === 'curso'
              ? 'No tenés subastas en vivo.'
              : tab === 'fin'
                ? 'No tenés subastas finalizadas.'
                : 'Todavía no participaste de subastas.\nOfrecé un bien desde "Publicar".'}
          </Text>
        )}
        {tab === 'ganadas' && (
          <View style={{ gap: 14 }}>
            {ganadas.map((g) => {
              const yaPaga = g.estadoPago === 'pagado' || g.reembolsada === 'si';
              return (
              <TouchableOpacity
                key={g.registroId}
                activeOpacity={0.85}
                onPress={() => (yaPaga ? navigation.navigate('CompraDetalle', g) : irAGanaste(navigation, g))}
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
                        <Display style={{ fontSize: 15, flex: 1, paddingRight: 8 }} numberOfLines={2}>{g.title}</Display>
                        <Tag label={g.tag} color={g.tagColor} />
                      </View>
                      <Text style={{ color: colors.muted, fontSize: 13 }}>{g.sub} · {g.date}</Text>
                      <Text style={{ color: colors.green, fontSize: 14, fontWeight: '800' }}>$ {g.price}</Text>
                      {!yaPaga && <Text style={{ color: colors.gold, fontSize: 12, fontWeight: '700' }}>Tocá para pagar →</Text>}
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
              );
            })}
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
                      <ImgBox style={{ width: 64, height: 64, borderRadius: 10 }} size={22} src={`${BASE_URL}/subastas/${a.identificador}/portada`} />
                      <View style={{ flex: 1, gap: 4 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Display style={{ fontSize: 15, flex: 1, paddingRight: 8 }} numberOfLines={2}>{tituloSubasta(a)}</Display>
                          <Tag label={tag.label} color={tag.color} />
                        </View>
                        <Text style={{ color: colors.muted, fontSize: 13 }}>
                          {subtituloSubasta(a)} · {formatFechaSubasta(a.fecha)}
                        </Text>
                        {a.totalItems > 1 ? (
                          <Text style={{ color: colors.muted, fontSize: 12 }}>{a.totalItems} ítems en catálogo</Text>
                        ) : null}
                        <Text style={{ color: colors.blue, fontSize: 13, fontWeight: '700', marginTop: 2 }}>Gestionar →</Text>
                      </View>
                    </View>
                  </Card>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
      {/* La creación/gestión de subastas vive en la web /admin del backend, no en la app. */}
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
            <View style={cs.calHeader}>
              <TouchableOpacity onPress={prevMonth} style={cs.calNavBtn}>
                <Ionicons name="chevron-back" size={22} color="#fff" />
              </TouchableOpacity>
              <Text style={cs.calMonthLabel}>{MESES[viewMonth]} {viewYear}</Text>
              <TouchableOpacity onPress={nextMonth} style={cs.calNavBtn}>
                <Ionicons name="chevron-forward" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={cs.calRow}>
              {DIAS_CORTOS.map(d => (<Text key={d} style={cs.calDayHeader}>{d}</Text>))}
            </View>
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
                    style={[cs.calCell, isSelected && cs.calCellSelected, isHoy && !isSelected && cs.calCellHoy]}
                    onPress={() => onSelectDay(day)}
                    disabled={isDisabled}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      cs.calDayText,
                      isDisabled && { color: colors.border },
                      isSelected && { color: '#fff', fontWeight: '800' },
                      isHoy && !isSelected && { color: colors.gold },
                    ]}>{day}</Text>
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

      <Modal visible={showHour} transparent animationType="fade" onRequestClose={() => setShowHour(false)}>
        <TouchableOpacity style={cs.modalOverlay} activeOpacity={1} onPress={() => setShowHour(false)}>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <TouchableOpacity activeOpacity={1} style={cs.pickerBox}>
              <Text style={cs.pickerTitle}>Hora</Text>
              <View style={cs.pickerGrid}>
                {HORAS_OPTS.map((h) => (
                  <TouchableOpacity key={h} style={[cs.pickerCell, hh === h && cs.pickerCellActive]} onPress={() => selectHour(h)}>
                    <Text style={cs.pickerCellText}>{h}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showMin} transparent animationType="fade" onRequestClose={() => setShowMin(false)}>
        <TouchableOpacity style={cs.modalOverlay} activeOpacity={1} onPress={() => setShowMin(false)}>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <TouchableOpacity activeOpacity={1} style={cs.pickerBox}>
              <Text style={cs.pickerTitle}>Minutos</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {MINUTOS_OPTS.map((m) => (
                  <TouchableOpacity key={m} style={[cs.pickerMinCell, mm === m && cs.pickerCellActive]} onPress={() => selectMin(m)}>
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

// ─── CREAR SUBASTA (subastador) ──────────────────────────────────────────────
const CATS_SUBASTA = ['comun', 'especial', 'plata', 'oro', 'platino'];
const MONEDAS = ['pesos', 'dolares'];

export function CrearSubastaScreen({ navigation, route }) {
  const { user } = useAuth();
  const [paso, setPaso] = useState(1);
  const [f, setF] = useState({ fecha: '', hora: '', categoria: 'comun', moneda: 'pesos', ubicacion: '' });
  const productoInicial = route.params?.productoId
    ? [{ productoId: route.params.productoId, titulo: route.params.titulo || '', precioBase: '' }]
    : [];
  const [itemsSeleccionados, setItemsSeleccionados] = useState(productoInicial);
  const [loading, setLoading] = useState(false);
  const [exito, setExito] = useState(null);

  useEffect(() => {
    const prod = route.params?.productoSeleccionado;
    if (!prod) return;
    setItemsSeleccionados((prev) => {
      if (prev.find((i) => i.productoId === prod.identificador)) return prev;
      return [...prev, { productoId: prod.identificador, titulo: prod.descripcionCatalogo || `Producto #${prod.identificador}`, precioBase: '' }];
    });
    navigation.setParams({ productoSeleccionado: undefined });
  }, [route.params?.productoSeleccionado]);

  const exitoScale = useRef(new Animated.Value(0.6)).current;
  const exitoOpacity = useRef(new Animated.Value(0)).current;
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  const setItemField = (productoId, campo, valor) => {
    setItemsSeleccionados((prev) => prev.map((i) => (i.productoId === productoId ? { ...i, [campo]: valor } : i)));
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
      try { irAMisSubastas(navigation, { creada: subasta.identificador, tituloCreada: titulo }); }
      catch { navigation.goBack(); }
    }, 1600);
  };

  const onCrear = async () => {
    const conItems = itemsSeleccionados.length > 0;
    if (conItems) {
      const sinPrecio = itemsSeleccionados.find((i) => !String(i.precioBase).trim() || parseFloat(i.precioBase) <= 0 || isNaN(parseFloat(i.precioBase)));
      if (sinPrecio) return Alert.alert('Precio faltante', 'Completá el precio base de cada producto con un valor mayor a 0.');
    }
    setLoading(true);
    try {
      const subasta = await Subastas.crear({
        fecha: f.fecha,
        hora: f.hora + ':00',
        estado: 'cerrada', // queda en espera; el subastador la abre desde el panel
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
            Catalogos.agregarItem(catalogo.identificador, { producto: it.productoId, precioBase: parseFloat(it.precioBase) })
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
        <Field placeholder="Dirección donde se realiza la subasta" value={f.ubicacion} onChangeText={set('ubicacion')} />

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

      <Card el style={{ flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 18 }}>
        <Ionicons name="calendar" size={22} color={colors.blue} />
        <View>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{formatFechaDisplay(f.fecha)}</Text>
          <Text style={{ color: colors.muted, fontSize: 12.5 }}>{f.hora} hs · {f.ubicacion}</Text>
        </View>
      </Card>

      {itemsSeleccionados.length === 0 && (
        <Card el style={{ alignItems: 'center', paddingVertical: 20, marginBottom: 14 }}>
          <Ionicons name="cube-outline" size={36} color={colors.muted} />
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 8, textAlign: 'center' }}>No hay productos aún.</Text>
          <TouchableOpacity style={{ marginTop: 12 }} onPress={() => navigation.navigate('MisProductos', { modoSeleccion: true })}>
            <Text style={{ color: colors.blue, fontWeight: '700', fontSize: 13 }}>Elegir de mis productos →</Text>
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
              <Display style={{ fontSize: 13 }} numberOfLines={2}>{item.titulo || `Producto #${item.productoId}`}</Display>
            </View>
            <TouchableOpacity onPress={() => setItemsSeleccionados(prev => prev.filter(i => i.productoId !== item.productoId))}>
              <Ionicons name="close-circle" size={22} color={colors.red} />
            </TouchableOpacity>
          </View>
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 2 }}>PRECIO BASE</Text>
            <Field placeholder="$ 0.00" value={String(item.precioBase)} onChangeText={(v) => setItemField(item.productoId, 'precioBase', v)} keyboardType="numeric" />
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

      <TouchableOpacity style={cs.addProductoBtn} onPress={() => navigation.navigate('MisProductos', { modoSeleccion: true })} activeOpacity={0.8}>
        <Ionicons name="add-circle-outline" size={20} color={colors.blue} />
        <Text style={{ color: colors.blue, fontWeight: '700', fontSize: 14 }}>Elegir de mis productos</Text>
      </TouchableOpacity>

      <View style={{ marginTop: 24 }}>
        <Btn
          title={loading ? 'Creando subasta…' : itemsSeleccionados.length > 0 ? `Crear subasta con ${itemsSeleccionados.length} producto(s)` : 'Crear subasta vacía'}
          onPress={onCrear}
          disabled={loading || !!exito}
        />
      </View>

      <Modal visible={!!exito} transparent animationType="fade">
        <View style={s.exitoOverlay}>
          <Animated.View style={[s.exitoCard, { opacity: exitoOpacity, transform: [{ scale: exitoScale }] }]}>
            <View style={s.exitoIcon}><Ionicons name="checkmark" size={42} color="#fff" /></View>
            <Display style={{ fontSize: 22, textAlign: 'center', marginTop: 16 }}>¡Subasta creada!</Display>
            <Text style={{ color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>{exito?.titulo}</Text>
            <Text style={{ color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: 10, lineHeight: 18 }}>
              Queda en espera. La abrís/cerrás desde el panel del subastador.
            </Text>
            <Text style={{ color: colors.blue, fontSize: 13, fontWeight: '700', marginTop: 18 }}>Yendo a Mis subastas…</Text>
          </Animated.View>
        </View>
      </Modal>
    </Screen>
  );
}

// ─── PUBLICAR SCREEN (dueño ofrece un bien → nace 'solicitado') ──────────────
const MIN_FOTOS = 6;

export function PublicarScreen({ navigation }) {
  const { user } = useAuth();
  const [f, setF] = useState({ titulo: '', descripcion: '' });
  const [fotos, setFotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [declaraPropiedad, setDeclaraPropiedad] = useState(false);
  const [declaraOrigen, setDeclaraOrigen] = useState(false);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  const elegirFoto = async () => {
    if (fotos.length >= MIN_FOTOS) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para agregar fotos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: MIN_FOTOS - fotos.length, quality: 0.7,
    });
    if (!result.canceled) setFotos((prev) => [...prev, ...result.assets].slice(0, MIN_FOTOS));
  };

  const quitarFoto = (idx) => setFotos((prev) => prev.filter((_, i) => i !== idx));

  const onPublicar = async () => {
    if (!f.titulo.trim() || !f.descripcion.trim()) {
      return Alert.alert('Campos requeridos', 'Completá el título y la descripción del bien.');
    }
    if (fotos.length < MIN_FOTOS) {
      return Alert.alert('Faltan fotos', `Subí al menos ${MIN_FOTOS} fotos del bien (tenés ${fotos.length}).`);
    }
    if (!declaraPropiedad || !declaraOrigen) {
      return Alert.alert('Declaraciones obligatorias',
        'Tenés que declarar que el bien te pertenece y que su origen es lícito.');
    }
    setLoading(true);
    try {
      // 1) Alta del producto (multipart: descripción + fotos + declaración de propiedad).
      const fd = new FormData();
      fd.append('descripcionCatalogo', f.titulo);
      fd.append('descripcionCompleta', f.descripcion);
      fd.append('duenio', String(user?.clienteId ?? ''));
      fd.append('declaraPropiedad', declaraPropiedad ? 'true' : 'false');
      fotos.forEach((foto, i) => {
        if (foto.file) fd.append('fotos', foto.file, `foto_${i}.jpg`);
        else fd.append('fotos', { uri: foto.uri, name: `foto_${i}.jpg`, type: foto.mimeType || 'image/jpeg' });
      });
      const prod = await Productos.crear(fd);

      // 2) Solicitud de admisión: Bidly lo inspecciona y luego propone valor + comisión.
      await Admisiones.crear({
        productoId: prod.identificador,
        duenioId: user?.clienteId,
        declaraPropiedad,
        declaraOrigen,
      });

      Alert.alert(
        'Solicitud enviada',
        'Tu bien fue enviado a admisión. Bidly lo va a inspeccionar y, si lo acepta, te propondrá un valor base y comisión para que aceptes o rechaces.',
        [{ text: 'Ver mis publicaciones', onPress: () => navigation.navigate('MisAdmisiones') },
         { text: 'Ir al inicio', style: 'cancel', onPress: () => navigation.navigate('Main') }],
      );
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo enviar la solicitud.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Header />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        <Title>Publicar{'\n'}producto</Title>
        <Sub>Completá los datos y se enviará a revisión de Bidly.</Sub>
        <SectionLabel>Fotos ({fotos.length}/{MIN_FOTOS}){fotos.length >= MIN_FOTOS ? ' ✓' : ''}</SectionLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {fotos.map((foto, i) => (
            <TouchableOpacity key={i} style={s.photo} onPress={() => quitarFoto(i)} activeOpacity={0.8}>
              <Image source={{ uri: foto.uri }} style={{ width: '100%', height: '100%', borderRadius: 10 }} resizeMode="cover" />
              <View style={s.removeOverlay}><Ionicons name="close-circle" size={20} color="#fff" /></View>
            </TouchableOpacity>
          ))}
          {fotos.length < MIN_FOTOS && (
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
          El valor base y la comisión los define Bidly tras la inspección.
        </Text>
      </ScrollView>
      <View style={{ paddingHorizontal: 22, paddingBottom: 28, paddingTop: 14 }}>
        <Btn title={loading ? 'Publicando…' : 'Publicar'} onPress={onPublicar} disabled={loading} />
      </View>
    </Screen>
  );
}

// ─── MIS MÉTRICAS ─────────────────────────────────────────────────────────────
export function MisMetricasScreen() {
  const { user } = useAuth();
  const [m, setM] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.clienteId) { setLoading(false); return; }
    Clientes.metricas(user.clienteId).then(setM).catch(() => setM(null)).finally(() => setLoading(false));
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
              <Row k="Total comprado" v={fmt(m.totalComprado)} vc={colors.green} />
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

// ─── COMPRA DETALLE (con solicitud de reembolso) ─────────────────────────────
const REEMBOLSO_LABEL = {
  ninguno:    null,
  solicitado: { label: 'REEMBOLSO PEDIDO', color: colors.gold },
  aceptado:   { label: 'REEMBOLSADA', color: colors.muted },
  rechazado:  { label: 'REEMBOLSO RECHAZADO', color: colors.red },
};

export function CompraDetalleScreen({ route }) {
  const { registroId } = route.params || {};
  const [reg, setReg] = useState(route.params || {});
  const [loading, setLoading] = useState(!!registroId);
  const [ctrl, setCtrl] = useState(false);
  const [form, setForm] = useState(false);
  const [motivo, setMotivo] = useState('');

  const cargar = () => {
    if (!registroId) { setLoading(false); return; }
    RegistroSubasta.obtener(registroId)
      .then((r) => setReg({ ...route.params, ...r, title: route.params?.title || tituloSubasta(r.subasta) }))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(cargar, [registroId]);

  const title = reg.title || 'Artículo';
  const importe = reg.importe;
  const comision = reg.comision;
  const total = importe != null ? Number(importe) + Number(comision || 0) : null;
  const pagada = reg.estadoPago === 'pagado';
  const rEstado = reg.reembolsoEstado || (reg.reembolsada === 'si' ? 'aceptado' : 'ninguno');
  const rMeta = REEMBOLSO_LABEL[rEstado];

  const solicitar = async () => {
    if (!motivo.trim()) return Alert.alert('Motivo', 'Contanos por qué querés el reembolso.');
    setCtrl(true);
    try {
      await RegistroSubasta.solicitarReembolso(registroId, motivo.trim());
      setForm(false); setMotivo('');
      Alert.alert('Solicitud enviada', 'La empresa va a revisar tu pedido de reembolso y te va a responder.');
      cargar();
    } catch (e) { Alert.alert('No se pudo solicitar', e.message || 'Intentá de nuevo.'); }
    finally { setCtrl(false); }
  };

  return (
    <Screen>
      <Header />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Title>Mi compra</Title>
        <Sub>Registro #{registroId || '—'}</Sub>
        {loading && <ActivityIndicator color={colors.blue} style={{ marginTop: 12 }} />}
        <Card el style={{ marginTop: 12, gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Display style={{ fontSize: 16, lineHeight: 20, flex: 1, paddingRight: 8 }}>{title}</Display>
            <Tag label={rMeta ? rMeta.label : pagada ? 'PAGADA ✓' : 'A PAGAR'}
                 color={rMeta ? rMeta.color : pagada ? colors.green : colors.gold} />
          </View>
          {reg.sub ? <Text style={{ color: colors.muted, fontSize: 13 }}>{reg.sub}</Text> : null}
          {reg.date ? <Text style={{ color: colors.faint, fontSize: 12 }}>{reg.date}</Text> : null}
        </Card>
        <SectionLabel>Importes</SectionLabel>
        <Card el>
          {importe != null && <Row k="Puja ganadora" v={`$ ${Number(importe).toLocaleString('es-AR')}`} />}
          {Number(comision) > 0 && <Row k="Comisión" v={`$ ${Number(comision).toLocaleString('es-AR')}`} />}
          {total != null && (
            <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8, paddingTop: 6 }}>
              <Row k="Total" v={`$ ${total.toLocaleString('es-AR')}`} vc={colors.green} bold />
            </View>
          )}
        </Card>

        <SectionLabel>Reembolso</SectionLabel>
        {rEstado === 'solicitado' && (
          <Card el>
            <Text style={{ color: colors.gold, fontWeight: '700' }}>Solicitud enviada ⏳</Text>
            <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 4 }}>La empresa está revisando tu pedido. Te avisamos cuando responda.</Text>
            {reg.motivoReembolso ? <Text style={{ color: colors.faint, fontSize: 12, marginTop: 4 }}>Motivo: {reg.motivoReembolso}</Text> : null}
          </Card>
        )}
        {rEstado === 'aceptado' && (
          <Card el><Text style={{ color: colors.green, fontWeight: '700' }}>Reembolso aceptado ✓</Text>
            <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 4 }}>Se te acreditó el dinero de la compra.</Text></Card>
        )}
        {rEstado === 'rechazado' && (
          <Card el><Text style={{ color: colors.red, fontWeight: '700' }}>Reembolso rechazado</Text>
            {reg.motivoReembolso ? <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 4 }}>Motivo: {reg.motivoReembolso}</Text> : null}</Card>
        )}
        {rEstado === 'ninguno' && !pagada && (
          <Text style={{ color: colors.muted, fontSize: 13 }}>Vas a poder pedir el reembolso una vez que la compra esté pagada.</Text>
        )}
        {rEstado === 'ninguno' && pagada && !form && (
          <Btn title="Solicitar reembolso" kind="danger" onPress={() => setForm(true)} />
        )}
        {form && (
          <Card el style={{ gap: 10 }}>
            <Field placeholder="Motivo del reembolso (producto dañado, no llegó, etc.)" value={motivo} onChangeText={setMotivo} multiline />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Btn title="Cancelar" kind="ghost" onPress={() => setForm(false)} style={{ flex: 1 }} />
              <Btn title={ctrl ? 'Enviando…' : 'Enviar solicitud'} onPress={solicitar} disabled={ctrl} style={{ flex: 1 }} />
            </View>
          </Card>
        )}
      </ScrollView>
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
    RegistroSubasta.obtener(registroId).then(setRegistro).catch(() => {}).finally(() => setLoading(false));
  }, [registroId]);

  const nombre = registro?.cliente?.nombre || 'Ganador';
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
            {registro?.importe != null && <Row k="Importe" v={`$ ${Number(registro.importe).toLocaleString('es-AR')}`} />}
          </Card>
        </ScrollView>
      )}
      <View style={{ paddingHorizontal: 22, paddingBottom: 28, paddingTop: 14 }}>
        <Btn title="Marcar entregado" onPress={() => {
          Alert.alert('Entrega registrada', 'La entrega fue marcada como completada.', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        }} />
      </View>
    </Screen>
  );
}

// ─── DATOS PERSONALES ────────────────────────────────────────────────────────
export function DatosPersonalesScreen() {
  const { user } = useAuth();
  const [persona, setPersona] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.clienteId) { setLoading(false); return; }
    Promise.all([Personas.obtener(user.clienteId), Clientes.obtener(user.clienteId)])
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
              <View style={s.dpIcon}><Ionicons name={icon} size={20} color={colors.blue} /></View>
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

// ─── MIS PRODUCTOS (con su estado de aprobación) ─────────────────────────────
// Estado real del bien = el de su ADMISIÓN (lo que maneja la web /admin), no el
// de producto_estado (que no se actualiza con ese flujo).
const PROD_LABEL = {
  solicitada:       { label: 'ESPERANDO APROBACIÓN', color: colors.gold },
  en_inspeccion:    { label: 'EN INSPECCIÓN', color: colors.blue },
  propuesta:        { label: 'PROPUESTA — REVISALA', color: colors.gold },
  aprobada:         { label: 'EN SUBASTA', color: colors.green },
  rechazada:        { label: 'RECHAZADA', color: colors.red },
  rechazada_duenio: { label: 'DEVUELTA', color: colors.muted },
};

export function MisProductosScreen({ navigation }) {
  const { user } = useAuth();
  const [productos, setProductos] = useState([]);
  const [admisiones, setAdmisiones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ctrl, setCtrl] = useState(false);

  const cargar = () => {
    if (!user?.clienteId) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      Productos.porDuenio(user.clienteId).catch(() => []),
      Admisiones.porDuenio(user.clienteId).catch(() => []),
    ])
      .then(([prods, adms]) => {
        setProductos(Array.isArray(prods) ? prods : []);
        setAdmisiones(Array.isArray(adms) ? adms : []);
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => navigation.addListener('focus', cargar), [navigation, user]);

  const admisionDe = (pid) => admisiones.find((a) => Number(a.producto?.identificador) === Number(pid));

  const aceptar = (a) => Alert.alert('Aceptar propuesta', `Valor base $${a.valorBase} y comisión $${a.comision}. ¿Aceptás?`, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Aceptar', onPress: async () => {
        setCtrl(true);
        try { await Admisiones.aprobarDuenio(a.identificador); Alert.alert('Listo', 'Tu bien entró al catálogo de la subasta.'); cargar(); }
        catch (e) { Alert.alert('Error', e.message || 'No se pudo aceptar.'); } finally { setCtrl(false); }
      } },
  ]);
  const rechazar = (a) => Alert.alert('Rechazar propuesta', 'Se devuelve el bien con gastos a tu cargo. ¿Confirmás?', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Rechazar', style: 'destructive', onPress: async () => {
        setCtrl(true);
        try { await Admisiones.rechazarDuenio(a.identificador); cargar(); }
        catch (e) { Alert.alert('Error', e.message || 'No se pudo rechazar.'); } finally { setCtrl(false); }
      } },
  ]);

  const confirmarEliminar = (p) => {
    Alert.alert('Eliminar producto', `¿Eliminar "${p.descripcionCatalogo || `Producto #${p.identificador}`}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
          try { await Productos.eliminar(p.identificador); cargar(); }
          catch (e) { Alert.alert('No se pudo eliminar', e.message || 'El producto puede estar en una subasta.'); }
        } },
    ]);
  };

  return (
    <Screen scroll contentStyle={{ paddingHorizontal: 22, paddingBottom: 40 }}>
      <Header />
      <Title>Mis{'\n'}productos</Title>
      <Sub>Los bienes que ofreciste a subasta y en qué estado están.</Sub>
      {loading && <ActivityIndicator color={colors.blue} style={{ marginTop: 20 }} />}
      {!loading && productos.length === 0 && (
        <Card el style={{ alignItems: 'center', paddingVertical: 28, gap: 12 }}>
          <Ionicons name="cube-outline" size={44} color={colors.muted} />
          <Text style={{ color: colors.muted, fontSize: 13, textAlign: 'center' }}>Todavía no publicaste ningún producto.</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Publicar')}>
            <Text style={{ color: colors.blue, fontWeight: '700', fontSize: 13 }}>+ Publicar mi primer producto</Text>
          </TouchableOpacity>
        </Card>
      )}
      <View style={{ gap: 12 }}>
        {productos.map((p) => {
          const a = admisionDe(p.identificador);
          const estado = a?.estado || 'solicitada';
          const meta = PROD_LABEL[estado] || PROD_LABEL.solicitada;
          const enSubasta = estado === 'aprobada';
          return (
            <Card key={p.identificador} el style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <View style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: colors.cardEl, overflow: 'hidden' }}>
                  <Image source={{ uri: `${BASE_URL}/productos/${p.identificador}/portada` }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <Display style={{ fontSize: 14, flex: 1, marginRight: 8 }} numberOfLines={1}>
                      {p.descripcionCatalogo || `Producto #${p.identificador}`}
                    </Display>
                    <Tag label={meta.label} color={meta.color} />
                  </View>
                  {!!p.descripcionCompleta && (
                    <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={2}>{p.descripcionCompleta}</Text>
                  )}
                  <Text style={{ color: colors.blue, fontSize: 11, fontWeight: '700', marginTop: 4 }}>ID #{p.identificador}</Text>
                </View>
                {!enSubasta && (
                  <TouchableOpacity onPress={() => confirmarEliminar(p)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="trash-outline" size={22} color="#ef4444" />
                  </TouchableOpacity>
                )}
              </View>

              {estado === 'solicitada' && (
                <Text style={{ color: colors.muted, fontSize: 12 }}>Bidly lo está revisando. Te avisamos cuando avance.</Text>
              )}
              {estado === 'en_inspeccion' && a?.direccionEnvio && (
                <Text style={{ color: colors.muted, fontSize: 12.5 }}>Enviá el bien a: {a.direccionEnvio}</Text>
              )}
              {estado === 'rechazada' && a?.observacion && (
                <Text style={{ color: colors.red, fontSize: 12.5 }}>Motivo: {a.observacion}</Text>
              )}
              {estado === 'aprobada' && (
                <Text style={{ color: colors.green, fontSize: 12.5 }}>Incluido en la subasta. ¡Suerte con el remate!</Text>
              )}
              {estado === 'propuesta' && a && (
                <View style={{ gap: 4 }}>
                  <Text style={{ color: colors.gold, fontSize: 12.5, fontWeight: '700' }}>Bidly te propuso un precio. Aceptalo para entrar a la subasta:</Text>
                  <Row k="Valor base" v={`$${Number(a.valorBase).toLocaleString('es-AR')}`} />
                  <Row k="Comisión" v={`$${Number(a.comision).toLocaleString('es-AR')}`} />
                  {a.subasta?.fecha && <Row k="Subasta" v={`${a.subasta.fecha} · ${a.subasta.ubicacion || ''}`} />}
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                    <Btn title="Aceptar" onPress={() => aceptar(a)} disabled={ctrl} style={{ flex: 1 }} />
                    <Btn title="Rechazar" kind="danger" onPress={() => rechazar(a)} disabled={ctrl} style={{ flex: 1 }} />
                  </View>
                </View>
              )}
            </Card>
          );
        })}
      </View>
      <View style={{ marginTop: 24 }}>
        <Btn title="+ Publicar nuevo producto" onPress={() => navigation.navigate('Publicar')} />
      </View>
    </Screen>
  );
}

// ─── MIS PUBLICACIONES (admisiones del dueño) ────────────────────────────────
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

  const aceptar = (a) => Alert.alert('Aceptar propuesta', `Valor base $${a.valorBase} y comisión $${a.comision}. ¿Aceptás?`, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Aceptar', onPress: async () => {
        setCtrl(true);
        try { await Admisiones.aprobarDuenio(a.identificador); Alert.alert('Listo', 'Tu bien se incluyó en el catálogo.'); cargar(); }
        catch (e) { Alert.alert('Error', e.message || 'No se pudo aceptar.'); } finally { setCtrl(false); }
      } },
  ]);

  const rechazar = (a) => Alert.alert('Rechazar propuesta', 'Se procederá a la devolución con gastos a tu cargo. ¿Confirmás?', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Rechazar', style: 'destructive', onPress: async () => {
        setCtrl(true);
        try { await Admisiones.rechazarDuenio(a.identificador); cargar(); }
        catch (e) { Alert.alert('Error', e.message || 'No se pudo rechazar.'); } finally { setCtrl(false); }
      } },
  ]);

  return (
    <Screen>
      <Header />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Title>Mis{'\n'}publicaciones</Title>
        <Sub>Seguí el estado de los bienes que ofreciste a subasta.</Sub>
        {loading && <ActivityIndicator color={colors.blue} style={{ marginTop: 20 }} />}
        {!loading && admisiones.length === 0 && (
          <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 20 }}>
            Todavía no ofreciste ningún bien.{'\n'}Usá "Publicar" para enviar uno.
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
                {a.esColeccion === 'si' && a.nombreColeccion && (
                  <Text style={{ color: colors.blue, fontSize: 12 }}>Colección: {a.nombreColeccion}</Text>
                )}
                {a.estado === 'en_inspeccion' && <Text style={{ color: colors.muted, fontSize: 12.5 }}>Enviá el bien a: {a.direccionEnvio}</Text>}
                {a.estado === 'rechazada' && <Text style={{ color: colors.red, fontSize: 12.5 }}>Motivo: {a.observacion}</Text>}
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
                  <Text style={{ color: colors.green, fontSize: 12.5 }}>Incluido en la subasta y asegurado. ¡Suerte con el remate!</Text>
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
export function MisCobrosScreen() {
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
    Promise.all([Payouts.porDuenio(user.clienteId), Payouts.cuentas(user.clienteId)])
      .then(([ps, cs]) => { setPayouts(Array.isArray(ps) ? ps : []); setCuentas(Array.isArray(cs) ? cs : []); })
      .catch(() => { setPayouts([]); setCuentas([]); })
      .finally(() => setLoading(false));
  };
  useEffect(cargar, [user]);

  const declararCuenta = async () => {
    if (!nueva.alias.trim()) return Alert.alert('Cuenta', 'Ingresá el CBU / IBAN / alias.');
    setCtrl(true);
    try {
      await Payouts.declararCuenta({ duenioId: user.clienteId, ...nueva });
      setForm(false); setNueva({ alias: '', banco: '', pais: '', moneda: 'pesos', esExterior: false }); cargar();
    } catch (e) { Alert.alert('Error', e.message || 'No se pudo declarar la cuenta.'); } finally { setCtrl(false); }
  };

  const cobrar = (p) => {
    if (cuentas.length === 0) return Alert.alert('Falta una cuenta', 'Declará una cuenta a la vista antes de cobrar.', [
      { text: 'Declarar', onPress: () => setForm(true) }, { text: 'Cancelar', style: 'cancel' }]);
    const cuenta = cuentas[0];
    Alert.alert('Cobrar', `Se acreditarán $${Number(p.importeNeto).toLocaleString('es-AR')} en ${cuenta.alias}. ¿Confirmás?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cobrar', onPress: async () => {
          setCtrl(true);
          try { await Payouts.cobrar(p.identificador, cuenta.identificador); cargar(); }
          catch (e) { Alert.alert('Error', e.message || 'No se pudo cobrar.'); } finally { setCtrl(false); }
        } },
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
                  {p.producto?.titulo || `Producto #${p.producto?.identificador ?? p.producto}`}
                </Display>
                <Tag label={p.estado === 'pagado' ? 'ACREDITADO' : 'PENDIENTE'} color={p.estado === 'pagado' ? colors.green : colors.gold} />
              </View>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {p.origen === 'empresa' ? 'Comprado por la empresa (sin pujas)' : 'Vendido en subasta'}
              </Text>
              <Row k="Bruto" v={`$${Number(p.importeBruto).toLocaleString('es-AR')}`} />
              <Row k="Comisión" v={`$${Number(p.comision).toLocaleString('es-AR')}`} />
              <Row k="Neto a cobrar" v={`$${Number(p.importeNeto).toLocaleString('es-AR')}`} vc={colors.green} bold />
              {p.estado !== 'pagado' && <Btn title="Cobrar" onPress={() => cobrar(p)} disabled={ctrl} style={{ marginTop: 4 }} />}
            </Card>
          ))}
        </View>
      </ScrollView>
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
  winnerAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.cardEl, alignItems: 'center', justifyContent: 'center' },
  dpIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(59,130,246,0.12)', alignItems: 'center', justifyContent: 'center' },
  toastOk: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(55,214,111,0.12)', borderWidth: 1, borderColor: colors.green,
    borderRadius: 12, padding: 14, marginBottom: 12,
  },
  decl: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 12, marginBottom: 8,
  },
  exitoOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  exitoCard: { width: '100%', backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.borderHi, padding: 28, alignItems: 'center' },
  exitoIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
});

const cs = StyleSheet.create({
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
  timePicker: { backgroundColor: colors.cardEl, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8,
    minWidth: 56, alignItems: 'center', justifyContent: 'center' },
  timePickerText: { color: '#fff', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  pickerBox: { backgroundColor: colors.card, borderRadius: 20, padding: 20, margin: 24, borderWidth: 1, borderColor: colors.border },
  pickerTitle: { color: '#fff', fontWeight: '800', fontSize: 15, marginBottom: 14 },
  pickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickerCell: { width: 50, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: colors.cardEl },
  pickerCellActive: { backgroundColor: colors.blue },
  pickerCellText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  pickerMinCell: { flex: 1, paddingVertical: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.cardEl },
  addProductoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.blueSoft, borderWidth: 1, borderColor: colors.blue, borderRadius: 12, paddingVertical: 14, marginTop: 4 },
});
