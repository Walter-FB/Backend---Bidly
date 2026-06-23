-- Tabla nueva (no toca el esquema protegido de subastas).
-- Ejecutar una vez en PostgreSQL local y en Railway.

CREATE TABLE IF NOT EXISTS subasta_revision (
    identificador SERIAL PRIMARY KEY,
    subasta INT NOT NULL UNIQUE,
    solicitante INT NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente'
        CONSTRAINT chk_subasta_revision_estado
        CHECK (estado IN ('pendiente', 'aprobada', 'pausada', 'rechazada')),
    fechasolicitud TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecharevision TIMESTAMP NULL,
    observacion VARCHAR(500) NULL,
    CONSTRAINT fk_subasta_revision_subasta
        FOREIGN KEY (subasta) REFERENCES subastas(identificador),
    CONSTRAINT fk_subasta_revision_solicitante
        FOREIGN KEY (solicitante) REFERENCES clientes(identificador)
);

CREATE INDEX IF NOT EXISTS idx_subasta_revision_estado ON subasta_revision(estado);
