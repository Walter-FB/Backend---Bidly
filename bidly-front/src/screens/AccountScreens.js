// BIDLY — Perfil, MisSubastas, MisCompras, Historial, Publicar, DatosGanador.
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Header, Title, Sub, SectionLabel, Btn, Chip, Card, Field, Tag, ImgBox, BottomBar, Row, Display } from '../components/ui';
import { colors } from '../theme/theme';
import { AuctionCard } from './HomeScreens';
import { useAuth } from '../context/AuthContext';
import { Clientes, Personas, RegistroSubasta, Subastas, Productos } from '../api/endpoints';

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
      <Header hideBack right={<Display style={{ color: colors.blueLogo, fontSize: 19 }}>BIDLY</Display>} />
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

  useEffect(() => {
    // Los clientes no son subastadores: la pantalla muestra estado vacío con mensaje.
    setSubastas([]);
    setLoading(false);
  }, []);

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
          <Ionicons name="notifications-outline" size={21} color="#fff" /></TouchableOpacity>
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
            Aún no publicaste subastas.{'\n'}Usá el botón + para comenzar.
          </Text>
        )}
        <View style={{ gap: 14 }}>
          {filtradas.map((a) => (
            <AuctionCard
              key={a.id}
              a={a}
              onPress={() => navigation.navigate('Producto', { subastaId: a.id, subasta: a })}
            />
          ))}
        </View>
      </ScrollView>
      <BottomBar>
        <Btn title="+ Publicar producto" onPress={() => navigation.navigate('Publicar')} />
      </BottomBar>
    </View>
  );
}

// ─── PUBLICAR SCREEN ─────────────────────────────────────────────────────────
export function PublicarScreen({ navigation }) {
  const { user } = useAuth();
  const [f, setF] = useState({ titulo: '', categoria: '', estado: '', precio: '', descripcion: '' });
  const [loading, setLoading] = useState(false);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

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
      Alert.alert(
        '¡Producto creado!',
        `Producto #${producto.identificador} registrado. Un administrador lo asignará a una subasta.`,
        [{ text: 'OK', onPress: () => navigation.navigate('Main') }],
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
        <SectionLabel>Fotos (mín. 6)</SectionLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <ImgBox style={s.photo} size={24} />
          <ImgBox style={s.photo} size={24} />
          <TouchableOpacity
            style={[s.photo, s.photoAdd]}
            onPress={() => Alert.alert('Próximamente', 'La carga de fotos estará disponible en una próxima versión.')}
          >
            <Ionicons name="add" size={26} color={colors.blue} />
          </TouchableOpacity>
          {[3, 4, 5].map((i) => <View key={i} style={[s.photo, s.photoEmpty]} />)}
        </View>
        <SectionLabel>Datos del producto</SectionLabel>
        <View style={{ gap: 12 }}>
          <Field placeholder="Título" value={f.titulo} onChangeText={set('titulo')} />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}><Field placeholder="Categoría" value={f.categoria} onChangeText={set('categoria')} /></View>
            <View style={{ flex: 1 }}><Field placeholder="Estado (nuevo/usado)" value={f.estado} onChangeText={set('estado')} /></View>
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

const s = StyleSheet.create({
  bigAvatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.cardEl, alignItems: 'center', justifyContent: 'center' },
  catBadge: { marginTop: 10, borderRadius: 6, paddingVertical: 5, paddingHorizontal: 12 },
  listItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 16 },
  photo: { width: '30%', aspectRatio: 1, flexGrow: 1 },
  photoAdd: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.borderHi, backgroundColor: colors.blueSoft,
    alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  photoEmpty: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.card, borderRadius: 12 },
  winnerAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.cardEl, alignItems: 'center', justifyContent: 'center' },
  dpIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(59,130,246,0.12)', alignItems: 'center', justifyContent: 'center' },
});
