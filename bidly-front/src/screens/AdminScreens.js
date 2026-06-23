// BIDLY — QA Console: observabilidad + validación del circuito de puja.
// Herramienta interna. Gateada por isAdmin/DEV_QA. No visible al usuario final.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Display, Tag, Chip, Card, SectionLabel, Row, Btn, LiveBadge } from '../components/ui';
import { colors } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { Subastas, Pujas, Items, Asistentes } from '../api/endpoints';
import { tituloSubasta } from '../utils/subasta';

// ─── Definición de escenarios ─────────────────────────────────────────────────
const SCENARIOS = [
  { key: 'valid_bid',   label: '✅ Puja válida',           exp: '201',               note: 'importe = mínimo + 1' },
  { key: 'below_min',  label: '⛔ Bajo mínimo',           exp: '400 MIN_BID',       note: 'importe = mínimo − 1' },
  { key: 'above_max',  label: '⛔ Sobre máximo',          exp: '400 MAX_BID',       note: 'importe = actual × 2.5' },
  { key: 'gold_no_cap',label: '🥇 Oro sin tope',          exp: '201',               note: 'usar subasta oro/platino' },
  { key: 'no_payment', label: '🚫 Sin medio verificado',  exp: '403 NO_PAYMENT',    note: 'puede no estar impl.' },
  { key: 'race',       label: '🏁 Carrera concurrente',   exp: '1×201 + 1×4xx',    note: '2 POST simultáneos' },
  { key: 'closed',     label: '🔒 Subasta cerrada',       exp: '409 AUCTION_CLOSED',note: 'cerrar subasta antes' },
  { key: 'item_sold',  label: '📦 Ítem adjudicado',       exp: '409 ITEM_SOLD',     note: 'adjudicar ítem antes' },
  { key: 'double_tap', label: '👆 Doble tap',             exp: '≤1 aceptada',       note: '2 POST mismo importe' },
];

// ─── Componente principal ─────────────────────────────────────────────────────
export function DashboardAdminScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const { user } = useAuth();

  const [tab, setTab] = useState('estado');
  const [subastas, setSubastas] = useState([]);
  const [selId, setSelId] = useState(null);
  const [items, setItems] = useState([]);
  const [asistentes, setAsistentes] = useState([]);
  const [pujas, setPujas] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [log, setLog] = useState([]);
  const [results, setResults] = useState({});
  const [asisId, setAsisId] = useState(null);
  const [running, setRunning] = useState(null);
  const [ctrl, setCtrl] = useState(false);
  const [lastRefresh, setLastRefresh] = useState('—');
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  const selSubasta = subastas.find(s => s.identificador === selId) ?? null;
  const activeItem = items[activeIdx] ?? null;
  const lastPuja = pujas[0] ?? null;
  const precioBase = Number(activeItem?.precioBase ?? 0);
  const minBid = lastPuja ? Number(lastPuja.importe) + precioBase * 0.01 : precioBase;
  const maxBidOver = Number(lastPuja?.importe ?? precioBase) * 2.5;

  // ── Cargar lista de subastas ───────────────────────────────────────────────
  const loadSubastas = useCallback(async () => {
    try {
      const data = await Subastas.listar();
      if (mounted.current) setSubastas(Array.isArray(data) ? data : []);
    } catch {}
  }, []);

  useEffect(() => { loadSubastas(); }, [loadSubastas]);

  // ── Al cambiar subasta seleccionada: cargar ítems, asistentes, inscribir ──
  useEffect(() => {
    if (!selId) {
      setItems([]);
      setAsistentes([]);
      setPujas([]);
      setAsisId(null);
      setActiveIdx(0);
      return;
    }
    // Limpiar de inmediato para no mostrar datos de la subasta anterior.
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
      } catch {}
      if (user?.clienteId) {
        try {
          const a = await Asistentes.inscribir(user.clienteId, selId);
          if (!cancelled) setAsisId(a?.identificador ?? null);
        } catch {}
      }
    })();
    return () => { cancelled = true; };
  }, [selId, user?.clienteId]);

  // ── Polling: estado de la subasta + asistentes cada 5s ───────────────────
  useEffect(() => {
    if (!selId) return;
    const tick = async () => {
      if (!mounted.current) return;
      try {
        const [sub, asis] = await Promise.all([
          Subastas.obtener(selId),
          Subastas.asistentes(selId),
        ]);
        if (!mounted.current) return;
        setSubastas(prev => prev.map(s => s.identificador === selId ? { ...s, ...sub } : s));
        setAsistentes(Array.isArray(asis) ? asis : []);
        setLastRefresh(new Date().toLocaleTimeString('es-AR', { hour12: false }));
      } catch {}
    };
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, [selId]);

  // ── Polling: pujas del ítem activo cada 5s ────────────────────────────────
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

  // ── Helper: ejecuta un request y lo loguea en el inspector ───────────────
  const exec = useCallback(async (label, method, path, fn, expStatus, expCode = null) => {
    const entryId = Date.now() + Math.random();
    const time = new Date().toLocaleTimeString('es-AR', { hour12: false });
    setLog(prev =>
      [{ entryId, time, label, method, path, status: '…', code: '…', expStatus, expCode, ok: null }, ...prev].slice(0, 20)
    );
    try {
      const data = await fn();
      const ok = expStatus >= 200 && expStatus < 300;
      setLog(prev => prev.map(e => e.entryId === entryId ? { ...e, status: '2xx', code: 'OK', ok } : e));
      return { ok, data, status: 200, code: 'OK' };
    } catch (err) {
      const status = err.status || 0;
      const code = err.data?.code || '';
      const ok = status === expStatus && (!expCode || code === expCode);
      setLog(prev => prev.map(e => e.entryId === entryId ? { ...e, status, code, ok } : e));
      return { ok, data: null, status, code };
    }
  }, []);

  // ── Runner de escenarios ──────────────────────────────────────────────────
  const runScenario = useCallback(async (key) => {
    if (running) return;
    if (!selId || !activeItem) {
      Alert.alert('Sin contexto', 'Seleccioná una subasta e ítem primero.');
      return;
    }
    setRunning(key);
    const iid = activeItem.identificador;
    const aid = asisId;

    try {
      switch (key) {

        case 'valid_bid': {
          const importe = Math.ceil(minBid) + 1;
          const r = await exec('Puja válida', 'POST', '/pujos',
            () => Pujas.pujar(aid, iid, importe), 201);
          setResults(p => ({ ...p, valid_bid: { ok: r.ok, msg: `${r.status} ${r.code}` } }));
          break;
        }

        case 'below_min': {
          const importe = Math.max(1, Math.floor(minBid) - 1);
          const r = await exec('Bajo mínimo', 'POST', '/pujos',
            () => Pujas.pujar(aid, iid, importe), 400, 'MIN_BID');
          setResults(p => ({ ...p, below_min: { ok: r.ok, msg: `${r.status} ${r.code || 'OK'}` } }));
          break;
        }

        case 'above_max': {
          const importe = Math.ceil(maxBidOver);
          const r = await exec('Sobre máximo', 'POST', '/pujos',
            () => Pujas.pujar(aid, iid, importe), 400, 'MAX_BID');
          setResults(p => ({ ...p, above_max: { ok: r.ok, msg: `${r.status} ${r.code || 'OK'}` } }));
          break;
        }

        case 'gold_no_cap': {
          const importe = Math.ceil(maxBidOver);
          const isGold = ['oro', 'platino', 'especial'].includes(selSubasta?.categoria);
          const r = await exec('Oro sin tope', 'POST', '/pujos',
            () => Pujas.pujar(aid, iid, importe), 201);
          const note = !isGold ? ' ⚠️ cat≠oro' : '';
          setResults(p => ({ ...p, gold_no_cap: { ok: r.ok, msg: `${r.status} ${r.code || 'OK'}${note}` } }));
          break;
        }

        case 'no_payment': {
          const importe = Math.ceil(minBid) + 1;
          const r = await exec('Sin medio verificado', 'POST', '/pujos',
            () => Pujas.pujar(aid, iid, importe), 403, 'NO_PAYMENT');
          setResults(p => ({ ...p, no_payment: { ok: r.ok, msg: `${r.status} ${r.code || 'OK'}` } }));
          break;
        }

        case 'race': {
          const importe = Math.ceil(minBid) + 1;
          const t = new Date().toLocaleTimeString('es-AR', { hour12: false });
          const idA = Date.now(); const idB = idA + 1;
          setLog(prev => [
            { entryId: idA, time: t, label: 'Carrera A', method: 'POST', path: '/pujos', status: '…', code: '…', expStatus: 201, expCode: null, ok: null },
            { entryId: idB, time: t, label: 'Carrera B', method: 'POST', path: '/pujos', status: '…', code: '…', expStatus: -1, expCode: null, ok: null },
            ...prev,
          ].slice(0, 20));
          const [rA, rB] = await Promise.all([
            Pujas.pujar(aid, iid, importe)
              .then(() => ({ ok: true, status: 201, code: 'OK' }))
              .catch(e => ({ ok: false, status: e.status || 0, code: e.data?.code || '' })),
            Pujas.pujar(aid, iid, importe)
              .then(() => ({ ok: true, status: 201, code: 'OK' }))
              .catch(e => ({ ok: false, status: e.status || 0, code: e.data?.code || '' })),
          ]);
          setLog(prev => prev.map(e => {
            if (e.entryId === idA) return { ...e, status: rA.status, code: rA.code, ok: rA.ok };
            if (e.entryId === idB) return { ...e, status: rB.status, code: rB.code, ok: !rB.ok };
            return e;
          }));
          const exactlyOne = rA.ok !== rB.ok;
          const msg = `A:${rA.status} B:${rB.status} — ${rA.ok && rB.ok ? '⚠️ ambas aceptadas' : exactlyOne ? '✅ 1 aceptada' : 'ambas rechazadas'}`;
          setResults(p => ({ ...p, race: { ok: exactlyOne, msg } }));
          break;
        }

        case 'closed': {
          if (selSubasta?.estado === 'abierta') {
            setResults(p => ({ ...p, closed: { ok: false, msg: 'Subasta abierta — cerrala en la pestaña Estado' } }));
            break;
          }
          const importe = Math.ceil(minBid) + 1;
          const r = await exec('Subasta cerrada', 'POST', '/pujos',
            () => Pujas.pujar(aid, iid, importe), 409, 'AUCTION_CLOSED');
          setResults(p => ({ ...p, closed: { ok: r.ok, msg: `${r.status} ${r.code || 'OK'}` } }));
          break;
        }

        case 'item_sold': {
          const sold = items.find(i => i.subastado === 'si');
          if (!sold) {
            setResults(p => ({ ...p, item_sold: { ok: false, msg: 'No hay ítems adjudicados — adjudicá uno primero' } }));
            break;
          }
          const r = await exec('Ítem adjudicado', 'POST', '/pujos',
            () => Pujas.pujar(aid, sold.identificador, Number(sold.precioBase)), 409, 'ITEM_SOLD');
          setResults(p => ({ ...p, item_sold: { ok: r.ok, msg: `${r.status} ${r.code || 'OK'}` } }));
          break;
        }

        case 'double_tap': {
          const importe = Math.ceil(minBid) + 1;
          const t = new Date().toLocaleTimeString('es-AR', { hour12: false });
          const id1 = Date.now(); const id2 = id1 + 1;
          setLog(prev => [
            { entryId: id1, time: t, label: 'Doble tap 1', method: 'POST', path: '/pujos', status: '…', code: '…', expStatus: 201, expCode: null, ok: null },
            { entryId: id2, time: t, label: 'Doble tap 2', method: 'POST', path: '/pujos', status: '…', code: '…', expStatus: -1, expCode: null, ok: null },
            ...prev,
          ].slice(0, 20));
          const [r1, r2] = await Promise.all([
            Pujas.pujar(aid, iid, importe)
              .then(() => ({ ok: true, status: 201, code: 'OK' }))
              .catch(e => ({ ok: false, status: e.status || 0, code: e.data?.code || '' })),
            Pujas.pujar(aid, iid, importe)
              .then(() => ({ ok: true, status: 201, code: 'OK' }))
              .catch(e => ({ ok: false, status: e.status || 0, code: e.data?.code || '' })),
          ]);
          setLog(prev => prev.map(e => {
            if (e.entryId === id1) return { ...e, status: r1.status, code: r1.code, ok: r1.ok };
            if (e.entryId === id2) return { ...e, status: r2.status, code: r2.code, ok: !r2.ok };
            return e;
          }));
          const atMostOne = !r1.ok || !r2.ok;
          const msg2 = `T1:${r1.status} T2:${r2.status} — ${atMostOne ? '✅ ≤1 persistida' : '⚠️ ambas aceptadas'}`;
          setResults(p => ({ ...p, double_tap: { ok: atMostOne, msg: msg2 } }));
          break;
        }

        default: break;
      }
    } finally {
      if (mounted.current) setRunning(null);
    }
  }, [running, selId, activeItem, asisId, minBid, maxBidOver, selSubasta, items, exec]);

  // ── Acciones de control ───────────────────────────────────────────────────
  const toggleEstado = async () => {
    if (ctrl || !selId) return;
    setCtrl(true);
    const next = selSubasta?.estado === 'abierta' ? 'cerrada' : 'abierta';
    try {
      await exec(
        next === 'abierta' ? 'Abrir subasta' : 'Cerrar subasta',
        'PATCH', `/subastas/${selId}/estado`,
        () => Subastas.actualizarEstado(selId, next), 200,
      );
      const data = await Subastas.obtener(selId);
      if (mounted.current) setSubastas(prev => prev.map(s => s.identificador === selId ? { ...s, ...data } : s));
    } catch {} finally { if (mounted.current) setCtrl(false); }
  };

  const adjudicar = async () => {
    if (ctrl || !activeItem || activeItem.subastado === 'si') return;
    setCtrl(true);
    try {
      await exec('Adjudicar ítem', 'PATCH', `/items/${activeItem.identificador}/adjudicar`,
        () => Items.adjudicar(activeItem.identificador), 200);
      const data = await Subastas.catalogos(selId);
      if (!mounted.current) return;
      const list = Array.isArray(data) ? data : [];
      setItems(list);
      const sub = await Subastas.obtener(selId);
      if (!mounted.current) return;
      setSubastas(prev => prev.map(s => s.identificador === selId ? { ...s, ...sub } : s));
      const nextIdx = list.findIndex((i, n) => n > activeIdx && i.subastado !== 'si');
      if (nextIdx >= 0) {
        setActiveIdx(nextIdx);
      } else if (list.length > 0 && list.every(i => i.subastado === 'si')) {
        setActiveIdx(0);
      }
    } catch {} finally { if (mounted.current) setCtrl(false); }
  };

  const nextItem = async () => {
    if (ctrl || !selId) return;
    setCtrl(true);
    try {
      const data = await Subastas.catalogos(selId);
      if (!mounted.current) return;
      const list = Array.isArray(data) ? data : [];
      setItems(list);

      if (list.length === 0) {
        setPujas([]);
        Alert.alert('Sin catálogo', 'Esta subasta no tiene ítems cargados.');
        return;
      }

      // QA: recorrer todo el catálogo, adjudicados o no.
      setActiveIdx(prev => (prev + 1) % list.length);
    } catch {
      Alert.alert('No se pudo refrescar', 'Revisá la conexión con el backend y volvé a intentar.');
    } finally {
      if (mounted.current) setCtrl(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>

      {/* Topbar */}
      <View style={s.topbar}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Display style={{ color: colors.blueLogo, fontSize: 19 }}>BIDLY</Display>
        <Tag label="MODO QA" color={colors.red} />
      </View>

      {/* Banner */}
      <View style={s.banner}>
        <Ionicons name="warning-outline" size={13} color={colors.gold} />
        <Text style={s.bannerTxt}>HERRAMIENTA INTERNA DE QA — NO ES PANTALLA DE USUARIO FINAL</Text>
      </View>

      {/* Selector de subasta */}
      <View style={{ borderBottomWidth: 1, borderColor: colors.border }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 8, gap: 8 }}
        >
          {subastas.map(sub => (
            <Chip
              key={sub.identificador}
              label={`${sub.titulo || sub.categoria || 'Subasta'} ${sub.estado === 'abierta' ? '🟢' : '🔴'}`}
              active={selId === sub.identificador}
              onPress={() => { setSelId(sub.identificador); setResults({}); }}
            />
          ))}
          {subastas.length === 0 && (
            <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 38 }}>Sin subastas</Text>
          )}
          <TouchableOpacity onPress={loadSubastas} style={{ padding: 10, justifyContent: 'center' }}>
            <Ionicons name="refresh" size={17} color={colors.muted} />
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {[['estado', 'Estado'], ['escenarios', 'Escenarios'], ['inspector', 'Inspector']].map(([k, label]) => (
          <TouchableOpacity key={k} onPress={() => setTab(k)} style={[s.tabBtn, tab === k && s.tabActive]}>
            <Text style={[s.tabTxt, tab === k && { color: '#fff', fontWeight: '700' }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Contenido */}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {!selId ? (
          <View style={{ paddingTop: 48, alignItems: 'center', gap: 8 }}>
            <Ionicons name="flask-outline" size={40} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 14, textAlign: 'center', lineHeight: 22 }}>
              Seleccioná una subasta arriba para comenzar.{'\n'}
              <Text style={{ color: colors.blue }}>↑ tocá un chip</Text>
            </Text>
          </View>
        ) : tab === 'estado' ? (
          <EstadoSection
            subasta={selSubasta}
            items={items}
            asistentes={asistentes}
            pujas={pujas}
            activeIdx={activeIdx}
            onSelectItem={setActiveIdx}
            onToggle={toggleEstado}
            onAdjudicar={adjudicar}
            onNext={nextItem}
            ctrl={ctrl}
            lastRefresh={lastRefresh}
          />
        ) : tab === 'escenarios' ? (
          <EscenariosSection
            subasta={selSubasta}
            activeItem={activeItem}
            asisId={asisId}
            minBid={minBid}
            results={results}
            running={running}
            onRun={runScenario}
          />
        ) : (
          <InspectorSection log={log} onClear={() => setLog([])} />
        )}
      </ScrollView>
    </View>
  );
}

// ─── Sección Estado ───────────────────────────────────────────────────────────
function EstadoSection({ subasta, items, asistentes, pujas, activeIdx, onSelectItem, onToggle, onAdjudicar, onNext, ctrl, lastRefresh }) {
  const isOpen = subasta?.estado === 'abierta';
  const allAdjudicados = items.length > 0 && items.every(i => i.subastado === 'si');
  const datosInconsistentes = isOpen && allAdjudicados;
  return (
    <View style={{ gap: 12, paddingTop: 14 }}>

      {datosInconsistentes && (
        <View style={s.warn}>
          <Ionicons name="alert-circle-outline" size={14} color={colors.gold} />
          <Text style={{ color: colors.gold, fontSize: 12.5, flex: 1 }}>
            Todos los ítems están adjudicados pero la subasta sigue abierta. Cerrala con el botón de abajo.
          </Text>
        </View>
      )}

      {/* Info subasta */}
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Display style={{ fontSize: 15 }} numberOfLines={2}>{tituloSubasta(subasta, items)}</Display>
          {isOpen ? <LiveBadge /> : <Tag label="CERRADA" color={colors.muted} />}
        </View>
        <Row k="Categoría" v={subasta?.categoria ?? '—'} />
        <Row k="Moneda" v={subasta?.moneda ?? '—'} />
        <Row k="Fecha" v={subasta?.fecha ?? '—'} />
        <Row k="Asistentes" v={String(asistentes.length)} />
        <Row k="Último refresh" v={lastRefresh} />
      </Card>

      {/* Catálogo */}
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

      {/* Pujas del ítem activo */}
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

      {/* Control */}
      <SectionLabel>Control de subasta</SectionLabel>
      <Btn
        title={isOpen ? 'Cerrar subasta' : 'Abrir subasta'}
        kind={isOpen ? 'danger' : 'primary'}
        onPress={onToggle}
        disabled={ctrl}
      />
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
        <Btn
          title="Adjudicar ítem"
          kind="primary"
          style={{ flex: 1 }}
          onPress={onAdjudicar}
          disabled={ctrl || !items[activeIdx] || items[activeIdx]?.subastado === 'si'}
        />
        <Btn
          title="Siguiente →"
          kind="ghost"
          style={{ flex: 1 }}
          onPress={onNext}
          disabled={ctrl}
        />
      </View>
    </View>
  );
}

// ─── Sección Escenarios ───────────────────────────────────────────────────────
function EscenariosSection({ subasta, activeItem, asisId, minBid, results, running, onRun }) {
  return (
    <View style={{ gap: 10, paddingTop: 14 }}>

      {/* Contexto actual */}
      <Card el>
        <Row k="Subasta" v={subasta ? `#${subasta.identificador} (${subasta.estado})` : '—'} />
        <Row k="Ítem activo" v={activeItem ? `#${activeItem.identificador}` : '—'} />
        <Row
          k="Mi asistente"
          v={asisId ? `#${asisId}` : 'no inscripto'}
          vc={asisId ? colors.green : colors.red}
        />
        <Row
          k="Puja mínima"
          v={activeItem ? `$${(Math.ceil(minBid) + 1).toLocaleString('es-AR')}` : '—'}
          vc={colors.green}
        />
      </Card>

      {!asisId && (
        <View style={s.warn}>
          <Ionicons name="alert-circle-outline" size={14} color={colors.gold} />
          <Text style={{ color: colors.gold, fontSize: 12.5, flex: 1 }}>
            Sin asistente — la auto-inscripción falló. Probá con otra subasta.
          </Text>
        </View>
      )}

      {SCENARIOS.map(sc => {
        const res = results[sc.key];
        const isRunning = running === sc.key;
        return (
          <Card key={sc.key} el style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14, flex: 1 }}>{sc.label}</Text>
              {res && (
                <View style={[
                  s.resBadge,
                  { backgroundColor: res.ok ? colors.green + '33' : colors.red + '33',
                    borderColor: res.ok ? colors.green : colors.red },
                ]}>
                  <Text style={{ color: res.ok ? colors.green : colors.red, fontSize: 12, fontWeight: '800' }}>
                    {res.ok ? '✅' : '❌'}
                  </Text>
                </View>
              )}
            </View>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Esperado: {sc.exp} · {sc.note}</Text>
            {res && (
              <Text style={{ color: res.ok ? colors.green : colors.red, fontSize: 12, fontWeight: '600' }}>
                Obtenido: {res.msg}
              </Text>
            )}
            <Btn
              title={isRunning ? 'Ejecutando…' : res ? 'Re-ejecutar' : 'Ejecutar'}
              kind={res ? (res.ok ? 'ghost' : 'danger') : 'primary'}
              style={{ marginTop: 2 }}
              onPress={() => onRun(sc.key)}
              disabled={isRunning || !!running}
            />
          </Card>
        );
      })}
    </View>
  );
}

// ─── Sección Inspector ────────────────────────────────────────────────────────
function InspectorSection({ log, onClear }) {
  if (log.length === 0) {
    return (
      <View style={{ paddingTop: 32, alignItems: 'center', gap: 8 }}>
        <Ionicons name="receipt-outline" size={36} color={colors.muted} />
        <Text style={{ color: colors.muted, fontSize: 13, textAlign: 'center' }}>
          Sin requests aún.{'\n'}Ejecutá escenarios o acciones de control.
        </Text>
      </View>
    );
  }
  return (
    <View style={{ paddingTop: 14, gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <SectionLabel style={{ marginTop: 0, marginBottom: 0 }}>
          Últimas {log.length} llamadas
        </SectionLabel>
        <TouchableOpacity onPress={onClear} hitSlop={10}>
          <Text style={{ color: colors.red, fontSize: 13, fontWeight: '700' }}>Limpiar</Text>
        </TouchableOpacity>
      </View>
      {log.map(entry => (
        <View
          key={entry.entryId}
          style={[s.logRow, {
            borderLeftColor: entry.ok === null
              ? colors.muted
              : entry.ok ? colors.green : colors.red,
          }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12.5 }}>{entry.label}</Text>
            <Text style={{ color: colors.muted, fontSize: 11.5 }}>{entry.method} {entry.path}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <Text style={{
              color: entry.ok === null ? colors.muted : entry.ok ? colors.green : colors.red,
              fontWeight: '800', fontSize: 13,
            }}>
              {entry.ok === null ? '…' : entry.ok ? '✅' : '❌'} {entry.status}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>
              {entry.code || ''}{entry.code ? ' · ' : ''}{entry.time}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 10.5 }}>
              esp: {entry.expStatus}{entry.expCode ? ` ${entry.expCode}` : ''}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  topbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, height: 52,
  },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.gold + '22', paddingVertical: 7, paddingHorizontal: 16,
  },
  bannerTxt: { color: colors.gold, fontSize: 11, fontWeight: '700', letterSpacing: 0.4, flex: 1 },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.border },
  tabBtn: { flex: 1, paddingVertical: 11, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.blue },
  tabTxt: { color: colors.muted, fontSize: 13.5, fontWeight: '600' },
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
  resBadge: { borderWidth: 1, borderRadius: 6, paddingVertical: 3, paddingHorizontal: 8 },
  logRow: {
    backgroundColor: colors.card, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    borderLeftWidth: 3, padding: 12, flexDirection: 'row', gap: 10,
  },
});
