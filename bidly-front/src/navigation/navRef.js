// Referencia global de navegación: permite navegar desde componentes que viven
// FUERA de las pantallas (p. ej. el toaster de notificaciones montado en App.js).
import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export function navegar(name, params) {
  if (navigationRef.isReady()) {
    try { navigationRef.navigate(name, params); } catch { /* noop */ }
  }
}
