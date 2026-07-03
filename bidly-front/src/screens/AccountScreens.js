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
import { Clientes, Personas, RegistroSubasta, Subastas, Productos, Admisiones, Payouts } from '../api/endpoints';
import { useNotifBadge } from '../hooks/useNotifBadge';
import { tituloSubasta, subtituloSubasta, formatFechaSubasta, esSubastaFinalizada, esSubastaEnCursoVendedor, esMiSubasta, tagEstadoSubasta } from '../utils/subasta';

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
                {a.alertaOrigen === 'si' && (
                  <Text style={{ color: colors.red, fontSize: 12.5 }}>
                    ⚠ Acreditá el origen lícito del bien{a.alertaOrigenMotivo ? `: ${a.alertaOrigenMotivo}` : ''}
                  </Text>
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
                  <>
                    <Text style={{ color: colors.green, fontSize: 12.5 }}>Incluido en la subasta y asegurado. ¡Suerte con el remate!</Text>
                    {a.ubicacion && (
                      <Row k="Depósito" v={`${a.ubicacion.deposito}${a.ubicacion.sector ? ` · ${a.ubicacion.sector}` : ''}`} />
                    )}
                    {a.poliza && (
                      <Row k="Póliza" v={`${a.poliza.nroPoliza} · $${Number(a.poliza.importe || 0).toLocaleString('es-AR')}`} />
                    )}
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
});
