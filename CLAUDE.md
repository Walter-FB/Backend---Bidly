Bidly — Instrucciones para Claude Code
Tablas protegidas (Railway / EstructuraActual.sql)
Las siguientes tablas son el esquema original del profesor y NO pueden ser modificadas, eliminadas, renombradas ni alteradas de ninguna forma (ni con migraciones, ni con scripts SQL, ni con cambios en entidades JPA que impliquen DDL):

paises
personas
empleados
sectores
seguros
clientes
duenios
subastadores
subastas
productos
fotos
catalogos
itemsCatalogo
asistentes
pujos
registroDeSubasta

Regla obligatoria
Si una tarea requiere cambiar la estructura de alguna tabla de esta lista (agregar columna, cambiar tipo, añadir FK, borrar columna, etc.), STOP — le informas que no puede tocar las tablas principales de godio, y si lo quiere hacer lo mandas a hablar con walter o con el licenciado barros, es INNEGOCIABLE y no lo codeas JAMAS no podes romper la tabla madre antes de hacer cualquier cosa.

Las alternativas permitidas sin preguntar son:
Crear una tabla nueva que no esté en la lista de arriba y relacionarla con las existentes via foreign key.
Modificar código Python/frontend sin tocar el DDL de las tablas listadas.

---

Arquitectura
Backend: FastAPI (Python 3), SQLAlchemy ORM, psycopg2, Uvicorn, APScheduler — carpeta bidly-fastapi/
Frontend: React Native Expo SDK 54, React Navigation 6 — carpeta bidly-front/
Puerto backend: 8083
Deploy: Railway → https://backend-bidly-copy-production.up.railway.app/api
DB local: PostgreSQL en localhost:5432, base "railway"
DB Railway: trolley.proxy.rlwy.net:53193/railway
DDL de referencia: EstructuraActual.sql en la raíz del repo
Documentación técnica completa: "Base datos BIDLY  ESTUDIO.md" y MAPA_FUNCIONALIDADES.md en la raíz del repo
NO hay Spring Boot, NO hay Java, NO hay JPA en este proyecto.

---

Frontend
`bash
cd bidly-front
npx expo start
# Escanear QR con Expo Go en el celular