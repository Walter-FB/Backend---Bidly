// BIDLY — Panel del subastador: admisiones a validar + subastas que corre.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Display, Tag, Chip, Card, SectionLabel, Row, Btn, LiveBadge, SuccessBanner, ErrorBanner, Field } from '../components/ui';
import { colors } from '../theme/theme';
import { Subastas, Pujas, Items, Admisiones, Clientes } from '../api/endpoints';
import { BASE_URL } from '../api/client';
import { tituloSubasta, formatFechaSubasta, tagEstadoSubasta } from '../utils/subasta';

function formatAdminError(e) {
  if (e?.status === 301) return 'Error HTTP→HTTPS. Usá https en app.json o recargá la app.';
  if (e?.data?.code === 'NOT_APPROVED') return 'La subasta debe estar aprobada antes de iniciar la puja.';
  if (e?.status === 0) return e.message || 'Sin conexión al backend.';
  return e?.data?.error || e?.message || 'Error desconocido';
}

const FILTROS_SUBASTA = [
  ['todas', 'Todas'],
  ['abierta', 'Abiertas'],
  ['cerrada', 'Cerradas'],
  ['con_items', 'Con ítems'],
];

export function DashboardAdminScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();

  const [tab, setTab] = useState('admisiones');
  const [subastas, setSubastas] = useState([]);
  const [filtroLista, setFiltroLista] = useState('con_items');
  const [loadingSubastas, setLoadingSubastas] = useState(false);
  const [selId, setSelId] = useState(null);
  const [items, setItems] = useState([]);
  const [asistentes, setAsistentes] = useState([]);
  const [pujas, setPujas] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [ctrl, setCtrl] = useState(false);
  const [lastRefresh, setLastRefresh] = useState('—');
  const [admisiones, setAdmisiones] = useState([]);
  const [loadingAdmisiones, setLoadingAdmisiones] = useState(false);
  const [admisionesCount, setAdmisionesCount] = useState(0);
  const [postores, setPostores] = useState([]);
  const [loadingPostores, setLoadingPostores] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  const selSubasta = subastas.find(s => s.identificador === selId) ?? null;
  const activeItem = items[activeIdx] ?? null;

  const subastasFiltradas = subastas.filter((sub) => {
    if (filtroLista === 'abierta') return sub.estado === 'abierta';
    if (filtroLista === 'cerrada') return sub.estado === 'cerrada';
    if (filtroLista === 'con_items') return (sub.totalItems ?? 0) > 0;
    return true;
  });

  const loadSubastas = useCallback(async () => {
    setLoadingSubastas(true);
    try {
      const params = { publico: false };
      if (filtroLista === 'abierta' || filtroLista === 'cerrada') {
        params.estado = filtroLista;
      }
      const data = await Subastas.listar(params);
      if (mounted.current) setSubastas(Array.isArray(data) ? data : []);
    } catch (e) {
      if (mounted.current) setErrorMsg(formatAdminError(e));
    } finally {
      if (mounted.current) setLoadingSubastas(false);
    }
  }, [filtroLista]);

  useEffect(() => { loadSubastas(); }, [loadSubastas]);

  const loadAdmisiones = useCallback(async () => {
    setLoadingAdmisiones(true);
    try {
      const [lista, countData] = await Promise.all([
        Admisiones.listar(),
        Admisiones.contarPendientes(),
      ]);
      if (!mounted.current) return;
      setAdmisiones(Array.isArray(lista) ? lista : []);
      setAdmisionesCount(Number(countData?.pendientes ?? 0));
    } catch (e) {
      if (mounted.current) setErrorMsg(formatAdminError(e));
    } finally {
      if (mounted.current) setLoadingAdmisiones(false);
    }
  }, []);

  useEffect(() => { loadAdmisiones(); }, [loadAdmisiones]);

  const loadPostores = useCallback(async () => {
    setLoadingPostores(true);
    try {
      const lista = await Clientes.pendientes();
      if (mounted.current) setPostores(Array.isArray(lista) ? lista : []);
    } catch (e) {
      if (mounted.current) setErrorMsg(formatAdminError(e));
    } finally {
      if (mounted.current) setLoadingPostores(false);
    }
  }, []);

  useEffect(() => { loadPostores(); }, [loadPostores]);

  const refreshContexto = useCallback(async () => {
    if (!selId || !mounted.current) return;
    try {
      const [sub, its, asis, sesion] = await Promise.all([
        Subastas.obtener(selId),
        Subastas.catalogos(selId),
        Subastas.asistentes(selId),
        Subastas.sesion(selId).catch(() => null),
      ]);
      if (!mounted.current) return;
      const list = Array.isArray(its) ? its : [];
      const subMerged = sesion?.segundosRestantes != null
        ? { ...sub, segundosRestantes: sesion.segundosRestantes }
        : sub;
      setSubastas(prev => prev.map(s => s.identificador === selId ? { ...s, ...subMerged, totalItems: list.length } : s));
      setItems(list);
      setAsistentes(Array.isArray(asis) ? asis : []);
      if (sesion?.itemActivoId != null) {
        const idx = list.findIndex((i) => Number(i.identificador) === Number(sesion.itemActivoId));
        if (idx >= 0) setActiveIdx(idx);
      } else {
        const firstFree = list.findIndex((i) => i.subastado !== 'si');
        if (firstFree >= 0) setActiveIdx(firstFree);
      }
      setLastRefresh(new Date().toLocaleTimeString('es-AR', { hour12: false }));
    } catch (e) {
      if (mounted.current) setErrorMsg(formatAdminError(e));
    }
  }, [selId]);

  const abrirSubasta = useCallback((id) => {
    setSelId(id);
    setTab('subastas');
  }, []);

  const verComoUsuario = useCallback((item) => {
    if (!selSubasta || !item) return;
    const titulo = tituloSubasta(selSubasta, items);
    if (selSubasta.estadoSubasta === 'iniciada' || selSubasta.fase === 'en_curso') {
      nav.navigate('SubastaEnVivo', {
        subastaId: selSubasta.identificador,
        itemId: item.identificador,
        productoId: item.producto?.identificador,
        precioBase: item.precioBase,
        titulo,
        moneda: selSubasta.moneda,
        comision: item.comision,
        fecha: selSubasta.fecha,
        hora: selSubasta.hora,
        categoriaSubasta: selSubasta.categoria,
      });
    } else {
      nav.navigate('Producto', { subastaId: selSubasta.identificador, subasta: selSubasta });
    }
  }, [selSubasta, items, nav]);

  useEffect(() => {
    if (!selId) {
      setItems([]);
      setAsistentes([]);
      setPujas([]);
      setActiveIdx(0);
      return;
    }
    setItems([]);
    setPujas([]);
    setActiveIdx(0);
    let cancelled = false;
    (async () => {
      try {
        const [its, asis, sesion] = await Promise.all([
          Subastas.catalogos(selId),
          Subastas.asistentes(selId),
          Subastas.sesion(selId).catch(() => null),
        ]);
        if (cancelled) return;
        const list = Array.isArray(its) ? its : [];
        setItems(list);
        setAsistentes(Array.isArray(asis) ? asis : []);
        if (sesion?.itemActivoId != null) {
          const idx = list.findIndex((i) => Number(i.identificador) === Number(sesion.itemActivoId));
          setActiveIdx(idx >= 0 ? idx : 0);
        } else {
          const firstFree = list.findIndex(i => i.subastado !== 'si');
          setActiveIdx(firstFree >= 0 ? firstFree : 0);
        }
      } catch (e) {
        if (!cancelled && mounted.current) setErrorMsg(formatAdminError(e));
      }
    })();
    return () => { cancelled = true; };
  }, [selId]);

  useEffect(() => {
    if (!selId) return;
    refreshContexto();
    const id = setInterval(refreshContexto, 5000);
    return () => clearInterval(id);
  }, [selId, refreshContexto]);

  useEffect(() => {
    const iid = activeItem?.identificador;
    if (!iid) { setPujas([]); return; }
    const tick = async () => {
      if (!mounted.current) return;
      try {
        const data = await Pujas.porItem(iid);
        if (mounted.current) setPujas(Array.isArray(data) ? data : []);
      } catch { if (mounted.current) setPujas([]); }
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, [activeItem?.identificador]);

  const runAdminAction = useCallback(async (action, okMessage) => {
    if (ctrl) return;
    setCtrl(true);
    setErrorMsg(null);
    try {
      await action();
      if (mounted.current && okMessage) setSuccessMsg(okMessage);
    } catch (e) {
      if (mounted.current) setErrorMsg(formatAdminError(e));
    } finally {
      if (mounted.current) setCtrl(false);
    }
  }, [ctrl]);

  const iniciarPuja = useCallback(async () => {
    if (!selId) return;
    await runAdminAction(async () => {
      await Subastas.actualizarEstado(selId, 'abierta');
      await refreshContexto();
      await loadSubastas();
    }, 'Puja iniciada — en vivo');
  }, [selId, runAdminAction, refreshContexto, loadSubastas]);

  const cerrarSubasta = useCallback(async () => {
    if (!selId) return;
    await runAdminAction(async () => {
      await Subastas.actualizarEstado(selId, 'cerrada');
      await refreshContexto();
      await loadSubastas();
    }, 'Subasta cerrada');
  }, [selId, runAdminAction, refreshContexto, loadSubastas]);

  const adjudicarItemActivo = useCallback(async () => {
    const item = items[activeIdx];
    if (!item?.identificador || item.subastado === 'si') return;
    await runAdminAction(async () => {
      await Items.adjudicar(item.identificador);
      await refreshContexto();
    }, 'Ítem adjudicado');
  }, [items, activeIdx, runAdminAction, refreshContexto]);

  const pedirInspeccion = useCallback(async (id, direccion) => {
    await runAdminAction(async () => {
      await Admisiones.pedirInspeccion(id, direccion);
      await loadAdmisiones();
    }, 'Inspección solicitada');
  }, [runAdminAction, loadAdmisiones]);

  const rechazarAdmision = useCallback(async (id, observacion) => {
    await runAdminAction(async () => {
      await Admisiones.rechazar(id, observacion);
      await loadAdmisiones();
    }, 'Admisión rechazada');
  }, [runAdminAction, loadAdmisiones]);

  const proponerAdmision = useCallback(async (id, valorBase, comision, subastaId) => {
    await runAdminAction(async () => {
      await Admisiones.proponer(id, valorBase, comision || null, subastaId);
      await loadAdmisiones();
    }, 'Propuesta enviada al dueño');
  }, [runAdminAction, loadAdmisiones]);

  const admitirPostor = useCallback(async (id, categoria) => {
    await runAdminAction(async () => {
      await Clientes.actualizarCategoria(id, categoria);
      await Clientes.admitir(id, 'si');
      await loadPostores();
    }, 'Postor admitido');
  }, [runAdminAction, loadPostores]);

  const crearColeccion = useCallback(async (payload) => {
    await runAdminAction(async () => {
      await Admisiones.crearColeccion(payload);
      await loadAdmisiones();
    }, 'Colección creada');
  }, [runAdminAction, loadAdmisiones]);

  const admisionesLabel = admisionesCount > 0
    ? `Admisiones (${admisionesCount})`
    : 'Admisiones';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={s.topbar}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Display style={{ color: colors.blueLogo, fontSize: 19 }}>Subastador</Display>
        <Tag label="SUBASTADOR" color={colors.blue} />
      </View>

      <View style={s.tabRow}>
        {[
          ['admisiones', admisionesLabel],
          ['postores', postores.length > 0 ? `Postores (${postores.length})` : 'Postores'],
          ['subastas', 'Subastas'],
        ].map(([k, label]) => (
          <TouchableOpacity key={k} onPress={() => setTab(k)} style={[s.tabBtn, tab === k && s.tabActive]}>
            <Text style={[s.tabTxt, tab === k && { color: '#fff', fontWeight: '700' }]} numberOfLines={1}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <SuccessBanner message={successMsg} onDismiss={() => setSuccessMsg(null)} />
      <ErrorBanner message={errorMsg} onDismiss={() => setErrorMsg(null)} />
      {ctrl && (
        <View style={{ paddingVertical: 8, alignItems: 'center' }}>
          <ActivityIndicator color={colors.blue} />
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>Procesando…</Text>
        </View>
      )}
      <Text style={{ color: colors.muted, fontSize: 10, textAlign: 'center', marginBottom: 4 }} numberOfLines={1}>
        API: {BASE_URL}
      </Text>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {tab === 'admisiones' ? (
          <AdmisionesSection
            admisiones={admisiones}
            subastas={subastas}
            loading={loadingAdmisiones}
            ctrl={ctrl}
            onRefresh={loadAdmisiones}
            onInspeccionar={pedirInspeccion}
            onRechazar={rechazarAdmision}
            onProponer={proponerAdmision}
            onColeccion={crearColeccion}
          />
        ) : tab === 'postores' ? (
          <PostoresSection
            postores={postores}
            loading={loadingPostores}
            ctrl={ctrl}
            onRefresh={loadPostores}
            onAdmitir={admitirPostor}
          />
        ) : selId ? (
          <EstadoSection
            subasta={selSubasta}
            items={items}
            asistentes={asistentes}
            pujas={pujas}
            activeIdx={activeIdx}
            activeItem={activeItem}
            onBack={() => setSelId(null)}
            onSelectItem={setActiveIdx}
            onVerComoUsuario={verComoUsuario}
            onAbrir={iniciarPuja}
            onCerrar={cerrarSubasta}
            onAdjudicar={adjudicarItemActivo}
            onRefresh={refreshContexto}
            ctrl={ctrl}
            lastRefresh={lastRefresh}
          />
        ) : (
          <SubastasListSection
            subastas={subastasFiltradas}
            total={subastas.length}
            loading={loadingSubastas}
            filtro={filtroLista}
            onFiltro={setFiltroLista}
            onSelect={abrirSubasta}
            onRefresh={loadSubastas}
            onCrear={() => nav.navigate('CrearSubasta')}
          />
        )}
      </ScrollView>
    </View>
  );
}

function SubastasListSection({
  subastas, total, loading, filtro, onFiltro, onSelect, onRefresh, onCrear,
}) {
  return (
    <View style={{ gap: 12, paddingTop: 14 }}>
      <Btn title="+ Crear subasta" onPress={onCrear} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 4 }}>
          {FILTROS_SUBASTA.map(([k, label]) => (
            <Chip key={k} label={label} active={filtro === k} onPress={() => onFiltro(k)} />
          ))}
        </View>
      </ScrollView>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: colors.muted, fontSize: 12.5 }}>
          {subastas.length} mostradas · {total} en total
        </Text>
        <TouchableOpacity onPress={onRefresh} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="refresh" size={16} color={colors.blue} />
          <Text style={{ color: colors.blue, fontSize: 13, fontWeight: '700' }}>Actualizar</Text>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator color={colors.blue} />}

      {!loading && subastas.length === 0 && (
        <Text style={{ color: colors.muted, fontSize: 13, textAlign: 'center', paddingVertical: 24 }}>
          Nada con este filtro. Probá «Todas» o actualizá.
        </Text>
      )}

      {subastas.map((sub) => {
        const tag = tagEstadoSubasta(sub);
        return (
          <TouchableOpacity key={sub.identificador} onPress={() => onSelect(sub.identificador)} activeOpacity={0.85}>
            <Card el style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: '700' }}>#{sub.identificador}</Text>
                  <Display style={{ fontSize: 14.5, lineHeight: 18 }} numberOfLines={2}>
                    {sub.titulo || tituloSubasta(sub)}
                  </Display>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Tag label={tag.label} color={tag.color} />
                </View>
              </View>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {sub.categoria ?? '—'} · {sub.moneda ?? '—'} · {formatFechaSubasta(sub.fecha)}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {sub.totalItems ?? 0} ítems · {sub.totalAsistentes ?? 0} asistentes
              </Text>
            </Card>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function EstadoSection({
  subasta, items, asistentes, pujas, activeIdx, activeItem, onBack, onSelectItem, onVerComoUsuario,
  onAbrir, onCerrar, onAdjudicar, onRefresh, ctrl, lastRefresh,
}) {
  const tag = tagEstadoSubasta(subasta || {});
  const isOpen = subasta?.estadoSubasta === 'iniciada' || subasta?.fase === 'en_curso';
  const isPendiente = subasta?.estadoSubasta === 'pendiente' || subasta?.fase === 'pendiente';
  const isEsperando = subasta?.estadoSubasta === 'esperando'
    || (!subasta?.estadoSubasta && subasta?.fase === 'programada');
  const isFinalizada = subasta?.estadoSubasta === 'finalizada' || subasta?.fase === 'finalizada';
  const itemActivo = activeItem ?? items[activeIdx];
  const itemActivoAdjudicado = itemActivo?.subastado === 'si';
  const allAdjudicados = items.length > 0 && items.every(i => i.subastado === 'si');
  const datosInconsistentes = isOpen && allAdjudicados;

  return (
    <View style={{ gap: 12, paddingTop: 14 }}>
      <TouchableOpacity onPress={onBack} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        <Ionicons name="chevron-back" size={20} color={colors.blue} />
        <Text style={{ color: colors.blue, fontSize: 14, fontWeight: '700' }}>Volver al listado</Text>
      </TouchableOpacity>

      {datosInconsistentes && (
        <View style={s.warn}>
          <Ionicons name="alert-circle-outline" size={14} color={colors.gold} />
          <Text style={{ color: colors.gold, fontSize: 12.5, flex: 1 }}>
            Todos los ítems están adjudicados pero la subasta sigue abierta. Cerrala abajo.
          </Text>
        </View>
      )}

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Display style={{ fontSize: 15 }} numberOfLines={2}>{tituloSubasta(subasta, items)}</Display>
          {isOpen ? <LiveBadge /> : <Tag label={tag.label} color={tag.color} />}
        </View>
        <Row k="ID" v={`#${subasta?.identificador ?? '—'}`} />
        <Row k="Categoría" v={subasta?.categoria ?? '—'} />
        <Row k="Moneda" v={subasta?.moneda ?? '—'} />
        <Row k="Fecha" v={subasta?.fecha ?? '—'} />
        <Row
          k="Estado subasta"
          v={subasta?.estadoSubasta ?? subasta?.fase ?? '—'}
          vc={
            subasta?.estadoSubasta === 'iniciada' ? colors.green
              : subasta?.estadoSubasta === 'finalizada' ? colors.muted
              : subasta?.estadoSubasta === 'esperando' ? colors.blue
              : subasta?.estadoSubasta === 'pendiente' ? colors.gold
              : undefined
          }
        />
        <Row k="Asistentes" v={String(asistentes.length)} />
        {isOpen && subasta?.segundosRestantes != null ? (
          <Row k="Timer" v={`${Math.floor(subasta.segundosRestantes / 60)}m ${subasta.segundosRestantes % 60}s`} vc={colors.gold} />
        ) : null}
        <Row k="Último refresh" v={lastRefresh} />
      </Card>

      <SectionLabel>Catálogo ({items.length} ítems)</SectionLabel>
      {items.length === 0 && (
        <Text style={{ color: colors.muted, fontSize: 13 }}>Sin ítems en catálogo</Text>
      )}
      {items.map((item, idx) => {
        const adj = item.subastado === 'si';
        const active = idx === activeIdx;
        return (
          <TouchableOpacity
            key={item.identificador}
            onPress={() => (active ? onVerComoUsuario(item) : onSelectItem(idx))}
            activeOpacity={active ? 0.75 : 0.85}
            style={[s.itemRow, active && { borderColor: colors.blue, borderWidth: 1.5 }, adj && { opacity: 0.5 }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: adj ? colors.muted : '#fff', fontSize: 13, fontWeight: '700' }}>
                {active ? '▶ ' : ''}{item.producto?.descripcionCatalogo ?? `Ítem #${item.identificador}`}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 11.5, marginTop: 2 }}>
                Base: {Number(item.precioBase).toLocaleString('es-AR')} · Comisión: {item.comision}
              </Text>
              {active && (
                <Text style={{ color: colors.blue, fontSize: 11, marginTop: 4, fontWeight: '700' }}>
                  Tocá para ver la subasta como usuario →
                </Text>
              )}
            </View>
            {adj
              ? <Tag label="ADJUDICADO" color={colors.green} />
              : active ? <Tag label="ACTIVO" color={colors.blue} /> : null}
          </TouchableOpacity>
        );
      })}

      <SectionLabel>Pujas del ítem activo</SectionLabel>
      {pujas.length === 0 && (
        <Text style={{ color: colors.muted, fontSize: 13 }}>Sin pujas en este ítem</Text>
      )}
      {pujas.slice(0, 5).map((p, i) => (
        <View key={p.identificador ?? i} style={[s.pujaRow, i === 0 && { borderColor: colors.green }]}>
          <Text style={{ color: i === 0 ? colors.green : '#fff', fontWeight: '800', fontSize: 15 }}>
            ${Number(p.importe).toLocaleString('es-AR')}
          </Text>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Asistente #{p.asistente?.identificador ?? '?'}</Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>
              {p.fechaHora ? String(p.fechaHora).slice(11, 19) : ''}
            </Text>
          </View>
          {p.ganador === 'si' && <Tag label="GANADOR" color={colors.gold} />}
        </View>
      ))}

      <SectionLabel>Control</SectionLabel>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {isOpen ? (
          <Btn title="Subasta iniciada" kind="ghost" style={{ flex: 1 }} disabled />
        ) : isFinalizada ? (
          <Btn title="Subasta finalizada" kind="ghost" style={{ flex: 1 }} disabled />
        ) : (
          <Btn
            title={ctrl ? 'Procesando…' : 'Iniciar puja'}
            kind="primary"
            style={{ flex: 1 }}
            onPress={onAbrir}
            disabled={ctrl || !isEsperando}
          />
        )}
        <Btn title={ctrl ? '…' : 'Cerrar'} kind="danger" style={{ flex: 1 }} onPress={onCerrar} disabled={ctrl || !isOpen} />
      </View>
      {isOpen && itemActivo && !itemActivoAdjudicado && (
        <Btn
          title={ctrl ? 'Adjudicando…' : 'Adjudicar ítem activo'}
          onPress={onAdjudicar}
          disabled={ctrl}
          style={{ marginTop: 8 }}
        />
      )}
      <Btn title="Refrescar" kind="ghost" onPress={onRefresh} disabled={ctrl} style={{ marginTop: 4 }} />
    </View>
  );
}

const CATEGORIAS_POSTOR = ['comun', 'especial', 'plata', 'oro', 'platino'];

function PostoresSection({ postores, loading, ctrl, onRefresh, onAdmitir }) {
  return (
    <View style={{ gap: 12, paddingTop: 14 }}>
      <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 20 }}>
        Postores registrados pendientes de admisión. Verificá sus datos, asigná una categoría y admitilos.
      </Text>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <TouchableOpacity onPress={onRefresh} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="refresh" size={16} color={colors.blue} />
          <Text style={{ color: colors.blue, fontSize: 13, fontWeight: '700' }}>Actualizar</Text>
        </TouchableOpacity>
      </View>
      {loading && <ActivityIndicator color={colors.blue} />}
      {!loading && postores.length === 0 && (
        <Text style={{ color: colors.muted, fontSize: 13, textAlign: 'center', paddingVertical: 28 }}>
          No hay postores pendientes de admisión.
        </Text>
      )}
      {postores.map((p) => (
        <PostorCard key={p.identificador} p={p} ctrl={ctrl} onAdmitir={onAdmitir} />
      ))}
    </View>
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
          {CATEGORIAS_POSTOR.map((c) => (
            <Chip key={c} label={c} active={cat === c} onPress={() => setCat(c)} />
          ))}
        </View>
      </ScrollView>
      <Btn title={ctrl ? 'Procesando…' : `Admitir como ${cat.toUpperCase()}`} onPress={() => onAdmitir(p.identificador, cat)} disabled={ctrl} />
    </Card>
  );
}

const ADMISION_ADMIN_LABEL = {
  solicitada:       { label: 'A REVISAR', color: colors.gold },
  en_inspeccion:    { label: 'EN INSPECCIÓN', color: colors.blue },
  propuesta:        { label: 'PROPUESTA ENVIADA', color: colors.gold },
  aprobada:         { label: 'EN SUBASTA', color: colors.green },
  rechazada:        { label: 'RECHAZADA', color: colors.red },
  rechazada_duenio: { label: 'DEVUELTA', color: colors.muted },
};

function ColeccionBuilder({ admisiones, subastas, ctrl, onColeccion }) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState('');
  const [subastaId, setSubastaId] = useState(null);
  const [sel, setSel] = useState({}); // admisionId -> valorBase

  const candidatas = (admisiones || []).filter((a) => a.estado === 'solicitada' || a.estado === 'en_inspeccion');
  const disponibles = (subastas || []).filter((s) => s.estadoSubasta !== 'finalizada');

  const toggle = (id) => setSel((s) => {
    const n = { ...s };
    if (id in n) delete n[id]; else n[id] = '';
    return n;
  });

  const crear = () => {
    const ids = Object.keys(sel);
    if (!nombre.trim()) return Alert.alert('Nombre', 'Ponele un nombre a la colección (ej. "Colección Juan Pérez").');
    if (!subastaId) return Alert.alert('Subasta', 'Elegí a qué subasta asignar la colección.');
    if (ids.length < 2) return Alert.alert('Ítems', 'Elegí al menos 2 bienes para armar la colección.');
    const items = ids.map((id) => ({ admisionId: Number(id), valorBase: Number(sel[id]) }));
    if (items.some((it) => !it.valorBase || it.valorBase <= 0)) return Alert.alert('Valores', 'Completá el valor base de cada bien.');
    onColeccion({ subastaId, nombreColeccion: nombre.trim(), items });
    setAbierto(false); setNombre(''); setSubastaId(null); setSel({});
  };

  if (!abierto) {
    return (
      <Btn title="+ Armar colección" kind="ghost" onPress={() => setAbierto(true)} disabled={candidatas.length < 2} />
    );
  }
  return (
    <Card el style={{ gap: 8 }}>
      <Text style={{ color: '#fff', fontWeight: '700' }}>Nueva colección</Text>
      <Field placeholder='Nombre (ej. "Colección Juan Pérez")' value={nombre} onChangeText={setNombre} />
      <Text style={{ color: colors.muted, fontSize: 12 }}>Asignar a subasta:</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 2 }}>
          {disponibles.map((s) => (
            <Chip key={s.identificador} label={`#${s.identificador}`} active={subastaId === s.identificador} onPress={() => setSubastaId(s.identificador)} />
          ))}
        </View>
      </ScrollView>
      <Text style={{ color: colors.muted, fontSize: 12 }}>Bienes (≥2, mismo dueño idealmente):</Text>
      {candidatas.map((a) => (
        <View key={a.identificador} style={{ gap: 6 }}>
          <TouchableOpacity onPress={() => toggle(a.identificador)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name={a.identificador in sel ? 'checkbox' : 'square-outline'} size={20} color={a.identificador in sel ? colors.blue : colors.muted} />
            <Text style={{ color: '#fff', fontSize: 13, flex: 1 }} numberOfLines={1}>#{a.identificador} · {a.producto?.titulo || 'Producto'} (dueño {a.duenio})</Text>
          </TouchableOpacity>
          {a.identificador in sel && (
            <Field placeholder="Valor base ($)" value={sel[a.identificador]} onChangeText={(v) => setSel((s) => ({ ...s, [a.identificador]: v }))} keyboardType="numeric" />
          )}
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
        <Btn title="Cancelar" kind="ghost" onPress={() => setAbierto(false)} style={{ flex: 1 }} />
        <Btn title={ctrl ? 'Creando…' : 'Crear colección'} onPress={crear} disabled={ctrl} style={{ flex: 1 }} />
      </View>
    </Card>
  );
}

function AdmisionesSection({ admisiones, subastas, loading, ctrl, onRefresh, onInspeccionar, onRechazar, onProponer, onColeccion }) {
  return (
    <View style={{ gap: 12, paddingTop: 14 }}>
      <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 20 }}>
        Artículos que los usuarios ofrecen a subasta. Pedí la inspección, rechazá con motivo o aceptá
        proponiendo valor base y comisión (asignándolo a una subasta).
      </Text>
      <ColeccionBuilder admisiones={admisiones} subastas={subastas} ctrl={ctrl} onColeccion={onColeccion} />
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <TouchableOpacity onPress={onRefresh} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="refresh" size={16} color={colors.blue} />
          <Text style={{ color: colors.blue, fontSize: 13, fontWeight: '700' }}>Actualizar</Text>
        </TouchableOpacity>
      </View>
      {loading && <ActivityIndicator color={colors.blue} />}
      {!loading && admisiones.length === 0 && (
        <Text style={{ color: colors.muted, fontSize: 13, textAlign: 'center', paddingVertical: 28 }}>
          No hay solicitudes de admisión.
        </Text>
      )}
      {admisiones.map((a) => (
        <AdmisionAdminCard
          key={a.identificador}
          a={a}
          subastas={subastas}
          ctrl={ctrl}
          onInspeccionar={onInspeccionar}
          onRechazar={onRechazar}
          onProponer={onProponer}
        />
      ))}
    </View>
  );
}

function AdmisionAdminCard({ a, subastas, ctrl, onInspeccionar, onRechazar, onProponer }) {
  const meta = ADMISION_ADMIN_LABEL[a.estado] || ADMISION_ADMIN_LABEL.solicitada;
  const [direccion, setDireccion] = useState('Depósito BIDLY · Av. Corrientes 1234, CABA');
  const [observacion, setObservacion] = useState('');
  const [valorBase, setValorBase] = useState('');
  const [comision, setComision] = useState('');
  const [subastaId, setSubastaId] = useState(null);

  // Se puede asignar a cualquier subasta no finalizada (recién creada = 'esperando').
  const disponibles = (subastas || []).filter((sub) => sub.estadoSubasta !== 'finalizada');
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
      {a.estado === 'rechazada' && a.observacion && (
        <Text style={{ color: colors.red, fontSize: 12 }}>Motivo: {a.observacion}</Text>
      )}
      {a.estado === 'propuesta' && (
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          Propuesto: base ${a.valorBase} · comisión ${a.comision} · subasta #{a.subastaId}
        </Text>
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
              {disponibles.length === 0 && <Text style={{ color: colors.muted, fontSize: 12 }}>No hay subastas disponibles</Text>}
              {disponibles.map((sub) => (
                <Chip
                  key={sub.identificador}
                  label={`#${sub.identificador} · ${sub.categoria ?? ''}`}
                  active={subastaId === sub.identificador}
                  onPress={() => setSubastaId(sub.identificador)}
                />
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

const s = StyleSheet.create({
  topbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, height: 52,
  },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.border },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', paddingHorizontal: 8 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.blue },
  tabTxt: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  itemRow: {
    backgroundColor: colors.card, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  pujaRow: {
    backgroundColor: colors.card, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  warn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.gold + '22', borderRadius: 8, padding: 10,
  },
});
