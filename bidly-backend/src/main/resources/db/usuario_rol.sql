-- Rol operativo por cliente (postor / subastador / admin).
-- Tabla nueva: no modifica el esquema protegido de clientes.

CREATE TABLE IF NOT EXISTS usuario_rol (
    cliente INT PRIMARY KEY,
    rol VARCHAR(20) NOT NULL DEFAULT 'postor'
        CONSTRAINT chk_usuario_rol_rol
        CHECK (rol IN ('postor', 'subastador', 'admin')),
    CONSTRAINT fk_usuario_rol_cliente
        FOREIGN KEY (cliente) REFERENCES clientes(identificador)
);

-- Seed opcional: admin para cliente 1 si existe
INSERT INTO usuario_rol (cliente, rol)
SELECT 1, 'admin'
WHERE EXISTS (SELECT 1 FROM clientes WHERE identificador = 1)
ON CONFLICT (cliente) DO NOTHING;
