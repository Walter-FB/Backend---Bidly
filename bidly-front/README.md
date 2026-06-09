# BIDLY — App de subastas (React Native + Expo)

Front-end completo de las 24 pantallas, listo para conectar a tu backend **Spring Boot**.

## Stack
- **Expo (managed)** + React Native 0.74
- **React Navigation**: native-stack (flujos) + bottom-tabs (Home / Historial / Subastas / Perfil + FAB Publicar)
- **JWT en AsyncStorage** (`src/api/client.js`)
- **Capa de servicios con `fetch`** (`src/api/endpoints.js`)
- Fuente de títulos: **Archivo Black** (Google Fonts, vía `@expo-google-fonts/archivo-black`)

## Cómo correr
```bash
cd bidly-front
npm install
npm start         # luego escaneá el QR con Expo Go, o presioná 'a' / 'i'
```

## Conexión a Spring Boot
1. Configurá la URL base del backend en **`app.json`** → `expo.extra.apiBaseUrl`
   (o editá `BASE_URL` en `src/api/client.js`).
   - Emulador Android → `http://10.0.2.2:8080/api`
   - Simulador iOS → `http://localhost:8080/api`
   - Dispositivo físico → `http://<IP-de-tu-PC>:8080/api`
2. Todos los endpoints están centralizados en **`src/api/endpoints.js`**. Ajustá los paths
   para que coincidan con tus `@RequestMapping`/`@GetMapping` de Spring.
3. El token JWT se guarda automáticamente al hacer login/registro y se envía en
   `Authorization: Bearer <token>` en cada request autenticado.

### Mapa de botones → endpoints
| Pantalla | Acción | Servicio |
|---|---|---|
| Login | Ingresar | `Auth.login(email, pass)` |
| Registro 2 | Crear cuenta | `Auth.register(payload)` |
| Home / Filtros | Listar subastas | `Auctions.list(params)` |
| Producto | Ver detalle | `Auctions.get(id)` |
| Subasta en vivo | Pujar | `Auctions.placeBid(id, amount)` |
| Medio de pago | Tarjetas | `Payments.methods()` / `addMethod()` |
| Seguro | Cotizar/contratar | `Insurance.quote()` / `contract()` |
| Confirmar pago | Pagar | `Payments.pay(payload)` |
| Multa | Pagar multa | `Payments.payFine(id, methodId)` |
| Reembolso | Solicitar | `Payments.refund(orderId, reason)` |
| Publicar | Publicar/borrador | `Auctions.create()` / `saveDraft()` |
| Datos del ganador | Marcar entregado | `Auctions.markDelivered(id)` |
| Dashboard admin | Métricas/reclamos | `Admin.dashboard()` / `claims()` |

> Las pantallas hoy renderizan con datos de ejemplo (`src/data/mock.js`).
> Reemplazá esos datos por llamadas a `endpoints.js` dentro de un `useEffect`/handler.
> Ejemplo en `HomeScreen`:
> ```js
> useEffect(() => { Auctions.list({ status: 'LIVE' }).then(setItems).catch(console.warn); }, []);
> ```

## Roles
El **Dashboard admin** sólo aparece si el usuario tiene rol `ADMIN`
(`user.role === 'ADMIN'` o `user.roles.includes('ADMIN')`), gateado en
`src/navigation/RootNavigator.js`.

## Estructura
```
bidly-front/
├── App.js                      # fuentes + providers + navegación
├── app.json                    # apiBaseUrl en expo.extra
└── src/
    ├── api/
    │   ├── client.js           # fetch + JWT (AsyncStorage)
    │   └── endpoints.js        # capa de servicios (Auth, Auctions, Payments…)
    ├── context/AuthContext.js  # sesión + rol
    ├── navigation/
    │   ├── RootNavigator.js    # stack + auth/role gate
    │   └── TabNavigator.js     # bottom tabs + FAB
    ├── components/ui.js         # UI kit (Btn, Card, Chip, Field…)
    ├── theme/theme.js          # colores, radios, fuentes
    ├── data/mock.js            # datos demo (reemplazar por API)
    └── screens/                # las 24 pantallas
```
