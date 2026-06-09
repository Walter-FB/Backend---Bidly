// BIDLY — bottom tabs: Home / Historial / (Publicar FAB) / Subastas / Perfil.
import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/theme';

import { HomeScreen } from '../screens/HomeScreens';
import { HistorialScreen } from '../screens/AccountScreens';
import { MisSubastasScreen } from '../screens/AccountScreens';
import { PerfilScreen } from '../screens/AccountScreens';

const Tab = createBottomTabNavigator();

// Center floating "+" that opens the Publicar flow.
function PublishButton({ navigation }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate('Publicar')} style={s.fab}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

export default function TabNavigator() {
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
      <Tab.Screen name="Home" component={HomeScreen}
        options={{ tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={23} color={color} /> }} />
      <Tab.Screen name="Historial" component={HistorialScreen}
        options={{ tabBarIcon: ({ color }) => <Ionicons name="time-outline" size={23} color={color} /> }} />
      <Tab.Screen name="Publish" component={HomeScreen}
        options={{ tabBarButton: (props) => <PublishButton {...props} /> }}
        listeners={({ navigation }) => ({
          tabPress: (e) => { e.preventDefault(); navigation.navigate('Publicar'); },
        })} />
      <Tab.Screen name="Subastas" component={MisSubastasScreen}
        options={{ tabBarIcon: ({ color }) => <Ionicons name="hammer-outline" size={23} color={color} /> }} />
      <Tab.Screen name="Perfil" component={PerfilScreen}
        options={{ tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={23} color={color} /> }} />
    </Tab.Navigator>
  );
}

const s = StyleSheet.create({
  bar: { backgroundColor: '#0c1226', borderTopColor: colors.border, height: 84, paddingTop: 8 },
  fab: { position: 'absolute', top: -26, width: 58, height: 58, borderRadius: 30, backgroundColor: colors.blue,
    alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#0c1226',
    shadowColor: colors.blue, shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
});
