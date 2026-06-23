-- Estado operativo (abierta/cerrada) para subastas cuya fila en "subastas"
-- ya no puede actualizarse por chkfecha (fecha > hoy + 10 días).
-- No modifica tablas protegidas del esquema original.

CREATE TABLE IF NOT EXISTS subasta_estado_admin (
    subasta INT PRIMARY KEY,
    estado VARCHAR(10) NOT NULL
        CONSTRAINT chk_subasta_estado_admin_estado
        CHECK (estado IN ('abierta', 'cerrada')),
    CONSTRAINT fk_subasta_estado_admin_subasta
        FOREIGN KEY (subasta) REFERENCES subastas(identificador)
);
