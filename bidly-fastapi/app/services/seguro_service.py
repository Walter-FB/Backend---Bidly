"""Seguro del bien entregado para subasta.

Enunciado: de cada bien recibido para la venta se contrata un seguro en función
del valor base. El dueño puede ver la póliza y el depósito, y aumentar la póliza
pagando la diferencia del premio.

La póliza se guarda en `seguros` (protegida: sólo INSERT/UPDATE de valores, no
DDL) y el nº se referencia desde `productos.seguro`. El depósito va en la tabla
nueva `ubicacion_bien`.
"""
from datetime import datetime
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.seguro import Seguro
from app.models.producto import Producto
from app.models.ubicacion_bien import UbicacionBien

COMPANIA_DEFECTO = "Aseguradora BIDLY S.A."


def contratar_para_producto(producto_id: int, valor_base, db: Session) -> Seguro | None:
    prod = db.query(Producto).filter(Producto.identificador == producto_id).first()
    if not prod:
        return None
    if prod.seguro:  # ya tiene póliza
        return db.query(Seguro).filter(Seguro.nropoliza == prod.seguro).first()

    nropoliza = f"POL-{producto_id}-{int(datetime.utcnow().timestamp())}"
    seguro = Seguro(
        nropoliza=nropoliza,
        compania=COMPANIA_DEFECTO,
        polizacombinada="no",
        importe=Decimal(str(valor_base or 0)) or Decimal("1"),
    )
    db.add(seguro)
    prod.seguro = nropoliza  # UPDATE de valor (no DDL)

    if not db.query(UbicacionBien).filter(UbicacionBien.producto == producto_id).first():
        db.add(UbicacionBien(producto=producto_id, deposito=f"Depósito Central BIDLY · Estante {producto_id}"))
    db.flush()
    return seguro


def contratar_combinada(producto_ids: list, db: Session) -> Seguro:
    """Una sola póliza sobre varias piezas, siempre del mismo dueño (beneficiario)."""
    productos = db.query(Producto).filter(Producto.identificador.in_(producto_ids)).all()
    if len(productos) < 2:
        raise HTTPException(422, detail={"message": "Se necesitan al menos 2 piezas", "code": "POCAS_PIEZAS"})
    duenios = {p.duenio for p in productos}
    if len(duenios) > 1:
        raise HTTPException(422, detail={
            "message": "La póliza combinada debe ser de piezas de un mismo dueño.",
            "code": "DUENIOS_DISTINTOS",
        })

    # Importe combinado = suma de las pólizas individuales existentes (o 0).
    total = Decimal("0")
    for p in productos:
        if p.seguro:
            s = db.query(Seguro).filter(Seguro.nropoliza == p.seguro).first()
            if s and s.importe:
                total += Decimal(str(s.importe))

    nropoliza = f"POLC-{'-'.join(str(p.identificador) for p in productos[:3])}-{int(datetime.utcnow().timestamp())}"
    seguro = Seguro(
        nropoliza=nropoliza,
        compania=COMPANIA_DEFECTO,
        polizacombinada="si",
        importe=total or Decimal("1"),
    )
    db.add(seguro)
    for p in productos:
        p.seguro = nropoliza
    db.flush()
    return seguro


def poliza_de_producto(producto_id: int, db: Session) -> dict:
    prod = db.query(Producto).filter(Producto.identificador == producto_id).first()
    if not prod:
        raise HTTPException(404, "Producto no encontrado")
    seguro = db.query(Seguro).filter(Seguro.nropoliza == prod.seguro).first() if prod.seguro else None
    ubic = db.query(UbicacionBien).filter(UbicacionBien.producto == producto_id).first()
    return {
        "producto": producto_id,
        "deposito": ubic.deposito if ubic else None,
        "poliza": {
            "nroPoliza": seguro.nropoliza,
            "compania": seguro.compania,
            "polizaCombinada": seguro.polizacombinada,
            "importe": float(seguro.importe) if seguro.importe is not None else None,
        } if seguro else None,
    }


def aumentar_poliza(nropoliza: str, nuevo_importe, db: Session) -> dict:
    seguro = db.query(Seguro).filter(Seguro.nropoliza == nropoliza).first()
    if not seguro:
        raise HTTPException(404, "Póliza no encontrada")
    actual = Decimal(str(seguro.importe or 0))
    nuevo = Decimal(str(nuevo_importe))
    if nuevo <= actual:
        raise HTTPException(422, detail={
            "message": f"El nuevo valor debe ser mayor al actual (${actual}).",
            "code": "IMPORTE_INVALIDO",
        })
    diferencia = nuevo - actual
    seguro.importe = nuevo  # UPDATE de valor
    db.flush()
    return {
        "nroPoliza": seguro.nropoliza,
        "importe": float(nuevo),
        "diferenciaPagada": float(diferencia),
    }
