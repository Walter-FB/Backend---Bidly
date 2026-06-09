// BIDLY — root stack. Splash -> (Auth | App), with the full screen graph.
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import TabNavigator from './TabNavigator';

import { SplashScreen, LoginScreen, Registro1Screen, Registro2Screen } from '../screens/AuthScreens';
import { FiltrosScreen, NotificacionesScreen, FavoritosScreen } from '../screens/HomeScreens';
import { ProductoScreen, SubastaEnVivoScreen, GanasteScreen, SubastaFinalizadaScreen } from '../screens/AuctionScreens';
import { MedioPagoScreen, SeguroScreen, ConfirmarPagoScreen, PagoConfirmadoScreen, MultaScreen, ReembolsoScreen } from '../screens/PaymentScreens';
import { MisComprasScreen, PublicarScreen, DatosGanadorScreen } from '../screens/AccountScreens';
import { DashboardAdminScreen } from '../screens/AdminScreens';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { user, booting, isAdmin } = useAuth();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      {booting ? (
        <Stack.Screen name="Splash" component={SplashScreen} />
      ) : !user ? (
        <Stack.Group>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Registro1" component={Registro1Screen} />
          <Stack.Screen name="Registro2" component={Registro2Screen} />
        </Stack.Group>
      ) : (
        <Stack.Group>
          <Stack.Screen name="Main" component={TabNavigator} />
          {/* discovery */}
          <Stack.Screen name="Filtros" component={FiltrosScreen} options={{ presentation: 'modal' }} />
          <Stack.Screen name="Notificaciones" component={NotificacionesScreen} />
          <Stack.Screen name="Favoritos" component={FavoritosScreen} />
          {/* auction */}
          <Stack.Screen name="Producto" component={ProductoScreen} />
          <Stack.Screen name="SubastaEnVivo" component={SubastaEnVivoScreen} />
          <Stack.Screen name="Ganaste" component={GanasteScreen} />
          <Stack.Screen name="SubastaFinalizada" component={SubastaFinalizadaScreen} />
          {/* payment + post-sale */}
          <Stack.Screen name="MedioPago" component={MedioPagoScreen} />
          <Stack.Screen name="Seguro" component={SeguroScreen} />
          <Stack.Screen name="ConfirmarPago" component={ConfirmarPagoScreen} />
          <Stack.Screen name="PagoConfirmado" component={PagoConfirmadoScreen} />
          <Stack.Screen name="Multa" component={MultaScreen} />
          <Stack.Screen name="Reembolso" component={ReembolsoScreen} />
          {/* account / seller */}
          <Stack.Screen name="MisCompras" component={MisComprasScreen} />
          <Stack.Screen name="Publicar" component={PublicarScreen} />
          <Stack.Screen name="DatosGanador" component={DatosGanadorScreen} />
          {/* admin (role-gated) */}
          {isAdmin && <Stack.Screen name="DashboardAdmin" component={DashboardAdminScreen} />}
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
}
