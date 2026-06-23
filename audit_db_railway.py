#!/usr/bin/env python3
"""
Auditoría de la base PostgreSQL de Bidly (Railway o local).

Uso:
  python audit_db_railway.py
  python audit_db_railway.py --url "postgresql://user:pass@host:port/db"
  DATABASE_URL=postgresql://... python audit_db_railway.py

Solo lectura — no modifica datos.
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from urllib.parse import urlparse

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("Falta psycopg2. Instalá con: pip install psycopg2-binary", file=sys.stderr)
    sys.exit(1)


# Tablas del profesor (EstructuraActual.sql) — nombres en minúsculas como en PG
TABLAS_PROFESOR = {
    "paises",
    "personas",
    "empleados",
    "sectores",
    "seguros",
    "clientes",
    "duenios",
    "subastadores",
    "subastas",
    "productos",
    "fotos",
    "catalogos",
    "itemscatalogo",
    "asistentes",
    "pujos",
    "registrodesubasta",
}

# Tablas propias del equipo (según JPA + DOCUMENTACION.md)
TABLAS_EQUIPO = {
    "credenciales",
    "subasta_moneda",
    "pujo_fecha",
    "reembolsos",
    "mediosdepago",
    "notificaciones",
    "multas",
    "dni_verificacion",
}

TABLAS_ESPERADAS = TABLAS_PROFESOR | TABLAS_EQUIPO

# Alias documentados que podrían existir por error de migración
ALIAS_SOSPECHOSOS = {
    "itemscatalogo": ["itemscatalogo", "items_catalogo"],
    "registrodesubasta": ["registrodesubasta", "registro_de_subasta"],
    "mediosdepago": ["mediosdepago", "medios_pago"],
}


@dataclass
class Hallazgo:
    severidad: str  # OK, INFO, WARN, ERROR
    categoria: str
    mensaje: str


def parse_database_url(url: str) -> dict:
    parsed = urlparse(url)
    if parsed.scheme not in ("postgresql", "postgres"):
        raise ValueError(f"Esquema no soportado: {parsed.scheme}")
    return {
        "host": parsed.hostname,
        "port": parsed.port or 5432,
        "dbname": (parsed.path or "/").lstrip("/"),
        "user": parsed.username,
        "password": parsed.password,
    }


def connect(url: str):
    params = parse_database_url(url)
    return psycopg2.connect(**params)


def qall(cur, sql, params=None):
    cur.execute(sql, params or ())
    return cur.fetchall()


def qone(cur, sql, params=None):
    cur.execute(sql, params or ())
    return cur.fetchone()


def mask_url(url: str) -> str:
    parsed = urlparse(url)
    user = parsed.username or "?"
    host = parsed.hostname or "?"
    port = parsed.port or 5432
    db = (parsed.path or "/").lstrip("/")
    return f"postgresql://{user}:***@{host}:{port}/{db}"


def audit_schema(cur) -> list[Hallazgo]:
    hallazgos: list[Hallazgo] = []

    tablas = {
        r[0]
        for r in qall(
            cur,
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name
            """,
        )
    }

    faltantes = TABLAS_ESPERADAS - tablas
    extras = tablas - TABLAS_ESPERADAS

    for t in sorted(faltantes):
        hallazgos.append(Hallazgo("ERROR", "schema", f"Tabla esperada ausente: {t}"))

    for t in sorted(extras):
        hallazgos.append(Hallazgo("WARN", "schema", f"Tabla no documentada en el repo: {t}"))

    if not faltantes and not extras:
        hallazgos.append(
            Hallazgo("OK", "schema", f"Conjunto de tablas coincide ({len(tablas)} tablas)")
        )

    # Duplicados conceptuales (ej. itemsCatalogo vs itemscatalogo)
    for canon, variantes in ALIAS_SOSPECHOSOS.items():
        presentes = [v for v in variantes if v in tablas]
        if len(presentes) > 1:
            hallazgos.append(
                Hallazgo(
                    "ERROR",
                    "schema",
                    f"Posible duplicado de tabla: {presentes} (debería existir solo '{canon}')",
                )
            )

    return hallazgos, tablas


def audit_columns(cur, tablas: set[str]) -> list[Hallazgo]:
    hallazgos: list[Hallazgo] = []
    rows = qall(
        cur,
        """
        SELECT table_name, column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
        """,
    )
    por_tabla: dict[str, list] = defaultdict(list)
    for row in rows:
        por_tabla[row[0]].append(row)

    for tabla in sorted(tablas & TABLAS_ESPERADAS):
        cols = por_tabla.get(tabla, [])
        if not cols:
            hallazgos.append(Hallazgo("ERROR", "columnas", f"{tabla}: sin columnas"))
            continue
        nombres = [c[1] for c in cols]
        hallazgos.append(
            Hallazgo(
                "INFO",
                "columnas",
                f"{tabla}: {len(cols)} columnas → {', '.join(nombres)}",
            )
        )

    return hallazgos


def audit_fk_orphans(cur) -> list[Hallazgo]:
    """Detecta filas huérfanas para cada FK definida en el catálogo."""
    hallazgos: list[Hallazgo] = []
    fks = qall(
        cur,
        """
        SELECT
            tc.table_name AS child_table,
            kcu.column_name AS child_col,
            ccu.table_name AS parent_table,
            ccu.column_name AS parent_col,
            tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
        ORDER BY child_table, child_col
        """,
    )

    for child_table, child_col, parent_table, parent_col, cname in fks:
        sql = f"""
            SELECT COUNT(*) FROM "{child_table}" c
            LEFT JOIN "{parent_table}" p ON c."{child_col}" = p."{parent_col}"
            WHERE c."{child_col}" IS NOT NULL AND p."{parent_col}" IS NULL
        """
        try:
            count = qone(cur, sql)[0]
        except psycopg2.Error as e:
            hallazgos.append(
                Hallazgo(
                    "WARN",
                    "integridad",
                    f"No se pudo verificar FK {cname}: {e.pgerror or e}",
                )
            )
            cur.connection.rollback()
            continue

        if count > 0:
            hallazgos.append(
                Hallazgo(
                    "ERROR",
                    "integridad",
                    f"FK rota {child_table}.{child_col} → {parent_table}.{parent_col}: "
                    f"{count} huérfano(s) [{cname}]",
                )
            )

    if not any(h.severidad == "ERROR" and h.categoria == "integridad" for h in hallazgos):
        hallazgos.append(
            Hallazgo("OK", "integridad", f"Sin huérfanos en {len(fks)} foreign keys verificadas")
        )

    return hallazgos


def audit_row_counts(cur, tablas: set[str]) -> list[Hallazgo]:
    hallazgos: list[Hallazgo] = []
    for tabla in sorted(tablas):
        try:
            n = qone(cur, f'SELECT COUNT(*) FROM "{tabla}"')[0]
            sev = "INFO"
            if tabla in ("empleados", "paises") and n == 0:
                sev = "ERROR"
            elif n == 0:
                sev = "WARN"
            hallazgos.append(Hallazgo(sev, "conteo", f"{tabla}: {n} fila(s)"))
        except psycopg2.Error as e:
            cur.connection.rollback()
            hallazgos.append(Hallazgo("ERROR", "conteo", f"{tabla}: {e.pgerror or e}"))

    return hallazgos


def audit_sequences(cur) -> list[Hallazgo]:
    hallazgos: list[Hallazgo] = []
    seqs = qall(
        cur,
        """
        SELECT sequencename, last_value
        FROM pg_sequences
        WHERE schemaname = 'public'
        ORDER BY sequencename
        """,
    )
    if not seqs:
        hallazgos.append(Hallazgo("INFO", "secuencias", "No hay secuencias en public"))
        return hallazgos

    for seq_name, last_val in seqs:
        # Intentar inferir tabla/columna desde convención estándar de PG
        base = seq_name.replace("_identificador_seq", "").replace("_seq", "")
        tabla_candidata = base
        try:
            max_id = qone(cur, f'SELECT COALESCE(MAX(identificador), 0) FROM "{tabla_candidata}"')[0]
            if max_id > (last_val or 0):
                hallazgos.append(
                    Hallazgo(
                        "WARN",
                        "secuencias",
                        f"Secuencia {seq_name} last_value={last_val} < MAX(identificador)={max_id} "
                        f"en {tabla_candidata} — próximos INSERT pueden fallar",
                    )
                )
            else:
                hallazgos.append(
                    Hallazgo("OK", "secuencias", f"{seq_name}: last_value={last_val}, max_id={max_id}")
                )
        except psycopg2.Error:
            cur.connection.rollback()
            hallazgos.append(Hallazgo("INFO", "secuencias", f"{seq_name}: last_value={last_val}"))

    return hallazgos


def audit_business_rules(cur) -> list[Hallazgo]:
    """Chequeos de dominio conocidos del proyecto."""
    hallazgos: list[Hallazgo] = []
    checks: list[tuple[str, str, str, bool]] = [
        # name, sql, desc, expect_zero (True = problema si count > 0)
        (
            "empleado_sistema",
            "SELECT COUNT(*) FROM empleados WHERE identificador = 1",
            "EMPLEADO_SISTEMA (identificador=1) debe existir para FKs NOT NULL",
            False,
        ),
        (
            "pais_argentina",
            "SELECT COUNT(*) FROM paises WHERE numero = 1",
            "paises.numero=1 (Argentina) debe existir",
            False,
        ),
        (
            "subastas_estado_invalido",
            """
            SELECT COUNT(*) FROM subastas
            WHERE estado IS NOT NULL
              AND lower(estado) NOT IN ('abierta', 'cerrada', 'carrada')
            """,
            "subastas con estado fuera de abierta/cerrada/carrada",
            True,
        ),
        (
            "clientes_sin_persona",
            """
            SELECT COUNT(*) FROM clientes c
            LEFT JOIN personas p ON c.identificador = p.identificador
            WHERE p.identificador IS NULL
            """,
            "clientes sin fila en personas",
            True,
        ),
        (
            "credenciales_sin_cliente",
            """
            SELECT COUNT(*) FROM credenciales cr
            LEFT JOIN clientes c ON cr.cliente = c.identificador
            WHERE c.identificador IS NULL
            """,
            "credenciales huérfanas de clientes",
            True,
        ),
        (
            "items_precio_invalido",
            "SELECT COUNT(*) FROM itemscatalogo WHERE preciobase <= 0.01 OR comision <= 0.01",
            "itemsCatalogo con precioBase o comision <= 0.01",
            True,
        ),
        (
            "subastas_fecha_chk",
            """
            SELECT COUNT(*) FROM subastas
            WHERE fecha IS NOT NULL AND fecha <= CURRENT_DATE + 10
            """,
            "subastas que violarían chkFecha (fecha <= hoy+10)",
            True,
        ),
        (
            "pujos_ganador_multiple",
            """
            SELECT COUNT(*) FROM (
                SELECT item FROM pujos
                WHERE ganador = 'si'
                GROUP BY item HAVING COUNT(*) > 1
            ) t
            """,
            "ítems con más de un puja ganadora",
            True,
        ),
        (
            "catalogo_sin_subasta",
            "SELECT COUNT(*) FROM catalogos WHERE subasta IS NULL",
            "catálogos sin subasta asignada",
            True,
        ),
        (
            "item_subastado_sin_puja_ganadora",
            """
            SELECT COUNT(*) FROM itemscatalogo ic
            WHERE ic.subastado = 'si'
              AND NOT EXISTS (
                SELECT 1 FROM pujos p WHERE p.item = ic.identificador AND p.ganador = 'si'
              )
            """,
            "ítems marcados subastado=si sin puja ganadora",
            True,
        ),
        (
            "pujos_sin_fecha",
            """
            SELECT COUNT(*) FROM pujos p
            LEFT JOIN pujo_fecha pf ON p.identificador = pf.pujo
            WHERE pf.pujo IS NULL
            """,
            "pujos sin fila en pujo_fecha",
            True,
        ),
        (
            "subastas_abiertas_fecha_vencida",
            """
            SELECT COUNT(*) FROM subastas
            WHERE estado = 'abierta' AND fecha <= CURRENT_DATE + 10
            """,
            "subastas ABIERTAS con fecha que ya no cumple chkFecha",
            True,
        ),
        (
            "subastas_sin_moneda",
            """
            SELECT COUNT(*) FROM subastas s
            LEFT JOIN subasta_moneda sm ON s.identificador = sm.subasta
            WHERE sm.subasta IS NULL
            """,
            "subastas sin fila en subasta_moneda",
            True,
        ),
        (
            "clientes_sin_credencial",
            """
            SELECT COUNT(*) FROM clientes c
            WHERE NOT EXISTS (SELECT 1 FROM credenciales cr WHERE cr.cliente = c.identificador)
            """,
            "clientes registrados sin credencial (no pueden loguearse)",
            True,
        ),
    ]

    for name, sql, desc, expect_zero in checks:
        try:
            result = qone(cur, sql)[0]
            if expect_zero:
                if result and result > 0:
                    sev = "WARN" if name in (
                        "catalogo_sin_subasta",
                        "subastas_fecha_chk",
                        "clientes_sin_credencial",
                        "pujos_sin_fecha",
                    ) else "ERROR"
                    hallazgos.append(Hallazgo(sev, "negocio", f"{desc}: {result}"))
                else:
                    hallazgos.append(Hallazgo("OK", "negocio", f"{desc}: OK"))
            else:
                if result and result > 0:
                    hallazgos.append(Hallazgo("OK", "negocio", f"{desc}: OK"))
                else:
                    hallazgos.append(Hallazgo("ERROR", "negocio", f"{desc}: AUSENTE"))
        except psycopg2.Error as e:
            cur.connection.rollback()
            hallazgos.append(
                Hallazgo("WARN", "negocio", f"No se pudo ejecutar check '{name}': {e.pgerror or e}")
            )

    return hallazgos


def audit_constraints(cur) -> list[Hallazgo]:
    hallazgos: list[Hallazgo] = []
    rows = qall(
        cur,
        """
        SELECT tc.table_name, tc.constraint_type, tc.constraint_name
        FROM information_schema.table_constraints tc
        WHERE tc.table_schema = 'public'
        ORDER BY tc.table_name, tc.constraint_type
        """,
    )
    por_tipo: dict[str, int] = defaultdict(int)
    for _, ctype, _ in rows:
        por_tipo[ctype] += 1

    resumen = ", ".join(f"{k}={v}" for k, v in sorted(por_tipo.items()))
    hallazgos.append(Hallazgo("INFO", "constraints", f"Constraints en public: {resumen}"))

    # Listar CHECK constraints de subastas (estado/fecha son críticos)
    checks = qall(
        cur,
        """
        SELECT conrelid::regclass::text, conname, pg_get_constraintdef(oid)
        FROM pg_constraint
        WHERE contype = 'c'
          AND connamespace = 'public'::regnamespace
        ORDER BY 1, 2
        """,
    )
    for tabla, cname, defin in checks:
        if "subastas" in tabla or "itemscatalogo" in tabla or "pujos" in tabla:
            hallazgos.append(Hallazgo("INFO", "constraints", f"{tabla}.{cname}: {defin}"))

    return hallazgos


def audit_indexes(cur) -> list[Hallazgo]:
    hallazgos: list[Hallazgo] = []
    rows = qall(
        cur,
        """
        SELECT tablename, indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
        ORDER BY tablename, indexname
        """,
    )
    hallazgos.append(Hallazgo("INFO", "indices", f"{len(rows)} índices en public"))
    for tabla, idx, defin in rows:
        if "unique" in defin.lower() or "credenciales" in tabla or "email" in defin.lower():
            hallazgos.append(Hallazgo("INFO", "indices", f"{tabla}.{idx}: {defin}"))
    return hallazgos


def print_report(url: str, hallazgos: list[Hallazgo]) -> int:
    icon = {"OK": "[OK]", "INFO": "[i]", "WARN": "[!]", "ERROR": "[X]"}
    orden = {"ERROR": 0, "WARN": 1, "OK": 2, "INFO": 3}

    print("=" * 72)
    print("BIDLY — Auditoría de base de datos PostgreSQL")
    print(f"Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Target: {mask_url(url)}")
    print("=" * 72)

    por_cat: dict[str, list[Hallazgo]] = defaultdict(list)
    for h in hallazgos:
        por_cat[h.categoria].append(h)

    for categoria in [
        "schema",
        "columnas",
        "conteo",
        "integridad",
        "secuencias",
        "negocio",
        "constraints",
        "indices",
    ]:
        items = por_cat.get(categoria, [])
        if not items:
            continue
        print(f"\n-- {categoria.upper()} " + "-" * (65 - len(categoria)))
        for h in sorted(items, key=lambda x: (orden[x.severidad], x.mensaje)):
            print(f"  [{icon[h.severidad]} {h.severidad:5}] {h.mensaje}")

    errores = sum(1 for h in hallazgos if h.severidad == "ERROR")
    warns = sum(1 for h in hallazgos if h.severidad == "WARN")
    print("\n" + "=" * 72)
    print(f"Resumen: {errores} error(es), {warns} advertencia(s)")
    print("=" * 72)
    return 1 if errores else 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Auditoría read-only de la DB Bidly")
    parser.add_argument(
        "--url",
        default=os.environ.get("DATABASE_URL"),
        help="URL postgresql://user:pass@host:port/db (o env DATABASE_URL)",
    )
    args = parser.parse_args()

    if not args.url:
        print(
            "Pasá --url o definí DATABASE_URL.\n"
            'Ej: python audit_db_railway.py --url "postgresql://..."',
            file=sys.stderr,
        )
        return 2

    try:
        conn = connect(args.url)
    except Exception as e:
        print(f"No se pudo conectar: {e}", file=sys.stderr)
        return 2

    hallazgos: list[Hallazgo] = []
    try:
        with conn.cursor() as cur:
            schema_h, tablas = audit_schema(cur)
            hallazgos.extend(schema_h)
            hallazgos.extend(audit_columns(cur, tablas))
            hallazgos.extend(audit_row_counts(cur, tablas))
            hallazgos.extend(audit_fk_orphans(cur))
            hallazgos.extend(audit_sequences(cur))
            hallazgos.extend(audit_business_rules(cur))
            hallazgos.extend(audit_constraints(cur))
            hallazgos.extend(audit_indexes(cur))
    finally:
        conn.close()

    return print_report(args.url, hallazgos)


if __name__ == "__main__":
    sys.exit(main())
