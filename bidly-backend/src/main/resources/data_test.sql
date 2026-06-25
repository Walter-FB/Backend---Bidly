-- 1. Países
INSERT INTO paises (numero, nombre, nombreCorto, capital, nacionalidad, idiomas)
VALUES
    (1, 'Argentina',  'ARG', 'Buenos Aires', 'Argentino/a', 'Español'),
    (2, 'Estados Unidos', 'USA', 'Washington D.C.', 'Estadounidense', 'Inglés'),
    (3, 'España', 'ESP', 'Madrid', 'Español/a', 'Español');

-- 2 y 3. Personas y empleados
INSERT INTO personas (identificador, documento, nombre, direccion, estado)
OVERRIDING SYSTEM VALUE VALUES (1, '20111111', 'Carlos Rodriguez', 'Av. Corrientes 1234, CABA', 'activo');
INSERT INTO personas (identificador, documento, nombre, direccion, estado)
OVERRIDING SYSTEM VALUE VALUES (2, '20222222', 'Marta Gonzalez', 'Av. Santa Fe 5678, CABA', 'activo');
INSERT INTO personas (identificador, documento, nombre, direccion, estado)
OVERRIDING SYSTEM VALUE VALUES (3, '20333333', 'Pablo Fernandez', 'Calle Rivadavia 999, CABA', 'activo');

INSERT INTO empleados (identificador, cargo) VALUES (1, 'Gerente'), (2, 'Analista'), (3, 'Asistente');

-- 4 y 5. Subastadores
INSERT INTO personas (identificador, documento, nombre, direccion, estado)
OVERRIDING SYSTEM VALUE VALUES (4, '20444444', 'Lucia Martinez', 'Av. de Mayo 100, CABA', 'activo');
INSERT INTO personas (identificador, documento, nombre, direccion, estado)
OVERRIDING SYSTEM VALUE VALUES (5, '20555555', 'Roberto Perez', 'Av. Callao 200, CABA', 'activo');
INSERT INTO subastadores (identificador, matricula, region) VALUES (4, 'MAT-0001', 'Buenos Aires'), (5, 'MAT-0002', 'Cordoba');

-- 6 y 7. Dueños
INSERT INTO personas (identificador, documento, nombre, direccion, estado)
OVERRIDING SYSTEM VALUE VALUES (6, '20666666', 'Ana Lopez', 'Lavalle 300, CABA', 'activo');
INSERT INTO personas (identificador, documento, nombre, direccion, estado)
OVERRIDING SYSTEM VALUE VALUES (7, '20777777', 'Hernan Torres', 'Tucuman 450, CABA', 'activo');
INSERT INTO duenios (identificador, numeroPais, verificacionFinanciera, verificacionJudicial, calificacionRiesgo, verificador)
VALUES (6, 1, 'si', 'si', 2, 1), (7, 1, 'si', 'no', 4, 1);

-- 8 y 9. Clientes
INSERT INTO personas (identificador, documento, nombre, direccion, estado)
OVERRIDING SYSTEM VALUE VALUES (8,  '20888888', 'Juan Diaz', 'Viamonte 600, CABA', 'activo');
INSERT INTO personas (identificador, documento, nombre, direccion, estado)
OVERRIDING SYSTEM VALUE VALUES (9,  '20999999', 'Laura Suarez', 'Sarmiento 700, CABA', 'activo');
INSERT INTO personas (identificador, documento, nombre, direccion, estado)
OVERRIDING SYSTEM VALUE VALUES (10, '21000000', 'Diego Ruiz', 'Mapu 800, CABA', 'activo');
INSERT INTO personas (identificador, documento, nombre, direccion, estado)
OVERRIDING SYSTEM VALUE VALUES (11, '21111111', 'Sofia Castro', 'Libertad 900, CABA', 'activo');

INSERT INTO clientes (identificador, numeroPais, admitido, categoria, verificador, email, passwordHash)
VALUES
    (8,  1, 'si', 'comun', 1, 'juan@bidly.com',  'hash_prueba_123'),
    (9,  1, 'si', 'comun', 1, 'laura@bidly.com', 'hash_prueba_123'),
    (10, 1, 'si', 'comun', 1, 'diego@bidly.com', 'hash_prueba_123'),
    (11, 1, 'si', 'comun', 1, 'sofia@bidly.com', 'hash_prueba_123');

-- 10. Seguros
INSERT INTO seguros (nroPoliza, compania, polizaCombinada, importe)
VALUES ('POL-001', 'La Caja Seguros', 'si', 50000.00), ('POL-002', 'Sancor Seguros', 'no', 30000.00);

-- 11. Productos
INSERT INTO productos (fecha, disponible, descripcionCatalogo, descripcionCompleta, revisor, duenio, seguro)
VALUES
    (CURRENT_DATE, 'si', 'Reloj vintage dorado', 'Reloj de pulsera de coleccion, fabricado en 1965, caja dorada 18k.', 1, 6, 'POL-001'),
    (CURRENT_DATE, 'si', 'Pintura al oleo', 'Oleo sobre tela 60x80 cm, autor local reconocido, firmado.', 1, 6, 'POL-001'),
    (CURRENT_DATE, 'si', 'Escultura de bronce', 'Escultura de bronce fundido, 35 cm de altura, pieza numerada 3/10.', 1, 7, 'POL-002'),
    (CURRENT_DATE, 'si', 'Collar de plata', 'Collar artesanal de plata 925 con piedra labradorita natural.', 1, 7, 'POL-002');

-- 12. Subastas
INSERT INTO subastas (fecha, hora, estado, subastador, ubicacion, capacidadAsistentes, tieneDeposito, seguridadPropia, categoria, moneda)
VALUES
    (CURRENT_DATE + INTERVAL '15 days', '10:00:00', 'abierta', 4, 'Palais de Glace - Posadas 1725, CABA', 150, 'si', 'no', 'comun', 'pesos'),
    (CURRENT_DATE + INTERVAL '15 days', '15:00:00', 'abierta', 5, 'Centro Cultural Borges - Viamonte 525, CABA', 100, 'no', 'si', 'comun', 'pesos');

-- 13. Catalogos
INSERT INTO catalogos (descripcion, subasta, responsable)
VALUES
    ('Catalogo Subasta Primavera 2026 - Sesion Manana', 1, 1),
    ('Catalogo Subasta Primavera 2026 - Sesion Tarde', 2, 1);

-- 14. Items catalogo
INSERT INTO itemsCatalogo (catalogo, producto, precioBase, comision, subastado)
VALUES
    (1, 1, 12000.00, 1200.00, 'no'),
    (1, 2,  8500.00,  850.00, 'no'),
    (2, 3, 25000.00, 2500.00, 'no'),
    (2, 4,  6000.00,  600.00, 'no');

-- 15. Medios de pago
INSERT INTO mediosDePago (cliente, tipo, numeroTarjeta, vencimiento, titular, verificado)
VALUES
    (8, 'tarjeta', '4111111111111111', '2028-12', 'JUAN DIAZ', 'si'),
    (9, 'tarjeta', '5500005555555559', '2027-06', 'LAURA SUAREZ', 'si');

-- Sincronizar secuencias
SELECT setval(pg_get_serial_sequence('personas', 'identificador'), 11);
SELECT setval(pg_get_serial_sequence('subastas', 'identificador'), 2);
SELECT setval(pg_get_serial_sequence('productos', 'identificador'), 4);
SELECT setval(pg_get_serial_sequence('catalogos', 'identificador'), 2);
SELECT setval(pg_get_serial_sequence('itemsCatalogo', 'identificador'), 4);
SELECT setval(pg_get_serial_sequence('mediosDePago', 'identificador'), 2);