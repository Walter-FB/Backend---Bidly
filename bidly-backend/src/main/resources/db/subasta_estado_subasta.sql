-- Estado de ciclo de vida de subasta (esperando / iniciada / finalizada).
-- Tabla auxiliar propia; no modifica tablas protegidas del esquema Godio.

ALTER TABLE subasta_estado_admin
  ADD COLUMN IF NOT EXISTS estado_subasta VARCHAR(20) NOT NULL DEFAULT 'pendiente'
    CHECK (estado_subasta IN ('pendiente', 'esperando', 'iniciada', 'finalizada'));

ALTER TABLE subasta_estado_admin
  ADD COLUMN IF NOT EXISTS fecha_inicio_real TIMESTAMP;

ALTER TABLE subasta_estado_admin
  ADD COLUMN IF NOT EXISTS fecha_finalizacion TIMESTAMP;

-- Migración datos existentes (orden importa: primero iniciada solo si abierta, luego finalizada)
UPDATE subasta_estado_admin
SET estado_subasta = 'iniciada',
    fecha_inicio_real = COALESCE(fecha_apertura, CURRENT_TIMESTAMP),
    alguna_vez_abierta = true
WHERE estado = 'abierta' AND estado_subasta = 'esperando';

UPDATE subasta_estado_admin
SET estado_subasta = 'finalizada',
    fecha_finalizacion = COALESCE(fecha_finalizacion, CURRENT_TIMESTAMP)
WHERE estado = 'cerrada'
  AND alguna_vez_abierta = true
  AND estado_subasta IN ('esperando', 'iniciada');

INSERT INTO subasta_estado_admin (subasta, estado, alguna_vez_abierta, estado_subasta)
SELECT s.identificador, s.estado, false, 'pendiente'
FROM subastas s
WHERE NOT EXISTS (SELECT 1 FROM subasta_estado_admin a WHERE a.subasta = s.identificador);
