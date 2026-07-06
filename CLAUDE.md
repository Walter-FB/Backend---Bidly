# Bidly — Instrucciones para Claude Code

## Eje central: `EstructuraActual.sql`
La DDL del profe (16 tablas) es el **eje central**. El sistema está alineado a ese
esquema; las tablas propias son las mínimas que la consigna necesita y NO están en
la DDL. Prioridad de decisiones: **consigna del profe + `EstructuraActual.sql`**.

## Tablas (31 en total). Cada una con utilidad real.

### Las 16 del profe (protegidas — NO se tocan: nada de ALTER/DROP/rename ni FK)
`paises, personas, empleados, sectores, seguros, clientes, duenios, subastadores,
subastas, productos, fotos, catalogos, itemsCatalogo, asistentes, pujos, registroDeSubasta`.
`subastas.estado` = 'abierta' | 'cerrada' (estado directo del profe). El "en vivo" con
reloj se maneja en la tabla propia `item_remate` (ver Features), sin tocar `subastas`.

### Auth (2 tablas propias — el profe no tiene login)
- `credenciales`: email + password del cliente.
- `usuario_rol`: `postor` (default) o `subastador` (staff interno de Bidly).

### SPEC (1 tabla propia)
- `producto_estado`: estado técnico del bien (`solicitado/en_inspeccion/aceptado/rechazado`
  + causa). Se mantiene en sync con `admisiones` y con `productos.disponible`.

### Features de la consigna (12 tablas propias)
- `mediosdepago`: medio de pago del postor con **presupuesto** en pesos (`limite`=original,
  `saldo`=restante). `tipo` = `debito` (default 100k) | `credito` (default 200k) | `cuenta`
  (monto que elige el usuario) | `cheque` certificado (monto que elige el usuario). El cheque
  nace `verificado='no'` (se valida en /admin); cuenta/tarjetas se validan solas.
- `multas`: multa 10% por impago (bloquea participación).
- `subasta_moneda`: **moneda de la subasta** (pesos | dólares). Conversión demo dólar=$1500
  (`services/moneda_service.py`); los presupuestos siempre en pesos.
- `admisiones`: tasación interna (solicitar → inspección → propuesta → aceptación del dueño).
  Incluye **colecciones** (`es_coleccion`, `nombre_coleccion`) y **Cobertura Premium Bidly**
  (`garantia_premium`: +5% del valor base, se descuenta del cobro del dueño).
- `cuentas_duenio`: cuenta a la vista del dueño (puede ser del exterior).
- `payouts`: cobro al dueño (neto = venta − comisión − `premium`).
- `notificaciones`: mensajes al usuario (ganaste, multa, admisión, seguro, cobro, categoría…).
- `registro_pago`: pago del comprador (medio, envío, retiro personal).
- `reembolsos`: reembolso de una compra.
- `ubicaciones_bien`: depósito/sector donde está guardada la pieza (visible al dueño).
- `item_remate`: **timer del remate** (item + `termina_en`). 3 min por ítem, +1 min por puja.
- `subasta_venta_modo`: **modo de venta del catálogo** — `individual` (default, pieza por pieza)
  | `bloque` (única venta: se rematan todas las piezas juntas a un único precio, el mejor postor
  se lleva todo, importe prorrateado por base). Sin fila = individual. Se elige en el panel web.

> **Regla:** si una tarea pide tocar la estructura de una de las 16 del profe → STOP,
> no se codea. Se puede crear tabla nueva (fuera de las 16) + FK, o cambiar código.

## ⚠️ Decisiones recientes — NO revertir (leer antes de tocar estas áreas)
Estas cosas ya se decidieron/arreglaron con el usuario. Revertirlas = reabrir bugs que ya odió.

1. **Regla "subastas con ≥10 días de anticipación": ELIMINADA.** El usuario la sacó a propósito.
   NO reponer el check en `routers/admisiones.py` (/proponer) ni las validaciones JS del panel
   (`admin_web.py`). El `chkFecha` de `EstructuraActual.sql` es **SQL Server / doc de referencia**,
   nunca aplicó al Postgres real (lo verifiqué: la tabla `subastas` no tiene CHECK de fecha).
2. **El precio base es PÚBLICO.** `/subastas/{id}/catalogos`, `/subastas/{id}/catalogo` y
   `/catalogos/{id}/items` devuelven el precio a todos. **NO re-gatear** con
   `mostrar_precio = current is not None`. Motivo: el token vive en un dict EN MEMORIA
   (`auth.py _token_store`) que Railway borra al reiniciar → el gate ocultaba el precio a
   usuarios ya logueados (salía "$0"/"—" en detalle/vivo pero sí en Home, que usa `enrich`).
3. **Fechas de subasta se comparan en hora AR (UTC-3), no UTC.** `subasta_service._ahora_ar()`.
   El backend corre en UTC (Railway); comparar el inicio contra `datetime.utcnow()` abría las
   subastas ~3h antes. `enrich` expone `segundosParaInicio` (hora AR) y el Home muestra un
   banner-canario si back/front difieren >2min (zona horaria mal alineada).
4. **Montos en `numeric(18,2)`** (no 12,2) en `registro_pago.importe_total/envio` y
   `multas.importe` — antes desbordaban al cerrar una subasta con puja grande
   (`NumericValueOutOfRange` → 500 → subasta clavada "en vivo"). `db_reconcile.py` ya lo aplica.
   Son tablas propias (features); NO se tocó ninguna de las 16 del profe.
5. **Entrar a MIRAR una subasta es libre.** `acceso_service.validar_inscripcion` (corre al
   inscribirse) NO bloquea `YA_CONECTADO` — ese límite ("una a la vez") es de PUJAR y vive en
   `routers/pujas.py`. `SUBASTA_EN_CURSO` (aceptar propuesta / armar colección) solo bloquea si
   el remate YA vendió alguna pieza (`subastado='si'`), no por estar `'abierta'` sin más.
6. **Avance del remate en vivo** (front `SubastaEnVivoScreen`): usa `itemActivoId` de
   `GET /subastas/{id}/remate` como fuente de verdad para pasar al siguiente ítem — avanza
   **aunque el ítem cierre sin pujas** (la empresa lo compra, no hay puja ganadora). NO volver a
   depender solo de detectar la puja ganadora.

> **Gotcha del token:** si un dato aparece en Home pero NO en el detalle/vivo (solo para
> logueados), sospechá del token vencido (Railway reinició → `_token_store` vacío), NO de la DB.

## Reglas de negocio implementadas
- **Puja**: mín = mejor + 1% base; máx = mejor + 20% base; **oro/platino** sin tope máximo.
  Una puja por vez (commit). Gates: subasta `abierta` + categoría(subasta) ≤ categoría(postor)
  + **medio de pago verificado** + sin multa impaga.
- **Presupuesto de medios**: cada medio tiene un tope en pesos que se gasta al pagar.
  **Cheque y cuenta** se validan EN LA PUJA (no podés pujar por más que su monto); el medio
  elegido debe estar validado. **Crédito y débito** NO se validan al pujar → se chequean y
  descuentan al **pagar** (`services/saldo_service.py`, `routers/registro.py`).
- **Categorías** (solo suben, `services/categoria_service.py`): combina actividad + medios.
  3+ medios → **oro**; 3+ medios y ≥1 puja ganada → **platino**; cada 2 subastas ganadas sube
  un escalón. Notifica el ascenso.
- **Moneda**: en dólares se paga en dólares (el cheque no vale para dólares). Conversión demo
  a $1500 para comparar contra el presupuesto (en pesos).
- **Timer del remate** (`services/remate_service.py`, `item_remate`): el catálogo se remata de
  a un ítem por vez. Al abrir la subasta arranca el ítem 1 (3 min); cada puja suma 1 min; al
  llegar a 0 se **adjudica solo** y arranca el siguiente. Sin cron: el reloj avanza "lazy" en
  cada `GET /subastas/{id}/remate` (el front lo poll-ea) o al entrar una puja.
- **Admisiones**: la empresa propone base+comisión+subasta → el dueño acepta (entra al
  catálogo + se contrata seguro; puede sumar **Cobertura Premium Bidly** +5%) o rechaza.
- **Colección**: un solo dueño (lleva su nombre; el seguro tiene un único beneficiario).
- **Seguro / ubicación**: al aceptar, el bien se asegura según el valor base y se guarda en un
  depósito; el dueño ve póliza + depósito desde la app. Premium → póliza reforzada (base +5%).
- **Cierre de subasta**: mejor postor gana → `registroDeSubasta` + payout al dueño +
  notificación; si nadie pujó, la empresa compra a base. (También cierra a mano el subastador.)
- **Impago**: multa 10% + bloqueo + 72hs; si no cumple, derivado a la justicia.

## Roles y visibilidad (importante)
- **postor / dueño (usuario normal):** registro, medios de pago, ver/pujar subastas,
  publicar bienes, ver estado de sus publicaciones (aceptar/rechazar propuesta), pagar,
  cobrar, métricas. **NO ve nada del panel interno.**
- **subastador (interno Bidly):** panel web `/admin` con tabs — Admisiones (tasar), Postores
  (verificar + categoría + admitir), Subastas (crear/abrir/cerrar/adjudicar), **Cheques**
  (validar cheques cargados), Reembolsos, Multas.

## Arquitectura
- Backend: FastAPI + SQLAlchemy + psycopg2 — `bidly-fastapi/` · puerto 8083.
- Frontend: React Native Expo — `bidly-front/`.
- DB: Postgres en Railway. La conexión sale de `DATABASE_URL` (o `PG*`) por variable de entorno.

## Scripts (todos leen `DATABASE_URL` del entorno)
- `bidly-fastapi/db_reconcile.py` — deja la base con las 30 tablas (crea las de features
  + producto_estado, aplica ALTERs de columnas nuevas, backfillea moneda, dropea lo que
  sobre). Idempotente. **Correr tras cambios de esquema.**
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
- **DB ya migrada y en producción** (Railway auto-deploya desde la rama `SOBRADO` al pushear).
  Tras CUALQUIER cambio de esquema: correr `db_reconcile.py` (ya incluye `limite`,
  `garantia_premium`, `premium`, `item_remate`, `ubicaciones_bien`, `subasta_venta_modo` y el
  ensanche de montos a `numeric(18,2)`) y esperar el redeploy. Los fixes de backend (precio
  público, hora AR, gates) necesitan el redeploy para verse; el front toma los cambios al recargar.
- Features de la consigna NO modeladas (fuera de alcance pedido): detalle de obra de arte
  (`producto_detalle`), póliza combinada, streaming (la consigna dice que no es parte),
  DNI frente/dorso (la pantalla existe pero no sube la foto).
- Ya implementado: ubicación en depósito (`ubicaciones_bien`), aumento de póliza / cobertura
  premium (`admisiones.garantia_premium`), timer del remate (`item_remate`).

NO hay Spring Boot, NO hay Java, NO hay JPA.
