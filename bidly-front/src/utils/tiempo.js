// Etiquetas de tiempo para subastas (derivadas de subastas.estado: abierta/cerrada).

import { esSubastaFinalizada, esSubastaEnVivo } from './subasta';

export { esSubastaEnVivo };

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

export function etiquetaTiempoSubasta(subasta) {
  if (!subasta) return '—';
  if (esSubastaEnVivo(subasta)) return 'En vivo';
  if (esSubastaFinalizada(subasta)) return 'Finalizada';
  return '—';
}
