-- Backfill estado_subasta según reglas actuales (esperando / iniciada / finalizada).
-- Tabla auxiliar subasta_estado_admin; no modifica subastas ni otras tablas protegidas.
-- Ejecutar una vez en Railway y local si hay datos inconsistentes.

-- 1) Asegurar fila admin para cada subasta
INSERT INTO subasta_estado_admin (subasta, estado, alguna_vez_abierta, estado_subasta)
SELECT s.identificador,
       COALESCE(s.estado, 'cerrada'),
       false,
       'esperando'
FROM subastas s
WHERE NOT EXISTS (
    SELECT 1 FROM subasta_estado_admin a WHERE a.subasta = s.identificador
);

-- 2) En vivo: admin tiene estado legacy abierta
UPDATE subasta_estado_admin
SET estado_subasta = 'iniciada',
    alguna_vez_abierta = true,
    fecha_inicio_real = COALESCE(fecha_inicio_real, fecha_apertura, CURRENT_TIMESTAMP)
WHERE estado = 'abierta'
  AND estado_subasta <> 'finalizada'
  AND estado_subasta <> 'iniciada';

-- 3) Finalizada: todos los ítems del catálogo vendidos
UPDATE subasta_estado_admin sea
SET estado_subasta = 'finalizada',
    estado = 'cerrada',
    fecha_finalizacion = COALESCE(fecha_finalizacion, CURRENT_TIMESTAMP)
WHERE sea.estado_subasta <> 'finalizada'
  AND EXISTS (
      SELECT 1
      FROM catalogos c
      JOIN itemsCatalogo ic ON ic.catalogo = c.identificador
      WHERE c.subasta = sea.subasta
  )
  AND NOT EXISTS (
      SELECT 1
      FROM catalogos c
      JOIN itemsCatalogo ic ON ic.catalogo = c.identificador
      WHERE c.subasta = sea.subasta
        AND ic.subastado <> 'si'
  );

-- 4) Finalizada: se abrió alguna vez y el admin la cerró
UPDATE subasta_estado_admin
SET estado_subasta = 'finalizada',
    estado = 'cerrada',
    fecha_finalizacion = COALESCE(fecha_finalizacion, CURRENT_TIMESTAMP)
WHERE alguna_vez_abierta = true
  AND estado = 'cerrada'
  AND estado_subasta IN ('iniciada', 'esperando');

-- 5) Finalizada: subasta iniciada sin ítems en catálogo
UPDATE subasta_estado_admin sea
SET estado_subasta = 'finalizada',
    estado = 'cerrada',
    fecha_finalizacion = COALESCE(fecha_finalizacion, CURRENT_TIMESTAMP)
WHERE sea.estado_subasta = 'iniciada'
  AND NOT EXISTS (
      SELECT 1
      FROM catalogos c
      JOIN itemsCatalogo ic ON ic.catalogo = c.identificador
      WHERE c.subasta = sea.subasta
  );

-- 6) Coherencia alguna_vez_abierta
UPDATE subasta_estado_admin
SET alguna_vez_abierta = true
WHERE estado_subasta IN ('iniciada', 'finalizada')
  AND alguna_vez_abierta = false;

-- 7) Limpiar sesión de subastas ya finalizadas
DELETE FROM subasta_sesion ss
USING subasta_estado_admin sea
WHERE ss.subasta = sea.subasta
  AND sea.estado_subasta = 'finalizada';
