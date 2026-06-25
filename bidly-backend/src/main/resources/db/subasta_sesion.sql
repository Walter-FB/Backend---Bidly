CREATE TABLE IF NOT EXISTS subasta_sesion (
    subasta INT PRIMARY KEY REFERENCES subastas(identificador),
    item_activo INT NOT NULL REFERENCES itemscatalogo(identificador),
    orden_actual INT NOT NULL DEFAULT 1,
    timer_desde TIMESTAMP NOT NULL,
    iniciada_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
