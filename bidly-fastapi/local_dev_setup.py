"""
Setup de entorno LOCAL de pruebas (NO usar en producción).
Crea el esquema a partir de los modelos SQLAlchemy y carga datos demo
equivalentes a seed_demo.sql, usando los nombres de tabla/columna reales
de los modelos (evita los desajustes del seed .sql).

Uso:
    set DATABASE_URL=postgresql+psycopg2://postgres:bidly@localhost:5544/railway
    python local_dev_setup.py
"""
import os
from datetime import date, timedelta, time

# La URL se toma de DATABASE_URL (config.py ya la resuelve).
from sqlalchemy import Table, Column, Integer, String
from app.database import Base, engine, SessionLocal
import app.models  # registra todos los modelos en Base.metadata

# La tabla 'sectores' es referenciada por empleados.sector pero no tiene modelo.
if "sectores" not in Base.metadata.tables:
    Table(
        "sectores", Base.metadata,
        Column("identificador", Integer, primary_key=True),
        Column("nombresector", String),
    )

from app.models.persona import Persona
from app.models.empleado import Empleado
from app.models.cliente import Cliente
from app.models.credencial import Credencial
from app.models.usuario_rol import UsuarioRol
from app.models.subastador import Subastador
from app.models.subasta import Subasta
from app.models.subasta_moneda import SubastaMoneda
from app.models.duenio import Duenio
from app.models.producto import Producto
from app.models.catalogo import Catalogo
from app.models.item_catalogo import ItemCatalogo
from app.models.medio_pago import MedioPago


def main():
    print(">> Creando esquema...")
    Base.metadata.create_all(engine)
    db = SessionLocal()
    try:
        if db.query(Credencial).filter(Credencial.email == "c1@bidly.demo").first():
            print(">> El seed demo ya existe. Nada que hacer.")
            return

        # Empleado sistema (id=1) requerido por FKs verificador/revisor/responsable
        psis = Persona(nombre="Sistema", documento="00000000", direccion="-", estado="activo")
        db.add(psis); db.flush()
        emp = Empleado(identificador=psis.identificador, cargo="Sistema")
        db.add(emp); db.flush()
        emp_id = emp.identificador

        def nueva_persona(nombre, doc, dir):
            p = Persona(nombre=nombre, documento=doc, direccion=dir, estado="activo")
            db.add(p); db.flush()
            return p

        p1 = nueva_persona("Demo Cliente Uno", "11111111", "Corrientes 1000 CABA")
        p2 = nueva_persona("Demo Cliente Dos", "22222222", "Florida 200 CABA")
        p3 = nueva_persona("Demo Sin Pago", "33333333", "Rivadavia 300 CABA")
        padm = nueva_persona("Demo Admin", "55555555", "Admin 500 CABA")
        psub = nueva_persona("Demo Subastador", "44444444", "Libertador 400 CABA")

        for p in (p1, p2, p3, padm):
            db.add(Cliente(identificador=p.identificador, admitido="si",
                           categoria="comun", verificador=emp_id, numeropais=1))
        db.flush()

        db.add(Credencial(cliente=p1.identificador, email="c1@bidly.demo", passwordhash="demo1234"))
        db.add(Credencial(cliente=p2.identificador, email="c2@bidly.demo", passwordhash="demo1234"))
        db.add(Credencial(cliente=p3.identificador, email="c3@bidly.demo", passwordhash="demo1234"))
        db.add(Credencial(cliente=padm.identificador, email="admin@bidly.demo", passwordhash="demo1234"))

        db.add(UsuarioRol(cliente=p1.identificador, rol="postor"))
        db.add(UsuarioRol(cliente=p2.identificador, rol="postor"))
        db.add(UsuarioRol(cliente=p3.identificador, rol="postor"))
        db.add(UsuarioRol(cliente=padm.identificador, rol="admin"))

        db.add(Subastador(identificador=psub.identificador, matricula="MAT-DEMO-001", region="CABA"))
        db.flush()

        fecha_ok = date.today() + timedelta(days=1)
        sub_a = Subasta(fecha=fecha_ok, hora=time(19, 0), estado="abierta",
                        subastador=psub.identificador, ubicacion="Buenos Aires", categoria="comun")
        sub_b = Subasta(fecha=fecha_ok, hora=time(20, 0), estado="abierta",
                        subastador=psub.identificador, ubicacion="Buenos Aires", categoria="oro")
        db.add(sub_a); db.add(sub_b); db.flush()

        db.add(SubastaMoneda(subasta=sub_a.identificador, moneda="pesos"))
        db.add(SubastaMoneda(subasta=sub_b.identificador, moneda="pesos"))

        db.add(Duenio(identificador=p1.identificador, numeropais=1,
                      verificacionfinanciera="no", verificacionjudicial="no",
                      calificacionriesgo=3, verificador=emp_id))
        db.flush()

        prod_a = Producto(disponible="si", descripcioncatalogo="Laptop Gaming QA Demo",
                          descripcioncompleta="Laptop para demo circuito de puja comun",
                          revisor=emp_id, duenio=p1.identificador)
        prod_b = Producto(disponible="si", descripcioncatalogo="Smartwatch Oro QA Demo",
                          descripcioncompleta="Smartwatch para demo subasta oro",
                          revisor=emp_id, duenio=p1.identificador)
        db.add(prod_a); db.add(prod_b); db.flush()

        cat_a = Catalogo(descripcion="Catálogo Demo Subasta A", subasta=sub_a.identificador, responsable=emp_id)
        cat_b = Catalogo(descripcion="Catálogo Demo Subasta B", subasta=sub_b.identificador, responsable=emp_id)
        db.add(cat_a); db.add(cat_b); db.flush()

        db.add(ItemCatalogo(catalogo=cat_a.identificador, producto=prod_a.identificador,
                            preciobase=10000, comision=100, subastado="no"))
        db.add(ItemCatalogo(catalogo=cat_b.identificador, producto=prod_b.identificador,
                            preciobase=10000, comision=100, subastado="no"))

        db.add(MedioPago(cliente=p1.identificador, tipo="tarjeta", verificado="si"))
        db.add(MedioPago(cliente=p2.identificador, tipo="tarjeta", verificado="si"))

        db.commit()
        print(">> Seed demo cargado OK")
        print("   c1@bidly.demo / demo1234  (medio de pago)")
        print("   c2@bidly.demo / demo1234  (medio de pago)")
        print("   c3@bidly.demo / demo1234  (SIN medio de pago)")
        print("   admin@bidly.demo / demo1234  (rol admin)")
        print(f"   Subasta A (comun) id={sub_a.identificador}, Subasta B (oro) id={sub_b.identificador}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
