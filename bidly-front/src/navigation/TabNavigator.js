// BIDLY — bottom tabs: Home / Historial / (Publicar FAB) / Subastas / Perfil.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/theme';
import { useAuth } from '../context/AuthContext';

import { HomeScreen } from '../screens/HomeScreens';
import { HistorialScreen, MisSubastasScreen, PerfilScreen } from '../screens/AccountScreens';

const Tab = createBottomTabNavigator();

// Pantalla que se muestra cuando un invitado intenta acceder a una sección bloqueada.
function GuestBlockScreen() {
  const { logout } = useAuth();
  return (
    <View style={g.container}>
      <View style={g.iconWrap}>
        <Ionicons name="lock-closed" size={38} color={colors.blue} />
      </View>
      <Text style={g.title}>Sección bloqueada</Text>
      <Text style={g.sub}>
        Esta sección requiere una cuenta BIDLY.{'\n'}
        Iniciá sesión o creá una cuenta para acceder.
      </Text>
      <TouchableOpacity style={g.btn} onPress={logout}>
        <Text style={g.btnText}>Iniciar sesión</Text>
      </TouchableOpacity>
      <TouchableOpacity style={g.btnGhost} onPress={logout}>
        <Text style={g.btnGhostText}>Crear cuenta</Text>
      </TouchableOpacity>
    </View>
  );
}

// Center floating "+" — bloqueado para invitados.
function PublishButton() {
  const navigation = useNavigation();
  const { user, logout } = useAuth();

  const handlePress = () => {
    if (user?.isGuest) {
      Alert.alert(
        'Necesitás una cuenta',
        'Para publicar subastas tenés que iniciar sesión o crear una cuenta.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Iniciar sesión', onPress: logout },
        ],
      );
      return;
    }
    navigation.navigate('Publicar');
  };

  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handlePress}
        style={[s.fab, user?.isGuest && s.fabLocked]}
      >
        <Ionicons
          name={user?.isGuest ? 'lock-closed' : 'add'}
          size={user?.isGuest ? 22 : 28}
          color="#fff"
        />
      </TouchableOpacity>
    </View>
  );
}

export default function TabNavigator() {
  const { user } = useAuth();
  const isGuest = user?.isGuest;

  // Componentes bloqueados para invitados — se recalculan solo cuando cambia isGuest.
  const HistorialTab = isGuest ? GuestBlockScreen : HistorialScreen;
  const SubastasTab  = isGuest ? GuestBlockScreen : MisSubastasScreen;
  const PerfilTab    = isGuest ? GuestBlockScreen : PerfilScreen;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: '#6b7494',
        tabBarStyle: s.bar,
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: '700' },
      }}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={23} color={color} /> }}
      />
      <Tab.Screen
        name="Historial"
        component={HistorialTab}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View>
              <Ionicons name="time-outline" size={23} color={color} />
              {isGuest && <Ionicons name="lock-closed" size={10} color={colors.muted} style={s.lockBadge} />}
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Publish"
        component={HomeScreen}
        options={{ tabBarButton: () => <PublishButton /> }}
      />
      <Tab.Screen
        name="Subastas"
        component={SubastasTab}
        options={{
          tabBarIcon: ({ color }) => (
            <View>
              <Ionicons name="hammer-outline" size={23} color={color} />
              {isGuest && <Ionicons name="lock-closed" size={10} color={colors.muted} style={s.lockBadge} />}
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Perfil"
        component={PerfilTab}
        options={{
          tabBarIcon: ({ color }) => (
            <View>
              <Ionicons name="person-outline" size={23} color={color} />
              {isGuest && <Ionicons name="lock-closed" size={10} color={colors.muted} style={s.lockBadge} />}
            </View>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const s = StyleSheet.create({
  bar: { backgroundColor: '#0c1226', borderTopColor: colors.border, height: 84, paddingTop: 8 },
  fab: {
    position: 'absolute', top: -26, width: 58, height: 58, borderRadius: 30,
    backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center',
    borderWidth: 4, borderColor: '#0c1226',
    shadowColor: colors.blue, shadowOpacity: 0.5, shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  fabLocked: { backgroundColor: '#2a3050' },
  lockBadge: { position: 'absolute', bottom: -2, right: -2 },
});

const g = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: colors.bg,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36,
  },
  iconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.blueSoft ?? 'rgba(59,130,246,0.12)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 10 },
  sub: {
    color: colors.muted, fontSize: 14, lineHeight: 22,
    textAlign: 'center', marginBottom: 30,
  },
  btn: {
    width: '100%', paddingVertical: 14, borderRadius: 12,
    backgroundColor: colors.blue, alignItems: 'center', marginBottom: 10,
  },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  btnGhost: {
    width: '100%', paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: colors.border, alignItems: 'center',
  },
  btnGhostText: { color: colors.muted, fontWeight: '700', fontSize: 15 },
});
