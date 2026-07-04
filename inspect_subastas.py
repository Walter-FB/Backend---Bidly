"""
inspect_subastas.py
-------------------
Conecta a Railway, muestra el estado de cada subasta con toda su cascada,
te pregunta cuáles borrar, y las borra en orden seguro.

Requiere: pip install psycopg2-binary tabulate
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

# ---------- conexión ----------

def connect():
    return psycopg2.connect(DB_URL)

# ---------- diagnóstico ----------

DIAG_QUERY = """
SELECT
    s.identificador                          AS id,
    s.fecha,
    s.hora,
    s.estado,
    s.subastador,
    s.ubicacion,
    s.categoria,
    -- catalogos
    COUNT(DISTINCT c.identificador)          AS catalogos,
    -- items
    COUNT(DISTINCT ic.identificador)         AS items,
    -- asistentes
    COUNT(DISTINCT a.identificador)          AS asistentes,
    -- pujos
    COUNT(DISTINCT p.identificador)          AS pujos,
    -- registros
    COUNT(DISTINCT r.identificador)          AS registros,
    -- extras
    sea.estado                               AS admin_estado,
    sea.estado_subasta                       AS admin_estado_sub,
    sm.moneda                                AS moneda,
    sr.estado                                AS revision_estado
FROM subastas s
LEFT JOIN catalogos          c   ON c.subasta   = s.identificador
LEFT JOIN itemscatalogo      ic  ON ic.catalogo  = c.identificador
LEFT JOIN asistentes         a   ON a.subasta    = s.identificador
LEFT JOIN pujos              p   ON p.asistente  = a.identificador
LEFT JOIN registrodesubasta  r   ON r.subasta    = s.identificador
LEFT JOIN subasta_estado_admin sea ON sea.subasta = s.identificador
LEFT JOIN subasta_moneda      sm  ON sm.subasta   = s.identificador
LEFT JOIN subasta_revision    sr  ON sr.subasta   = s.identificador
GROUP BY s.identificador, sea.estado, sea.estado_subasta, sm.moneda, sr.estado
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
    if row["admin_estado"] is None:
        problemas.append("sin estado_admin")
    if row["moneda"] is None:
        problemas.append("sin moneda")
    if row["estado"] is None:
        problemas.append("estado NULL")
    return problemas

def mostrar_tabla(subastas):
    headers = [
        "ID", "Fecha", "Estado", "Subastador", "Categoría",
        "Catálogos", "Items", "Asistentes", "Pujos", "Registros",
        "Admin", "Moneda", "Revisión", "PROBLEMAS"
    ]
    rows = []
    for s in subastas:
        probs = detectar_problemas(s)
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
            ", ".join(probs) if probs else "OK"
        ])
    print()
    print(tabulate(rows, headers=headers, tablefmt="rounded_outline"))
    print()

# ---------- borrado en cascada ----------

def cascade_delete(conn, ids):
    """Borra las subastas indicadas en orden seguro."""
    if not ids:
        return

    placeholders = ",".join([str(i) for i in ids])

    steps = [
        # 1. multas que apuntan a pujos de asistentes de estas subastas
        f"""
        DELETE FROM multas WHERE pujo IN (
            SELECT p.identificador FROM pujos p
            JOIN asistentes a ON p.asistente = a.identificador
            WHERE a.subasta IN ({placeholders})
        )
        """,
        # 2. multas que apuntan a pujos de items de estas subastas
        f"""
        DELETE FROM multas WHERE pujo IN (
            SELECT p.identificador FROM pujos p
            JOIN itemscatalogo ic ON p.item = ic.identificador
            JOIN catalogos c ON ic.catalogo = c.identificador
            WHERE c.subasta IN ({placeholders})
        )
        """,
        # 3. pujo_fecha de pujos de asistentes
        f"""
        DELETE FROM pujo_fecha WHERE pujo IN (
            SELECT p.identificador FROM pujos p
            JOIN asistentes a ON p.asistente = a.identificador
            WHERE a.subasta IN ({placeholders})
        )
        """,
        # 4. pujo_fecha de pujos de items
        f"""
        DELETE FROM pujo_fecha WHERE pujo IN (
            SELECT p.identificador FROM pujos p
            JOIN itemscatalogo ic ON p.item = ic.identificador
            JOIN catalogos c ON ic.catalogo = c.identificador
            WHERE c.subasta IN ({placeholders})
        )
        """,
        # 5. pujos de asistentes
        f"""
        DELETE FROM pujos WHERE asistente IN (
            SELECT identificador FROM asistentes WHERE subasta IN ({placeholders})
        )
        """,
        # 6. pujos de items de catálogos
        f"""
        DELETE FROM pujos WHERE item IN (
            SELECT ic.identificador FROM itemscatalogo ic
            JOIN catalogos c ON ic.catalogo = c.identificador
            WHERE c.subasta IN ({placeholders})
        )
        """,
        # 7. reembolsos
        f"""
        DELETE FROM reembolsos WHERE registro IN (
            SELECT identificador FROM registrodesubasta WHERE subasta IN ({placeholders})
        )
        """,
        # 8. registro_pago
        f"""
        DELETE FROM registro_pago WHERE registro IN (
            SELECT identificador FROM registrodesubasta WHERE subasta IN ({placeholders})
        )
        """,
        # 9. registrodesubasta
        f"DELETE FROM registrodesubasta WHERE subasta IN ({placeholders})",
        # 10. asistentes
        f"DELETE FROM asistentes WHERE subasta IN ({placeholders})",
        # 11. itemscatalogo
        f"""
        DELETE FROM itemscatalogo WHERE catalogo IN (
            SELECT identificador FROM catalogos WHERE subasta IN ({placeholders})
        )
        """,
        # 12. catalogos
        f"DELETE FROM catalogos WHERE subasta IN ({placeholders})",
        # 13. subasta_sesion
        f"DELETE FROM subasta_sesion WHERE subasta IN ({placeholders})",
        # 14. subasta_revision
        f"DELETE FROM subasta_revision WHERE subasta IN ({placeholders})",
        # 15. subasta_moneda
        f"DELETE FROM subasta_moneda WHERE subasta IN ({placeholders})",
        # 16. subasta_estado_admin
        f"DELETE FROM subasta_estado_admin WHERE subasta IN ({placeholders})",
        # 17. subastas
        f"DELETE FROM subastas WHERE identificador IN ({placeholders})",
    ]

    with conn.cursor() as cur:
        for sql in steps:
            cur.execute(sql)
            if cur.rowcount:
                print(f"  -> {cur.rowcount} fila(s) borradas: {sql.strip()[:80]}...")
    conn.commit()
    print(f"\n✓ Subastas {ids} eliminadas correctamente.")

# ---------- main ----------

def main():
    print("Conectando a Railway...")
    conn = connect()
    print("Conectado.\n")

    subastas = fetch_subastas(conn)

    if not subastas:
        print("No hay subastas en la base de datos.")
        conn.close()
        return

    print(f"Se encontraron {len(subastas)} subasta(s):\n")
    mostrar_tabla(subastas)

    # Resumen rápido de las problemáticas
    con_problemas = [(s["id"], detectar_problemas(s)) for s in subastas if detectar_problemas(s)]
    if con_problemas:
        print("Subastas con problemas detectados:")
        for sid, probs in con_problemas:
            print(f"  ID {sid}: {', '.join(probs)}")
        print()
    else:
        print("No se detectaron problemas. Igual podés borrar las que quieras.\n")

    respuesta = input("¿Qué IDs querés borrar? (ej: 1,3,7 — Enter para no borrar nada): ").strip()

    if not respuesta:
        print("No se borró nada.")
        conn.close()
        return

    try:
        ids_a_borrar = [int(x.strip()) for x in respuesta.split(",") if x.strip()]
    except ValueError:
        print("IDs inválidos. No se borró nada.")
        conn.close()
        return

    # Validar que existen
    ids_validos = {s["id"] for s in subastas}
    ids_invalidos = set(ids_a_borrar) - ids_validos
    if ids_invalidos:
        print(f"Los siguientes IDs no existen: {ids_invalidos}")
        conn.close()
        return

    print(f"\nVas a borrar las subastas: {ids_a_borrar}")
    print("Esto borra en cascada: catálogos, items, asistentes, pujos, registros, reembolsos, pagos, etc.")
    confirmacion = input("¿Confirmás? (s/n): ").strip().lower()

    if confirmacion != "s":
        print("Cancelado.")
        conn.close()
        return

    print("\nBorrando en cascada...")
    cascade_delete(conn, ids_a_borrar)
    conn.close()

if __name__ == "__main__":
    main()
