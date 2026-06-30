"""
cambiar_categoria.py
--------------------
Cambia la categoría de un cliente en la base de datos de Railway.

Uso:
    python cambiar_categoria.py <id_cliente> <nueva_categoria>

Ejemplo:
    python cambiar_categoria.py 5 VIP
"""

import sys
try:
    import psycopg2, psycopg2.extras
except ImportError:
    print("Falta psycopg2. Corré: pip install psycopg2-binary"); sys.exit(1)

DB_URL = "postgresql://postgres:rzOnesuXFNdajrJWXelLgoOlwkcGJECU@trolley.proxy.rlwy.net:53193/railway"

def main():
    if len(sys.argv) != 3:
        print("Uso: python cambiar_categoria.py <id_cliente> <nueva_categoria>")
        sys.exit(1)

    try:
        cliente_id = int(sys.argv[1])
    except ValueError:
        print("El ID debe ser un número entero.")
        sys.exit(1)

    nueva_cat = sys.argv[2].strip()

    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    # Verificar que existe
    cur.execute("""
        SELECT c.identificador, cr.email, p.nombre, c.categoria
        FROM clientes c
        JOIN personas     p  ON p.identificador = c.identificador
        JOIN credenciales cr ON cr.cliente      = c.identificador
        WHERE c.identificador = %s
    """, (cliente_id,))
    row = cur.fetchone()

    if not row:
        print(f"No se encontró ningún cliente con ID {cliente_id}.")
        conn.close()
        sys.exit(1)

    print(f"\nCliente encontrado:")
    print(f"  ID       : {row['identificador']}")
    print(f"  Nombre   : {row['nombre']}")
    print(f"  Email    : {row['email']}")
    print(f"  Categoría actual: {row['categoria'] or '(sin categoría)'}")
    print(f"  Nueva categoría : {nueva_cat}")

    confirm = input("\n¿Confirmás el cambio? (s/n): ").strip().lower()
    if confirm != "s":
        print("Cancelado.")
        conn.close()
        return

    cur.execute(
        "UPDATE clientes SET categoria = %s WHERE identificador = %s",
        (nueva_cat, cliente_id)
    )
    conn.commit()
    print(f"\n✓ Categoría del cliente {cliente_id} actualizada a '{nueva_cat}'.")
    conn.close()

if __name__ == "__main__":
    main()
