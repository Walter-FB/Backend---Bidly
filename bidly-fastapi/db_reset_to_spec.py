"""
db_reset_to_spec.py
-------------------
Deja la base alineada con la DDL del profe (EstructuraActual.sql) + las 3 tablas
propias que sí tienen utilidad (credenciales, usuario_rol, producto_estado):

  1. DROP de todas las tablas de relleno que se quemaron.
  2. CREATE de producto_estado (SPEC §1) — idempotente.
  3. BACKFILL de producto_estado para los productos existentes (SPEC §2).

Se corre UNA vez. Es idempotente: se puede volver a correr sin romper nada.

La URL de conexión se toma de la variable de entorno DATABASE_URL (o de las
PG* que usa app/config.py). NO hay password hardcodeada acá: rotá la que estaba
expuesta en inspect_subastas.py y seteá DATABASE_URL en Railway / tu entorno.

Uso:
    DATABASE_URL=postgresql://user:pass@host:port/db  python db_reset_to_spec.py
"""
import os
import sys

try:
    import psycopg2
except ImportError:
    print("Falta psycopg2. Corré: pip install psycopg2-binary")
    sys.exit(1)


# Tablas de relleno a eliminar (ninguna tabla del profe las referencia).
TABLAS_A_QUEMAR = [
    "admisiones", "payouts", "cuentas_duenio", "ubicacion_bien", "producto_detalle",
    "subasta_moneda", "subasta_sesion", "subasta_estado_admin", "subasta_revision",
    "pujo_fecha", "multas", "notificaciones", "reembolsos", "registro_pago",
    "mediosdepago", "cliente_push_tokens", "dni_verificacion",
    "sesiones_activas", "verificaciones_email",
]

CREATE_PRODUCTO_ESTADO = """
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
"""

BACKFILL_PRODUCTO_ESTADO = """
INSERT INTO producto_estado (producto, estado)
SELECT identificador,
       CASE WHEN disponible = 'si' THEN 'aceptado' ELSE 'solicitado' END
FROM productos
WHERE identificador NOT IN (SELECT producto FROM producto_estado);
"""

LISTAR_TABLAS = """
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;
"""


def get_dsn() -> str:
    url = os.environ.get("DATABASE_URL")
    if url:
        return url
    host = os.environ.get("PGHOST")
    if host:
        return (
            f"postgresql://{os.environ.get('PGUSER','postgres')}:{os.environ.get('PGPASSWORD','')}"
            f"@{host}:{os.environ.get('PGPORT','5432')}/{os.environ.get('PGDATABASE','railway')}"
        )
    print("Seteá DATABASE_URL (o PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE) antes de correr.")
    sys.exit(1)


def listar(cur) -> list[str]:
    cur.execute(LISTAR_TABLAS)
    return [r[0] for r in cur.fetchall()]


def main():
    conn = psycopg2.connect(get_dsn())
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            antes = listar(cur)
            print(f"Tablas ANTES ({len(antes)}): {', '.join(antes)}\n")

            for t in TABLAS_A_QUEMAR:
                cur.execute(f'DROP TABLE IF EXISTS "{t}" CASCADE;')
                print(f"  DROP {t}")

            cur.execute(CREATE_PRODUCTO_ESTADO)
            print("\n  CREATE producto_estado")
            cur.execute(BACKFILL_PRODUCTO_ESTADO)
            print(f"  BACKFILL producto_estado ({cur.rowcount} filas)")

            despues = listar(cur)
        conn.commit()
        print(f"\nTablas DESPUES ({len(despues)}): {', '.join(despues)}")
        print("\n[OK] Base alineada con la DDL del profe + credenciales, usuario_rol, producto_estado.")
    except Exception as e:
        conn.rollback()
        print(f"\n[ERROR] se hizo rollback: {e}")
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
