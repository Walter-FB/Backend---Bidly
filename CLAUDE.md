# Bidly — Instrucciones para Claude Code

## Eje central: `EstructuraActual.sql`
La DDL del profe (16 tablas) es el **eje central**. El sistema está alineado a ese
esquema; las tablas propias son las mínimas que la consigna necesita y NO están en
la DDL. Prioridad de decisiones: **consigna del profe + `EstructuraActual.sql`**.

## Tablas (28 en total). Cada una con utilidad real.

### Las 16 del profe (protegidas — NO se tocan: nada de ALTER/DROP/rename ni FK)
`paises, personas, empleados, sectores, seguros, clientes, duenios, subastadores,
subastas, productos, fotos, catalogos, itemsCatalogo, asistentes, pujos, registroDeSubasta`.
`subastas.estado` = 'abierta' | 'cerrada' (así maneja el estado el profe: sin sesión en vivo).

### Auth (2 tablas propias — el profe no tiene login)
- `credenciales`: email + password del cliente.
- `usuario_rol`: `postor` (default) o `subastador` (staff interno de Bidly).

### SPEC (1 tabla propia)
- `producto_estado`: estado técnico del bien (`solicitado/en_inspeccion/aceptado/rechazado`
  + causa). Se mantiene en sync con `admisiones` y con `productos.disponible`.

### Features de la consigna (9 tablas propias)
- `mediosdepago`: tarjeta / cuenta / **cheque certificado** del postor (con saldo/monto).
- `multas`: multa 10% por impago (bloquea participación).
- `subasta_moneda`: **moneda de la subasta** (pesos | dólares).
- `admisiones`: tasación interna (solicitar → inspección → propuesta → aceptación del dueño). Incluye **colecciones** (`es_coleccion`, `nombre_coleccion`).
- `cuentas_duenio`: cuenta a la vista del dueño (puede ser del exterior).
- `payouts`: cobro al dueño (neto = venta − comisión).
- `notificaciones`: mensajes al usuario (ganaste, multa, admisión, seguro, cobro…).
- `registro_pago`: pago del comprador (medio, envío, retiro personal).
- `reembolsos`: reembolso de una compra.

> **Regla:** si una tarea pide tocar la estructura de una de las 16 del profe → STOP,
> no se codea. Se puede crear tabla nueva (fuera de las 16) + FK, o cambiar código.

## Reglas de negocio implementadas
- **Puja**: mín = mejor + 1% base; máx = mejor + 20% base; **oro/platino** sin tope máximo.
  Una puja por vez (commit). Gates: subasta `abierta` + categoría(subasta) ≤ categoría(postor)
  + **medio de pago verificado** + sin multa impaga + límite de saldo (cheque).
- **Moneda**: en dólares se paga en dólares (el cheque no vale para dólares).
- **Admisiones**: la empresa propone base+comisión+subasta → el dueño acepta (entra al
  catálogo + se contrata seguro) o rechaza (devolución con gastos).
- **Colección**: un solo dueño (lleva su nombre; el seguro tiene un único beneficiario).
- **Cierre de subasta**: mejor postor gana → `registroDeSubasta` + payout al dueño +
  notificación; si nadie pujó, la empresa compra a base.
- **Impago**: multa 10% + bloqueo + 72hs; si no cumple, derivado a la justicia.

## Roles y visibilidad (importante)
- **postor / dueño (usuario normal):** registro, medios de pago, ver/pujar subastas,
  publicar bienes, ver estado de sus publicaciones (aceptar/rechazar propuesta), pagar,
  cobrar, métricas. **NO ve nada del panel interno.**
- **subastador (interno Bidly):** panel con 3 tabs — Admisiones (tasar), Postores
  (verificar + categoría + admitir), Subastas (crear/abrir/cerrar/adjudicar).

## Arquitectura
- Backend: FastAPI + SQLAlchemy + psycopg2 — `bidly-fastapi/` · puerto 8083.
- Frontend: React Native Expo — `bidly-front/`.
- DB: Postgres en Railway. La conexión sale de `DATABASE_URL` (o `PG*`) por variable de entorno.

## Scripts (todos leen `DATABASE_URL` del entorno)
- `bidly-fastapi/db_reconcile.py` — deja la base con las 28 tablas (crea las de features
  + producto_estado, backfillea moneda, dropea lo que sobre). Idempotente.
- `bidly-fastapi/db_reset_to_spec.py` — versión mínima (solo profe + auth + producto_estado).
- `inspect_subastas.py` — diagnóstico/borrado de subastas.

## Cómo probar
- Backend local: `cd bidly-fastapi && DATABASE_URL=... uvicorn app.main:app --port 8083`.
- Front: `cd bidly-front && npx expo start` (apunta a Railway por defecto; para local, `app.json` → `expo.extra.apiBaseUrl`).
- Login: hay cuentas seed en `credenciales` (postor y subastador). Registro nuevo: sin
  `BREVO_API_KEY`, el código de verificación se imprime en los logs del backend (`[DEV] Código…`).

## PENDIENTES / notas
- [ ] **Rotar la password de la DB** expuesta en el historial y setear `DATABASE_URL`/`PG*`
  como variable de entorno en Railway. (Baja prioridad para el usuario, pero queda anotado.)
- [ ] Passwords de usuarios guardadas en **texto plano** (`credenciales.passwordhash`). Para
  entrega de facultad alcanza; si se quiere, hashear.
- [ ] **Redeploy del backend en Railway**: el DDL cambió (28 tablas), así que el backend
  deployado debe correr el código nuevo (redeploy) para que la app en producción funcione.
- Features de la consigna NO modeladas (fuera de alcance pedido): detalle de obra de arte
  (`producto_detalle`), ubicación del bien en depósito (`ubicacion_bien`), póliza combinada /
  aumento con diferencia de premio (parcial), streaming (la consigna dice que no es parte),
  DNI frente/dorso (la pantalla existe pero no sube la foto).

NO hay Spring Boot, NO hay Java, NO hay JPA.
