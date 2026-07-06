// BIDLY — Producto, SubastaEnVivo, Ganaste, SubastaFinalizada.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Header, Title, SectionLabel, Btn, Card, LiveBadge, Tag, ImgBox, ImageLightbox, BottomBar, Row, Display, SuccessBanner, Field, Chip } from '../components/ui';
import { colors } from '../theme/theme';
import { Subastas, Pujas, Asistentes, Productos, RegistroSubasta, Clientes } from '../api/endpoints';
import { BASE_URL } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { tituloSubasta, tagEstadoSubasta, formatFechaSubasta } from '../utils/subasta';
import { etiquetaTiempoSubasta, esSubastaEnVivo } from '../utils/tiempo';

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function formatImporte(importe, moneda) {
  if (importe == null) return '—';
  const simbolo = moneda === 'dolares' ? 'U$D' : '$';
  return `${simbolo} ${Number(importe).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
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

async function buscarRegistroId(clienteId, subastaId, productoId) {
  if (!clienteId || !subastaId) return null;
  try {
    const registros = await RegistroSubasta.porCliente(clienteId);
    const match = (registros || []).find((r) => {
      if (Number(r.subasta?.identificador) !== Number(subastaId)) return false;
      if (productoId != null) return Number(r.producto) === Number(productoId);
      return true;
    });
    return match?.identificador ?? null;
  } catch {
    return null;
  }
}

function mensajeError(e, proximaPuja, maxPuja, moneda) {
  const detail = e?.data?.detail ?? e?.data;
  const code = detail?.code;
  const min = detail?.minimoAceptable ?? proximaPuja;
  const max = detail?.maximoAceptable ?? maxPuja;
  switch (code) {
    case 'MIN_BID':      return `La oferta mínima es ${formatImporte(min, moneda)}.`;
    case 'MAX_BID':      return `El tope para esta subasta es ${formatImporte(max, moneda)}.`;
    case 'NO_PAYMENT':   return 'Registrá un medio de pago en tu perfil para pujar.';
    case 'CATEGORY':     return 'Tu categoría no permite esta subasta.';
    case 'FORBIDDEN':    return 'No estás inscripto en esta subasta.';
    case 'AUCTION_CLOSED':
    case 'ITEM_SOLD':    return 'La subasta ya cerró.';
    case 'ITEM_NOT_ACTIVE':
      return 'Este ítem ya no está en subasta. Volvé atrás y entrá al ítem activo.';
    case 'RACE':         return 'Alguien pujó más rápido. Mirá el nuevo monto.';
    default:             return detail?.error || detail?.message || e?.message || 'Error al registrar la puja.';
  }
}

// ─── PRODUCTO SCREEN ──────────────────────────────────────────────────────────
export function ProductoScreen({ navigation, route }) {
  const subastaId = route.params?.subastaId || route.params?.subasta?.id;
  const subastaPreview = route.params?.subasta;

  const [subasta, setSubasta] = useState(null);
  const [items, setItems] = useState([]);
  const [itemEnVivo, setItemEnVivo] = useState(null);
  const [fotoIds, setFotoIds] = useState([]);
  const [lightboxIdx, setLightboxIdx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!subastaId) { setLoading(false); return; }
    Promise.all([
      Subastas.obtener(subastaId),
      Subastas.catalogos(subastaId),
    ])
      .then(([s, catalogoItems]) => {
        const lista = catalogoItems || [];
        setSubasta(s);
        setItems(lista);

        const activo = lista.find((i) => i.subastado !== 'si') || lista[0] || null;
        setItemEnVivo(activo);

        const productoId = activo?.producto?.identificador ?? lista[0]?.producto?.identificador;
        if (productoId) {
          Productos.fotos(productoId)
            .then((ids) => setFotoIds(ids || []))
            .catch(() => {});
        }
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

  const itemDestacado = itemEnVivo || items[0];
  const titulo = tituloSubasta(subasta, items);
  const categoria = `${subasta.categoria || 'General'} · ${subasta.ubicacion || ''}`.replace(/·\s*$/, '').trim();
  // En única venta (bloque) se puja por el catálogo completo: la base de referencia
  // es la SUMA de las bases pendientes (el backend valida con el mismo criterio).
  const ventaBloque = subasta.ventaModo === 'bloque';
  const itemsPendientes = items.filter((i) => i.subastado !== 'si');
  const basePendiente = itemsPendientes.reduce((t, i) => t + Number(i.precioBase ?? i.preciobase ?? 0), 0);
  const comisionPendiente = itemsPendientes.reduce((t, i) => t + Number(i.comision ?? 0), 0);
  const precioBase = ventaBloque ? basePendiente : itemDestacado?.precioBase;
  const viva = esSubastaEnVivo(subasta);
  const fotoUrls = fotoIds.map((id) => `${BASE_URL}/fotos/${id}`);

  return (
    <Screen>
      <Header />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <View>
          <ImgBox
            style={{ width: '100%', height: 230 }}
            size={42}
            src={fotoUrls[0]}
            onPress={() => fotoUrls.length > 0 && setLightboxIdx(0)}
          />
          {viva && <LiveBadge style={{ position: 'absolute', top: 12, left: 12 }} />}
          {fotoUrls.length > 0 && (
            <View style={st.expandHint}>
              <Ionicons name="expand-outline" size={14} color="#fff" />
            </View>
          )}
        </View>
        {fotoUrls.length > 1 && (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            {fotoUrls.map((url, i) => (
              <ImgBox
                key={fotoIds[i]}
                style={{ flex: 1, height: 56 }}
                size={18}
                src={url}
                onPress={() => setLightboxIdx(i)}
              />
            ))}
          </View>
        )}
        <Text style={st.kicker}>{categoria.toUpperCase()}</Text>
        <Title style={{ fontSize: 26, marginTop: 6 }}>{titulo}</Title>
        <View style={{ flexDirection: 'row', gap: 20, marginVertical: 12, flexWrap: 'wrap' }}>
          <View>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Precio base</Text>
            <Text style={{ color: colors.green, fontSize: 20, fontWeight: '800' }}>
              {formatImporte(precioBase, subasta.moneda)}
            </Text>
          </View>
          <View>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Estado</Text>
            <Text style={{ color: colors.gold, fontSize: 20, fontWeight: '800' }}>
              {etiquetaTiempoSubasta(subasta)}
            </Text>
          </View>
          <View>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Fecha</Text>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>
              {subasta.fecha ? formatFechaSubasta(subasta.fecha) : 'A confirmar'}
            </Text>
          </View>
        </View>

        {itemDestacado?.producto?.descripcionCompleta && (
          <>
            <SectionLabel>Descripción</SectionLabel>
            <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 22 }}>
              {itemDestacado.producto.descripcionCompleta}
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 18, marginBottom: 6 }}>
              <Display style={{ fontSize: 14 }}>Ítems del catálogo · {items.length}</Display>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {ventaBloque ? 'Base total ' : 'Base desde '}
                <Text style={{ color: colors.green, fontWeight: '800' }}>
                  {formatImporte(ventaBloque ? basePendiente : precioBase, subasta.moneda)}
                </Text>
              </Text>
            </View>
            <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 12, lineHeight: 17 }}>
              {ventaBloque
                ? '🧺 Única venta: se rematan todas las piezas juntas a un único precio; el mejor postor se lleva todo.'
                : '🔨 Pieza por pieza: se remata un producto por vez; al cerrarse uno arranca el siguiente.'}
            </Text>
            {items.map((item) => {
              const vendido = item.subastado === 'si';
              const esActual = itemDestacado && item.identificador === itemDestacado.identificador;
              const portada = item.producto?.identificador
                ? `${BASE_URL}/productos/${item.producto.identificador}/portada`
                : undefined;
              return (
                <Card key={item.identificador} el style={{ marginBottom: 10, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <ImgBox style={{ width: 50, height: 50 }} size={18} src={portada} />
                  <View style={{ flex: 1 }}>
                    <Display style={{ fontSize: 13, color: vendido ? colors.muted : colors.text }} numberOfLines={1}>
                      {item.producto?.descripcionCatalogo || `Item #${item.identificador}`}
                    </Display>
                    <Text style={{ color: colors.green, fontSize: 13, fontWeight: '800', marginTop: 2 }}>
                      {formatImporte(item.precioBase ?? item.preciobase, subasta.moneda)}
                    </Text>
                  </View>
                  {vendido ? (
                    <Tag label="VENDIDO" color={colors.muted} />
                  ) : viva && !ventaBloque && esActual ? (
                    <LiveBadge />
                  ) : null}
                </Card>
              );
            })}
          </>
        )}
      </ScrollView>

      <ImageLightbox
        visible={lightboxIdx !== null}
        images={fotoUrls}
        initialIndex={lightboxIdx ?? 0}
        onClose={() => setLightboxIdx(null)}
      />

      {viva && itemDestacado && (
        <BottomBar>
          <Btn
            title="Ir a la subasta en vivo"
            onPress={() => navigation.navigate('SubastaEnVivo', {
              subastaId: subasta.identificador,
              itemId: itemDestacado.identificador,
              productoId: itemDestacado.producto?.identificador,
              // En bloque, base y comisión de referencia = las del catálogo completo.
              precioBase,
              titulo,
              moneda: subasta.moneda,
              comision: ventaBloque ? comisionPendiente : itemDestacado.comision,
              fecha: subasta.fecha,
              hora: subasta.hora,
              categoriaSubasta: subasta.categoria,
              ventaModo: subasta.ventaModo,
              totalPiezas: itemsPendientes.length,
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
    productoId,
    precioBase = 0,
    titulo = 'Subasta en vivo',
    moneda = 'pesos',
    comision = 0,
    fecha,
    hora,
    categoriaSubasta,
    ventaModo = 'individual',
    totalPiezas = 1,
  } = route.params || {};

  const [subasta, setSubasta] = useState(null);
  const [items, setItems] = useState([]);
  const [pujas, setPujas] = useState([]);
  const [asistenteId, setAsistenteId] = useState(null);
  const [accesoError, setAccesoError] = useState(null);
  const [loadingPujas, setLoadingPujas] = useState(true);
  const [pujando, setPujando] = useState(false);
  const [pollingError, setPollingError] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [fotoAmpliada, setFotoAmpliada] = useState(false);
  const [montoIngresado, setMontoIngresado] = useState('');
  const [medios, setMedios] = useState([]);
  const [medioSelId, setMedioSelId] = useState(null);
  const mounted = useRef(true);
  const asistenteIdRef = useRef(null);
  const navegado = useRef(false);
  const baselineRef = useRef(null); // { fetchedAt: ms, segundos: number } — baseline del backend al entrar
  const ultimaPujaTopRef = useRef(null);

  useEffect(() => {
    return () => { mounted.current = false; };
  }, []);

  // Mantener ref actualizada para usarla en callbacks sin crear dependencias.
  useEffect(() => { asistenteIdRef.current = asistenteId; }, [asistenteId]);

  // Medios de pago del usuario (para elegir con cuál pagará si gana).
  useEffect(() => {
    if (user?.isGuest || !user?.clienteId) return;
    Clientes.mediosPago(user.clienteId).then((data) => {
      if (!mounted.current) return;
      const list = data || [];
      setMedios(list);
      if (list.length) setMedioSelId((prev) => prev ?? list[0].identificador);
    }).catch(() => {});
  }, [user]);

  const labelMedio = (m) => m.tipo === 'cheque' ? `Cheque ${m.numeroCheque || ''}`.trim()
    : m.tipo === 'cuenta' ? `Cuenta ${m.banco || ''}`.trim()
    : `Tarjeta ****${(m.numerotarjeta || m.numeroTarjeta || '').slice(-4)}`;

  // Datos vivos del catálogo: traemos la subasta + sus ítems del backend para NO
  // depender de los params (que se degradan al avanzar de ítem). Así el precio, el
  // modo de venta, el total y el estado de cada pieza nunca se "pierden" ni quedan en 0.
  const cargarCatalogo = useCallback(() => {
    if (!subastaId) return;
    Promise.all([Subastas.obtener(subastaId), Subastas.catalogos(subastaId)])
      .then(([s, cat]) => {
        if (!mounted.current) return;
        setSubasta(s);
        setItems(cat || []);
      })
      .catch(() => {});
  }, [subastaId]);

  useEffect(() => {
    cargarCatalogo();
    const interval = setInterval(cargarCatalogo, 4000);
    return () => clearInterval(interval);
  }, [cargarCatalogo]);

  // Modo de venta y montos derivados de datos vivos (con params como respaldo).
  const ventaModoLive = subasta?.ventaModo || ventaModo;
  const pendientes = items.filter((i) => i.subastado !== 'si');
  const itemActual = items.find((i) => Number(i.identificador) === Number(itemId)) || null;
  const piezasPendientes = pendientes.length || Number(totalPiezas) || 1;
  const sumaBasesPend = pendientes.reduce((t, i) => t + Number(i.precioBase ?? i.preciobase ?? 0), 0);
  const sumaComisionesPend = pendientes.reduce((t, i) => t + Number(i.comision ?? 0), 0);
  // En bloque la base/comisión de referencia es la SUMA de las piezas pendientes;
  // en individual, la del ítem que se está rematando ahora.
  const baseLive = ventaModoLive === 'bloque'
    ? (sumaBasesPend || Number(precioBase) || 0)
    : Number(itemActual?.precioBase ?? itemActual?.preciobase ?? precioBase ?? 0);
  const comisionLive = ventaModoLive === 'bloque'
    ? (sumaComisionesPend || Number(comision) || 0)
    : Number(itemActual?.comision ?? comision ?? 0);
  const baseRef = baseLive > 0 ? baseLive : Number(precioBase) || 0;

  // Timer del remate: el ítem tiene 3 min (+15s por puja). Al llegar a 0 se adjudica
  // solo y arranca el siguiente ítem. El reloj se lee de /subastas/{id}/remate.

  // Inscribir al usuario como asistente.
  useEffect(() => {
    if (!user?.clienteId || !subastaId) return;

    Asistentes.inscribir(user.clienteId, subastaId)
      .then((a) => { if (mounted.current) { setAsistenteId(a.identificador); setAccesoError(null); } })
      .catch((e) => {
        if (!mounted.current) return;
        // No tragamos el error: mostramos el motivo (categoría, ya conectado a otra,
        // multa, etc.) y sacamos al usuario en vez de quedar colgados en "Registrando…".
        const msg = e?.message || 'No pudimos registrar tu acceso a la subasta.';
        setAccesoError(msg);
        Alert.alert('No podés entrar a esta subasta', msg, [
          { text: 'Volver', onPress: () => navigation.goBack() },
        ]);
      });
  }, [user, subastaId]);

  // Cuando el ítem actual se adjudica y no lo gané: si el catálogo tiene más ítems,
  // sigo automáticamente al próximo (el remate "tira" producto por producto); si no,
  // muestro el fin de la subasta.
  const irAlSiguienteItem = useCallback(async (listaFinal) => {
    navegado.current = true;
    try {
      const catalogoItems = await Subastas.catalogos(subastaId);
      const siguiente = (catalogoItems || []).find(
        (it) => it.subastado !== 'si' && Number(it.identificador) !== Number(itemId),
      );
      if (siguiente) {
        navigation.replace('SubastaEnVivo', {
          subastaId,
          itemId: siguiente.identificador,
          productoId: siguiente.producto?.identificador,
          precioBase: siguiente.precioBase ?? siguiente.preciobase ?? 0,
          titulo: siguiente.producto?.descripcionCatalogo || 'Subasta en vivo',
          comision: siguiente.comision ?? comision,
          moneda, categoriaSubasta, fecha, hora, ventaModo,
        });
        return;
      }
    } catch {}
    const ganadora = (listaFinal || []).find((p) => p.ganador === 'si');
    navigation.replace('SubastaFinalizada', {
      titulo, moneda,
      importe: ganadora?.importe,
      totalPostores: new Set((listaFinal || []).map((p) => p.asistente?.identificador)).size,
      subastaId,
    });
  }, [subastaId, itemId, comision, moneda, categoriaSubasta, fecha, hora, titulo, ventaModo, navigation]);

  // Cargar pujas y refrescar cada 5 segundos.
  // Detecta automáticamente cuando el ítem fue adjudicado y navega al resultado.
  const cargarPujas = useCallback(() => {
    if (!itemId) return;
    Pujas.porItem(itemId)
      .then((data) => {
        if (!mounted.current || navegado.current) return;
        const lista = data || [];
        setPujas(lista);
        setPollingError(false);

        const ganadora = lista.find((p) => p.ganador === 'si');
        if (!ganadora) return;

        // Esperar inscripción antes de evaluar si gané (evita falso negativo por race).
        if (!user?.isGuest && asistenteIdRef.current == null) return;

        navegado.current = true;
        const yoGane = !user?.isGuest &&
          asistenteIdRef.current != null &&
          ganadora.asistente?.identificador === asistenteIdRef.current;

        if (yoGane) {
          buscarRegistroId(user?.clienteId, subastaId, productoId)
            .then((registroId) => {
              if (!mounted.current) return;
              navigation.replace('Ganaste', {
                titulo,
                moneda,
                importe: ganadora.importe,
                subastaId,
                itemId,
                comision,
                registroId,
              });
            })
            .catch(() => { navegado.current = false; });
        } else {
          // No gané: sigo al próximo ítem del catálogo (o fin si no hay más).
          irAlSiguienteItem(lista);
        }
      })
      .catch(() => { if (mounted.current) setPollingError(true); })
      .finally(() => { if (mounted.current) setLoadingPujas(false); });
  }, [itemId, user, navigation, titulo, moneda, subastaId, comision, productoId, irAlSiguienteItem]);

  useEffect(() => {
    cargarPujas();
    const interval = setInterval(cargarPujas, 1000);
    return () => clearInterval(interval);
  }, [cargarPujas]);

  // Reloj del remate: poll al backend cada segundo. Además de alimentar el
  // contador, esta llamada hace avanzar el timer server-side (adjudica solo al
  // llegar a 0 y activa el ítem siguiente).
  const cargarRemate = useCallback(() => {
    if (!subastaId) return;
    Subastas.remate(subastaId)
      .then((r) => { if (mounted.current) setTimeLeft(r?.segundosRestantes ?? null); })
      .catch(() => {});
  }, [subastaId]);

  useEffect(() => {
    cargarRemate();
    const interval = setInterval(cargarRemate, 1000);
    return () => clearInterval(interval);
  }, [cargarRemate]);

  // Calcular puja actual, próximo importe y tope máximo.
  const pujaActual = pujas.length > 0 ? pujas[0].importe : null;
  const minIncremento = baseRef > 0
    ? Math.ceil(baseRef * 0.01 * 100) / 100
    : 1;
  const proximaPuja = pujaActual != null
    ? Number(pujaActual) + minIncremento
    : baseRef;
  const CATS_SIN_LIMITE = new Set(['oro', 'platino']);
  const maxPuja = CATS_SIN_LIMITE.has(categoriaSubasta)
    ? null
    : pujaActual != null
      ? Number(pujaActual) + baseRef * 0.20
      : baseRef * 1.20;

  // Total que pagaría el ganador = puja (o base si nadie pujó) + comisión.
  const totalAPagar = (pujaActual != null ? Number(pujaActual) : baseRef) + Number(comisionLive || 0);

  // Sincronizar el input solo cuando cambia la puja líder (no en cada poll).
  useEffect(() => {
    const top = pujas[0];
    const firma = top
      ? `${top.identificador ?? 'p'}-${Number(top.importe)}`
      : `base-${baseRef}`;
    if (ultimaPujaTopRef.current === firma) return;
    ultimaPujaTopRef.current = firma;

    setMontoIngresado((prev) => {
      const num = parseFloat(prev.replace(',', '.'));
      return Number.isNaN(num) || num < proximaPuja - 0.001 ? String(proximaPuja) : prev;
    });
  }, [pujas, proximaPuja, baseRef]);

  // Validación del monto ingresado.
  const montoNum = parseFloat(montoIngresado.replace(',', '.'));
  const montoValido = !Number.isNaN(montoNum) && montoNum > 0;
  const montoMenorQueMin = montoValido && montoNum < proximaPuja - 0.001;
  const montoMayorQueMax = maxPuja != null && montoValido && montoNum > maxPuja + 0.001;
  const montoInvalido = !montoValido || montoMenorQueMin || montoMayorQueMax;

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
    if (medios.length > 0 && !medioSelId) {
      return Alert.alert('Medio de pago', 'Elegí con qué medio vas a pagar si ganás.');
    }
    setPujando(true);
    try {
      await Pujas.pujar(asistenteId, itemId, montoNum, medioSelId);
      cargarPujas();
    } catch (e) {
      Alert.alert('No se pudo pujar', mensajeError(e, proximaPuja, maxPuja, moneda));
      if (['MIN_BID', 'RACE'].includes(e?.data?.code)) cargarPujas();
    } finally {
      setPujando(false);
    }
  };

  const esLidero = !user?.isGuest && pujas.length > 0 &&
    pujas[0].asistente?.identificador === asistenteId;

  const countdownColor = timeLeft != null && timeLeft < 300 ? colors.red ?? '#ff4d4d' : colors.gold;
  const portadaUrl = productoId ? `${BASE_URL}/productos/${productoId}/portada` : undefined;

  return (
    <Screen>
      <Header />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View>
          <ImgBox
            style={{ width: '100%', height: 200 }}
            size={40}
            src={portadaUrl}
            onPress={() => portadaUrl && setFotoAmpliada(true)}
          />
          <LiveBadge style={{ position: 'absolute', top: 12, left: 12 }} />
          {portadaUrl && (
            <View style={st.expandHint}>
              <Ionicons name="expand-outline" size={14} color="#fff" />
            </View>
          )}
        </View>
        <Display style={{ fontSize: 20, marginVertical: 14, lineHeight: 23 }}>{titulo}</Display>
        {ventaModoLive === 'bloque' ? (
          <View style={st.modoBanner}>
            <Text style={st.modoTitle}>🧺 Única venta · catálogo completo</Text>
            <Text style={st.modoDesc}>
              Se rematan las {piezasPendientes} piezas juntas a un único precio. El mejor postor se lleva TODO el catálogo.
            </Text>
          </View>
        ) : (
          <View style={st.modoBanner}>
            <Text style={st.modoTitle}>🔨 Remate pieza por pieza</Text>
            <Text style={st.modoDesc}>
              Se subasta un producto por vez; al cerrarse uno arranca el siguiente automáticamente.
              {piezasPendientes > 0 ? ` Quedan ${piezasPendientes} ${piezasPendientes === 1 ? 'pieza' : 'piezas'} por rematar.` : ''}
            </Text>
          </View>
        )}

        <Card el style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View>
            <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>{ventaModoLive === 'bloque' ? 'Base total del catálogo' : 'Precio base'}</Text>
            <Text style={{ color: colors.gold, fontSize: 24, fontWeight: '800' }}>
              {formatImporte(baseRef, moneda)}
            </Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Cierra en</Text>
            <Text style={{ color: countdownColor, fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
              {timeLeft == null ? '—' : formatCountdown(timeLeft)}
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
                {pujaActual != null ? formatImporte(pujaActual, moneda) : formatImporte(baseRef, moneda)}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 2 }}>
                Mínima: {formatImporte(proximaPuja, moneda)}{maxPuja != null ? `  ·  Tope: ${formatImporte(maxPuja, moneda)}` : '  ·  Sin tope'}
              </Text>
              <View style={st.totalRow}>
                <View>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>Total a pagar si ganás</Text>
                  <Text style={{ color: colors.muted, fontSize: 10.5, marginTop: 1 }}>
                    Puja + comisión {formatImporte(comisionLive, moneda)}{ventaModoLive === 'bloque' ? ` · ${piezasPendientes} piezas` : ''}
                  </Text>
                </View>
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>{formatImporte(totalAPagar, moneda)}</Text>
              </View>
            </>
          )}
        </Card>

        {!user?.isGuest && asistenteId && medios.length > 0 && (
          <Card el style={{ marginTop: 12 }}>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>MEDIO DE PAGO</Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4, marginBottom: 8 }}>Con este medio pagás si ganás.</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {medios.map((m) => (
                  <Chip key={m.identificador} label={labelMedio(m)} active={medioSelId === m.identificador} onPress={() => setMedioSelId(m.identificador)} />
                ))}
              </View>
            </ScrollView>
          </Card>
        )}

        {!user?.isGuest && asistenteId && !esLidero && (
          <Card el style={{ marginTop: 12 }}>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>TU OFERTA</Text>
            <Field
              value={montoIngresado}
              onChangeText={(v) => setMontoIngresado(v.replace(/[^0-9.,]/g, ''))}
              keyboardType="numeric"
              placeholder={`Ingresá el monto (mín ${formatImporte(proximaPuja, moneda)})`}
              style={{ marginTop: 8 }}
            />
            {montoIngresado && montoInvalido ? (
              <Text style={{ color: colors.red, fontSize: 12, marginTop: 6 }}>
                {montoMenorQueMin
                  ? `La oferta debe ser al menos ${formatImporte(proximaPuja, moneda)}.`
                  : montoMayorQueMax
                    ? `La oferta no puede superar ${formatImporte(maxPuja, moneda)}.`
                    : 'Ingresá un monto válido.'}
              </Text>
            ) : (
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>
                {maxPuja != null
                  ? `Mín: ${formatImporte(proximaPuja, moneda)}  ·  Máx: ${formatImporte(maxPuja, moneda)}`
                  : `Mín: ${formatImporte(proximaPuja, moneda)}  ·  Sin tope`}
              </Text>
            )}
          </Card>
        )}

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
        {!user?.isGuest && !asistenteId && accesoError && (
          <Card el style={{ marginTop: 10, backgroundColor: 'rgba(226,57,80,0.10)', borderColor: colors.red, borderWidth: 1 }}>
            <Text style={{ color: colors.red, fontWeight: '800', textAlign: 'center', fontSize: 13 }}>{accesoError}</Text>
          </Card>
        )}
        {!user?.isGuest && !asistenteId && !accesoError && (
          <Card el style={{ marginTop: 10, backgroundColor: 'rgba(255,193,7,0.08)', borderColor: colors.gold, borderWidth: 1 }}>
            <Text style={{ color: colors.gold, fontWeight: '700', textAlign: 'center', fontSize: 13 }}>
              Registrando tu acceso a la subasta…
            </Text>
          </Card>
        )}

        {items.length > 0 && (
          <>
            <SectionLabel>Catálogo · {items.length} {items.length === 1 ? 'pieza' : 'piezas'}</SectionLabel>
            {items.map((it) => {
              const esActual = Number(it.identificador) === Number(itemId);
              const vendido = it.subastado === 'si';
              return (
                <View key={it.identificador} style={st.catRow}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={{ color: vendido ? colors.muted : '#fff', fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
                      {it.producto?.descripcionCatalogo || `Ítem #${it.identificador}`}
                    </Text>
                    <Text style={{ color: colors.green, fontSize: 12.5, fontWeight: '800', marginTop: 2 }}>
                      {formatImporte(it.precioBase ?? it.preciobase, moneda)}
                    </Text>
                  </View>
                  {vendido ? (
                    <Tag label="VENDIDO" color={colors.muted} />
                  ) : ventaModoLive !== 'bloque' && esActual ? (
                    <LiveBadge />
                  ) : (
                    <Tag label={ventaModoLive === 'bloque' ? 'EN VENTA' : 'EN ESPERA'} color={colors.gold} />
                  )}
                </View>
              );
            })}
          </>
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
        {!user?.isGuest && !asistenteId ? (
          <Btn title="Esperando acceso…" kind="ghost" disabled />
        ) : esLidero ? (
          <Btn title="Ya sos el mayor postor" kind="ghost" disabled />
        ) : (
          <Btn
            title={
              user?.isGuest
                ? 'Pujar (requiere cuenta)'
                : pujando ? 'Pujando…'
                : `Pujar ${montoValido ? formatImporte(montoNum, moneda) : '—'}`
            }
            onPress={onPujar}
            disabled={pujando || (!user?.isGuest && (!asistenteId || montoInvalido))}
          />
        )}
      </BottomBar>

      <ImageLightbox
        visible={fotoAmpliada}
        images={portadaUrl ? [portadaUrl] : []}
        onClose={() => setFotoAmpliada(false)}
      />
    </Screen>
  );
}

// ─── GANASTE SCREEN ───────────────────────────────────────────────────────────
export function GanasteScreen({ navigation, route }) {
  const { titulo, moneda, importe, subastaId, itemId, comision, registroId } = route.params || {};

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
            <Display style={{ fontSize: 15, lineHeight: 18 }}>{titulo}</Display>
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
          onPress={() => navigation.navigate('MedioPago', { registroId, subastaId, itemId, moneda, importe, comision, titulo })}
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
          {titulo}
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

// ─── SUBASTA ADMIN (panel del subastador) ────────────────────────────────────
export function SubastaAdminScreen({ navigation, route }) {
  const { subastaId } = route.params || {};
  const [subasta, setSubasta] = useState(null);
  const [items, setItems] = useState([]);
  const [itemActivo, setItemActivo] = useState(null);
  const [pujas, setPujas] = useState([]);
  const [asistentes, setAsistentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState(null);
  const [fotoAmpliada, setFotoAmpliada] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const mounted = useRef(true);

  useEffect(() => { return () => { mounted.current = false; }; }, []);

  const cargarSubasta = useCallback(() => {
    if (!subastaId) return;
    Promise.all([
      Subastas.obtener(subastaId),
      Subastas.catalogos(subastaId),
      Subastas.asistentes(subastaId),
    ])
      .then(([s, catalogoItems, asis]) => {
        if (!mounted.current) return;
        setSubasta(s);
        const lista = catalogoItems || [];
        setItems(lista);
        setAsistentes(asis || []);
        // Seleccionar primer ítem no adjudicado como activo
        const pendiente = lista.find((i) => i.subastado !== 'si');
        setItemActivo((prev) => {
          if (prev && lista.find((i) => i.identificador === prev.identificador && i.subastado !== 'si')) return prev;
          return pendiente || lista[0] || null;
        });
      })
      .catch(() => {})
      .finally(() => { if (mounted.current) setLoading(false); });
  }, [subastaId]);

  const cargarPujas = useCallback(() => {
    if (!itemActivo?.identificador) return;
    Pujas.porItem(itemActivo.identificador)
      .then((data) => { if (mounted.current) setPujas(data || []); })
      .catch(() => {});
  }, [itemActivo?.identificador]);

  // Carga inicial
  useEffect(() => { cargarSubasta(); }, [cargarSubasta]);

  // Polling de pujas del ítem activo cada 1 segundo
  useEffect(() => {
    if (!itemActivo) return;
    cargarPujas();
    const interval = setInterval(cargarPujas, 1000);
    return () => clearInterval(interval);
  }, [cargarPujas]);

  // Reloj del remate: hace avanzar el timer server-side (adjudica solo y activa el
  // siguiente ítem) y alimenta el countdown. Al avanzar, recarga el catálogo.
  const cargarRemate = useCallback(() => {
    if (!subastaId) return;
    Subastas.remate(subastaId)
      .then((r) => {
        if (!mounted.current) return;
        setTimeLeft(r?.segundosRestantes ?? null);
        // Si el ítem activo del backend cambió, refresco el catálogo para avanzar.
        if (r?.itemActivoId && itemActivo && Number(r.itemActivoId) !== Number(itemActivo.identificador)) {
          cargarSubasta();
        }
      })
      .catch(() => {});
  }, [subastaId, itemActivo, cargarSubasta]);

  useEffect(() => {
    cargarRemate();
    const interval = setInterval(cargarRemate, 1000);
    return () => clearInterval(interval);
  }, [cargarRemate]);

  if (loading) {
    return (
      <Screen><Header />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.blue} size="large" />
        </View>
      </Screen>
    );
  }

  const pujaTop = pujas[0];
  const moneda = subasta?.moneda || 'pesos';
  const enVivo = subasta?.estado === 'abierta';
  const itemActivoAdjudicado = itemActivo?.subastado === 'si';
  const tituloAdmin = tituloSubasta(subasta, items);
  const tagEstado = tagEstadoSubasta(subasta);
  const portadaItemUrl = itemActivo?.producto?.identificador
    ? `${BASE_URL}/productos/${itemActivo.producto.identificador}/portada`
    : undefined;

  return (
    <Screen>
      <Header />
      <SuccessBanner message={successMsg} onDismiss={() => setSuccessMsg(null)} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
        {/* Cabecera */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          <Display style={{ fontSize: 20, flex: 1, paddingRight: 10 }} numberOfLines={2}>{tituloAdmin}</Display>
          <Tag label={tagEstado.label} color={tagEstado.color} />
        </View>
        <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 14 }}>
          {subasta?.categoria ? subasta.categoria.toUpperCase() : ''} · {asistentes.length} asistentes
        </Text>

        {/* Ítem activo */}
        {itemActivo ? (
          <Card el style={{ gap: 10 }}>
            {/* Foto del ítem */}
            {itemActivo.producto?.identificador && (
              <ImgBox
                style={{ width: '100%', height: 160, borderRadius: 10 }}
                size={36}
                src={portadaItemUrl}
                onPress={() => portadaItemUrl && setFotoAmpliada(true)}
              />
            )}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>
                {subasta?.ventaModo === 'bloque' ? 'CATÁLOGO COMPLETO · ÚNICA VENTA' : 'ÍTEM EN SUBASTA'}
              </Text>
              {itemActivoAdjudicado
                ? <Tag label="ADJUDICADO" color={colors.green} />
                : (enVivo && timeLeft != null && (
                    <Text style={{ color: timeLeft < 30 ? (colors.red ?? '#ff4d4d') : colors.gold, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
                      ⏱ {formatCountdown(timeLeft)}
                    </Text>
                  ))}
            </View>
            <Display style={{ fontSize: 16 }} numberOfLines={2}>
              {itemActivo.producto?.descripcionCatalogo || `Ítem #${itemActivo.identificador}`}
            </Display>
            <Text style={{ color: colors.muted, fontSize: 13 }}>
              Precio base: {formatImporte(itemActivo.precioBase, moneda)}
            </Text>
            {subasta?.ventaModo === 'bloque' && (
              <Text style={{ color: colors.gold, fontSize: 12.5, fontWeight: '700' }}>
                🧺 Única venta: el mejor postor se lleva las {items.filter((i) => i.subastado !== 'si').length} piezas
                {' '}· base total {formatImporte(items.filter((i) => i.subastado !== 'si').reduce((t, i) => t + Number(i.precioBase ?? 0), 0), moneda)}
              </Text>
            )}

            {/* Puja más alta */}
            <View style={{ marginTop: 6 }}>
              <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>PUJA MÁS ALTA</Text>
              {pujaTop ? (
                <>
                  <Text style={{ color: colors.green, fontSize: 28, fontWeight: '800', marginTop: 2 }}>
                    {formatImporte(pujaTop.importe, moneda)}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12.5 }}>
                    Postor #{pujaTop.asistente?.numeroPostor || pujaTop.asistente?.identificador}
                  </Text>
                </>
              ) : (
                <Text style={{ color: colors.muted, fontSize: 14, marginTop: 4 }}>Sin pujas aún</Text>
              )}
            </View>
          </Card>
        ) : (
          <Card el>
            <Text style={{ color: colors.muted, textAlign: 'center' }}>No hay ítems en esta subasta aún.</Text>
          </Card>
        )}

        {/* Historial de pujas del ítem activo */}
        {pujas.length > 0 && (
          <>
            <SectionLabel>Historial de pujas</SectionLabel>
            {pujas.map((p, i) => (
              <View key={p.identificador ?? i} style={st.bidRow}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
                  Postor #{p.asistente?.numeroPostor || p.asistente?.identificador}
                </Text>
                <Text style={{ color: colors.green, fontSize: 13, fontWeight: '800' }}>
                  {formatImporte(p.importe, moneda)}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* Lista completa de ítems */}
        <SectionLabel>Todos los ítems</SectionLabel>
        {items.map((item) => {
          const esActivo = item.identificador === itemActivo?.identificador;
          const adjudicado = item.subastado === 'si';
          return (
            <TouchableOpacity
              key={item.identificador}
              onPress={() => { setItemActivo(item); setPujas([]); }}
              activeOpacity={0.8}
            >
              <Card
                el={!esActivo}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8,
                  borderWidth: esActivo ? 1.5 : 1,
                  borderColor: esActivo ? colors.blue : colors.border,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Display style={{ fontSize: 13 }} numberOfLines={1}>
                    {item.producto?.descripcionCatalogo || `Ítem #${item.identificador}`}
                  </Display>
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                    Base: {formatImporte(item.precioBase, moneda)}
                  </Text>
                </View>
                {adjudicado ? (
                  <Ionicons name="checkmark-circle" size={22} color={colors.green} />
                ) : esActivo ? (
                  <LiveBadge />
                ) : (
                  <Ionicons name="ellipse-outline" size={22} color={colors.muted} />
                )}
              </Card>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <BottomBar>
        <Card el style={{ padding: 14, width: '100%' }}>
          <Text style={{ color: colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 19 }}>
            {enVivo
              ? 'Subasta en vivo. El cierre de la puja lo gestiona el subastador.'
              : 'La puja la inicia el subastador a la fecha y hora programadas.'}
          </Text>
        </Card>
      </BottomBar>

      <ImageLightbox
        visible={fotoAmpliada}
        images={portadaItemUrl ? [portadaItemUrl] : []}
        onClose={() => setFotoAmpliada(false)}
      />
    </Screen>
  );
}

const st = StyleSheet.create({
  kicker: { color: colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 1.5, marginTop: 18 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.cardEl, alignItems: 'center', justifyContent: 'center' },
  bidRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  centerIcon: { width: 74, height: 74, borderRadius: 37, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  expandHint: {
    position: 'absolute', bottom: 10, right: 10,
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 6,
    padding: 5,
  },
  stepRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12,
  },
  stepBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.cardEl, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  stepBtnDisabled: { opacity: 0.3 },
  stepBtnText: { color: '#fff', fontSize: 26, fontWeight: '700', lineHeight: 30 },
  modoBanner: {
    marginTop: -6, marginBottom: 12, padding: 12, borderRadius: 12,
    backgroundColor: 'rgba(255,193,7,0.08)', borderWidth: 1, borderColor: 'rgba(255,193,7,0.35)',
  },
  modoTitle: { color: colors.gold, fontSize: 13.5, fontWeight: '800', marginBottom: 3 },
  modoDesc: { color: colors.muted, fontSize: 12.5, lineHeight: 18 },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border,
  },
  catRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.cardEl, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8,
  },
});
