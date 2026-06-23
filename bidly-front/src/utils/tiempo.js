// Etiquetas de tiempo para subastas (fase + segundosRestantes vienen del backend).

import { esSubastaFinalizada } from './subasta';

export function formatDuracion(segundos) {
  if (segundos == null || segundos < 0) return '—';
  if (segundos <= 0) return '0m';

  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;

  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0 && s > 0) return `${m}m ${s}s`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

export function esSubastaEnVivo(subasta) {
  return subasta?.estado === 'abierta' && subasta?.fase === 'en_curso';
}

export function etiquetaTiempoSubasta(subasta) {
  if (!subasta) return '—';

  if (esSubastaFinalizada(subasta)) {
    return 'Finalizada';
  }

  const secs = subasta.segundosRestantes;

  if (subasta.fase === 'programada') {
    if (secs == null) return 'Próximamente';
    if (secs <= 0 && subasta.estado === 'cerrada') return 'Esperando apertura';
    return `Abre en ${formatDuracion(Number(secs))}`;
  }

  if (subasta.fase === 'en_curso') {
    if (secs == null) return 'En curso';
    if (secs <= 0) return 'Por cerrar';
    return `Cierra en ${formatDuracion(Number(secs))}`;
  }

  return '—';
}

