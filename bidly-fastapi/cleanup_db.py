"""
cleanup_db.py — libera espacio en la base (Railway cobra por el disco usado).

Diagnóstico típico de Bidly: la base pesa ~400 MB y el 97% son las FOTOS
(`fotos.foto` son blobs binarios sin comprimir). Todo el resto de las tablas suma
~1 MB. Por eso lo que baja el costo es borrar/limpiar fotos, NO borrar productos.

Modos (elegí uno). Por defecto SOLO informa (dry-run); no borra nada hasta `--yes`:

  (sin flags)            Dry-run: muestra tamaños y qué liberaría cada modo.

  --fotos-vendidos       Borra las fotos de productos VENDIDOS (disponible='no').
                         Conserva productos, ventas, payouts, métricas — todo el
                         historial. Solo desaparecen esas imágenes. RECOMENDADO.

  --fotos-todas          Borra TODAS las fotos. Máximo espacio liberado; los
                         productos quedan sin imagen (placeholder en la app).

  --productos-vendidos   Borra en cascada los productos VENDIDOS y TODO lo que
                         cuelga de ellos (fotos, ítems de catálogo, pujas, multas
                         de esas pujas, registros de venta, pagos, reembolsos,
                         payouts, seguros, admisiones, ubicación, estado). ⚠️ PERDÉS
                         el historial de esas ventas. Es lo que pediste; úsalo solo
                         si de verdad querés purgar los registros.

Tras borrar corre `VACUUM FULL` (imprescindible: sin eso Postgres NO devuelve el
disco al SO y Railway te sigue cobrando lo mismo).

La conexión sale de DATABASE_URL (o PG* del .env); NO hay password hardcodeada acá.
Uso:
    DATABASE_URL="postgresql://user:pass@host:port/db" python cleanup_db.py            # ver
    DATABASE_URL="..." python cleanup_db.py --fotos-vendidos --yes                      # aplicar
"""
import os
import sys

try:
    import psycopg2
except ImportError:
    print("Falta psycopg2. Corré: pip install psycopg2-binary")
    sys.exit(1)


def get_dsn() -> str:
    url = os.environ.get("DATABASE_URL")
    if url:
        return url.replace("+psycopg2", "")
    # Respaldo: PG* del entorno / .env (mismo criterio que el resto de los scripts).
    host = os.environ.get("PGHOST"); pw = os.environ.get("PGPASSWORD")
    if not host or not pw:
        print("Seteá DATABASE_URL (o PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD) antes de correr.")
        sys.exit(1)
    port = os.environ.get("PGPORT", "5432"); db = os.environ.get("PGDATABASE", "railway")
    user = os.environ.get("PGUSER", "postgres")
    return f"postgresql://{user}:{pw}@{host}:{port}/{db}"


# Productos "vendidos" = con productos.disponible = 'no' (flag que setea la adjudicación).
SQL_VENDIDOS = "SELECT identificador FROM productos WHERE disponible = 'no'"


def _scalar(cur, sql, params=None):
    cur.execute(sql, params or [])
    r = cur.fetchone()
    return r[0] if r else None


def diagnostico(cur):
    total = _scalar(cur, "SELECT pg_size_pretty(pg_database_size(current_database()))")
    fotos_sz = _scalar(cur, "SELECT pg_size_pretty(pg_total_relation_size('fotos'))")
    n_fotos = _scalar(cur, "SELECT count(*) FROM fotos")
    n_vend = _scalar(cur, "SELECT count(*) FROM productos WHERE disponible='no'")
    n_fotos_vend = _scalar(
        cur, "SELECT count(*) FROM fotos WHERE producto IN (%s)" % SQL_VENDIDOS
    )
    print(f"  Base total ....................... {total}")
    print(f"  Tabla fotos ...................... {fotos_sz}  ({n_fotos} fotos)")
    print(f"  Productos vendidos (disp='no') ... {n_vend}")
    print(f"  Fotos de productos vendidos ...... {n_fotos_vend}")
    print()
    print("  Qué liberaría cada modo:")
    print(f"    --fotos-vendidos     ~ borra {n_fotos_vend} fotos (conserva todos los registros)")
    print(f"    --fotos-todas        ~ borra {n_fotos} fotos (todos los productos sin imagen)")
    print(f"    --productos-vendidos ~ borra {n_vend} productos + su historial (cascada)")


def borrar_fotos(cur, solo_vendidos: bool) -> int:
    if solo_vendidos:
        cur.execute(f"DELETE FROM fotos WHERE producto IN ({SQL_VENDIDOS})")
    else:
        cur.execute("DELETE FROM fotos")
    return cur.rowcount


def borrar_productos_vendidos(cur) -> dict:
    """Cascada manual (hijos primero) para no violar las FKs. Todo en la transacción
    abierta: si algo falla, se revierte entero (el caller hace rollback)."""
    P = SQL_VENDIDOS
    items = f"SELECT identificador FROM itemscatalogo WHERE producto IN ({P})"
    pujos = f"SELECT identificador FROM pujos WHERE item IN ({items})"
    regs = f"SELECT identificador FROM registrodesubasta WHERE producto IN ({P})"
    borrados = {}

    def d(nombre, sql):
        cur.execute(sql)
        borrados[nombre] = cur.rowcount

    # Hijos de pujos / itemscatalogo
    d("multas", f"DELETE FROM multas WHERE pujo IN ({pujos})")
    d("item_remate", f"DELETE FROM item_remate WHERE item IN ({items})")
    d("pujos", f"DELETE FROM pujos WHERE item IN ({items})")
    # Hijos de registrodesubasta
    d("registro_pago", f"DELETE FROM registro_pago WHERE registro IN ({regs})")
    d("reembolsos", f"DELETE FROM reembolsos WHERE registro IN ({regs})")
    d("registrodesubasta", f"DELETE FROM registrodesubasta WHERE producto IN ({P})")
    # Otros que cuelgan del producto (FKs reales a productos: admisiones, fotos,
    # itemscatalogo, payouts, producto_estado, ubicaciones_bien). La póliza `seguros`
    # NO referencia al producto (es productos.seguro → seguros); queda huérfana e
    # inofensiva, no se toca.
    d("payouts", f"DELETE FROM payouts WHERE producto IN ({P})")
    d("admisiones", f"DELETE FROM admisiones WHERE producto IN ({P})")
    d("ubicaciones_bien", f"DELETE FROM ubicaciones_bien WHERE producto IN ({P})")
    d("producto_estado", f"DELETE FROM producto_estado WHERE producto IN ({P})")
    d("fotos", f"DELETE FROM fotos WHERE producto IN ({P})")
    d("itemscatalogo", f"DELETE FROM itemscatalogo WHERE producto IN ({P})")
    d("productos", f"DELETE FROM productos WHERE disponible='no'")
    return borrados


def vacuum(conn, tabla=None):
    conn.commit()
    conn.autocommit = True  # VACUUM FULL no puede correr dentro de una transacción
    with conn.cursor() as cur:
        obj = tabla or ""
        print(f"\n  VACUUM FULL {obj or '(toda la base)'} — reclamando disco…")
        cur.execute(f"VACUUM FULL {obj}".strip() + ";")
    conn.autocommit = False


def main():
    args = set(sys.argv[1:])
    modos = args & {"--fotos-vendidos", "--fotos-todas", "--productos-vendidos"}
    aplicar = "--yes" in args

    if len(modos) > 1:
        print("Elegí UN solo modo."); sys.exit(1)

    conn = psycopg2.connect(get_dsn())
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            print("=== Estado de la base ===")
            diagnostico(cur)

        if not modos:
            print("\n(dry-run) No se borró nada. Elegí un modo + --yes para aplicar.")
            return

        modo = next(iter(modos))
        if not aplicar:
            print(f"\n(dry-run) Modo {modo} elegido pero SIN --yes: no se borró nada.")
            print("Volvé a correr con --yes para aplicar de verdad.")
            return

        with conn.cursor() as cur:
            if modo == "--fotos-vendidos":
                n = borrar_fotos(cur, solo_vendidos=True)
                print(f"\n  [OK] {n} fotos de productos vendidos borradas.")
            elif modo == "--fotos-todas":
                n = borrar_fotos(cur, solo_vendidos=False)
                print(f"\n  [OK] {n} fotos borradas (todas).")
            elif modo == "--productos-vendidos":
                res = borrar_productos_vendidos(cur)
                print("\n  [OK] Cascada de productos vendidos:")
                for t, c in res.items():
                    print(f"        {t:20s} {c} filas")
        conn.commit()

        # Reclamar disco. Si solo tocamos fotos, con VACUUM FULL fotos alcanza (mucho
        # más rápido); si borramos productos, vaciamos toda la base.
        vacuum(conn, "fotos" if modo.startswith("--fotos") else None)

        with conn.cursor() as cur:
            total = _scalar(cur, "SELECT pg_size_pretty(pg_database_size(current_database()))")
        print(f"\n[OK] Listo. Base ahora: {total}")
    except Exception as e:
        conn.rollback()
        print(f"\n[ERROR] se hizo rollback, no se borró nada: {e}")
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
