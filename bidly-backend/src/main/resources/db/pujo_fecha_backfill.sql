-- One-shot: backfill pujo_fecha para pujos sin registro de timestamp.
-- No modifica tablas protegidas del esquema original.

INSERT INTO pujo_fecha (pujo, fechahora)
SELECT p.identificador,
       COALESCE((s.fecha + s.hora)::timestamp, CURRENT_TIMESTAMP)
FROM pujos p
JOIN itemscatalogo ic ON ic.identificador = p.item
JOIN catalogos c ON c.identificador = ic.catalogo
JOIN subastas s ON s.identificador = c.subasta
WHERE NOT EXISTS (
    SELECT 1 FROM pujo_fecha pf WHERE pf.pujo = p.identificador
);
