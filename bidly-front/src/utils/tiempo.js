// Etiquetas de tiempo para subastas (derivadas de subastas.estado: abierta/cerrada).

import { esSubastaFinalizada, esSubastaEnVivo, esSubastaProxima, segundosParaInicio } from './subasta';

export { esSubastaEnVivo, esSubastaProxima };

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

/** Cuánto falta para que arranque una subasta próxima ("Faltan 2 días" / "a confirmar"). */
export function etiquetaProxima(subasta) {
  const s = segundosParaInicio(subasta);
  if (s == null) return 'Fecha a confirmar';
  if (s <= 0) return 'Por comenzar';
  const dias = Math.floor(s / 86400);
  if (dias >= 1) return 'Faltan ' + dias + (dias === 1 ? ' día' : ' días');
  const hs = Math.floor(s / 3600);
  if (hs >= 1) return 'Faltan ' + hs + (hs === 1 ? ' hora' : ' horas');
  const min = Math.floor(s / 60);
  if (min >= 1) return 'Faltan ' + min + ' min';
  return 'Por comenzar';
}

export function etiquetaTiempoSubasta(subasta) {
  if (!subasta) return '—';
  if (esSubastaEnVivo(subasta)) return 'En vivo';
  if (esSubastaProxima(subasta)) return etiquetaProxima(subasta);
  if (esSubastaFinalizada(subasta)) return 'Finalizada';
  return '—';
}
