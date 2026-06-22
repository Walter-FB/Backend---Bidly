// BIDLY — Perfil, MisSubastas, MisCompras, Historial, Publicar, DatosGanador.
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Image, Modal } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Header, Title, Sub, SectionLabel, Btn, Chip, Card, Field, Tag, ImgBox, BottomBar, Row, Display } from '../components/ui';
import { colors } from '../theme/theme';
import { AuctionCard } from './HomeScreens';
import { useAuth } from '../context/AuthContext';
import { BASE_URL, getToken } from '../api/client';
import { Clientes, Personas, RegistroSubasta, Subastas, Productos, Subastadores, Catalogos } from '../api/endpoints';

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
    title: `Subasta #${r.subasta?.identificador || r.identificador}`,
    date: fecha,
    sub: r.subasta?.categoria || '',
    price: r.importe ? Number(r.importe).toLocaleString('es-AR', { maximumFractionDigits: 2 }) : '—',
    tag: reembolsada ? 'Reembolsada' : 'Ganada',
    tagColor: reembolsada ? colors.red : colors.green,
    registroId: r.identificador,
    importe: r.importe,
    comision: r.comision,
    reembolsada: r.reembolsada,
  };
}

// ─── PERFIL SCREEN ────────────────────────────────────────────────────────────
export function PerfilScreen({ navigation }) {
  const { user, logout, isAdmin } = useAuth();
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
        {isAdmin && (
          <TouchableOpacity style={s.listItem} onPress={() => navigation.navigate('DashboardAdmin')}>
            <Text style={{ color: '#fff', fontSize: 14.5, fontWeight: '600' }}>Panel de administración</Text>
            <Tag label="ADMIN" color={colors.red} />
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
            onPress={() => navigation.navigate('Reembolso', { registroId: r.id, importe: r.importe, titulo: r.title })}
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
              <TouchableOpacity key={r.id} onPress={() => navigation.navigate('DatosGanador', { registroId: r.registroId })}>
                <ListRow item={r} />
              </TouchableOpacity>
            ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── MIS SUBASTAS ─────────────────────────────────────────────────────────────
export function MisSubastasScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [tab, setTab] = useState('curso');
  const [subastas, setSubastas] = useState([]);
  const [loading, setLoading] = useState(true);

  const cargar = () => {
    if (!user?.clienteId) { setLoading(false); return; }
    setLoading(true);
    Subastas.porSubastador(user.clienteId)
      .then((data) => setSubastas(data || []))
      .catch(() => setSubastas([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', cargar);
    return unsubscribe;
  }, [navigation, user]);

  const filtradas = subastas.filter((a) => {
    if (tab === 'curso') return a.estado === 'abierta';
    if (tab === 'fin') return a.estado === 'cerrada';
    return true;
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, height: 52 }}>
        <Display style={{ color: colors.blueLogo, fontSize: 20 }}>BIDLY</Display>
        <TouchableOpacity onPress={() => navigation.navigate('Notificaciones')}>
          <Ionicons name="notifications-outline" size={21} color="#fff" />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 170 }} showsVerticalScrollIndicator={false}>
        <Title>Mis subastas</Title>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 12 }}>
          <View style={{ flexDirection: 'row', gap: 9 }}>
            <Chip label={`En curso · ${subastas.filter(a => a.estado === 'abierta').length}`} active={tab === 'curso'} dot={tab === 'curso'} onPress={() => setTab('curso')} />
            <Chip label="Finalizadas" active={tab === 'fin'} onPress={() => setTab('fin')} />
            <Chip label={`Todas · ${subastas.length}`} active={tab === 'todas'} onPress={() => setTab('todas')} />
          </View>
        </ScrollView>
        {loading && <ActivityIndicator color={colors.blue} style={{ marginTop: 20 }} />}
        {!loading && filtradas.length === 0 && (
          <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 20 }}>
            Aún no tenés subastas.{'\n'}Presioná "Nueva subasta" para comenzar.
          </Text>
        )}
        <View style={{ gap: 14 }}>
          {filtradas.map((a) => (
            <TouchableOpacity
              key={a.identificador}
              onPress={() => navigation.navigate('SubastaAdmin', { subastaId: a.identificador, subasta: a })}
              activeOpacity={0.85}
            >
              <Card el style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Display style={{ fontSize: 15 }}>Subasta #{a.identificador}</Display>
                  <Tag
                    label={a.estado === 'abierta' ? 'EN VIVO' : 'CERRADA'}
                    color={a.estado === 'abierta' ? colors.green : colors.muted}
                  />
                </View>
                <Text style={{ color: colors.muted, fontSize: 13 }}>
                  {a.categoria ? a.categoria.toUpperCase() : '—'} · {a.fecha || '—'}
                </Text>
                {a.ubicacion ? (
                  <Text style={{ color: colors.muted, fontSize: 12 }}>📍 {a.ubicacion}</Text>
                ) : null}
                <Text style={{ color: colors.blue, fontSize: 13, fontWeight: '700', marginTop: 4 }}>
                  Gestionar →
                </Text>
              </Card>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <BottomBar>
        <Btn title="+ Nueva subasta" onPress={() => navigation.navigate('CrearSubasta')} />
      </BottomBar>
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
      {!value && (
        <Text style={{ color: colors.gold, fontSize: 11.5, marginTop: 4 }}>
          ⚠ Mínimo: {formatFechaDisplay(toYMD(minDate))}
        </Text>
      )}

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
    ? [{ productoId: route.params.productoId, titulo: route.params.titulo || '', precioBase: '', comision: '10' }]
    : [];
  const [itemsSeleccionados, setItemsSeleccionados] = useState(productoInicial);
  const [loading, setLoading] = useState(false);
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
        comision: '10',
      }];
    });
  };

  const onSiguiente = () => {
    if (!f.fecha) return Alert.alert('Fecha requerida', 'Seleccioná una fecha en el calendario.');
    if (!f.hora) return Alert.alert('Hora requerida', 'Ingresá la hora de inicio.');
    if (!f.ubicacion.trim()) return Alert.alert('Ubicación requerida', 'Completá la dirección.');
    setPaso(2);
  };

  const onCrear = async () => {
    if (itemsSeleccionados.length === 0) {
      return Alert.alert('Sin productos', 'Agregá al menos un producto a la subasta.');
    }
    const sinPrecio = itemsSeleccionados.find((i) => !String(i.precioBase).trim());
    if (sinPrecio) {
      return Alert.alert('Precio faltante', 'Completá el precio base de cada producto.');
    }
    setLoading(true);
    try {
      await Subastadores.crear({ identificador: user.clienteId }).catch(() => {});

      const subasta = await Subastas.crear({
        fecha: f.fecha,
        hora: f.hora + ':00',
        estado: 'cerrada',
        subastador: user.clienteId,
        ubicacion: f.ubicacion,
        categoria: f.categoria,
        moneda: f.moneda,
      });

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
            comision: parseFloat(it.comision) || 10,
          })
        )
      );

      Alert.alert(
        '¡Subasta creada!',
        `Subasta #${subasta.identificador} creada con ${itemsSeleccionados.length} producto(s). Abrila desde "Mis subastas" cuando estés listo.`,
        [{ text: 'Ir a mis subastas', onPress: () => navigation.navigate('Subastas') }]
      );
    } catch (e) {
      Alert.alert('Error al crear subasta', e.message || 'Revisá los datos e intentá nuevamente.');
    } finally {
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
            onPress={() => navigation.navigate('MisProductos', { onSeleccionar: agregarProducto })}
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
                <Display style={{ fontSize: 13 }}>Producto #{item.productoId}</Display>
                {item.titulo ? <Text style={{ color: colors.muted, fontSize: 11 }}>{item.titulo}</Text> : null}
              </View>
            </View>
            <TouchableOpacity onPress={() => setItemsSeleccionados(prev => prev.filter(i => i.productoId !== item.productoId))}>
              <Ionicons name="close-circle" size={22} color={colors.red} />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4 }}>PRECIO BASE</Text>
              <Field
                placeholder="$ 0.00"
                value={String(item.precioBase)}
                onChangeText={(v) => setItemField(item.productoId, 'precioBase', v)}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4 }}>COMISIÓN</Text>
              <Field
                placeholder="$ 10"
                value={String(item.comision)}
                onChangeText={(v) => setItemField(item.productoId, 'comision', v)}
                keyboardType="numeric"
              />
            </View>
          </View>
        </Card>
      ))}

      <TouchableOpacity
        style={cs.addProductoBtn}
        onPress={() => navigation.navigate('MisProductos', { onSeleccionar: agregarProducto })}
        activeOpacity={0.8}
      >
        <Ionicons name="add-circle-outline" size={20} color={colors.blue} />
        <Text style={{ color: colors.blue, fontWeight: '700', fontSize: 14 }}>Elegir de mis productos</Text>
      </TouchableOpacity>

      <View style={{ marginTop: 24 }}>
        <Btn title={loading ? 'Creando subasta…' : `Crear subasta con ${itemsSeleccionados.length} producto(s)`} onPress={onCrear} disabled={loading || itemsSeleccionados.length === 0} />
      </View>
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
    if (!f.titulo.trim() || !f.precio.trim()) {
      return Alert.alert('Campos requeridos', 'Completá al menos el título y el precio base.');
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
          fd.append('fotos', { uri: fotos[i].uri, name: `foto_${i}.jpg`, type: fotos[i].mimeType || 'image/jpeg' });
          xhr.send(fd);
        });
      }

      Alert.alert(
        '¡Producto publicado!',
        `Producto #${producto.identificador} listo. ¿Querés crear una subasta con este producto ahora?`,
        [
          {
            text: 'Crear subasta',
            onPress: () => navigation.navigate('CrearSubasta', {
              productoId: producto.identificador,
              titulo: f.titulo,
            }),
          },
          { text: 'Ir al inicio', style: 'cancel', onPress: () => navigation.navigate('Main') },
        ],
      );
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo publicar el producto.');
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
              <Ionicons name="add" size={26} color={colors.blue} />
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
          <Field placeholder="Precio base ($)" value={f.precio} onChangeText={set('precio')} keyboardType="numeric" />
          <Field placeholder="Descripción completa" value={f.descripcion} onChangeText={set('descripcion')} multiline />
        </View>
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 22, paddingBottom: 28, paddingTop: 14 }}>
        <Btn title="Borrador" kind="ghost" onPress={onBorrador} style={{ flex: 1 }} />
        <Btn title={loading ? 'Publicando…' : 'Publicar'} onPress={onPublicar} disabled={loading} style={{ flex: 1 }} />
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
                {registro ? `Subasta #${registro.subasta?.identificador}` : '—'}
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
  const onSeleccionar = route.params?.onSeleccionar;
  const modoSeleccion = !!onSeleccionar;
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
    onSeleccionar(p);
    navigation.goBack();
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
        {productos.map((p) => (
          <TouchableOpacity
            key={p.identificador}
            onPress={modoSeleccion ? () => seleccionar(p) : undefined}
            activeOpacity={modoSeleccion ? 0.75 : 1}
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
              {modoSeleccion && (
                <Ionicons name="add-circle" size={28} color={colors.blue} />
              )}
            </Card>
          </TouchableOpacity>
        ))}
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
