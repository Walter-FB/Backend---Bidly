#!/usr/bin/env python3
"""Ejecuta un .sql contra PostgreSQL (Railway o local). Uso: python run_sql.py archivo.sql"""
import os
import sys

import psycopg2

HOST = os.environ.get("PGHOST", "trolley.proxy.rlwy.net")
PORT = int(os.environ.get("PGPORT", "53193"))
DB = os.environ.get("PGDATABASE", "railway")
USER = os.environ.get("PGUSER", "postgres")
PASSWORD = os.environ.get("PGPASSWORD")
if not PASSWORD:
    print("Falta PGPASSWORD en el entorno", file=sys.stderr)
    sys.exit(1)

path = sys.argv[1] if len(sys.argv) > 1 else None
if not path or not os.path.isfile(path):
    print("Uso: python run_sql.py <archivo.sql>", file=sys.stderr)
    sys.exit(1)

with open(path, encoding="utf-8") as f:
    sql = f.read()

conn = psycopg2.connect(host=HOST, port=PORT, dbname=DB, user=USER, password=PASSWORD)
conn.autocommit = True
try:
    with conn.cursor() as cur:
        cur.execute(sql)
    print(f"OK: {path}")
finally:
    conn.close()
