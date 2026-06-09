// BIDLY — Dashboard admin (role-gated por RootNavigator).
// El backend no tiene endpoints admin todavía; los stats son placeholders.
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Title, SectionLabel, Card, Tag, Display } from '../components/ui';
import { colors } from '../theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

function StatCard({ label, value, color }) {
  return (
    <Card el style={{ flex: 1, minHeight: 96 }}>
      <Text style={{ color: colors.muted, fontSize: 12.5, lineHeight: 16 }}>{label}</Text>
      <Display style={{ color: color || '#fff', fontSize: 30, marginTop: 14 }}>{value}</Display>
    </Card>
  );
}

export function DashboardAdminScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();

  // Los endpoints de admin no existen en el backend actual.
  // Los valores son placeholders estáticos hasta que se implementen.
  const stats = [
    { label: 'Subastas activas', value: '—' },
    { label: 'Pendientes', value: '—', color: colors.gold },
    { label: 'Usuarios pendientes', value: '—', color: colors.gold },
    { label: 'Reclamos abiertos', value: '—', color: colors.red },
  ];

  const acciones = [
    ['Verificar usuarios', '—', colors.gold],
    ['Gestionar reclamos', '—', colors.red],
    ['Subastas a moderar', '—', colors.gold],
    ['Pagos pendientes', '—', colors.green],
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={s.topbar}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Display style={{ color: colors.blueLogo, fontSize: 20 }}>BIDLY</Display>
        <Tag label="ADMIN" color={colors.red} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <Title style={{ marginTop: 6, marginBottom: 4 }}>Dashboard</Title>
        <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 16 }}>
          Los endpoints de administración están pendientes de implementación en el backend.
        </Text>
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <StatCard label={stats[0].label} value={stats[0].value} />
            <StatCard label={stats[1].label} value={stats[1].value} color={stats[1].color} />
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <StatCard label={stats[2].label} value={stats[2].value} color={stats[2].color} />
            <StatCard label={stats[3].label} value={stats[3].value} color={stats[3].color} />
          </View>
        </View>
        <SectionLabel>Acciones rápidas</SectionLabel>
        <View style={{ gap: 10 }}>
          {acciones.map(([t, n, c]) => (
            <TouchableOpacity key={t} style={s.action}>
              <Text style={{ color: '#fff', fontSize: 14.5, fontWeight: '600' }}>{t}</Text>
              <Display style={{ color: c, fontSize: 15 }}>{n}</Display>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, height: 52 },
  action: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 17, paddingHorizontal: 16 },
});
