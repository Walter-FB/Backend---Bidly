// Helpers de presentación para subastas (sin campo "nombre" en BD: usamos producto del catálogo).

import { colors } from '../theme/theme';

const CATEGORIA_LABEL = {
  comun: 'Común',
  especial: 'Especial',
  plata: 'Plata',
  oro: 'Oro',
  platino: 'Platino',
};

const CATEGORIAS_ACCESO = new Set(Object.keys(CATEGORIA_LABEL));

function esCategoriaAcceso(texto) {
  if (!texto) return false;
  const norm = texto.trim().toLowerCase();
  if (CATEGORIAS_ACCESO.has(norm)) return true;
  return Object.values(CATEGORIA_LABEL).some((v) => v.toLowerCase() === norm);
}

function nombreProductoValido(desc) {
  if (!desc) return null;
  const t = desc.trim();
  if (!t || /^no posee$/i.test(t)) return null;
  if (esCategoriaAcceso(t)) return null;
  return t;
}

function tituloDesdeUbicacion(ubicacion) {
  const ubi = nombreProductoValido(ubicacion);
  if (!ubi) return null;
  const guion = ubi.indexOf(' - ');
  if (guion > 0) return ubi.slice(0, guion).trim();
  const coma = ubi.indexOf(',');
  if (coma > 0) return ubi.slice(0, coma).trim();
  return ubi;
}

export function tituloSubasta(subasta, items) {
  const apiTitulo = nombreProductoValido(subasta?.titulo);
  if (apiTitulo) return apiTitulo;

  const lista = items || [];
  for (const item of lista) {
    const nombre = nombreProductoValido(item?.producto?.descripcionCatalogo);
    if (nombre) {
      const extra = lista.length > 1 ? ` (+${lista.length - 1} ítems)` : '';
      return nombre + extra;
    }
  }

  const catDesc = nombreProductoValido(lista[0]?.catalogo?.descripcion);
  if (catDesc) return catDesc;

  const ubi = tituloDesdeUbicacion(subasta?.ubicacion);
  if (ubi) return ubi;

  return 'Subasta';
}

export function subtituloSubasta(subasta) {
  const partes = [];
  const cat = subasta?.categoria;
  if (cat) partes.push((CATEGORIA_LABEL[cat] || cat).toUpperCase());

  const ubi = subasta?.ubicacion?.trim();
  const titulo = tituloSubasta(subasta);
  if (ubi && titulo !== tituloDesdeUbicacion(ubi) && !ubi.toLowerCase().startsWith(titulo.toLowerCase())) {
    partes.push(ubi);
  }

  return partes.join(' · ') || '—';
}

export function formatFechaSubasta(fecha) {
  if (!fecha) return '—';
  try {
    const [y, m, d] = fecha.split('-').map(Number);
    if (!y || !m || !d) return fecha;
    return new Date(y, m - 1, d).toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return fecha;
  }
}

/** Todos los ítems ya adjudicados (no queda nada por subastar). */
function todoAdjudicado(subasta) {
  return !!subasta && (subasta.totalItems ?? 0) > 0 && (subasta.itemsPendientes ?? 1) === 0;
}

/** Todavía no abierta. */
export function esSubastaPendiente(subasta) {
  if (!subasta) return false;
  return subasta.estado === 'cerrada';
}

/** Finalizada = cerrada, o ya se adjudicó todo el catálogo (aunque no la cerraron). */
export function esSubastaFinalizada(subasta) {
  if (!subasta) return false;
  return subasta.estado === 'cerrada' || todoAdjudicado(subasta);
}

/** Subasta en vivo = abierta Y todavía con ítems por subastar. */
export function esSubastaEnVivo(subasta) {
  if (!subasta) return false;
  return subasta.estado === 'abierta' && !todoAdjudicado(subasta);
}

/** Subasta en curso para el vendedor (misma lógica que en vivo). */
export function esSubastaEnCursoVendedor(subasta) {
  return esSubastaEnVivo(subasta);
}

export function esMiSubasta(subasta, clienteId) {
  if (!clienteId || subasta?.subastador == null) return false;
  return Number(subasta.subastador) === Number(clienteId);
}

export function tagEstadoSubasta(subasta) {
  const sub = subasta || {};
  if (sub.estado === 'abierta') return { label: 'EN VIVO', color: colors.green };
  return { label: 'CERRADA', color: colors.muted };
}
