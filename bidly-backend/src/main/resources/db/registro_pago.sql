-- Estado de pago por registro de subasta adjudicado.
-- Tabla nueva: no modifica registroDeSubasta ni mediosDePago.

CREATE TABLE IF NOT EXISTS registro_pago (
    registro INT PRIMARY KEY,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente'
        CONSTRAINT chk_registro_pago_estado
        CHECK (estado IN ('pendiente', 'pagado', 'fallido', 'reembolsado')),
    medio_pago INT NULL,
    importe_total NUMERIC(18, 2) NOT NULL,
    fecha_pago TIMESTAMP NULL,
    CONSTRAINT fk_registro_pago_registro
        FOREIGN KEY (registro) REFERENCES registrodesubasta(identificador),
    CONSTRAINT fk_registro_pago_medio
        FOREIGN KEY (medio_pago) REFERENCES mediosdepago(identificador)
);
