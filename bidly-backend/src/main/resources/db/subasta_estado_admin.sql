-- Estado operativo (abierta/cerrada) para subastas cuya fila en "subastas"
-- ya no puede actualizarse por chkfecha (fecha > hoy + 10 días).
-- No modifica tablas protegidas del esquema original.

CREATE TABLE IF NOT EXISTS subasta_estado_admin (
    subasta INT PRIMARY KEY,
    estado VARCHAR(10) NOT NULL
        CONSTRAINT chk_subasta_estado_admin_estado
        CHECK (estado IN ('abierta', 'cerrada')),
    alguna_vez_abierta BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT fk_subasta_estado_admin_subasta
        FOREIGN KEY (subasta) REFERENCES subastas(identificador)
);

ALTER TABLE subasta_estado_admin
    ADD COLUMN IF NOT EXISTS alguna_vez_abierta BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE subasta_estado_admin
    ADD COLUMN IF NOT EXISTS fecha_apertura TIMESTAMP;

-- Marcar como iniciadas solo subastas cerradas que ya pasaron su fecha o vendieron algo.
UPDATE subasta_estado_admin a SET alguna_vez_abierta = true
FROM subastas s
WHERE a.subasta = s.identificador AND a.estado = 'cerrada'
AND (
  s.fecha <= CURRENT_DATE
  OR EXISTS (
    SELECT 1 FROM itemsCatalogo ic
    JOIN catalogos c ON c.identificador = ic.catalogo
    WHERE c.subasta = s.identificador AND ic.subastado = 'si'
  )
);
