-- Cuarto estado de ciclo: pendiente (sin aprobar) | esperando | iniciada | finalizada
-- Tabla auxiliar subasta_estado_admin; no modifica tablas protegidas.

ALTER TABLE subasta_estado_admin
  DROP CONSTRAINT IF EXISTS subasta_estado_admin_estado_subasta_check;

ALTER TABLE subasta_estado_admin
  DROP CONSTRAINT IF EXISTS chk_subasta_estado_subasta;

ALTER TABLE subasta_estado_admin
  ADD CONSTRAINT chk_subasta_estado_subasta
  CHECK (estado_subasta IN ('pendiente', 'esperando', 'iniciada', 'finalizada'));

ALTER TABLE subasta_estado_admin
  ALTER COLUMN estado_subasta SET DEFAULT 'pendiente';

-- Rechazadas → finalizada
UPDATE subasta_estado_admin sea
SET estado_subasta = 'finalizada',
    estado = 'cerrada',
    fecha_finalizacion = COALESCE(sea.fecha_finalizacion, CURRENT_TIMESTAMP)
FROM subasta_revision sr
WHERE sr.subasta = sea.subasta
  AND sr.estado = 'rechazada'
  AND sea.estado_subasta <> 'finalizada';

-- Sin aprobar aún → pendiente
UPDATE subasta_estado_admin sea
SET estado_subasta = 'pendiente'
FROM subasta_revision sr
WHERE sr.subasta = sea.subasta
  AND sr.estado IN ('pendiente', 'pausada')
  AND sea.estado_subasta IN ('esperando', 'pendiente')
  AND sea.alguna_vez_abierta = false
  AND sea.estado_subasta NOT IN ('iniciada', 'finalizada');

-- Aprobadas que nunca se abrieron → esperando
UPDATE subasta_estado_admin sea
SET estado_subasta = 'esperando',
    estado = 'cerrada'
FROM subasta_revision sr
WHERE sr.subasta = sea.subasta
  AND sr.estado = 'aprobada'
  AND sea.alguna_vez_abierta = false
  AND sea.estado_subasta IN ('pendiente', 'esperando')
  AND sea.estado_subasta NOT IN ('iniciada', 'finalizada');

-- Subastas sin fila de revisión (migración legacy): mantener esperando si ya lo eran
UPDATE subasta_estado_admin sea
SET estado_subasta = 'esperando'
WHERE sea.estado_subasta = 'pendiente'
  AND sea.alguna_vez_abierta = false
  AND NOT EXISTS (SELECT 1 FROM subasta_revision sr WHERE sr.subasta = sea.subasta);
