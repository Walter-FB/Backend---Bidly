// BIDLY — Panel interno del subastador (staff). Todo esto es INTERNO: un usuario
// normal no ve nada de acá. Tres funciones:
//   1) Admisiones: tasar bienes (inspección, proponer valor+comisión, rechazar, colecciones).
//   2) Postores: verificar y admitir postores asignándoles categoría.
//   3) Subastas: crear / abrir / cerrar / adjudicar.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Display, Tag, Chip, Card, SectionLabel, Row, Btn, Field } from '../components/ui';
import { colors } from '../theme/theme';
import { Subastas, Pujas, Items, Admisiones, Clientes } from '../api/endpoints';
import { tituloSubasta, tagEstadoSubasta } from '../utils/subasta';

function fmtError(e) {
  return e?.data?.message || e?.data?.error || e?.message || 'Error desconocido';
}

export function DashboardAdminScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const [tab, setTab] = useState('admisiones');
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const banner = (setter, texto, ms = 2500) => {
    setter(texto);
    setTimeout(() => { if (mounted.current) setter(null); }, ms);
  };
  const onOk = (t) => banner(setMsg, t);
  const onErr = (t) => banner(setErr, t);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={s.topbar}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Display style={{ color: colors.blueLogo, fontSize: 19 }}>Panel interno</Display>
        <Tag label="SUBASTADOR" color={colors.blue} />
      </View>

      <View style={s.tabRow}>
        {[['admisiones', 'Admisiones'], ['postores', 'Postores'], ['subastas', 'Subastas']].map(([k, label]) => (
          <TouchableOpacity key={k} onPress={() => setTab(k)} style={[s.tabBtn, tab === k && s.tabActive]}>
            <Text style={[s.tabTxt, tab === k && { color: '#fff', fontWeight: '700' }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {msg && <View style={s.okBanner}><Text style={s.okText}>{msg}</Text></View>}
      {err && <View style={s.errBanner}><Text style={s.errText}>{err}</Text></View>}

      {tab === 'admisiones' ? <AdmisionesTab onOk={onOk} onErr={onErr} />
        : tab === 'postores' ? <PostoresTab onOk={onOk} onErr={onErr} />
        : <CorrerSubastas onOk={onOk} onErr={onErr} />}
    </View>
  );
}

// ─── TAB 1: ADMISIONES (tasación) ─────────────────────────────────────────────
const ADM_META = {
  solicitada:       { label: 'A REVISAR', color: colors.gold },
  en_inspeccion:    { label: 'EN INSPECCIÓN', color: colors.blue },
  propuesta:        { label: 'PROPUESTA ENVIADA', color: colors.gold },
  aprobada:         { label: 'EN SUBASTA', color: colors.green },
  rechazada:        { label: 'RECHAZADA', color: colors.red },
  rechazada_duenio: { label: 'DEVUELTA', color: colors.muted },
};

function AdmisionesTab({ onOk, onErr }) {
  const [admisiones, setAdmisiones] = useState([]);
  const [subastas, setSubastas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ctrl, setCtrl] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [adm, subs] = await Promise.all([Admisiones.listar(), Subastas.listar()]);
      setAdmisiones(Array.isArray(adm) ? adm : []);
      setSubastas(Array.isArray(subs) ? subs : []);
    } catch (e) { onErr(fmtError(e)); } finally { setLoading(false); }
  }, [onErr]);
  useEffect(() => { cargar(); }, [cargar]);

  const run = async (fn, ok) => {
    if (ctrl) return;
    setCtrl(true);
    try { await fn(); onOk(ok); await cargar(); }
    catch (e) { onErr(fmtError(e)); } finally { setCtrl(false); }
  };

  const disponibles = (subastas || []).filter((s) => s.estado !== 'cerrada');

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}>
      <View style={{ paddingTop: 14, gap: 12 }}>
        <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
          Bienes que los usuarios ofrecen a subasta. Pedí inspección, rechazá con motivo, o aceptá
          proponiendo valor base + comisión y asignándolo a una subasta. Colecciones = varios bienes de un mismo dueño.
        </Text>
        <ColeccionBuilder admisiones={admisiones} subastas={disponibles} ctrl={ctrl}
          onCrear={(payload) => run(() => Admisiones.crearColeccion(payload), 'Colección creada')} />
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <TouchableOpacity onPress={cargar} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="refresh" size={16} color={colors.blue} />
            <Text style={{ color: colors.blue, fontSize: 13, fontWeight: '700' }}>Actualizar</Text>
          </TouchableOpacity>
        </View>
        {loading && <ActivityIndicator color={colors.blue} />}
        {!loading && admisiones.length === 0 && (
          <Text style={{ color: colors.muted, fontSize: 13, textAlign: 'center', paddingVertical: 24 }}>
            No hay solicitudes de admisión.
          </Text>
        )}
        {admisiones.map((a) => (
          <AdmisionAdminCard key={a.identificador} a={a} subastas={disponibles} ctrl={ctrl}
            onInspeccionar={(id, dir) => run(() => Admisiones.pedirInspeccion(id, dir), 'Inspección solicitada')}
            onRechazar={(id, obs) => run(() => Admisiones.rechazar(id, obs), 'Admisión rechazada')}
            onProponer={(id, vb, com, sid) => run(() => Admisiones.proponer(id, vb, com, sid), 'Propuesta enviada al dueño')} />
        ))}
      </View>
    </ScrollView>
  );
}

function AdmisionAdminCard({ a, subastas, ctrl, onInspeccionar, onRechazar, onProponer }) {
  const meta = ADM_META[a.estado] || ADM_META.solicitada;
  const [direccion, setDireccion] = useState('Depósito BIDLY · Av. Corrientes 1234, CABA');
  const [observacion, setObservacion] = useState('');
  const [valorBase, setValorBase] = useState('');
  const [comision, setComision] = useState('');
  const [subastaId, setSubastaId] = useState(null);
  const accionable = a.estado === 'solicitada' || a.estado === 'en_inspeccion';

  const proponer = () => {
    if (!valorBase || Number(valorBase) <= 0) return Alert.alert('Valor base', 'Ingresá un valor base válido.');
    if (!subastaId) return Alert.alert('Subasta', 'Elegí a qué subasta asignar el bien.');
    onProponer(a.identificador, Number(valorBase), comision ? Number(comision) : null, subastaId);
  };
  const rechazar = () => {
    if (!observacion.trim()) return Alert.alert('Motivo', 'Ingresá el motivo del rechazo.');
    onRechazar(a.identificador, observacion.trim());
  };

  return (
    <Card el style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: '700' }}>#{a.identificador} · dueño {a.duenio}</Text>
          <Display style={{ fontSize: 14.5, lineHeight: 18 }} numberOfLines={2}>
            {a.producto?.titulo || `Producto #${a.producto?.identificador}`}
          </Display>
        </View>
        <Tag label={meta.label} color={meta.color} />
      </View>
      <Text style={{ color: colors.muted, fontSize: 12 }}>
        {a.producto?.fotos ?? 0} fotos · propiedad: {a.declaraPropiedad} · origen: {a.declaraOrigen}
      </Text>
      {a.estado === 'rechazada' && a.observacion && <Text style={{ color: colors.red, fontSize: 12 }}>Motivo: {a.observacion}</Text>}
      {a.estado === 'propuesta' && (
        <Text style={{ color: colors.muted, fontSize: 12 }}>Propuesto: base ${a.valorBase} · comisión ${a.comision} · subasta #{a.subastaId}</Text>
      )}

      {a.estado === 'solicitada' && (
        <>
          <Field placeholder="Dirección de envío para inspección" value={direccion} onChangeText={setDireccion} />
          <Btn title="Pedir inspección" onPress={() => onInspeccionar(a.identificador, direccion)} disabled={ctrl || !direccion.trim()} />
        </>
      )}
      {a.estado === 'en_inspeccion' && (
        <>
          <SectionLabel>Aceptar y proponer</SectionLabel>
          <Field placeholder="Valor base ($)" value={valorBase} onChangeText={setValorBase} keyboardType="numeric" />
          <Field placeholder="Comisión ($) — opcional (10% por defecto)" value={comision} onChangeText={setComision} keyboardType="numeric" />
          <Text style={{ color: colors.muted, fontSize: 12 }}>Asignar a subasta:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 2 }}>
              {subastas.length === 0 && <Text style={{ color: colors.muted, fontSize: 12 }}>No hay subastas disponibles</Text>}
              {subastas.map((sub) => (
                <Chip key={sub.identificador} label={`#${sub.identificador} · ${sub.categoria ?? ''}`}
                  active={subastaId === sub.identificador} onPress={() => setSubastaId(sub.identificador)} />
              ))}
            </View>
          </ScrollView>
          <Btn title="Aceptar y proponer" onPress={proponer} disabled={ctrl} />
        </>
      )}
      {accionable && (
        <>
          <SectionLabel>Rechazar</SectionLabel>
          <Field placeholder="Motivo del rechazo (causas)" value={observacion} onChangeText={setObservacion} />
          <Btn title="Rechazar y devolver" kind="danger" onPress={rechazar} disabled={ctrl} />
        </>
      )}
    </Card>
  );
}

function ColeccionBuilder({ admisiones, subastas, ctrl, onCrear }) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState('');
  const [subastaId, setSubastaId] = useState(null);
  const [sel, setSel] = useState({}); // admisionId -> valorBase
  const [duenio, setDuenio] = useState(null); // colección = un solo dueño (consigna)

  const candidatas = (admisiones || []).filter((a) => a.estado === 'solicitada' || a.estado === 'en_inspeccion');
  const visibles = duenio == null ? candidatas : candidatas.filter((a) => a.duenio === duenio);

  const toggle = (a) => setSel((s) => {
    const n = { ...s };
    if (a.identificador in n) { delete n[a.identificador]; }
    else { n[a.identificador] = ''; }
    return n;
  });

  const onToggle = (a) => {
    if (duenio == null) setDuenio(a.duenio);
    else if (a.duenio !== duenio && !(a.identificador in sel)) {
      return Alert.alert('Un solo dueño', 'La colección lleva el nombre del dueño: todos los bienes deben ser del mismo.');
    }
    toggle(a);
    // Si quedó vacía, liberar el dueño.
    setTimeout(() => setSel((cur) => { if (Object.keys(cur).length === 0) setDuenio(null); return cur; }), 0);
  };

  const crear = () => {
    const ids = Object.keys(sel);
    if (!nombre.trim()) return Alert.alert('Nombre', 'Ponele un nombre (ej. "Colección Juan Pérez").');
    if (!subastaId) return Alert.alert('Subasta', 'Elegí a qué subasta asignar la colección.');
    if (ids.length < 2) return Alert.alert('Ítems', 'Elegí al menos 2 bienes del mismo dueño.');
    const items = ids.map((id) => ({ admisionId: Number(id), valorBase: Number(sel[id]) }));
    if (items.some((it) => !it.valorBase || it.valorBase <= 0)) return Alert.alert('Valores', 'Completá el valor base de cada bien.');
    onCrear({ subastaId, nombreColeccion: nombre.trim(), items });
    setAbierto(false); setNombre(''); setSubastaId(null); setSel({}); setDuenio(null);
  };

  if (!abierto) {
    return <Btn title="+ Armar colección" kind="ghost" onPress={() => setAbierto(true)} disabled={candidatas.length < 2} />;
  }
  return (
    <Card el style={{ gap: 8 }}>
      <Text style={{ color: '#fff', fontWeight: '700' }}>Nueva colección (un solo dueño)</Text>
      <Field placeholder='Nombre (ej. "Colección Juan Pérez")' value={nombre} onChangeText={setNombre} />
      <Text style={{ color: colors.muted, fontSize: 12 }}>Asignar a subasta:</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 2 }}>
          {subastas.map((s2) => (
            <Chip key={s2.identificador} label={`#${s2.identificador}`} active={subastaId === s2.identificador} onPress={() => setSubastaId(s2.identificador)} />
          ))}
        </View>
      </ScrollView>
      <Text style={{ color: colors.muted, fontSize: 12 }}>
        Bienes (≥2, mismo dueño){duenio != null ? ` · dueño ${duenio}` : ''}:
      </Text>
      {visibles.map((a) => (
        <View key={a.identificador} style={{ gap: 6 }}>
          <TouchableOpacity onPress={() => onToggle(a)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name={a.identificador in sel ? 'checkbox' : 'square-outline'} size={20} color={a.identificador in sel ? colors.blue : colors.muted} />
            <Text style={{ color: '#fff', fontSize: 13, flex: 1 }} numberOfLines={1}>
              #{a.identificador} · {a.producto?.titulo || 'Producto'} (dueño {a.duenio})
            </Text>
          </TouchableOpacity>
          {a.identificador in sel && (
            <Field placeholder="Valor base ($)" value={sel[a.identificador]} keyboardType="numeric"
              onChangeText={(v) => setSel((s2) => ({ ...s2, [a.identificador]: v }))} />
          )}
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
        <Btn title="Cancelar" kind="ghost" onPress={() => { setAbierto(false); setSel({}); setDuenio(null); }} style={{ flex: 1 }} />
        <Btn title={ctrl ? 'Creando…' : 'Crear colección'} onPress={crear} disabled={ctrl} style={{ flex: 1 }} />
      </View>
    </Card>
  );
}

// ─── TAB 2: POSTORES ──────────────────────────────────────────────────────────
const CATEGORIAS_POSTOR = ['comun', 'especial', 'plata', 'oro', 'platino'];

function PostoresTab({ onOk, onErr }) {
  const [postores, setPostores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ctrl, setCtrl] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try { const l = await Clientes.pendientes(); setPostores(Array.isArray(l) ? l : []); }
    catch (e) { onErr(fmtError(e)); } finally { setLoading(false); }
  }, [onErr]);
  useEffect(() => { cargar(); }, [cargar]);

  const admitir = async (id, categoria) => {
    if (ctrl) return;
    setCtrl(true);
    try { await Clientes.actualizarCategoria(id, categoria); await Clientes.admitir(id, 'si'); onOk('Postor admitido'); await cargar(); }
    catch (e) { onErr(fmtError(e)); } finally { setCtrl(false); }
  };

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}>
      <View style={{ paddingTop: 14, gap: 12 }}>
        <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
          Postores registrados pendientes de admisión. Verificá sus datos, asigná una categoría y admitilos.
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <TouchableOpacity onPress={cargar} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="refresh" size={16} color={colors.blue} />
            <Text style={{ color: colors.blue, fontSize: 13, fontWeight: '700' }}>Actualizar</Text>
          </TouchableOpacity>
        </View>
        {loading && <ActivityIndicator color={colors.blue} />}
        {!loading && postores.length === 0 && (
          <Text style={{ color: colors.muted, fontSize: 13, textAlign: 'center', paddingVertical: 24 }}>
            No hay postores pendientes.
          </Text>
        )}
        {postores.map((p) => <PostorCard key={p.identificador} p={p} ctrl={ctrl} onAdmitir={admitir} />)}
      </View>
    </ScrollView>
  );
}

function PostorCard({ p, ctrl, onAdmitir }) {
  const [cat, setCat] = useState('comun');
  return (
    <Card el style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: '700' }}>#{p.identificador}</Text>
          <Display style={{ fontSize: 14.5, lineHeight: 18 }} numberOfLines={2}>{p.nombre || 'Postor'}</Display>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{p.email || '—'}</Text>
        </View>
        <Tag label="PENDIENTE" color={colors.gold} />
      </View>
      <Text style={{ color: colors.muted, fontSize: 12 }}>Categoría a asignar:</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 2 }}>
          {CATEGORIAS_POSTOR.map((cc) => <Chip key={cc} label={cc} active={cat === cc} onPress={() => setCat(cc)} />)}
        </View>
      </ScrollView>
      <Btn title={ctrl ? 'Procesando…' : `Admitir como ${cat.toUpperCase()}`} onPress={() => onAdmitir(p.identificador, cat)} disabled={ctrl} />
    </Card>
  );
}

// ─── TAB 3: CORRER SUBASTAS ───────────────────────────────────────────────────
function CorrerSubastas({ onOk, onErr }) {
  const nav = useNavigation();
  const [subastas, setSubastas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selId, setSelId] = useState(null);
  const [items, setItems] = useState([]);
  const [pujasPorItem, setPujasPorItem] = useState({});
  const [ctrl, setCtrl] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try { const data = await Subastas.listar(); setSubastas(Array.isArray(data) ? data : []); }
    catch (e) { onErr(fmtError(e)); } finally { setLoading(false); }
  }, [onErr]);
  useEffect(() => { cargar(); }, [cargar]);

  const abrirDetalle = useCallback(async (id) => {
    setSelId(id);
    try {
      const its = await Subastas.catalogos(id);
      const lista = Array.isArray(its) ? its : [];
      setItems(lista);
      const pujas = {};
      await Promise.all(lista.map(async (it) => {
        try { pujas[it.identificador] = await Pujas.porItem(it.identificador); } catch { pujas[it.identificador] = []; }
      }));
      setPujasPorItem(pujas);
    } catch (e) { onErr(fmtError(e)); }
  }, [onErr]);

  const accion = async (fn, ok) => {
    if (ctrl) return;
    setCtrl(true);
    try { await fn(); onOk(ok); } catch (e) { onErr(fmtError(e)); } finally { setCtrl(false); }
  };
  const abrir = (id) => accion(async () => { await Subastas.actualizarEstado(id, 'abierta'); await cargar(); await abrirDetalle(id); }, 'Subasta abierta');
  const cerrar = (id) => accion(async () => { await Subastas.actualizarEstado(id, 'cerrada'); await cargar(); await abrirDetalle(id); }, 'Subasta cerrada');
  const adjudicar = (itemId) => accion(async () => { await Items.adjudicar(itemId); await abrirDetalle(selId); }, 'Ítem adjudicado');

  const sel = subastas.find((x) => x.identificador === selId) || null;

  if (sel) {
    const abierta = sel.estado === 'abierta';
    return (
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}>
        <View style={{ paddingTop: 14, gap: 12 }}>
          <TouchableOpacity onPress={() => setSelId(null)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="chevron-back" size={20} color={colors.blue} />
            <Text style={{ color: colors.blue, fontSize: 14, fontWeight: '700' }}>Volver al listado</Text>
          </TouchableOpacity>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Display style={{ fontSize: 15, flex: 1 }} numberOfLines={2}>{tituloSubasta(sel, items)}</Display>
              <Tag label={tagEstadoSubasta(sel).label} color={tagEstadoSubasta(sel).color} />
            </View>
            <Row k="ID" v={`#${sel.identificador}`} />
            <Row k="Categoría" v={sel.categoria ?? '—'} />
            <Row k="Moneda" v={sel.moneda ?? 'pesos'} />
            <Row k="Fecha" v={sel.fecha ?? '—'} />
            <Row k="Ítems" v={`${sel.totalItems ?? 0} (${sel.itemsPendientes ?? 0} pendientes)`} />
          </Card>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Btn title={ctrl ? '…' : 'Abrir puja'} onPress={() => abrir(sel.identificador)} disabled={ctrl || abierta} style={{ flex: 1 }} />
            <Btn title={ctrl ? '…' : 'Cerrar'} kind="danger" onPress={() => cerrar(sel.identificador)} disabled={ctrl || !abierta} style={{ flex: 1 }} />
          </View>
          <SectionLabel>Catálogo</SectionLabel>
          {items.length === 0 && <Text style={{ color: colors.muted, fontSize: 13 }}>Sin ítems en catálogo.</Text>}
          {items.map((it) => {
            const pujas = pujasPorItem[it.identificador] || [];
            const top = pujas[0];
            const adjudicado = it.subastado === 'si';
            return (
              <Card key={it.identificador} el style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <Display style={{ fontSize: 13.5, flex: 1 }} numberOfLines={2}>
                    {it.producto?.descripcionCatalogo || `Ítem #${it.identificador}`}
                  </Display>
                  {adjudicado && <Tag label="ADJUDICADO" color={colors.green} />}
                </View>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  Base: {Number(it.precioBase ?? 0).toLocaleString('es-AR')} · {pujas.length} pujas
                  {top ? ` · mejor $${Number(top.importe).toLocaleString('es-AR')}` : ''}
                </Text>
                {!adjudicado && <Btn title={ctrl ? 'Adjudicando…' : 'Adjudicar ítem'} onPress={() => adjudicar(it.identificador)} disabled={ctrl} />}
              </Card>
            );
          })}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}>
      <View style={{ paddingTop: 14, gap: 12 }}>
        <Btn title="+ Crear subasta" onPress={() => nav.navigate('CrearSubasta')} />
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <TouchableOpacity onPress={cargar} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="refresh" size={16} color={colors.blue} />
            <Text style={{ color: colors.blue, fontSize: 13, fontWeight: '700' }}>Actualizar</Text>
          </TouchableOpacity>
        </View>
        {loading && <ActivityIndicator color={colors.blue} />}
        {!loading && subastas.length === 0 && (
          <Text style={{ color: colors.muted, fontSize: 13, textAlign: 'center', paddingVertical: 24 }}>No hay subastas todavía.</Text>
        )}
        {subastas.map((sub) => {
          const tag = tagEstadoSubasta(sub);
          return (
            <TouchableOpacity key={sub.identificador} onPress={() => abrirDetalle(sub.identificador)} activeOpacity={0.85}>
              <Card el style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: '700' }}>#{sub.identificador}</Text>
                    <Display style={{ fontSize: 14.5, lineHeight: 18 }} numberOfLines={2}>{tituloSubasta(sub)}</Display>
                  </View>
                  <Tag label={tag.label} color={tag.color} />
                </View>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {sub.categoria ?? '—'} · {sub.moneda ?? 'pesos'} · {sub.fecha ?? '—'} · {sub.totalItems ?? 0} ítems · {sub.totalAsistentes ?? 0} asistentes
                </Text>
              </Card>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, height: 52 },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.border },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.blue },
  tabTxt: { color: colors.muted, fontSize: 13.5, fontWeight: '600' },
  okBanner: { backgroundColor: 'rgba(55,214,111,0.14)', paddingVertical: 8, paddingHorizontal: 16 },
  okText: { color: colors.green, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  errBanner: { backgroundColor: 'rgba(226,57,80,0.14)', paddingVertical: 8, paddingHorizontal: 16 },
  errText: { color: colors.red, fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
