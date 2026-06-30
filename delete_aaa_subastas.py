"""
delete_aaa_subastas.py
----------------------
Detecta todas las subastas cuyo primer producto en catálogo tiene
descripcioncatalogo = 'aaa' (el título que muestra la app), muestra su
estado completo, identifica cuáles están bugueadas y las borra en cascada.
"""

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

DB_URL = "postgresql://postgres:rzOnesuXFNdajrJWXelLgoOlwkcGJECU@trolley.proxy.rlwy.net:53193/railway"


def connect():
    return psycopg2.connect(DB_URL)


# Trae todas las subastas "aaa": aquellas cuyo primer producto (orden asc por
# itemscatalogo.identificador) tiene descripcioncatalogo ilike 'aaa'.
QUERY_AAA = """
WITH primer_producto AS (
    SELECT DISTINCT ON (c.subasta)
        c.subasta          AS subasta_id,
        pr.descripcioncatalogo AS titulo
    FROM catalogos c
    JOIN itemscatalogo ic ON ic.catalogo = c.identificador
    JOIN productos     pr ON pr.identificador = ic.producto
    ORDER BY c.subasta, ic.identificador
)
SELECT
    s.identificador                         AS id,
    s.fecha,
    s.hora,
    s.estado,
    s.subastador,
    s.ubicacion,
    s.categoria,
    pp.titulo,
    COUNT(DISTINCT c2.identificador)        AS catalogos,
    COUNT(DISTINCT ic2.identificador)       AS items,
    COUNT(DISTINCT a.identificador)         AS asistentes,
    COUNT(DISTINCT p.identificador)         AS pujos,
    COUNT(DISTINCT r.identificador)         AS registros,
    sea.estado                              AS admin_estado,
    sea.estado_subasta                      AS admin_estado_sub,
    sm.moneda,
    sr.estado                               AS revision_estado
FROM subastas s
JOIN primer_producto pp ON pp.subasta_id = s.identificador
LEFT JOIN catalogos          c2  ON c2.subasta   = s.identificador
LEFT JOIN itemscatalogo      ic2 ON ic2.catalogo  = c2.identificador
LEFT JOIN asistentes         a   ON a.subasta     = s.identificador
LEFT JOIN pujos              p   ON p.asistente   = a.identificador
LEFT JOIN registrodesubasta  r   ON r.subasta     = s.identificador
LEFT JOIN subasta_estado_admin sea ON sea.subasta = s.identificador
LEFT JOIN subasta_moneda      sm  ON sm.subasta   = s.identificador
LEFT JOIN subasta_revision    sr  ON sr.subasta   = s.identificador
WHERE LOWER(pp.titulo) = 'aaa'
GROUP BY s.identificador, pp.titulo, sea.estado, sea.estado_subasta, sm.moneda, sr.estado
ORDER BY s.identificador
"""


def fetch_aaa(conn):
    with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        cur.execute(QUERY_AAA)
        return cur.fetchall()


def detectar_problemas(row):
    probs = []
    if row["subastador"] is None:
        probs.append("sin subastador")
    if row["catalogos"] == 0:
        probs.append("sin catalogo")
    elif row["items"] == 0:
        probs.append("catalogo vacio")
    if row["admin_estado"] is None:
        probs.append("sin estado_admin")
    if row["moneda"] is None:
        probs.append("sin moneda")
    if row["estado"] is None:
        probs.append("estado NULL")
    return probs


def es_finalizada_ok(row):
    """True si parece una subasta correctamente finalizada."""
    return (
        row["estado"] in ("cerrada", "carrada")
        and row["admin_estado_sub"] in ("finalizada", "cerrada", "carrada")
        and row["catalogos"] > 0
        and row["items"] > 0
        and row["subastador"] is not None
        and row["moneda"] is not None
    )


def mostrar_tabla(subastas):
    headers = [
        "ID", "Fecha", "Estado", "Subastador", "Cat",
        "Catalogos", "Items", "Asistentes", "Pujos", "Registros",
        "Admin-Est", "Moneda", "Revision", "PROBLEMAS", "OK?"
    ]
    rows = []
    for s in subastas:
        probs = detectar_problemas(s)
        ok = "FINALIZADA OK" if es_finalizada_ok(s) else ("BUGUEADA" if probs else "sin probs claros")
        rows.append([
            s["id"],
            s["fecha"],
            s["estado"] or "NULL",
            s["subastador"] or "NULL",
            s["categoria"] or "-",
            s["catalogos"],
            s["items"],
            s["asistentes"],
            s["pujos"],
            s["registros"],
            s["admin_estado_sub"] or "NULL",
            s["moneda"] or "NULL",
            s["revision_estado"] or "-",
            ", ".join(probs) if probs else "-",
            ok,
        ])
    print()
    print(tabulate(rows, headers=headers, tablefmt="grid"))
    print()


def cascade_delete(conn, ids):
    if not ids:
        return
    placeholders = ",".join([str(i) for i in ids])
    steps = [
        f"""DELETE FROM multas WHERE pujo IN (
            SELECT p.identificador FROM pujos p
            JOIN asistentes a ON p.asistente = a.identificador
            WHERE a.subasta IN ({placeholders}))""",
        f"""DELETE FROM multas WHERE pujo IN (
            SELECT p.identificador FROM pujos p
            JOIN itemscatalogo ic ON p.item = ic.identificador
            JOIN catalogos c ON ic.catalogo = c.identificador
            WHERE c.subasta IN ({placeholders}))""",
        f"""DELETE FROM pujo_fecha WHERE pujo IN (
            SELECT p.identificador FROM pujos p
            JOIN asistentes a ON p.asistente = a.identificador
            WHERE a.subasta IN ({placeholders}))""",
        f"""DELETE FROM pujo_fecha WHERE pujo IN (
            SELECT p.identificador FROM pujos p
            JOIN itemscatalogo ic ON p.item = ic.identificador
            JOIN catalogos c ON ic.catalogo = c.identificador
            WHERE c.subasta IN ({placeholders}))""",
        f"""DELETE FROM pujos WHERE asistente IN (
            SELECT identificador FROM asistentes WHERE subasta IN ({placeholders}))""",
        f"""DELETE FROM pujos WHERE item IN (
            SELECT ic.identificador FROM itemscatalogo ic
            JOIN catalogos c ON ic.catalogo = c.identificador
            WHERE c.subasta IN ({placeholders}))""",
        f"""DELETE FROM reembolsos WHERE registro IN (
            SELECT identificador FROM registrodesubasta WHERE subasta IN ({placeholders}))""",
        f"""DELETE FROM registro_pago WHERE registro IN (
            SELECT identificador FROM registrodesubasta WHERE subasta IN ({placeholders}))""",
        f"DELETE FROM registrodesubasta WHERE subasta IN ({placeholders})",
        f"DELETE FROM asistentes WHERE subasta IN ({placeholders})",
        f"""DELETE FROM itemscatalogo WHERE catalogo IN (
            SELECT identificador FROM catalogos WHERE subasta IN ({placeholders}))""",
        f"DELETE FROM catalogos WHERE subasta IN ({placeholders})",
        f"DELETE FROM subasta_sesion WHERE subasta IN ({placeholders})",
        f"DELETE FROM subasta_revision WHERE subasta IN ({placeholders})",
        f"DELETE FROM subasta_moneda WHERE subasta IN ({placeholders})",
        f"DELETE FROM subasta_estado_admin WHERE subasta IN ({placeholders})",
        f"DELETE FROM subastas WHERE identificador IN ({placeholders})",
    ]
    with conn.cursor() as cur:
        for sql in steps:
            cur.execute(sql)
            if cur.rowcount:
                print(f"  -> {cur.rowcount} fila(s) borradas")
    conn.commit()
    print(f"\n✓ Subastas {ids} eliminadas correctamente.")


def main():
    print("Conectando a Railway...")
    conn = connect()
    print("Conectado.\n")

    subastas = fetch_aaa(conn)

    if not subastas:
        print("No se encontraron subastas con título 'aaa'.")
        conn.close()
        return

    print(f"Se encontraron {len(subastas)} subasta(s) llamadas 'aaa':\n")
    mostrar_tabla(subastas)

    bugueadas = [s for s in subastas if not es_finalizada_ok(s)]
    ok_ids    = [s["id"] for s in subastas if es_finalizada_ok(s)]

    if ok_ids:
        print(f"  CONSERVAR (finalizada ok): ID(s) {ok_ids}")
    if bugueadas:
        bug_ids = [s["id"] for s in bugueadas]
        print(f"  BUGUEADAS detectadas:       ID(s) {bug_ids}\n")
    else:
        print("No se detectaron subastas bugueadas automáticamente.\n")
        conn.close()
        return

    print("Se van a borrar en cascada las subastas bugueadas (catálogos, items, asistentes, pujos, etc.).")
    confirmacion = input(f"¿Confirmás el borrado de {bug_ids}? (s/n): ").strip().lower()

    if confirmacion != "s":
        print("Cancelado.")
        conn.close()
        return

    print("\nBorrando en cascada...")
    cascade_delete(conn, bug_ids)
    conn.close()


if __name__ == "__main__":
    main()
