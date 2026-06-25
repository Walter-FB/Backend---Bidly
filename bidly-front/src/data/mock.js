// BIDLY — demo data used until the Spring Boot endpoints are wired.
// Replace these with calls from src/api/endpoints.js inside each screen's useEffect.
export const AUCTIONS = [
  { id: 481, title: 'Reloj vintage Omega', cat: 'Relojes · Usado', puja: '12.500', ppl: 18, time: '2h 14m', lead: true },
  { id: 902, title: 'Bicicleta rodado 29', cat: 'Deportes · Usado', puja: '48.000', ppl: 7, time: '5h 02m', lead: false },
  { id: 773, title: 'Cuadro óleo 1962', cat: 'Arte · Usado', puja: '3.750', ppl: 11, time: '1h 38m', lead: false },
  { id: 640, title: 'Auriculares Sony WH', cat: 'Audio · Nuevo', puja: '21.300', ppl: 24, time: '0h 46m', lead: true },
];

export const NOTIFICATIONS = [
  { t: 'Te superaron en una puja', d: 'Reloj vintage Omega · puja máxima $ 13.250', a: 'Hace 4 min', unread: true },
  { t: 'Subasta finalizada', d: 'Cuadro óleo firmado · ganó @maria.luna', a: 'Hace 1 h', unread: true },
  { t: '¡Ganaste una subasta!', d: 'Auriculares Sony — pagá en 48 hs', a: 'Hace 3 h', unread: true },
  { t: 'Pago confirmado', d: 'Reloj Omega · recibo 0024-00001182', a: 'Ayer', unread: false },
  { t: 'Tu producto fue aprobado', d: 'Bicicleta rodado 29 ya está publicada', a: 'Ayer', unread: false },
];

export const PURCHASES = [
  { title: 'Reloj Omega', date: 'Pagado · 20/05/2026', price: '13.750', tag: 'Entregado', tagColor: '#3a8fd6' },
  { title: 'Cuadro óleo 1962', date: 'Pagado · 16/05/2026', price: '3.750', tag: 'Entregado', tagColor: '#3a8fd6' },
  { title: 'Auriculares Sony WH', date: 'A pagar · vence en 32 hs', price: '21.300', tag: 'Pendiente', tagColor: '#e89a3c' },
];

export const HISTORY = [
  { title: 'Reloj vintage Omega', date: '26/05/2026', sub: 'Subasta #481', price: '13.750', tag: 'Ganada', tagColor: '#37d66f' },
  { title: 'Bicicleta rodado 29', date: '22/05/2026', sub: 'Subasta #463', price: '48.000', tag: 'Perdida', tagColor: '#8a93ab' },
  { title: 'Cuadro óleo 1962', date: '16/05/2026', sub: 'Subasta #452', price: '3.750', tag: 'Ganada', tagColor: '#37d66f' },
];

export const CLAIMS = [
  { t: '#1182 · Producto dañado', u: '@juan.perez', s: 'Abierto', c: '#e23950' },
  { t: '#1174 · No recibido', u: '@mluna', s: 'En revisión', c: '#e89a3c' },
  { t: '#1169 · Reembolso', u: '@postor_47', s: 'Resuelto', c: '#37d66f' },
];
