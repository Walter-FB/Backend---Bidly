// Etiquetas de tiempo para subastas (estadoSubasta + segundosRestantes vienen del backend).

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

  const est = subasta.estadoSubasta;
  const secs = subasta.segundosRestantes;

  if (est === 'finalizada' || (esSubastaFinalizada(subasta) && est !== 'iniciada')) {
    return 'Finalizada';
  }

  if (est === 'pendiente' || subasta.fase === 'pendiente') {
    return 'Pendiente de aprobación';
  }

  if (est === 'iniciada' || subasta.fase === 'en_curso') {
    if (secs == null) return 'En curso';
    if (secs <= 0) return 'Por cerrar';
    return `Cierra en ${formatDuracion(Number(secs))}`;
  }

  if (est === 'esperando' || subasta.fase === 'programada') {
    if (secs == null) return 'Próximamente';
    if (secs <= 0) return 'Esperando inicio';
    return `Abre en ${formatDuracion(Number(secs))}`;
  }

  // Legacy sin estadoSubasta: no usar lógica de fecha programada si ya está en vivo
  if (esSubastaEnVivo(subasta)) {
    if (secs == null) return 'En curso';
    if (secs <= 0) return 'Por cerrar';
    return `Cierra en ${formatDuracion(Number(secs))}`;
  }

  return '—';
}
