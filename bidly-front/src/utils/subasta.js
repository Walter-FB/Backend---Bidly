// Helpers de presentación para subastas (sin campo "nombre" en BD: usamos producto del catálogo).

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
