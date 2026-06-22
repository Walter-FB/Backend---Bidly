// BIDLY — MedioPago, Seguro, ConfirmarPago, PagoConfirmado, Multa, Reembolso.
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Header, Title, Sub, SectionLabel, Btn, Card, Field, BottomBar, Row, Display } from '../components/ui';
import { colors } from '../theme/theme';
import { Clientes, Multas, RegistroSubasta, Seguros } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function formatImporte(importe, moneda = 'pesos') {
  if (importe == null) return '—';
  const simbolo = moneda === 'dolares' ? 'U$D' : '$';
  return `${simbolo} ${Number(importe).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
}

function VisaChip() {
  return <View style={s.visa}><Text style={s.visaTxt}>VISA</Text></View>;
}
function OtroChip({ tipo }) {
  return (
    <View style={[s.visa, { backgroundColor: colors.card }]}>
      <Text style={[s.visaTxt, { fontSize: 9 }]}>{(tipo || 'TARJ').toUpperCase().slice(0, 5)}</Text>
    </View>
  );
}
function Radio({ on }) {
  return (
    <View style={[s.radio, { borderColor: on ? colors.blue : colors.faint }]}>
      {on && <View style={s.radioDot} />}
    </View>
  );
}

// Muestra los últimos 4 dígitos de la tarjeta.
function maskCard(numero) {
  if (!numero) return '•••• ????';
  return `•••• ${numero.slice(-4)}`;
}

// ─── MEDIO PAGO SCREEN ────────────────────────────────────────────────────────
export function MedioPagoScreen({ navigation, route }) {
  const { user } = useAuth();
  const params = route.params || {};

  const [medios, setMedios] = useState([]);
  const [selIdx, setSelIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  // Campos para agregar nueva tarjeta
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nuevaTarjeta, setNuevaTarjeta] = useState({ tipo: 'tarjeta', numeroTarjeta: '', vencimiento: '', titular: '' });
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!user?.clienteId) { setLoading(false); return; }
    Clientes.mediosPago(user.clienteId)
      .then((data) => setMedios(data || []))
      .catch(() => setMedios([]))
      .finally(() => setLoading(false));
  }, [user]);

  const onAgregarTarjeta = async () => {
    if (!nuevaTarjeta.numeroTarjeta || !nuevaTarjeta.vencimiento || !nuevaTarjeta.titular) {
      return Alert.alert('Campos requeridos', 'Completá todos los datos de la tarjeta.');
    }
    setGuardando(true);
    try {
      const guardada = await Clientes.agregarMedioPago(user.clienteId, {
        tipo: nuevaTarjeta.tipo,
        numeroTarjeta: nuevaTarjeta.numeroTarjeta,
        vencimiento: nuevaTarjeta.vencimiento,
        titular: nuevaTarjeta.titular,
        verificado: 'no',
      });
      setMedios((m) => [...m, guardada]);
      setSelIdx(medios.length);
      setMostrarForm(false);
      setNuevaTarjeta({ tipo: 'tarjeta', numeroTarjeta: '', vencimiento: '', titular: '' });
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo guardar la tarjeta.');
    } finally {
      setGuardando(false);
    }
  };

  const medioSeleccionado = medios[selIdx];

  return (
    <Screen>
      <Header />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22 }} showsVerticalScrollIndicator={false}>
        <Title>Medio de pago</Title>
        <Sub>Necesitás una tarjeta válida para pujar.</Sub>

        {loading && <ActivityIndicator color={colors.blue} style={{ marginTop: 20 }} />}

        {!loading && medios.map((m, i) => (
          <TouchableOpacity key={m.identificador} activeOpacity={0.9} onPress={() => setSelIdx(i)}>
            <Card el style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10,
              borderColor: selIdx === i ? colors.borderHi : colors.border, borderWidth: 1.5 }}>
              {m.tipo === 'credito' || m.tipo === 'debito' ? <VisaChip /> : <OtroChip tipo={m.tipo} />}
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>{maskCard(m.numeroTarjeta)}</Text>
                <Text style={{ color: colors.muted, fontSize: 12.5 }}>
                  {m.tipo || 'Tarjeta'} · vence {m.vencimiento || '—'}
                </Text>
                {m.titular && <Text style={{ color: colors.faint, fontSize: 11.5 }}>{m.titular}</Text>}
              </View>
              <Radio on={selIdx === i} />
            </Card>
          </TouchableOpacity>
        ))}

        {!loading && medios.length === 0 && !mostrarForm && (
          <Text style={{ color: colors.muted, textAlign: 'center', marginVertical: 20 }}>
            No tenés medios de pago. Agregá uno.
          </Text>
        )}

        {mostrarForm && (
          <Card el style={{ gap: 10, marginTop: 8 }}>
            <Text style={{ color: '#fff', fontWeight: '700', marginBottom: 4 }}>Nueva tarjeta</Text>
            <Field placeholder="Número de tarjeta" value={nuevaTarjeta.numeroTarjeta}
              onChangeText={(v) => setNuevaTarjeta((t) => ({ ...t, numeroTarjeta: v }))} keyboardType="numeric" />
            <Field placeholder="Vencimiento (MM/AA)" value={nuevaTarjeta.vencimiento}
              onChangeText={(v) => setNuevaTarjeta((t) => ({ ...t, vencimiento: v }))} />
            <Field placeholder="Titular" value={nuevaTarjeta.titular}
              onChangeText={(v) => setNuevaTarjeta((t) => ({ ...t, titular: v }))} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <Btn title="Cancelar" kind="ghost" onPress={() => setMostrarForm(false)} style={{ flex: 1 }} />
              <Btn title={guardando ? 'Guardando…' : 'Guardar'} onPress={onAgregarTarjeta} disabled={guardando} style={{ flex: 1 }} />
            </View>
          </Card>
        )}

        {!mostrarForm && (
          <TouchableOpacity style={s.addCard} onPress={() => setMostrarForm(true)}>
            <Text style={{ color: colors.blue, fontSize: 14, fontWeight: '800' }}>+ Agregar tarjeta</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      <BottomBar>
        <Btn
          title="Continuar"
          disabled={medios.length === 0}
          onPress={() => navigation.navigate('Seguro', {
            ...params,
            medioPagoId: medioSeleccionado?.identificador,
            medioPagoLabel: medioSeleccionado
              ? `${medioSeleccionado.tipo || 'Tarjeta'} •••• ${(medioSeleccionado.numeroTarjeta || '').slice(-4)}`
              : '—',
          })}
        />
      </BottomBar>
    </Screen>
  );
}

// ─── SEGURO SCREEN ────────────────────────────────────────────────────────────
export function SeguroScreen({ navigation, route }) {
  const params = route.params || {};
  const { importe, moneda = 'ARS' } = params;

  const [on, setOn] = useState(false);
  const [valor, setValor] = useState(importe ? String(importe) : '');
  const [contratando, setContratando] = useState(false);

  const porcentajeSeguro = 0.025; // 2.5% del valor asegurado
  const importeSeguro = valor ? (Number(valor) * porcentajeSeguro).toFixed(2) : '0';

  const onContratar = async () => {
    if (!valor || Number(valor) <= 0) {
      return Alert.alert('Valor', 'Ingresá el valor a asegurar.');
    }
    setContratando(true);
    try {
      const poliza = await Seguros.crear({
        nroPoliza: `POL-${Date.now()}`,
        compania: 'BIDLY Seguros',
        polizaCombinada: 'no',
        importe: Number(importeSeguro),
      });
      navigation.navigate('ConfirmarPago', {
        ...params,
        seguroNroPoliza: poliza.nroPoliza,
        importeSeguro: Number(importeSeguro),
      });
    } catch {
      // Si falla la creación del seguro, continuamos sin él
      navigation.navigate('ConfirmarPago', { ...params, importeSeguro: Number(importeSeguro) });
    } finally {
      setContratando(false);
    }
  };

  const onOmitir = () => {
    navigation.navigate('ConfirmarPago', { ...params, importeSeguro: 0 });
  };

  return (
    <Screen>
      <Header />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22 }} showsVerticalScrollIndicator={false}>
        <Title>Seguro{'\n'}opcional</Title>
        <Sub>Protegé tu artículo durante el envío.</Sub>
        <Card el style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderColor: colors.borderHi, borderWidth: 1.5 }}>
          <View style={{ flex: 1 }}>
            <Display style={{ fontSize: 15, lineHeight: 18 }}>Seguro contra{'\n'}rotura y pérdida</Display>
            <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 6 }}>2.5% del valor declarado</Text>
          </View>
          <Switch value={on} onValueChange={setOn} trackColor={{ true: colors.blue, false: colors.faint }} thumbColor="#fff" />
        </Card>
        {on && (
          <>
            <SectionLabel>Valor a asegurar</SectionLabel>
            <Field
              value={valor}
              onChangeText={setValor}
              keyboardType="numeric"
              placeholder="Valor del artículo"
            />
            {valor ? (
              <Text style={{ color: colors.muted, marginTop: 8 }}>
                Prima del seguro: {formatImporte(importeSeguro, moneda)}
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 22, paddingBottom: 28, paddingTop: 14 }}>
        <Btn title="Omitir" kind="ghost" onPress={onOmitir} style={{ flex: 1 }} />
        {on ? (
          <Btn title={contratando ? 'Contratando…' : 'Contratar'} onPress={onContratar} disabled={contratando} style={{ flex: 1 }} />
        ) : (
          <Btn title="Continuar" onPress={onOmitir} style={{ flex: 1 }} />
        )}
      </View>
    </Screen>
  );
}

// ─── CONFIRMAR PAGO ───────────────────────────────────────────────────────────
export function ConfirmarPagoScreen({ navigation, route }) {
  const { user } = useAuth();
  const {
    subastaId, itemId, importe = 0, comision = 0,
    importeSeguro = 0, moneda = 'ARS',
    medioPagoLabel, titulo,
  } = route.params || {};

  const [pagando, setPagando] = useState(false);

  const total = Number(importe) + Number(comision) + Number(importeSeguro);

  const onPagar = async () => {
    setPagando(true);
    try {
      // Crear el registro de subasta (representa el pago confirmado)
      const importeReal = Number(importe) || 0.01;
      const comisionReal = Number(comision) > 0 ? Number(comision) : importeReal * 0.10;
      const registro = await RegistroSubasta.crear({
        subasta: subastaId ? { identificador: subastaId } : null,
        cliente: user?.clienteId ? { identificador: user.clienteId } : null,
        producto: itemId || null,
        duenio: null,
        importe: importeReal + comisionReal,
        comision: comisionReal,
        reembolsada: 'no',
      });
      navigation.navigate('PagoConfirmado', {
        registroId: registro.identificador,
        total,
        moneda,
        titulo,
        medioPagoLabel,
      });
    } catch (e) {
      Alert.alert('Error al confirmar el pago', e.message || 'Intentá nuevamente.');
    } finally {
      setPagando(false);
    }
  };

  return (
    <Screen>
      <Header />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22 }} showsVerticalScrollIndicator={false}>
        <Title>Confirmar{'\n'}pago</Title>
        <Card el style={{ marginTop: 8 }}>
          <Text style={s.detail}>DETALLE</Text>
          <Row k={titulo || 'Artículo'} v={formatImporte(importe, moneda)} />
          {Number(comision) > 0 && <Row k="Comisión BIDLY" v={formatImporte(comision, moneda)} />}
          {Number(importeSeguro) > 0 && <Row k="Seguro" v={formatImporte(importeSeguro, moneda)} />}
          <View style={s.divider}><Row k="TOTAL" v={formatImporte(total, moneda)} vc={colors.green} bold /></View>
        </Card>
        <SectionLabel>Medio de pago</SectionLabel>
        <Card el style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <VisaChip />
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{medioPagoLabel || '—'}</Text>
        </Card>
      </ScrollView>
      <BottomBar>
        <Btn
          title={pagando ? 'Procesando…' : `Pagar ${formatImporte(total, moneda)}`}
          onPress={onPagar}
          disabled={pagando}
        />
      </BottomBar>
    </Screen>
  );
}

// ─── PAGO CONFIRMADO ──────────────────────────────────────────────────────────
export function PagoConfirmadoScreen({ navigation, route }) {
  const { registroId, total, moneda = 'ARS', titulo, medioPagoLabel } = route.params || {};
  const fecha = new Date().toLocaleString('es-AR');

  return (
    <Screen>
      <Header />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 26, paddingBottom: 110, alignItems: 'center' }} showsVerticalScrollIndicator={false}>
        <View style={[s.centerIcon, { backgroundColor: colors.blue }]}>
          <Ionicons name="checkmark" size={34} color="#fff" />
        </View>
        <Display style={{ fontSize: 30, textAlign: 'center', marginVertical: 12 }}>Pago{'\n'}confirmado</Display>
        <Text style={{ color: colors.muted, fontSize: 13.5 }}>
          {registroId ? `Registro N° ${registroId}` : 'Pago registrado'}
        </Text>
        <Card el style={{ marginTop: 22, width: '100%' }}>
          <Row k="Fecha" v={fecha} />
          {titulo && <Row k="Artículo" v={titulo} />}
          {medioPagoLabel && <Row k="Medio de pago" v={medioPagoLabel} />}
          <View style={s.divider}>
            <Row k="TOTAL" v={formatImporte(total, moneda)} vc={colors.green} bold />
          </View>
        </Card>
      </ScrollView>
      <BottomBar>
        <Btn title="Volver al Home" onPress={() => navigation.navigate('Main')} />
      </BottomBar>
    </Screen>
  );
}

// ─── MULTA SCREEN ─────────────────────────────────────────────────────────────
export function MultaScreen({ navigation, route }) {
  const { multaId } = route.params || {};
  const [multa, setMulta] = useState(null);
  const [loading, setLoading] = useState(!!multaId);
  const [pagando, setPagando] = useState(false);

  useEffect(() => {
    if (!multaId) return;
    Multas.obtener(multaId)
      .then(setMulta)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [multaId]);

  const onPagar = async () => {
    if (!multaId) return;
    setPagando(true);
    try {
      await Multas.pagar(multaId);
      Alert.alert('Multa pagada', 'La multa fue registrada como pagada.', [
        { text: 'OK', onPress: () => navigation.navigate('PagoConfirmado', {
          total: multa?.importe,
          titulo: `Multa #${multaId}`,
        }) },
      ]);
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo pagar la multa.');
    } finally {
      setPagando(false);
    }
  };

  const importeMulta = multa?.importe ? Number(multa.importe) : 0;

  return (
    <Screen>
      <Header />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 26, paddingBottom: 110, alignItems: 'center' }} showsVerticalScrollIndicator={false}>
        <View style={[s.centerIcon, { backgroundColor: 'rgba(226,57,80,0.18)' }]}>
          <Ionicons name="alert" size={32} color={colors.red} />
        </View>
        <Display style={{ fontSize: 30, textAlign: 'center', marginVertical: 12, lineHeight: 33 }}>Multa{'\n'}pendiente</Display>
        <Text style={{ color: colors.red, fontSize: 13.5, fontWeight: '700' }}>No abonaste dentro del plazo</Text>
        {loading && <ActivityIndicator color={colors.blue} style={{ marginTop: 20 }} />}
        {!loading && (
          <Card el style={{ marginTop: 22, width: '100%' }}>
            {multa?.pujo?.item?.identificador && (
              <Row k="Item" v={`#${multa.pujo.item.identificador}`} />
            )}
            {importeMulta > 0 && (
              <Row k="Multa" v={formatImporte(importeMulta)} vc={colors.red} />
            )}
            {multa?.fechaGenerada && (
              <Row k="Generada" v={new Date(multa.fechaGenerada).toLocaleDateString('es-AR')} />
            )}
          </Card>
        )}
      </ScrollView>
      <BottomBar>
        <Btn
          title={pagando ? 'Pagando…' : 'Pagar multa'}
          kind="danger"
          onPress={onPagar}
          disabled={pagando || loading || !multaId}
        />
      </BottomBar>
    </Screen>
  );
}

// ─── REEMBOLSO SCREEN ─────────────────────────────────────────────────────────
export function ReembolsoScreen({ navigation, route }) {
  const { registroId, importe, titulo } = route.params || {};
  const [m, setM] = useState(0);
  const [confirmando, setConfirmando] = useState(false);
  const motivos = ['Producto dañado / no coincide', 'No recibí el artículo', 'Otro motivo'];

  const onConfirmar = async () => {
    if (!registroId) {
      return Alert.alert('Error', 'No se encontró el registro de compra.');
    }
    setConfirmando(true);
    try {
      await RegistroSubasta.reembolso(registroId, 'si');
      Alert.alert(
        'Reembolso solicitado',
        'Procesaremos la devolución en 5-10 días hábiles.',
        [{ text: 'OK', onPress: () => navigation.navigate('Main') }],
      );
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo procesar el reembolso.');
    } finally {
      setConfirmando(false);
    }
  };

  return (
    <Screen>
      <Header />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22 }} showsVerticalScrollIndicator={false}>
        <Title>Solicitar{'\n'}reembolso</Title>
        <Sub>Devolveremos el monto al postor en 5–10 días hábiles.</Sub>
        {(titulo || importe) && (
          <Card el style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              {registroId && <Text style={s.detail}>REGISTRO #{registroId}</Text>}
              {titulo && (
                <Display style={{ fontSize: 15, marginTop: 6, lineHeight: 18 }}>{titulo}</Display>
              )}
            </View>
            {importe && (
              <Display style={{ color: colors.green, fontSize: 20, textAlign: 'right' }}>
                {formatImporte(importe)}
              </Display>
            )}
          </Card>
        )}
        <SectionLabel>Motivo del reembolso</SectionLabel>
        <View style={{ gap: 10 }}>
          {motivos.map((t, i) => (
            <TouchableOpacity key={i} onPress={() => setM(i)}
              style={[s.motivo, { borderColor: m === i ? colors.borderHi : colors.border }]}>
              <Radio on={m === i} />
              <Text style={{ color: '#fff', fontSize: 14, flex: 1 }}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <BottomBar>
        <Btn
          title={confirmando ? 'Procesando…' : 'Confirmar reembolso'}
          onPress={onConfirmar}
          disabled={confirmando}
        />
      </BottomBar>
    </Screen>
  );
}

const s = StyleSheet.create({
  visa: { width: 46, height: 30, borderRadius: 6, backgroundColor: '#1a2a52', alignItems: 'center', justifyContent: 'center' },
  visaTxt: { color: '#fff', fontSize: 11, fontWeight: '900', fontStyle: 'italic' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.blue },
  addCard: { marginTop: 14, paddingVertical: 16, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed',
    borderColor: colors.borderHi, backgroundColor: colors.blueSoft, alignItems: 'center' },
  detail: { color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8, paddingTop: 6 },
  centerIcon: { width: 74, height: 74, borderRadius: 37, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  motivo: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.cardEl,
    borderWidth: 1.5, borderRadius: 12, paddingVertical: 15, paddingHorizontal: 16 },
});
