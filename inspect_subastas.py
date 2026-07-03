"""
inspect_subastas.py
-------------------
Conecta a la base, muestra cada subasta con su cascada (catálogos, ítems,
asistentes, pujos, registros), te pregunta cuáles borrar y las borra en orden seguro.

Esquema actual = DDL del profe (sin tablas de relleno). La URL sale de DATABASE_URL
(NO se hardcodea la password).

Requiere: pip install psycopg2-binary tabulate
Uso:      DATABASE_URL=postgresql://user:pass@host:port/db  python inspect_subastas.py
"""
import os
import sys
try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("Falta psycopg2. Corré: pip install psycopg2-binary")
    sys.exit(1)

try:
    from tabulate import tabulate
except ImportError:
    print("Falta tabulate. Corré: pip install tabulate")
    sys.exit(1)

DB_URL = os.environ.get("DATABASE_URL")
if not DB_URL:
    print("Seteá DATABASE_URL antes de correr (postgresql://user:pass@host:port/db).")
    sys.exit(1)


def connect():
    return psycopg2.connect(DB_URL)


DIAG_QUERY = """
SELECT
    s.identificador                  AS id,
    s.fecha,
    s.hora,
    s.estado,
    s.subastador,
    s.categoria,
    COUNT(DISTINCT c.identificador)  AS catalogos,
    COUNT(DISTINCT ic.identificador) AS items,
    COUNT(DISTINCT a.identificador)  AS asistentes,
    COUNT(DISTINCT p.identificador)  AS pujos,
    COUNT(DISTINCT r.identificador)  AS registros
FROM subastas s
LEFT JOIN catalogos          c   ON c.subasta    = s.identificador
LEFT JOIN itemscatalogo      ic  ON ic.catalogo  = c.identificador
LEFT JOIN asistentes         a   ON a.subasta    = s.identificador
LEFT JOIN pujos              p   ON p.asistente  = a.identificador
LEFT JOIN registrodesubasta  r   ON r.subasta    = s.identificador
GROUP BY s.identificador
ORDER BY s.identificador
"""


def fetch_subastas(conn):
    with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        cur.execute(DIAG_QUERY)
        return cur.fetchall()


def detectar_problemas(row):
    problemas = []
    if row["subastador"] is None:
        problemas.append("sin subastador")
    if row["catalogos"] == 0:
        problemas.append("sin catálogo")
    elif row["items"] == 0:
        problemas.append("catálogo vacío")
    if row["estado"] is None:
        problemas.append("estado NULL")
    return problemas


def mostrar_tabla(subastas):
    headers = ["ID", "Fecha", "Estado", "Subastador", "Categoría",
               "Catálogos", "Items", "Asistentes", "Pujos", "Registros", "PROBLEMAS"]
    rows = []
    for s in subastas:
        probs = detectar_problemas(s)
        rows.append([
            s["id"], s["fecha"], s["estado"] or "NULL", s["subastador"] or "NULL",
            s["categoria"] or "-", s["catalogos"], s["items"], s["asistentes"],
            s["pujos"], s["registros"], ", ".join(probs) if probs else "OK",
        ])
    print()
    print(tabulate(rows, headers=headers, tablefmt="rounded_outline"))
    print()


def cascade_delete(conn, ids):
    """Borra las subastas indicadas en orden seguro (solo tablas del profe)."""
    if not ids:
        return
    ph = ",".join(str(i) for i in ids)
    steps = [
        f"DELETE FROM pujos WHERE asistente IN (SELECT identificador FROM asistentes WHERE subasta IN ({ph}))",
        f"""DELETE FROM pujos WHERE item IN (
                SELECT ic.identificador FROM itemscatalogo ic
                JOIN catalogos c ON ic.catalogo = c.identificador
                WHERE c.subasta IN ({ph}))""",
        f"DELETE FROM registrodesubasta WHERE subasta IN ({ph})",
        f"DELETE FROM asistentes WHERE subasta IN ({ph})",
        f"DELETE FROM itemscatalogo WHERE catalogo IN (SELECT identificador FROM catalogos WHERE subasta IN ({ph}))",
        f"DELETE FROM catalogos WHERE subasta IN ({ph})",
        f"DELETE FROM subastas WHERE identificador IN ({ph})",
    ]
    with conn.cursor() as cur:
        for sql in steps:
            cur.execute(sql)
            if cur.rowcount:
                print(f"  -> {cur.rowcount} fila(s): {sql.strip()[:70]}...")
    conn.commit()
    print(f"\n✓ Subastas {ids} eliminadas.")


def main():
    print("Conectando...")
    conn = connect()
    print("Conectado.\n")

    subastas = fetch_subastas(conn)
    if not subastas:
        print("No hay subastas.")
        conn.close()
        return

    print(f"Se encontraron {len(subastas)} subasta(s):")
    mostrar_tabla(subastas)

    respuesta = input("¿Qué IDs querés borrar? (ej: 1,3,7 — Enter para no borrar): ").strip()
    if not respuesta:
        print("No se borró nada.")
        conn.close()
        return
    try:
        ids = [int(x.strip()) for x in respuesta.split(",") if x.strip()]
    except ValueError:
        print("IDs inválidos.")
        conn.close()
        return

    validos = {s["id"] for s in subastas}
    invalidos = set(ids) - validos
    if invalidos:
        print(f"No existen: {invalidos}")
        conn.close()
        return

    if input(f"Vas a borrar {ids} en cascada. ¿Confirmás? (s/n): ").strip().lower() == "s":
        cascade_delete(conn, ids)
    else:
        print("Cancelado.")
    conn.close()


if __name__ == "__main__":
    main()
