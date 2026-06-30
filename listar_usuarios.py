"""
listar_usuarios.py
------------------
Muestra todos los clientes con su ID, email y categoría.
"""

import sys
try:
    import psycopg2, psycopg2.extras
except ImportError:
    print("Falta psycopg2. Corré: pip install psycopg2-binary"); sys.exit(1)
try:
    from tabulate import tabulate
except ImportError:
    print("Falta tabulate. Corré: pip install tabulate"); sys.exit(1)

DB_URL = "postgresql://postgres:rzOnesuXFNdajrJWXelLgoOlwkcGJECU@trolley.proxy.rlwy.net:53193/railway"

def main():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    cur.execute("""
        SELECT
            c.identificador   AS id,
            cr.email,
            p.nombre,
            c.categoria,
            c.admitido
        FROM clientes c
        JOIN personas    p  ON p.identificador = c.identificador
        JOIN credenciales cr ON cr.cliente      = c.identificador
        ORDER BY c.identificador
    """)
    rows = cur.fetchall()
    conn.close()

    if not rows:
        print("No hay clientes en la base de datos.")
        return

    print(f"\n{len(rows)} cliente(s) encontrado(s):\n")
    print(tabulate(
        [[r["id"], r["email"], r["nombre"], r["categoria"] or "-", r["admitido"]] for r in rows],
        headers=["ID", "Email", "Nombre", "Categoría", "Admitido"],
        tablefmt="rounded_outline"
    ))
    print()

if __name__ == "__main__":
    main()
