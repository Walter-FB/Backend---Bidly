"""
db_reconcile.py
---------------
Deja la base EXACTAMENTE con el esquema final de 28 tablas:

  16 del profe (EstructuraActual.sql) + auth (credenciales, usuario_rol) +
  producto_estado + 9 features (mediosdepago, multas, subasta_moneda, admisiones,
  cuentas_duenio, payouts, notificaciones, registro_pago, reembolsos).

Qué hace (idempotente, en UNA transacción):
  (a) CREATE de las 9 tablas de features + producto_estado si faltan.
  (b) BACKFILL coherente con los datos vivos:
        - cada `subastas` sin fila en `subasta_moneda`  -> moneda 'pesos'
        - producto_estado sincronizado desde productos.disponible
        - NO inventa medios de pago / multas / payouts (arrancan vacíos, se llenan por uso)
  (c) DROP de cualquier tabla que NO pertenezca al esquema final de 28.

NO toca la estructura de las 16 tablas del profe (no ALTER/DROP/rename de esas).
Imprime la lista de tablas ANTES y DESPUES.

La URL de conexión se toma de DATABASE_URL (NO hay password hardcodeada acá).
Uso:
    DATABASE_URL="postgresql://user:pass@host:port/db" python db_reconcile.py
"""
import os
import sys

try:
    import psycopg2
except ImportError:
    print("Falta psycopg2. Corre: pip install psycopg2-binary")
    sys.exit(1)


# ── Esquema final: las 28 tablas permitidas ───────────────────────────────────
PROFE = [
    "paises", "personas", "empleados", "sectores", "seguros", "clientes",
    "duenios", "subastadores", "subastas", "productos", "fotos", "catalogos",
    "itemscatalogo", "asistentes", "pujos", "registrodesubasta",
]
AUTH = ["credenciales", "usuario_rol"]
FEATURES = [
    "mediosdepago", "multas", "subasta_moneda", "admisiones", "cuentas_duenio",
    "payouts", "notificaciones", "registro_pago", "reembolsos",
    "ubicaciones_bien",  # depósito donde está guardada la pieza (visible al dueño)
    "item_remate",       # timer del ítem que se está rematando
    "subasta_venta_modo",  # modo de venta del catálogo: individual | bloque (única venta)
]
ESQUEMA_FINAL = set(PROFE + AUTH + ["producto_estado"] + FEATURES)


# ── DDL de las tablas propias (idempotente). Orden = respeta las FKs. ──────────
DDL = [
    ("producto_estado", """
        CREATE TABLE IF NOT EXISTS producto_estado (
            producto      integer      NOT NULL,
            estado        varchar(20)  NOT NULL DEFAULT 'solicitado'
                          CONSTRAINT chk_pe_estado CHECK (estado IN
                          ('solicitado','en_inspeccion','aceptado','rechazado')),
            causa_rechazo varchar(300) NULL,
            fecha_cambio  timestamp    NOT NULL DEFAULT now(),
            CONSTRAINT pk_producto_estado PRIMARY KEY (producto),
            CONSTRAINT fk_producto_estado_productos
                FOREIGN KEY (producto) REFERENCES productos (identificador)
        );
    """),
    ("mediosdepago", """
        CREATE TABLE IF NOT EXISTS mediosdepago (
            identificador serial PRIMARY KEY,
            cliente       integer REFERENCES clientes (identificador),
            tipo          varchar,
            numerotarjeta varchar,
            vencimiento   varchar,
            titular       varchar,
            numerocuenta  varchar,
            banco         varchar,
            numerocheque  varchar,
            montocheque   numeric(12,2),
            limite        numeric(12,2),
            saldo         numeric(12,2),
            verificado    varchar DEFAULT 'no'
        );
    """),
    ("multas", """
        CREATE TABLE IF NOT EXISTS multas (
            identificador serial PRIMARY KEY,
            cliente       integer REFERENCES clientes (identificador),
            pujo          integer REFERENCES pujos (identificador),
            importe       numeric(12,2),
            pagada        varchar DEFAULT 'no',
            fechagenerada date,
            fecha_limite  timestamp
        );
    """),
    ("subasta_moneda", """
        CREATE TABLE IF NOT EXISTS subasta_moneda (
            subasta integer PRIMARY KEY REFERENCES subastas (identificador),
            moneda  varchar
        );
    """),
    ("admisiones", """
        CREATE TABLE IF NOT EXISTS admisiones (
            identificador     serial PRIMARY KEY,
            producto          integer REFERENCES productos (identificador),
            duenio            integer REFERENCES duenios (identificador),
            estado            varchar DEFAULT 'solicitada',
            declara_propiedad varchar DEFAULT 'no',
            declara_origen    varchar DEFAULT 'no',
            direccion_envio   varchar,
            observacion       varchar,
            valor_base        numeric(18,2),
            comision          numeric(18,2),
            subasta           integer REFERENCES subastas (identificador),
            gastos_devolucion numeric(18,2),
            es_coleccion      varchar DEFAULT 'no',
            nombre_coleccion  varchar,
            garantia_premium  varchar DEFAULT 'no',
            alerta_origen     varchar DEFAULT 'no',
            alerta_origen_motivo varchar,
            alerta_origen_en  timestamp,
            creado_en         timestamp,
            actualizado_en    timestamp
        );
    """),
    ("cuentas_duenio", """
        CREATE TABLE IF NOT EXISTS cuentas_duenio (
            identificador serial PRIMARY KEY,
            duenio        integer REFERENCES duenios (identificador),
            alias         varchar,
            banco         varchar,
            pais          varchar,
            moneda        varchar,
            es_exterior   varchar DEFAULT 'no',
            declarada_en  timestamp
        );
    """),
    ("payouts", """
        CREATE TABLE IF NOT EXISTS payouts (
            identificador serial PRIMARY KEY,
            duenio        integer REFERENCES duenios (identificador),
            producto      integer REFERENCES productos (identificador),
            subasta       integer REFERENCES subastas (identificador),
            importe_bruto numeric(18,2),
            comision      numeric(18,2),
            premium       numeric(18,2),
            importe_neto  numeric(18,2),
            origen        varchar DEFAULT 'venta',
            cuenta        integer REFERENCES cuentas_duenio (identificador),
            estado        varchar DEFAULT 'pendiente',
            creado_en     timestamp,
            pagado_en     timestamp
        );
    """),
    ("notificaciones", """
        CREATE TABLE IF NOT EXISTS notificaciones (
            identificador serial PRIMARY KEY,
            cliente       integer REFERENCES clientes (identificador),
            tipo          varchar,
            mensaje       varchar,
            leida         varchar DEFAULT 'no',
            fechahora     timestamp
        );
    """),
    ("registro_pago", """
        CREATE TABLE IF NOT EXISTS registro_pago (
            registro        integer PRIMARY KEY REFERENCES registrodesubasta (identificador),
            estado          varchar DEFAULT 'pendiente',
            medio_pago      integer REFERENCES mediosdepago (identificador),
            importe_total   numeric(12,2),
            fecha_pago      timestamp,
            envio           numeric(12,2),
            direccion_envio varchar,
            retiro_personal varchar DEFAULT 'no'
        );
    """),
    ("reembolsos", """
        CREATE TABLE IF NOT EXISTS reembolsos (
            registro    integer PRIMARY KEY REFERENCES registrodesubasta (identificador),
            reembolsada varchar DEFAULT 'no'
        );
    """),
    ("ubicaciones_bien", """
        CREATE TABLE IF NOT EXISTS ubicaciones_bien (
            producto     integer PRIMARY KEY REFERENCES productos (identificador),
            deposito     varchar,
            sector       varchar,
            ingresado_en timestamp
        );
    """),
    ("item_remate", """
        CREATE TABLE IF NOT EXISTS item_remate (
            item       integer PRIMARY KEY REFERENCES itemscatalogo (identificador),
            termina_en timestamp
        );
    """),
    ("subasta_venta_modo", """
        CREATE TABLE IF NOT EXISTS subasta_venta_modo (
            subasta integer PRIMARY KEY REFERENCES subastas (identificador),
            modo    varchar DEFAULT 'individual'
        );
    """),
]

# ── ALTERs idempotentes para bases YA creadas (no recrean la tabla) ───────────
ALTERS = [
    "ALTER TABLE mediosdepago ADD COLUMN IF NOT EXISTS limite numeric(12,2);",
    # Presupuesto por defecto para tarjetas ya cargadas sin límite: débito 100k,
    # crédito 200k, y el resto (cuenta/cheque/legacy) hereda su saldo o montocheque.
    "UPDATE mediosdepago SET limite = COALESCE(limite, saldo, montocheque);",
    # Reembolsos: columnas del flujo de solicitud (por si la tabla es vieja).
    "ALTER TABLE reembolsos ADD COLUMN IF NOT EXISTS estado varchar DEFAULT 'ninguno';",
    "ALTER TABLE reembolsos ADD COLUMN IF NOT EXISTS motivo varchar;",
    # Admisiones: garantía premium + aviso de origen (por si la tabla es vieja).
    "ALTER TABLE admisiones ADD COLUMN IF NOT EXISTS garantia_premium varchar DEFAULT 'no';",
    "ALTER TABLE admisiones ADD COLUMN IF NOT EXISTS alerta_origen varchar DEFAULT 'no';",
    "ALTER TABLE admisiones ADD COLUMN IF NOT EXISTS alerta_origen_motivo varchar;",
    "ALTER TABLE admisiones ADD COLUMN IF NOT EXISTS alerta_origen_en timestamp;",
    # Payouts: costo de la cobertura premium descontado del cobro.
    "ALTER TABLE payouts ADD COLUMN IF NOT EXISTS premium numeric(18,2);",
]

BACKFILL_PRODUCTO_ESTADO = """
    INSERT INTO producto_estado (producto, estado)
    SELECT identificador,
           CASE WHEN disponible = 'si' THEN 'aceptado' ELSE 'solicitado' END
    FROM productos
    WHERE identificador NOT IN (SELECT producto FROM producto_estado);
"""

BACKFILL_SUBASTA_MONEDA = """
    INSERT INTO subasta_moneda (subasta, moneda)
    SELECT identificador, 'pesos'
    FROM subastas
    WHERE identificador NOT IN (SELECT subasta FROM subasta_moneda);
"""

LISTAR_TABLAS = """
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' ORDER BY table_name;
"""


def get_dsn() -> str:
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("Setea DATABASE_URL antes de correr (postgresql://user:pass@host:port/db).")
        sys.exit(1)
    # psycopg2 usa libpq: sin el sufijo +psycopg2 del driver de SQLAlchemy.
    return url.replace("+psycopg2", "")


def listar(cur) -> list:
    cur.execute(LISTAR_TABLAS)
    return [r[0] for r in cur.fetchall()]


def main():
    conn = psycopg2.connect(get_dsn())
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            antes = listar(cur)
            print(f"Tablas ANTES ({len(antes)}): {', '.join(antes)}\n")

            # (a) CREATE de producto_estado + las 9 tablas de features (si faltan).
            for nombre, ddl in DDL:
                cur.execute(ddl)
                print(f"  [OK] CREATE IF NOT EXISTS {nombre}")

            # (a.2) ALTERs idempotentes sobre tablas de features ya creadas.
            for alter in ALTERS:
                cur.execute(alter)
            print(f"  [OK] ALTERs idempotentes aplicados ({len(ALTERS)})")

            # (b) BACKFILL coherente con los datos vivos.
            cur.execute(BACKFILL_PRODUCTO_ESTADO)
            print(f"\n  [OK] BACKFILL producto_estado ({cur.rowcount} filas)")
            cur.execute(BACKFILL_SUBASTA_MONEDA)
            print(f"  [OK] BACKFILL subasta_moneda 'pesos' ({cur.rowcount} filas)")

            # (c) DROP de cualquier tabla fuera del esquema final de 28.
            a_borrar = [t for t in listar(cur) if t not in ESQUEMA_FINAL]
            if a_borrar:
                for t in a_borrar:
                    cur.execute(f'DROP TABLE IF EXISTS "{t}" CASCADE;')
                    print(f"  [OK] DROP {t} (fuera del esquema final)")
            else:
                print("\n  [OK] No hay tablas fuera del esquema final (nada que dropear).")

            despues = listar(cur)

        conn.commit()
        print(f"\nTablas DESPUES ({len(despues)}): {', '.join(despues)}")
        faltan = sorted(ESQUEMA_FINAL - set(despues))
        sobran = sorted(set(despues) - ESQUEMA_FINAL)
        if len(despues) == len(ESQUEMA_FINAL) and not faltan and not sobran:
            print(f"\n[OK] La base quedo con exactamente las {len(ESQUEMA_FINAL)} tablas del esquema final.")
        else:
            print(f"\n[ERROR] Esquema inesperado. faltan={faltan} sobran={sobran}")
            sys.exit(1)
    except Exception as e:
        conn.rollback()
        print(f"\n[ERROR] se hizo rollback: {e}")
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
