// BIDLY — Auth screens: Splash, Login, Registro (2 pasos).
import React, { useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, Alert, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Header, Title, Sub, SectionLabel, Btn, Field, ImgBox, BottomBar, Display } from '../components/ui';
import { colors } from '../theme/theme';
import { useAuth } from '../context/AuthContext';

export function SplashScreen() {
  return (
    <View style={st.splash}>
      <Display style={{ color: colors.blueLogo, fontSize: 52 }}>BIDLY</Display>
      <Text style={st.tagline}>APLICACIÓN DE SUBASTAS</Text>
      <ActivityIndicator size="large" color={colors.blue} style={{ marginTop: 34 }} />
    </View>
  );
}

export function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    if (!email.trim() || !pass) {
      return Alert.alert('Campos requeridos', 'Ingresá tu email y contraseña.');
    }
    setLoading(true);
    try {
      await login(email.trim(), pass);
      // AuthContext setUser → RootNavigator redirige al app
    } catch (e) {
      Alert.alert('No se pudo ingresar', e.message || 'Revisá tus credenciales o la conexión al servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 30, paddingVertical: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Display style={{ color: colors.blueLogo, fontSize: 34, marginBottom: 18 }}>BIDLY</Display>
          <Title style={{ fontSize: 30 }}>Iniciar sesión</Title>
          <Sub>Ingresá con tu cuenta BIDLY</Sub>
          <View style={{ gap: 12, marginTop: 8 }}>
            <Field
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Field placeholder="Contraseña" value={pass} onChangeText={setPass} secureTextEntry />
          </View>
          <TouchableOpacity
            style={{ alignSelf: 'flex-end', marginVertical: 14 }}
            onPress={() => Alert.alert('Próximamente', 'La recuperación de contraseña estará disponible en una próxima versión.')}
          >
            <Text style={{ color: colors.blue, fontWeight: '700', fontSize: 13 }}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>
          <Btn title={loading ? 'Ingresando…' : 'Ingresar'} onPress={onLogin} disabled={loading} />
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 18 }}>
            <Text style={{ color: colors.muted, fontSize: 14 }}>¿No tenés cuenta? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Registro1')}>
              <Text style={{ color: colors.blue, fontWeight: '800', fontSize: 14 }}>Crear cuenta</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Progress({ pct }) {
  return (
    <View style={st.progress}><View style={[st.progressFill, { width: `${pct}%` }]} /></View>
  );
}

// Paso 1: datos personales — al continuar pasa los datos a Registro2 por params.
export function Registro1Screen({ navigation }) {
  const [f, setF] = useState({ nom: '', ape: '', dom: '', doc: '' });
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  const onContinuar = () => {
    if (!f.nom.trim() || !f.ape.trim()) {
      return Alert.alert('Campos requeridos', 'Ingresá al menos nombre y apellido.');
    }
    navigation.navigate('Registro2', { datosPersonales: f });
  };

  return (
    <Screen scroll contentStyle={{ paddingHorizontal: 22 }}>
      <Progress pct={50} />
      <Text style={st.step}>Paso 1 de 2</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Title>Datos{'\n'}personales</Title>
        <View style={st.brandSq}><Display style={{ color: colors.blueLogo, fontSize: 22 }}>B</Display></View>
      </View>
      <Sub>Se verifican antes de activar tu cuenta.</Sub>
      <View style={{ gap: 12 }}>
        <Field placeholder="Nombre" value={f.nom} onChangeText={set('nom')} />
        <Field placeholder="Apellido" value={f.ape} onChangeText={set('ape')} />
        <Field placeholder="Domicilio legal" value={f.dom} onChangeText={set('dom')} />
        <Field placeholder="N° de documento (DNI)" value={f.doc} onChangeText={set('doc')} keyboardType="numeric" />
      </View>
      <SectionLabel>Documento (frente y dorso)</SectionLabel>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {['DNI frente', 'DNI dorso'].map((t) => (
          <TouchableOpacity
            key={t}
            style={st.dni}
            onPress={() => Alert.alert('Próximamente', 'La carga de fotos estará disponible en una próxima versión.')}
          >
            <Ionicons name="image-outline" size={24} color={colors.blue} />
            <Text style={{ color: colors.blue, fontSize: 12.5, fontWeight: '700', marginTop: 6 }}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Btn title="Continuar" onPress={onContinuar} style={{ marginTop: 18 }} />
    </Screen>
  );
}

// Paso 2: email y contraseña — combina con los datos del paso 1 y llama al backend.
export function Registro2Screen({ navigation, route }) {
  const { register } = useAuth();
  const datosPersonales = route.params?.datosPersonales || {};
  const [f, setF] = useState({ email: '', p1: '', p2: '' });
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  const onCreate = async () => {
    if (!ok) return Alert.alert('Términos', 'Tenés que aceptar los Términos y la Política de Privacidad.');
    if (!f.email.trim()) return Alert.alert('Email', 'Ingresá tu email.');
    if (f.p1.length < 6) return Alert.alert('Contraseña', 'La contraseña debe tener al menos 6 caracteres.');
    if (f.p1 !== f.p2) return Alert.alert('Contraseña', 'Las contraseñas no coinciden.');

    setLoading(true);
    try {
      await register({
        nombre: datosPersonales.nom || '',
        apellido: datosPersonales.ape || '',
        domicilio: datosPersonales.dom || '',
        documento: datosPersonales.doc || '',
        email: f.email.trim(),
        password: f.p1,
        numeroPais: '1',
      });
      // AuthContext setUser → RootNavigator redirige al app
    } catch (e) {
      Alert.alert('No se pudo crear la cuenta', e.message || 'Error de conexión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll contentStyle={{ paddingHorizontal: 22 }}>
      <Progress pct={100} />
      <Text style={st.step}>Paso 2 de 2</Text>
      <Title>Datos de{'\n'}cuenta</Title>
      <Sub>Vas a usar este email para ingresar.</Sub>
      <View style={{ gap: 12 }}>
        <Field
          placeholder="Email"
          value={f.email}
          onChangeText={set('email')}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Field placeholder="Contraseña" value={f.p1} onChangeText={set('p1')} secureTextEntry />
        <Field placeholder="Repetir contraseña" value={f.p2} onChangeText={set('p2')} secureTextEntry />
      </View>
      <TouchableOpacity onPress={() => setOk((o) => !o)} style={st.checkRow}>
        <View style={[st.checkbox, { backgroundColor: ok ? colors.blue : 'transparent', borderColor: ok ? colors.blue : colors.faint }]}>
          {ok && <Ionicons name="checkmark" size={14} color="#fff" />}
        </View>
        <Text style={{ color: colors.muted, fontSize: 13.5, flex: 1, lineHeight: 18 }}>
          Acepto los Términos y la Política de Privacidad.</Text>
      </TouchableOpacity>
      <Btn title={loading ? 'Creando cuenta…' : 'Crear cuenta'} onPress={onCreate} disabled={loading} />
    </Screen>
  );
}

const st = StyleSheet.create({
  splash: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  tagline: { color: colors.muted, fontSize: 12.5, fontWeight: '700', letterSpacing: 3, marginTop: 6 },
  progress: { height: 4, backgroundColor: colors.cardEl, borderRadius: 4, marginTop: 8, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.blue, borderRadius: 4 },
  step: { color: colors.muted, fontSize: 13, fontWeight: '800', marginTop: 16, marginBottom: 6 },
  brandSq: { width: 46, height: 46, borderRadius: 12, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' },
  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.input,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingVertical: 15, paddingHorizontal: 16 },
  dni: { flex: 1, height: 92, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.borderHi,
    backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 18 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
