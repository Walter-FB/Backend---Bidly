// BIDLY — Producto, SubastaEnVivo, Ganaste, SubastaFinalizada.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Header, Title, SectionLabel, Btn, Card, LiveBadge, Tag, ImgBox, BottomBar, Row, Display } from '../components/ui';
import { colors } from '../theme/theme';
import { Subastas, Pujas, Asistentes } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function formatImporte(importe, moneda) {
  if (importe == null) return '—';
  const simbolo = moneda === 'dolares' ? 'U$D' : '$';
  return `${simbolo} ${Number(importe).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
}

function formatTimer(fechaStr, horaStr) {
  if (!fechaStr) return '—';
  try {
    const dt = new Date(`${fechaStr}T${horaStr || '00:00'}`);
    const now = new Date();
    const diffMs = dt - now;
    if (diffMs <= 0) return 'Finalizada';
    const diffH = Math.floor(diffMs / 3600000);
    const diffM = Math.floor((diffMs % 3600000) / 60000);
    if (diffH > 0) return `${diffH}h ${diffM}m`;
    return `${diffM}m`;
  } catch {
    return fechaStr;
  }
}

function calcSecondsLeft(fechaStr, horaStr) {
  if (!fechaStr) return null;
  try {
    const dt = new Date(`${fechaStr}T${horaStr || '00:00'}`);
    return Math.max(0, Math.floor((dt - new Date()) / 1000));
  } catch {
    return null;
  }
}

function formatCountdown(seconds) {
  if (seconds == null) return '—';
  if (seconds <= 0) return 'Finalizada';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─── PRODUCTO SCREEN ──────────────────────────────────────────────────────────
export function ProductoScreen({ navigation, route }) {
  const subastaId = route.params?.subastaId || route.params?.subasta?.id;
  const subastaPreview = route.params?.subasta;

  const [subasta, setSubasta] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!subastaId) { setLoading(false); return; }
    Promise.all([
      Subastas.obtener(subastaId),
      Subastas.catalogos(subastaId),
    ])
      .then(([s, catalogoItems]) => {
        setSubasta(s);
        setItems(catalogoItems || []);
      })
      .catch((e) => setError(e.message || 'No se pudo cargar la subasta.'))
      .finally(() => setLoading(false));
  }, [subastaId]);

  if (loading) {
    return (
      <Screen><Header />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.blue} size="large" />
        </View>
      </Screen>
    );
  }

  if (error || !subasta) {
    return (
      <Screen><Header />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 26 }}>
          <Text style={{ color: colors.muted, textAlign: 'center' }}>{error || 'Subasta no encontrada.'}</Text>
          <Btn title="Volver" onPress={() => navigation.goBack()} style={{ marginTop: 16 }} />
        </View>
      </Screen>
    );
  }

  const primerItem = items[0];
  const titulo = primerItem?.producto?.descripcionCatalogo || `Subasta #${subasta.identificador}`;
  const categoria = `${subasta.categoria || 'General'} · ${subasta.ubicacion || ''}`.replace(/·\s*$/, '').trim();
  const precioBase = primerItem?.precioBase;
  const viva = subasta.estado === 'abierta';

  return (
    <Screen>
      <Header />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <View>
          <ImgBox style={{ width: '100%', height: 230 }} size={42} />
          {viva && <LiveBadge style={{ position: 'absolute', top: 12, left: 12 }} />}
        </View>
        {items.length > 1 && (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            {items.slice(0, 4).map((_, i) => <ImgBox key={i} style={{ flex: 1, height: 56 }} size={18} />)}
          </View>
        )}
        <Text style={st.kicker}>{categoria.toUpperCase()}</Text>
        <Title style={{ fontSize: 26, marginTop: 6 }}>{titulo}</Title>
        <View style={{ flexDirection: 'row', gap: 20, marginVertical: 12 }}>
          <View>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Precio base</Text>
            <Text style={{ color: colors.green, fontSize: 20, fontWeight: '800' }}>
              {formatImporte(precioBase, subasta.moneda)}
            </Text>
          </View>
          <View>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Cierra</Text>
            <Text style={{ color: colors.gold, fontSize: 20, fontWeight: '800' }}>
              {formatTimer(subasta.fecha, subasta.hora)}
            </Text>
          </View>
        </View>

        {primerItem?.producto?.descripcionCompleta && (
          <>
            <SectionLabel>Descripción</SectionLabel>
            <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 22 }}>
              {primerItem.producto.descripcionCompleta}
            </Text>
          </>
        )}

        <Card style={{ marginTop: 16, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <View style={st.avatar}><Ionicons name="person" size={20} color="#fff" /></View>
          <View>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Subastador verificado</Text>
            <Text style={{ color: colors.muted, fontSize: 12.5 }}>
              {items.length} item{items.length !== 1 ? 's' : ''} en esta subasta
            </Text>
          </View>
        </Card>

        {items.length > 0 && (
          <>
            <SectionLabel>Items del catálogo</SectionLabel>
            {items.map((item) => (
              <Card key={item.identificador} el style={{ marginBottom: 10, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <ImgBox style={{ width: 50, height: 50 }} size={18} />
                <View style={{ flex: 1 }}>
                  <Display style={{ fontSize: 13 }} numberOfLines={1}>
                    {item.producto?.descripcionCatalogo || `Item #${item.identificador}`}
                  </Display>
                  <Text style={{ color: colors.green, fontSize: 13, fontWeight: '800', marginTop: 2 }}>
                    {formatImporte(item.precioBase, subasta.moneda)}
                  </Text>
                </View>
              </Card>
            ))}
          </>
        )}
      </ScrollView>

      {viva && primerItem && (
        <BottomBar>
          <Btn
            title="Ir a la subasta en vivo"
            onPress={() => navigation.navigate('SubastaEnVivo', {
              subastaId: subasta.identificador,
              itemId: primerItem.identificador,
              precioBase: primerItem.precioBase,
              titulo,
              moneda: subasta.moneda,
              comision: primerItem.comision,
              fecha: subasta.fecha,
              hora: subasta.hora,
            })}
          />
        </BottomBar>
      )}
    </Screen>
  );
}

// ─── SUBASTA EN VIVO ──────────────────────────────────────────────────────────
export function SubastaEnVivoScreen({ navigation, route }) {
  const { user, logout } = useAuth();
  const {
    subastaId,
    itemId,
    precioBase = 0,
    titulo = 'Subasta en vivo',
    moneda = 'pesos',
    comision = 0,
    fecha,
    hora,
  } = route.params || {};

  const [pujas, setPujas] = useState([]);
  const [asistenteId, setAsistenteId] = useState(null);
  const [loadingPujas, setLoadingPujas] = useState(true);
  const [pujando, setPujando] = useState(false);
  const [pollingError, setPollingError] = useState(false);
  const [timeLeft, setTimeLeft] = useState(() => calcSecondsLeft(fecha, hora));
  const mounted = useRef(true);

  useEffect(() => {
    return () => { mounted.current = false; };
  }, []);

  // Countdown ticker — actualiza cada segundo.
  useEffect(() => {
    if (!fecha) return;
    const tick = setInterval(() => {
      const s = calcSecondsLeft(fecha, hora);
      setTimeLeft(s);
      if (s <= 0) clearInterval(tick);
    }, 1000);
    return () => clearInterval(tick);
  }, [fecha, hora]);

  // Inscribir al usuario como asistente (solo si tiene cuenta).
  useEffect(() => {
    if (!user?.clienteId || !subastaId) return;
    Asistentes.inscribir(user.clienteId, subastaId)
      .then((a) => { if (mounted.current) setAsistenteId(a.identificador); })
      .catch(() => {});
  }, [user, subastaId]);

  // Cargar pujas y refrescar cada 5 segundos.
  const cargarPujas = useCallback(() => {
    if (!itemId) return;
    Pujas.porItem(itemId)
      .then((data) => {
        if (!mounted.current) return;
        setPujas(data || []);
        setPollingError(false);
      })
      .catch(() => { if (mounted.current) setPollingError(true); })
      .finally(() => { if (mounted.current) setLoadingPujas(false); });
  }, [itemId]);

  useEffect(() => {
    cargarPujas();
    const interval = setInterval(cargarPujas, 5000);
    return () => clearInterval(interval);
  }, [cargarPujas]);

  // Calcular puja actual y próximo importe.
  const pujaActual = pujas.length > 0 ? pujas[0].importe : null;
  const minIncremento = precioBase > 0
    ? Math.ceil(Number(precioBase) * 0.01 * 100) / 100
    : 1;
  const proximaPuja = pujaActual != null
    ? Number(pujaActual) + minIncremento
    : Number(precioBase);

  const onPujar = async () => {
    // Invitado: mostrar aviso y redirigir al login.
    if (user?.isGuest) {
      Alert.alert(
        'Necesitás una cuenta',
        'Para pujar en subastas tenés que iniciar sesión o crear una cuenta.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Iniciar sesión', onPress: logout },
        ],
      );
      return;
    }
    if (!asistenteId) {
      return Alert.alert('Espera', 'Estamos registrando tu acceso a la subasta. Intentá en un momento.');
    }
    setPujando(true);
    try {
      await Pujas.pujar(asistenteId, itemId, proximaPuja);
      cargarPujas();
    } catch (e) {
      Alert.alert(
        'No se pudo pujar',
        e.data?.error || e.message || 'Error al registrar la puja.',
      );
    } finally {
      setPujando(false);
    }
  };

  const esLidero = !user?.isGuest && pujas.length > 0 &&
    pujas[0].asistente?.identificador === asistenteId;

  const countdownColor = timeLeft != null && timeLeft < 300 ? colors.red ?? '#ff4d4d' : colors.gold;

  return (
    <Screen>
      <Header />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View>
          <ImgBox style={{ width: '100%', height: 170 }} size={40} />
          <LiveBadge style={{ position: 'absolute', top: 12, left: 12 }} />
        </View>
        <Display style={{ fontSize: 20, marginVertical: 14, lineHeight: 23 }}>{titulo}</Display>

        <Card el style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View>
            <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>Precio base</Text>
            <Text style={{ color: colors.gold, fontSize: 24, fontWeight: '800' }}>
              {formatImporte(precioBase, moneda)}
            </Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Cierra en</Text>
            <Text style={{ color: countdownColor, fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
              {formatCountdown(timeLeft)}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Postores</Text>
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>
              {loadingPujas ? '…' : new Set(pujas.map((p) => p.asistente?.identificador)).size}
            </Text>
          </View>
        </Card>

        <Card el style={{ marginTop: 12 }}>
          <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>PUJA ACTUAL</Text>
          {loadingPujas ? (
            <ActivityIndicator color={colors.blue} style={{ marginTop: 8 }} />
          ) : (
            <>
              <Text style={{ color: colors.green, fontSize: 30, fontWeight: '800', marginTop: 2 }}>
                {pujaActual != null ? formatImporte(pujaActual, moneda) : formatImporte(precioBase, moneda)}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 2 }}>
                Próxima mínima: {formatImporte(proximaPuja, moneda)}
              </Text>
            </>
          )}
        </Card>

        {esLidero && (
          <Card el style={{ marginTop: 10, backgroundColor: 'rgba(55,214,111,0.12)', borderColor: colors.green, borderWidth: 1 }}>
            <Text style={{ color: colors.green, fontWeight: '800', textAlign: 'center' }}>✓ Estás liderando la puja</Text>
          </Card>
        )}

        {user?.isGuest && (
          <Card el style={{ marginTop: 10, backgroundColor: 'rgba(255,193,7,0.08)', borderColor: colors.gold, borderWidth: 1 }}>
            <Text style={{ color: colors.gold, fontWeight: '700', textAlign: 'center', fontSize: 13 }}>
              Estás viendo como invitado. Creá una cuenta para pujar.
            </Text>
          </Card>
        )}

        <SectionLabel>Historial de pujas</SectionLabel>
        {pollingError && (
          <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center', marginBottom: 6 }}>
            Sin conexión — reintentando…
          </Text>
        )}
        {loadingPujas && <ActivityIndicator color={colors.blue} />}
        {pujas.length === 0 && !loadingPujas && !pollingError && (
          <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 10 }}>Sin pujas aún. ¡Sé el primero!</Text>
        )}
        {pujas.map((p, i) => {
          const esYo = !user?.isGuest && p.asistente?.identificador === asistenteId;
          const label = esYo ? '(vos)' : `Postor #${p.asistente?.numeroPostor || p.asistente?.identificador || '?'}`;
          const tiempo = p.fechaHora
            ? new Date(p.fechaHora).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
            : '';
          return (
            <View key={p.identificador ?? i} style={st.bidRow}>
              <Text style={{ color: esYo ? colors.blue : '#fff', fontSize: 13.5, fontWeight: '700' }}>{label}</Text>
              <Text style={{ color: colors.muted, fontSize: 13 }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>{formatImporte(p.importe, moneda)}</Text>
                {tiempo ? ` · ${tiempo}` : ''}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      <BottomBar>
        {esLidero ? (
          <Btn title="Ya sos el mayor postor" kind="ghost" disabled />
        ) : (
          <Btn
            title={
              user?.isGuest
                ? 'Pujar (requiere cuenta)'
                : pujando ? 'Pujando…' : `Pujar ${formatImporte(proximaPuja, moneda)}`
            }
            onPress={onPujar}
            disabled={pujando || (!user?.isGuest && !asistenteId)}
          />
        )}
      </BottomBar>
    </Screen>
  );
}

// ─── GANASTE SCREEN ───────────────────────────────────────────────────────────
export function GanasteScreen({ navigation, route }) {
  const { titulo, moneda, importe, subastaId, itemId, comision } = route.params || {};

  const total = importe != null
    ? Number(importe) + Number(comision || 0)
    : null;

  return (
    <Screen>
      <Header />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 26, paddingBottom: 110, alignItems: 'center' }} showsVerticalScrollIndicator={false}>
        <View style={[st.centerIcon, { backgroundColor: colors.blue }]}>
          <Ionicons name="checkmark" size={34} color="#fff" />
        </View>
        <Display style={{ fontSize: 30, marginVertical: 14 }}>¡Ganaste!</Display>
        <Text style={{ color: colors.muted, fontSize: 14.5, lineHeight: 21, textAlign: 'center', maxWidth: 280 }}>
          Tu puja fue la más alta. Falta un paso para retirar tu artículo.
        </Text>
        <Card el style={{ marginTop: 22, width: '100%', flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <ImgBox style={{ width: 64, height: 64 }} size={26} />
          <View>
            <Display style={{ fontSize: 15, lineHeight: 18 }}>{titulo || `Subasta #${subastaId}`}</Display>
            <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 6 }}>
              Item #{itemId} · {new Date().toLocaleDateString('es-AR')}
            </Text>
          </View>
        </Card>
        {total != null && (
          <Card style={{ marginTop: 12, width: '100%', flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.muted, fontSize: 14 }}>Monto a pagar</Text>
            <Text style={{ color: colors.green, fontSize: 18, fontWeight: '800' }}>
              {formatImporte(total, moneda)}
            </Text>
          </Card>
        )}
      </ScrollView>
      <BottomBar>
        <Btn
          title="Continuar al pago"
          onPress={() => navigation.navigate('MedioPago', {
            subastaId, itemId, moneda, importe, comision, titulo,
          })}
        />
      </BottomBar>
    </Screen>
  );
}

// ─── SUBASTA FINALIZADA ───────────────────────────────────────────────────────
export function SubastaFinalizadaScreen({ navigation, route }) {
  const { titulo, moneda, importe, totalPostores, subastaId } = route.params || {};
  return (
    <Screen>
      <Header />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 26 }}>
        <ImgBox style={{ width: 160, height: 160 }} size={44} />
        <Text style={[st.kicker, { textAlign: 'center', marginTop: 24 }]}>SUBASTA FINALIZADA</Text>
        <Display style={{ fontSize: 26, textAlign: 'center', marginVertical: 8, lineHeight: 30 }}>
          {titulo || `Subasta #${subastaId}`}
        </Display>
        {importe != null && (
          <Display style={{ color: colors.green, fontSize: 24 }}>
            Cierre: {formatImporte(importe, moneda)}
          </Display>
        )}
        {totalPostores != null && (
          <Text style={{ color: colors.muted, fontSize: 13.5, marginTop: 8 }}>
            {totalPostores} postores
          </Text>
        )}
      </View>
      <BottomBar>
        <Btn title="Volver al Home" onPress={() => navigation.navigate('Main')} />
      </BottomBar>
    </Screen>
  );
}

const st = StyleSheet.create({
  kicker: { color: colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 1.5, marginTop: 18 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.cardEl, alignItems: 'center', justifyContent: 'center' },
  bidRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  centerIcon: { width: 74, height: 74, borderRadius: 37, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
});
