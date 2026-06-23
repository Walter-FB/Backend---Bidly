// BIDLY — root stack. Splash -> (Auth | App), with the full screen graph.
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import TabNavigator from './TabNavigator';

import { SplashScreen, LoginScreen, FotoDNIScreen, RegistroScreen, VerificarEmailScreen, CrearPasswordScreen } from '../screens/AuthScreens';
import { FiltrosScreen, NotificacionesScreen } from '../screens/HomeScreens';
import { ProductoScreen, SubastaEnVivoScreen, GanasteScreen, SubastaFinalizadaScreen, SubastaAdminScreen } from '../screens/AuctionScreens';
import { MedioPagoScreen, SeguroScreen, ConfirmarPagoScreen, PagoConfirmadoScreen, MultaScreen, ReembolsoScreen } from '../screens/PaymentScreens';
import { MisComprasScreen, HistorialScreen, PublicarScreen, DatosGanadorScreen, CompraDetalleScreen, DatosPersonalesScreen, CrearSubastaScreen, MisProductosScreen } from '../screens/AccountScreens';
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
          <Stack.Screen name="FotoDNI" component={FotoDNIScreen} />
          <Stack.Screen name="Registro" component={RegistroScreen} />
          <Stack.Screen name="VerificarEmail" component={VerificarEmailScreen} />
          <Stack.Screen name="CrearPassword" component={CrearPasswordScreen} />
        </Stack.Group>
      ) : (
        <Stack.Group>
          <Stack.Screen name="Main" component={TabNavigator} />
          {/* discovery */}
          <Stack.Screen name="Filtros" component={FiltrosScreen} options={{ presentation: 'modal' }} />
          <Stack.Screen name="Notificaciones" component={NotificacionesScreen} />
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
          <Stack.Screen name="CompraDetalle" component={CompraDetalleScreen} />
          <Stack.Screen name="Historial" component={HistorialScreen} />
          <Stack.Screen name="Publicar" component={PublicarScreen} />
          <Stack.Screen name="DatosGanador" component={DatosGanadorScreen} />
          <Stack.Screen name="DatosPersonales" component={DatosPersonalesScreen} />
          <Stack.Screen name="CrearSubasta" component={CrearSubastaScreen} />
          <Stack.Screen name="MisProductos" component={MisProductosScreen} />
          <Stack.Screen name="SubastaAdmin" component={SubastaAdminScreen} />
          {/* admin (role-gated) */}
          {isAdmin && <Stack.Screen name="DashboardAdmin" component={DashboardAdminScreen} />}
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
}
