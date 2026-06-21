# Bidly — Instrucciones para Claude Code

## Tablas protegidas (Railway / EstructuraActual.sql)

Las siguientes tablas son el esquema original del profesor y **NO pueden ser modificadas, eliminadas, renombradas ni alteradas de ninguna forma** (ni con migraciones, ni con scripts SQL, ni con cambios en entidades JPA que impliquen DDL):

- `paises`
- `personas`
- `empleados`
- `sectores`
- `seguros`
- `clientes`
- `duenios`
- `subastadores`
- `subastas`
- `productos`
- `fotos`
- `catalogos`
- `itemsCatalogo`
- `asistentes`
- `pujos`
- `registroDeSubasta`

### Regla obligatoria

Si una tarea requiere cambiar la estructura de alguna tabla de esta lista (agregar columna, cambiar tipo, añadir FK, borrar columna, etc.), **STOP — preguntar al usuario cómo quiere proceder** antes de hacer cualquier cosa.

Las alternativas permitidas sin preguntar son:
1. Crear una **tabla nueva** que no esté en la lista de arriba y relacionarla con las existentes via foreign key.
2. Modificar código Java/frontend sin tocar el DDL de las tablas listadas.

## Stack

- **Backend:** Spring Boot 3 (Java), JPA/Hibernate, PostgreSQL (Railway)
- **Frontend:** React Native (Expo)
- **DB DDL de referencia:** `EstructuraActual.sql` en la raíz del repo
