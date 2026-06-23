// BIDLY — Panel de administración: subastas + solicitudes a confirmar.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Display, Tag, Chip, Card, SectionLabel, Row, Btn, LiveBadge, SuccessBanner } from '../components/ui';
import { colors } from '../theme/theme';
import { Subastas, Pujas, Items, SubastaRevision } from '../api/endpoints';
import { tituloSubasta, formatFechaSubasta } from '../utils/subasta';

const FILTROS_SUBASTA = [
  ['todas', 'Todas'],
  ['abierta', 'Abiertas'],
  ['cerrada', 'Cerradas'],
  ['con_items', 'Con ítems'],
];

function tagEstadoSubasta(sub) {
  const rev = sub.revisionEstado;
  if (rev === 'pendiente') return { label: 'PENDIENTE', color: colors.gold };
  if (rev === 'pausada') return { label: 'PAUSADA', color: colors.muted };
  if (rev === 'rechazada') return { label: 'RECHAZADA', color: colors.red };
  if (sub.fase === 'en_curso') return { label: 'EN VIVO', color: colors.green };
  if (sub.fase === 'programada') return { label: 'POR ABRIR', color: colors.blue };
  if (sub.fase === 'finalizada') return { label: 'FINALIZADA', color: colors.muted };
  return { label: sub.estado === 'abierta' ? 'ABIERTA' : 'CERRADA', color: sub.estado === 'abierta' ? colors.green : colors.muted };
}

export function DashboardAdminScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();

  const [tab, setTab] = useState('subastas');
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
  const [revisiones, setRevisiones] = useState([]);
  const [loadingRevisiones, setLoadingRevisiones] = useState(false);
  const [pendientesCount, setPendientesCount] = useState(0);
  const [successMsg, setSuccessMsg] = useState(null);
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
      if (mounted.current) {
        Alert.alert('Error al cargar', e.message || 'No se pudo obtener el listado de subastas.');
      }
    } finally {
      if (mounted.current) setLoadingSubastas(false);
    }
  }, [filtroLista]);

  useEffect(() => { loadSubastas(); }, [loadSubastas]);

  const loadRevisiones = useCallback(async () => {
    setLoadingRevisiones(true);
    try {
      const [lista, countData] = await Promise.all([
        SubastaRevision.listar('pendiente'),
        SubastaRevision.contarPendientes(),
      ]);
      if (!mounted.current) return;
      setRevisiones(Array.isArray(lista) ? lista : []);
      setPendientesCount(Number(countData?.pendientes ?? 0));
    } catch (e) {
      if (mounted.current) {
        Alert.alert('Error', e.message || 'No se pudieron cargar las solicitudes.');
      }
    } finally {
      if (mounted.current) setLoadingRevisiones(false);
    }
  }, []);

  useEffect(() => { loadRevisiones(); }, [loadRevisiones]);

  const refreshContexto = useCallback(async () => {
    if (!selId || !mounted.current) return;
    try {
      const [sub, its, asis] = await Promise.all([
        Subastas.obtener(selId),
        Subastas.catalogos(selId),
        Subastas.asistentes(selId),
      ]);
      if (!mounted.current) return;
      const list = Array.isArray(its) ? its : [];
      setSubastas(prev => prev.map(s => s.identificador === selId ? { ...s, ...sub, totalItems: list.length } : s));
      setItems(list);
      setAsistentes(Array.isArray(asis) ? asis : []);
      setLastRefresh(new Date().toLocaleTimeString('es-AR', { hour12: false }));
    } catch {}
  }, [selId]);

  const abrirSubasta = useCallback((id) => {
    setSelId(id);
    setTab('subastas');
  }, []);

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
        const [its, asis] = await Promise.all([
          Subastas.catalogos(selId),
          Subastas.asistentes(selId),
        ]);
        if (cancelled) return;
        const list = Array.isArray(its) ? its : [];
        setItems(list);
        setAsistentes(Array.isArray(asis) ? asis : []);
        const firstFree = list.findIndex(i => i.subastado !== 'si');
        setActiveIdx(firstFree >= 0 ? firstFree : 0);
      } catch (e) {
        if (!cancelled) {
          Alert.alert('Error', e.message || 'No se pudo cargar la subasta.');
        }
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

  const actuarRevision = (subastaId, accion) => {
    const cfg = {
      aprobar: {
        title: 'Aprobar subasta',
        msg: 'La subasta será visible en el home. El subastador podrá abrirla cuando quiera.',
        fn: () => SubastaRevision.aprobar(subastaId),
      },
      pausar: {
        title: 'Pausar subasta',
        msg: 'Quedará oculta del público y se cerrará hasta que la apruebes de nuevo.',
        fn: () => SubastaRevision.pausar(subastaId),
      },
      rechazar: {
        title: 'Eliminar solicitud',
        msg: 'Se rechaza la subasta y queda cerrada.',
        fn: () => SubastaRevision.rechazar(subastaId, 'Rechazada por administrador'),
      },
    }[accion];
    if (!cfg) return;

    Alert.alert(cfg.title, cfg.msg, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        style: accion === 'rechazar' ? 'destructive' : 'default',
        onPress: async () => {
          setCtrl(true);
          try {
            await cfg.fn();
            await Promise.all([loadRevisiones(), loadSubastas()]);
            if (selId === subastaId && accion !== 'aprobar') await refreshContexto();
            if (mounted.current && accion === 'aprobar') {
              Alert.alert('Listo', 'Subasta aprobada. Ya es visible en el home.');
            }
          } catch (e) {
            const msg = e.status === 301
              ? 'Error de conexión (HTTP→HTTPS). Recargá la app con la última versión.'
              : (e.message || 'No se pudo completar la acción.');
            Alert.alert('Error', msg);
          } finally {
            if (mounted.current) setCtrl(false);
          }
        },
      },
    ]);
  };

  const aplicarEstado = (next) => {
    if (ctrl || !selId) return;
    const verbo = next === 'abierta' ? 'abrir' : 'cerrar';
    Alert.alert(
      `${verbo.charAt(0).toUpperCase() + verbo.slice(1)} subasta`,
      `¿Querés ${verbo} la subasta #${selId}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          style: next === 'cerrada' ? 'destructive' : 'default',
          onPress: async () => {
            setCtrl(true);
            try {
              await Subastas.actualizarEstado(selId, next);
              await refreshContexto();
              await loadSubastas();
              if (mounted.current) {
                setSuccessMsg(next === 'abierta' ? 'Subasta abierta correctamente' : 'Subasta cerrada correctamente');
              }
            } catch (e) {
              Alert.alert('Error', e.message || `No se pudo ${verbo} la subasta.`);
            } finally {
              if (mounted.current) setCtrl(false);
            }
          },
        },
      ],
    );
  };

  const adjudicar = async () => {
    if (ctrl || !activeItem || activeItem.subastado === 'si') return;
    setCtrl(true);
    try {
      await Items.adjudicar(activeItem.identificador);
      await refreshContexto();
      await loadSubastas();
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo adjudicar el ítem.');
    } finally {
      if (mounted.current) setCtrl(false);
    }
  };

  const solicitudesLabel = pendientesCount > 0
    ? `Solicitudes (${pendientesCount})`
    : 'Solicitudes a confirmar';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={s.topbar}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Display style={{ color: colors.blueLogo, fontSize: 19 }}>Administración</Display>
        <Tag label="ADMIN" color={colors.blue} />
      </View>

      <View style={s.tabRow}>
        {[
          ['subastas', 'Subastas'],
          ['solicitudes', solicitudesLabel],
        ].map(([k, label]) => (
          <TouchableOpacity key={k} onPress={() => setTab(k)} style={[s.tabBtn, tab === k && s.tabActive]}>
            <Text style={[s.tabTxt, tab === k && { color: '#fff', fontWeight: '700' }]} numberOfLines={1}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <SuccessBanner message={successMsg} onDismiss={() => setSuccessMsg(null)} />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {tab === 'solicitudes' ? (
          <SolicitudesSection
            revisiones={revisiones}
            loading={loadingRevisiones}
            ctrl={ctrl}
            onRefresh={loadRevisiones}
            onAprobar={(id) => actuarRevision(id, 'aprobar')}
            onPausar={(id) => actuarRevision(id, 'pausar')}
            onRechazar={(id) => actuarRevision(id, 'rechazar')}
            onVer={abrirSubasta}
          />
        ) : selId ? (
          <EstadoSection
            subasta={selSubasta}
            items={items}
            asistentes={asistentes}
            pujas={pujas}
            activeIdx={activeIdx}
            onBack={() => setSelId(null)}
            onSelectItem={setActiveIdx}
            onAbrir={() => aplicarEstado('abierta')}
            onCerrar={() => aplicarEstado('cerrada')}
            onRefresh={refreshContexto}
            onAdjudicar={adjudicar}
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
          />
        )}
      </ScrollView>
    </View>
  );
}

function SubastasListSection({
  subastas, total, loading, filtro, onFiltro, onSelect, onRefresh,
}) {
  return (
    <View style={{ gap: 12, paddingTop: 14 }}>
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

const REVISION_LABEL = {
  pendiente: { label: 'PENDIENTE', color: colors.gold },
  aprobada: { label: 'APROBADA', color: colors.green },
  pausada: { label: 'PAUSADA', color: colors.muted },
  rechazada: { label: 'RECHAZADA', color: colors.red },
};

function SolicitudesSection({
  revisiones, loading, ctrl, onRefresh, onAprobar, onPausar, onRechazar, onVer,
}) {
  return (
    <View style={{ gap: 12, paddingTop: 14 }}>
      <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 20 }}>
        Las subastas nuevas aparecen acá hasta que las apruebes. Solo las aprobadas se muestran en el home.
      </Text>

      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <TouchableOpacity onPress={onRefresh} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="refresh" size={16} color={colors.blue} />
          <Text style={{ color: colors.blue, fontSize: 13, fontWeight: '700' }}>Actualizar</Text>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator color={colors.blue} />}

      {!loading && revisiones.length === 0 && (
        <Text style={{ color: colors.muted, fontSize: 13, textAlign: 'center', paddingVertical: 28 }}>
          No hay solicitudes pendientes ni pausadas.
        </Text>
      )}

      {revisiones.map((rev) => {
        const sub = rev.subasta;
        const sid = sub?.identificador;
        const meta = REVISION_LABEL[rev.estado] || REVISION_LABEL.pendiente;
        return (
          <Card key={rev.identificador ?? sid} el style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: '700' }}>#{sid}</Text>
                <Display style={{ fontSize: 14.5, lineHeight: 18 }} numberOfLines={2}>
                  {sub?.titulo || tituloSubasta(sub)}
                </Display>
              </View>
              <Tag label={meta.label} color={meta.color} />
            </View>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              Solicitante #{rev.solicitante} · {formatFechaSubasta(sub?.fecha)} · {sub?.categoria}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 11.5 }}>
              {sub?.totalItems ?? 0} ítems
            </Text>
            <Btn title="Ver subasta" kind="ghost" onPress={() => onVer(sid)} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Btn title="Aprobar" kind="primary" style={{ flex: 1 }} onPress={() => onAprobar(sid)} disabled={ctrl} />
              <Btn title="Pausar" kind="ghost" style={{ flex: 1 }} onPress={() => onPausar(sid)} disabled={ctrl} />
              <Btn title="Eliminar" kind="danger" style={{ flex: 1 }} onPress={() => onRechazar(sid)} disabled={ctrl} />
            </View>
          </Card>
        );
      })}
    </View>
  );
}

function EstadoSection({
  subasta, items, asistentes, pujas, activeIdx, onBack, onSelectItem,
  onAbrir, onCerrar, onRefresh, onAdjudicar, ctrl, lastRefresh,
}) {
  const tag = tagEstadoSubasta(subasta || {});
  const isOpen = subasta?.fase === 'en_curso';
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
        {subasta?.revisionEstado ? (
          <Row k="Aprobación" v={subasta.revisionEstado} vc={
            subasta.revisionEstado === 'aprobada' ? colors.green
              : subasta.revisionEstado === 'pendiente' ? colors.gold
              : colors.red
          } />
        ) : null}
        <Row k="Asistentes" v={String(asistentes.length)} />
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
            onPress={() => onSelectItem(idx)}
            style={[s.itemRow, active && { borderColor: colors.blue, borderWidth: 1.5 }, adj && { opacity: 0.5 }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: adj ? colors.muted : '#fff', fontSize: 13, fontWeight: '700' }}>
                {active ? '▶ ' : ''}{item.producto?.descripcionCatalogo ?? `Ítem #${item.identificador}`}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 11.5, marginTop: 2 }}>
                Base: {Number(item.precioBase).toLocaleString('es-AR')} · Comisión: {item.comision}
              </Text>
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
        <Btn title="Abrir" kind="primary" style={{ flex: 1 }} onPress={onAbrir} disabled={ctrl || isOpen} />
        <Btn title="Cerrar" kind="danger" style={{ flex: 1 }} onPress={onCerrar} disabled={ctrl || !isOpen} />
      </View>
      <Btn title="Refrescar" kind="ghost" onPress={onRefresh} disabled={ctrl} style={{ marginTop: 4 }} />
      <Btn
        title="Adjudicar ítem"
        kind="primary"
        onPress={onAdjudicar}
        disabled={ctrl || !items[activeIdx] || items[activeIdx]?.subastado === 'si'}
        style={{ marginTop: 4 }}
      />
    </View>
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
