// BIDLY — app entry: load fonts, providers, navigation.
import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, ArchivoBlack_400Regular } from '@expo-google-fonts/archivo-black';

import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import { navigationRef } from './src/navigation/navRef';
import NotifToaster from './src/components/NotifToaster';
import { warmup } from './src/api/client';
import { colors } from './src/theme/theme';

const navTheme = {
  dark: true,
  colors: {
    primary: colors.blue,
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    border: colors.border,
    notification: colors.red,
  },
};

export default function App() {
  const [fontsLoaded] = useFonts({ ArchivoBlack_400Regular });

  // Toque inicial: despierta Railway y abre la conexión apenas arranca la app,
  // así la primera pantalla no falla en celus lentos. Corre una sola vez.
  useEffect(() => { warmup(); }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.blue} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer theme={navTheme} ref={navigationRef}>
          <StatusBar style="light" />
          <RootNavigator />
          <NotifToaster />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
