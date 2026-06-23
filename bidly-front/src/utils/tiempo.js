// Etiquetas de tiempo para subastas (fase + segundosRestantes vienen del backend).

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

  if (subasta.estado === 'cerrada' || subasta.fase === 'finalizada') {
    return 'Finalizada';
  }

  const secs = subasta.segundosRestantes;

  if (subasta.fase === 'programada') {
    if (secs == null) return 'Próximamente';
    return `Abre en ${formatDuracion(Number(secs))}`;
  }

  if (subasta.fase === 'en_curso') {
    if (secs == null) return 'En curso';
    if (secs <= 0) return 'Por cerrar';
    return `Cierra en ${formatDuracion(Number(secs))}`;
  }

  return '—';
}

/** Calcula segundos hasta cierre por inactividad (30 min) en pantalla en vivo. */
export function segundosHastaCierrePujas(pujas, fechaInicio, horaInicio) {
  const INACTIVIDAD = 30 * 60;

  if (pujas?.length > 0 && pujas[0]?.fechaHora) {
    const ultima = new Date(pujas[0].fechaHora).getTime();
    if (!Number.isNaN(ultima)) {
      return Math.max(0, Math.floor((ultima + INACTIVIDAD * 1000 - Date.now()) / 1000));
    }
  }

  if (!fechaInicio) return null;
  const inicio = new Date(`${fechaInicio}T${horaInicio || '00:00'}`).getTime();
  if (Number.isNaN(inicio)) return null;

  const ahora = Date.now();
  if (inicio > ahora) {
    return Math.max(0, Math.floor((inicio - ahora) / 1000));
  }

  return Math.max(0, Math.floor((inicio + INACTIVIDAD * 1000 - ahora) / 1000));
}
