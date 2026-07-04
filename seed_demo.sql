-- ═══════════════════════════════════════════════════════════════════════════
-- BIDLY — SEED DE DEMO
-- Correr en Railway: Data → "Raw SQL" (botón en la UI de Railway),
--   o via psql: psql "postgresql://..." -f seed_demo.sql
--
-- Precondiciones que YA deben existir en Railway:
--   · empleados.identificador = 1  (EMPLEADO_SISTEMA, requerido por FKs NOT NULL)
--   · paises.numero = 1            (Argentina)
--
-- Qué crea:
--   · 3 clientes demo  →  c1@bidly.demo / c2@bidly.demo / c3@bidly.demo  (pwd: demo1234)
--   · Subasta A (comun, pesos, abierta)  → para MIN/MAX/RACE/CLOSED/ITEM_SOLD
--   · Subasta B (oro, pesos, abierta)    → para gold_no_cap "sin tope"
--   · 1 catálogo + 1 ítem (base=10000) en cada subasta
--   · Medios de pago verificados para C1 y C2; C3 sin ninguno (dispara NO_PAYMENT)
--
-- NOTA sobre nombres de columna:
--   La BD fue creada por el prof con EstructuraActual.sql.
--   Si algún INSERT falla por nombre de columna, probá con comillas dobles:
--   ej.  "passwordHash"  en vez de  passwordhash
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  p1   bigint;
  p2   bigint;
  p3   bigint;
  psub bigint;

  sub_a bigint;
  sub_b bigint;
  cat_a bigint;
  cat_b bigint;
  prod_a bigint;
  prod_b bigint;

  fecha_ok date := CURRENT_DATE + 1;

BEGIN

  -- ── Guard: si el seed ya corrió, no hacemos nada ─────────────────────────
  IF EXISTS (SELECT 1 FROM credenciales WHERE email = 'c1@bidly.demo') THEN
    RAISE NOTICE 'Seed ya corrido — datos demo ya existen. Nada que hacer.';
    RETURN;
  END IF;

  -- ══════════════════════════════════════════════════════
  --  PERSONAS  (base de todos los actores del sistema)
  -- ══════════════════════════════════════════════════════
  INSERT INTO personas (nombre, documento, direccion, estado)
    VALUES ('Demo Cliente Uno', '11111111', 'Corrientes 1000 CABA', 'activo')
    RETURNING identificador INTO p1;

  INSERT INTO personas (nombre, documento, direccion, estado)
    VALUES ('Demo Cliente Dos', '22222222', 'Florida 200 CABA', 'activo')
    RETURNING identificador INTO p2;

  INSERT INTO personas (nombre, documento, direccion, estado)
    VALUES ('Demo Sin Pago', '33333333', 'Rivadavia 300 CABA', 'activo')
    RETURNING identificador INTO p3;

  INSERT INTO personas (nombre, documento, direccion, estado)
    VALUES ('Demo Subastador', '44444444', 'Libertador 400 CABA', 'activo')
    RETURNING identificador INTO psub;

  -- ══════════════════════════════════════════════════════
  --  CLIENTES  (admitido=si para poder pujar)
  --  verificador=1 → EMPLEADO_SISTEMA (ya existe en Railway)
  --  numeropais=1  → Argentina        (ya existe en Railway)
  -- ══════════════════════════════════════════════════════
  INSERT INTO clientes (identificador, admitido, categoria, verificador, numeropais)
    VALUES (p1, 'si', 'comun', 1, 1);

  INSERT INTO clientes (identificador, admitido, categoria, verificador, numeropais)
    VALUES (p2, 'si', 'comun', 1, 1);

  INSERT INTO clientes (identificador, admitido, categoria, verificador, numeropais)
    VALUES (p3, 'si', 'comun', 1, 1);

  -- ══════════════════════════════════════════════════════
  --  CREDENCIALES  (password se guarda en TEXTO PLANO — sin bcrypt)
  --  Confirmado en AuthController.login():
  --    password.equals(cred.getPasswordHash())
  -- ══════════════════════════════════════════════════════
  INSERT INTO credenciales (cliente, email, passwordhash)
    VALUES (p1, 'c1@bidly.demo', 'demo1234');

  INSERT INTO credenciales (cliente, email, passwordhash)
    VALUES (p2, 'c2@bidly.demo', 'demo1234');

  INSERT INTO credenciales (cliente, email, passwordhash)
    VALUES (p3, 'c3@bidly.demo', 'demo1234');

  -- ══════════════════════════════════════════════════════
  --  SUBASTADOR
  -- ══════════════════════════════════════════════════════
  INSERT INTO subastadores (identificador, matricula, region)
    VALUES (psub, 'MAT-DEMO-001', 'CABA');

  -- ══════════════════════════════════════════════════════
  --  SUBASTA A — categoria=comun, moneda=pesos
  --  Para probar: MIN_BID, MAX_BID, NO_PAYMENT,
  --               AUCTION_CLOSED, ITEM_SOLD, RACE, DOUBLE_TAP
  -- ══════════════════════════════════════════════════════
  INSERT INTO subastas (fecha, hora, estado, subastador, ubicacion, categoria)
    VALUES (fecha_ok, '19:00', 'abierta', psub, 'Buenos Aires', 'comun')
    RETURNING identificador INTO sub_a;

  INSERT INTO subasta_moneda (subasta, moneda)
    VALUES (sub_a, 'pesos');

  -- ══════════════════════════════════════════════════════
  --  SUBASTA B — categoria=oro, moneda=pesos
  --  Para probar: gold_no_cap (puja > max sin rechazo)
  -- ══════════════════════════════════════════════════════
  INSERT INTO subastas (fecha, hora, estado, subastador, ubicacion, categoria)
    VALUES (fecha_ok, '20:00', 'abierta', psub, 'Buenos Aires', 'oro')
    RETURNING identificador INTO sub_b;

  INSERT INTO subasta_moneda (subasta, moneda)
    VALUES (sub_b, 'pesos');

  -- ══════════════════════════════════════════════════════
  --  DUENIO  (requerido por productos.duenio FK NOT NULL)
  --  Usamos p1 como dueño de los productos
  -- ══════════════════════════════════════════════════════
  INSERT INTO duenios (identificador, verificacionfinanciera, verificacionjudicial,
                       calificacionriesgo, verificador)
    VALUES (p1, 'no', 'no', 3, 1);

  -- ══════════════════════════════════════════════════════
  --  PRODUCTOS
  --  revisor=1 y duenio=p1 (EMPLEADO_SISTEMA como revisor)
  -- ══════════════════════════════════════════════════════
  INSERT INTO productos (disponible, descripcioncatalogo, descripcioncompleta, revisor, duenio)
    VALUES ('si', 'Laptop Gaming QA Demo', 'Laptop para demostración del circuito de puja en subasta comun', 1, p1)
    RETURNING identificador INTO prod_a;

  INSERT INTO productos (disponible, descripcioncatalogo, descripcioncompleta, revisor, duenio)
    VALUES ('si', 'Smartwatch Oro QA Demo', 'Smartwatch para demostración de subasta categoría oro (sin tope)', 1, p1)
    RETURNING identificador INTO prod_b;

  -- ══════════════════════════════════════════════════════
  --  CATÁLOGOS + ÍTEMS
  --  precioBase=10000  →  mínimo=10000, tope=12000 (para comun)
  --  comision=100      →  debe ser >0.01 (constraint de la tabla)
  -- ══════════════════════════════════════════════════════
  INSERT INTO catalogos (descripcion, subasta, responsable)
    VALUES ('Catálogo Demo Subasta A', sub_a, 1)
    RETURNING identificador INTO cat_a;

  INSERT INTO itemscatalogo (catalogo, producto, preciobase, comision, subastado)
    VALUES (cat_a, prod_a, 10000.00, 100.00, 'no');

  INSERT INTO catalogos (descripcion, subasta, responsable)
    VALUES ('Catálogo Demo Subasta B', sub_b, 1)
    RETURNING identificador INTO cat_b;

  INSERT INTO itemscatalogo (catalogo, producto, preciobase, comision, subastado)
    VALUES (cat_b, prod_b, 10000.00, 100.00, 'no');

  -- ══════════════════════════════════════════════════════
  --  MEDIOS DE PAGO
  --  C1 y C2: tarjeta verificada=si  → pueden pujar
  --  C3: sin ningún medio            → dispara NO_PAYMENT
  -- ══════════════════════════════════════════════════════
  INSERT INTO medios_pago (cliente, tipo, verificado)
    VALUES (p1, 'tarjeta', 'si');

  INSERT INTO medios_pago (cliente, tipo, verificado)
    VALUES (p2, 'tarjeta', 'si');

  -- ══════════════════════════════════════════════════════
  --  RESUMEN FINAL
  -- ══════════════════════════════════════════════════════
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════';
  RAISE NOTICE '  BIDLY SEED OK';
  RAISE NOTICE '════════════════════════════════════════';
  RAISE NOTICE 'Subasta A (comun, pesos) id = %', sub_a;
  RAISE NOTICE 'Subasta B (oro,   pesos) id = %', sub_b;
  RAISE NOTICE 'Cliente 1 id=% → c1@bidly.demo / demo1234  (medio verificado)', p1;
  RAISE NOTICE 'Cliente 2 id=% → c2@bidly.demo / demo1234  (medio verificado)', p2;
  RAISE NOTICE 'Cliente 3 id=% → c3@bidly.demo / demo1234  (SIN medio pago)', p3;
  RAISE NOTICE 'Fecha subastas: %', fecha_ok;
  RAISE NOTICE '════════════════════════════════════════';

END $$;
