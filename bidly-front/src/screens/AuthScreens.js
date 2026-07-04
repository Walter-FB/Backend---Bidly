// BIDLY — Auth screens: Splash, Login, FotoDNI, Registro (3 pasos: datos → verificar email → contraseña).
import React, { useState } from 'react';
import {
  View, Text, TextInput, ActivityIndicator, TouchableOpacity,
  Alert, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Header, Title, Sub, Btn, Field, Display } from '../components/ui';
import { colors } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { Auth } from '../api/endpoints';

// ─── SPLASH ───────────────────────────────────────────────────────────────────
export function SplashScreen() {
  return (
    <View style={st.splash}>
      <Display style={{ color: colors.blueLogo, fontSize: 52 }}>BIDLY</Display>
      <Text style={st.tagline}>APLICACIÓN DE SUBASTAS</Text>
      <ActivityIndicator size="large" color={colors.blue} style={{ marginTop: 34 }} />
    </View>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
export function LoginScreen({ navigation }) {
  const { login, loginAsGuest } = useAuth();
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
            <Field placeholder="Email" value={email} onChangeText={(v) => setEmail(v.toLowerCase())} keyboardType="email-address" autoCapitalize="none" />
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
            <TouchableOpacity onPress={() => navigation.navigate('FotoDNI')}>
              <Text style={{ color: colors.blue, fontWeight: '800', fontSize: 14 }}>Crear cuenta</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 28 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            <Text style={{ color: colors.muted, fontSize: 12, marginHorizontal: 12 }}>o</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          </View>
          <TouchableOpacity
            style={{ marginTop: 18, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center' }}
            onPress={loginAsGuest}
          >
            <Text style={{ color: colors.muted, fontWeight: '700', fontSize: 15 }}>Entrar como invitado</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

// ─── FOTO DNI — paso 0 del registro ──────────────────────────────────────────
export function FotoDNIScreen({ navigation }) {
  const [frente, setFrente] = useState(null);
  const [dorso, setDorso] = useState(null);

  const elegirFoto = async (setter) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para subir la foto del DNI.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.7,
    });
    if (!result.canceled) {
      setter(result.assets[0]);
    }
  };

  const tomarFoto = async (setter) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara para fotografiar el DNI.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled) {
      setter(result.assets[0]);
    }
  };

  const mostrarOpciones = (setter) => {
    Alert.alert('Foto del DNI', 'Elegí cómo querés subir la foto', [
      { text: 'Cámara', onPress: () => tomarFoto(setter) },
      { text: 'Galería', onPress: () => elegirFoto(setter) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const onContinuar = () => {
    if (!frente || !dorso) {
      return Alert.alert('Fotos requeridas', 'Necesitás subir el frente y el dorso de tu DNI para continuar.');
    }
    navigation.navigate('Registro', { fotoDNI: { frente, dorso } });
  };

  return (
    <Screen scroll contentStyle={{ paddingHorizontal: 22 }}>
      <Header />
      <Title>Verificá tu{'\n'}identidad</Title>
      <Sub>Para crear tu cuenta necesitamos una foto del frente y del dorso de tu DNI.</Sub>

      <View style={{ gap: 16, marginTop: 8 }}>
        <FotoSlot
          label="Frente del DNI"
          icon="card-outline"
          foto={frente}
          onPress={() => mostrarOpciones(setFrente)}
        />
        <FotoSlot
          label="Dorso del DNI"
          icon="card"
          foto={dorso}
          onPress={() => mostrarOpciones(setDorso)}
        />
      </View>

      <Btn
        title="Continuar"
        onPress={onContinuar}
        style={{ marginTop: 24 }}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 16 }}>
        <Text style={{ color: colors.muted, fontSize: 14 }}>¿Ya tenés cuenta? </Text>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={{ color: colors.blue, fontWeight: '800', fontSize: 14 }}>Iniciar sesión</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

function FotoSlot({ label, icon, foto, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={st.fotoSlot}>
      {foto ? (
        <Image source={{ uri: foto.uri }} style={st.fotoPreview} resizeMode="cover" />
      ) : (
        <View style={st.fotoPlaceholder}>
          <Ionicons name={icon} size={32} color={colors.muted} />
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 8, textAlign: 'center' }}>{label}</Text>
          <Text style={{ color: colors.blue, fontSize: 12, marginTop: 4, fontWeight: '700' }}>Tomar o elegir foto</Text>
        </View>
      )}
      {foto && (
        <View style={st.fotoLabel}>
          <Ionicons name="checkmark-circle" size={16} color={colors.green} />
          <Text style={{ color: colors.green, fontSize: 12, fontWeight: '700', marginLeft: 4 }}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── REGISTRO — datos personales + email (paso único) ────────────────────────
export function RegistroScreen({ navigation, route }) {
  const fotoDNI = route.params?.fotoDNI;
  const [f, setF] = useState({ nom: '', ape: '', dom: '', doc: '', email: '' });
  const [loading, setLoading] = useState(false);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  const onContinuar = async () => {
    if (!f.nom.trim() || !f.ape.trim()) {
      return Alert.alert('Campos requeridos', 'Ingresá al menos nombre y apellido.');
    }
    if (!f.doc.trim()) {
      return Alert.alert('Documento requerido', 'Ingresá tu número de documento (DNI).');
    }
    if (!f.email.trim() || !f.email.includes('@')) {
      return Alert.alert('Email inválido', 'Ingresá un email válido.');
    }
    setLoading(true);
    try {
      await Auth.sendVerification(f.email.trim());
      navigation.navigate('VerificarEmail', {
        email: f.email.trim(),
        datosPersonales: f,
        fotoDNI,
      });
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo enviar el código de verificación.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll contentStyle={{ paddingHorizontal: 22 }}>
      <Header />
      <Title>Crear{'\n'}cuenta</Title>
      <Sub>Completá tus datos para comenzar.</Sub>
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}><Field placeholder="Nombre" value={f.nom} onChangeText={set('nom')} /></View>
          <View style={{ flex: 1 }}><Field placeholder="Apellido" value={f.ape} onChangeText={set('ape')} /></View>
        </View>
        <Field placeholder="Domicilio legal" value={f.dom} onChangeText={set('dom')} />
        <Field placeholder="N° de documento (DNI)" value={f.doc} onChangeText={set('doc')} keyboardType="numeric" />
        <View style={st.divider} />
        <Field placeholder="Email" value={f.email} onChangeText={(v) => set('email')(v.toLowerCase())} keyboardType="email-address" autoCapitalize="none" />
      </View>
      <Btn
        title={loading ? 'Enviando código…' : 'Continuar'}
        onPress={onContinuar}
        disabled={loading}
        style={{ marginTop: 20 }}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 16 }}>
        <Text style={{ color: colors.muted, fontSize: 14 }}>¿Ya tenés cuenta? </Text>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={{ color: colors.blue, fontWeight: '800', fontSize: 14 }}>Iniciar sesión</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

// ─── VERIFICAR EMAIL — ingresá el código de 6 dígitos ────────────────────────
export function VerificarEmailScreen({ navigation, route }) {
  const { email, datosPersonales, fotoDNI } = route.params || {};
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');

  const onVerificar = async () => {
    setError('');
    if (code.trim().length !== 6) {
      setError('El código debe tener 6 dígitos.');
      return;
    }
    setLoading(true);
    try {
      const res = await Auth.verifyCode(email, code.trim());
      navigation.replace('CrearPassword', {
        email,
        verificationToken: res.verificationToken,
        datosPersonales,
        fotoDNI,
      });
    } catch (e) {
      setError(e.message || 'El código es inválido o expiró. Pedí uno nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const onReenviar = async () => {
    setResending(true);
    setError('');
    try {
      await Auth.sendVerification(email);
      Alert.alert('Código reenviado', `Revisá tu casilla ${email}.`);
      setCode('');
    } catch (e) {
      Alert.alert('Error', 'No se pudo reenviar el código.');
    } finally {
      setResending(false);
    }
  };

  return (
    <Screen scroll contentStyle={{ paddingHorizontal: 22 }}>
      <Header />
      <View style={{ alignItems: 'center', marginTop: 10, marginBottom: 4 }}>
        <View style={st.mailIcon}>
          <Ionicons name="mail" size={36} color={colors.blue} />
        </View>
      </View>
      <Title style={{ marginTop: 18 }}>Verificá tu{'\n'}email</Title>
      <Sub>Para avanzar con el registro necesitás validar tu mail.</Sub>
      <Text style={{ color: colors.muted, fontSize: 13.5, marginBottom: 20, lineHeight: 20 }}>
        Te enviamos un código de 6 dígitos a{' '}
        <Text style={{ color: '#fff', fontWeight: '700' }}>{email}</Text>
      </Text>

      <TextInput
        value={code}
        onChangeText={(v) => { setCode(v); setError(''); }}
        placeholder="000000"
        placeholderTextColor={colors.muted}
        keyboardType="numeric"
        maxLength={6}
        style={[st.codeInput, error ? { borderColor: '#ef4444' } : null]}
      />

      {error ? (
        <View style={st.errorBanner}>
          <Ionicons name="alert-circle" size={16} color="#ef4444" />
          <Text style={st.errorText}>{error}</Text>
        </View>
      ) : null}

      <Btn
        title={loading ? 'Verificando…' : 'Verificar'}
        onPress={onVerificar}
        disabled={loading}
        style={{ marginTop: 16 }}
      />
      <TouchableOpacity
        style={{ marginTop: 20, alignSelf: 'center' }}
        onPress={onReenviar}
        disabled={resending}
      >
        <Text style={{ color: colors.blue, fontWeight: '700', fontSize: 13.5 }}>
          {resending ? 'Reenviando…' : '¿No te llegó? Reenviar código'}
        </Text>
      </TouchableOpacity>
    </Screen>
  );
}

// ─── CREAR CONTRASEÑA — solo acá se guarda en la base de datos ───────────────
export function CrearPasswordScreen({ navigation, route }) {
  const { register } = useAuth();
  const { email, verificationToken, datosPersonales = {}, fotoDNI } = route.params || {};
  const [f, setF] = useState({ p1: '', p2: '' });
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  const onCreate = async () => {
    if (!ok) return Alert.alert('Términos', 'Tenés que aceptar los Términos y la Política de Privacidad.');
    if (f.p1.length < 6) return Alert.alert('Contraseña', 'La contraseña debe tener al menos 6 caracteres.');
    if (f.p1 !== f.p2) return Alert.alert('Contraseña', 'Las contraseñas no coinciden.');
    setLoading(true);
    try {
      const u = await register({
        nombre: datosPersonales.nom || '',
        apellido: datosPersonales.ape || '',
        domicilio: datosPersonales.dom || '',
        documento: datosPersonales.doc || '',
        email,
        password: f.p1,
        numeroPais: '1',
        verificationToken,
      });
      // Subir fotos de DNI en segundo plano — no bloquea el acceso si falla
      if (fotoDNI?.frente?.uri && fotoDNI?.dorso?.uri && u?.clienteId) {
        try {
          const fd = new FormData();
          fd.append('frente', { uri: fotoDNI.frente.uri, name: 'frente.jpg', type: 'image/jpeg' });
          fd.append('dorso', { uri: fotoDNI.dorso.uri, name: 'dorso.jpg', type: 'image/jpeg' });
          await Auth.uploadDni(u.clienteId, fd);
        } catch (uploadErr) {
          console.warn('No se pudieron subir las fotos del DNI:', uploadErr);
        }
      }
      // AuthContext setUser → RootNavigator redirige al app
    } catch (e) {
      Alert.alert('No se pudo crear la cuenta', e.message || 'Error de conexión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll contentStyle={{ paddingHorizontal: 22 }}>
      <Header />
      <View style={{ alignItems: 'center', marginTop: 10, marginBottom: 4 }}>
        <View style={[st.mailIcon, { backgroundColor: 'rgba(55,214,111,0.12)' }]}>
          <Ionicons name="checkmark-circle" size={36} color={colors.green} />
        </View>
      </View>
      <Title style={{ marginTop: 18 }}>Elegí tu{'\n'}contraseña</Title>
      <Sub>Email verificado correctamente. Ya falta poco.</Sub>
      <View style={{ gap: 12, marginTop: 4 }}>
        <Field placeholder="Contraseña" value={f.p1} onChangeText={set('p1')} secureTextEntry />
        <Field placeholder="Repetir contraseña" value={f.p2} onChangeText={set('p2')} secureTextEntry />
      </View>
      <TouchableOpacity onPress={() => setOk((o) => !o)} style={st.checkRow}>
        <View style={[st.checkbox, { backgroundColor: ok ? colors.blue : 'transparent', borderColor: ok ? colors.blue : colors.faint }]}>
          {ok && <Ionicons name="checkmark" size={14} color="#fff" />}
        </View>
        <Text style={{ color: colors.muted, fontSize: 13.5, flex: 1, lineHeight: 18 }}>
          Acepto los Términos y la Política de Privacidad.
        </Text>
      </TouchableOpacity>
      <Btn title={loading ? 'Creando cuenta…' : 'Crear cuenta'} onPress={onCreate} disabled={loading} />
    </Screen>
  );
}

const st = StyleSheet.create({
  splash: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  tagline: { color: colors.muted, fontSize: 12.5, fontWeight: '700', letterSpacing: 3, marginTop: 6 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  mailIcon: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: 'rgba(59,130,246,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  codeInput: {
    backgroundColor: colors.input ?? colors.cardEl,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    color: '#fff',
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 10,
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 18 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)',
    paddingHorizontal: 12, paddingVertical: 10, marginTop: 10,
  },
  errorText: { color: '#ef4444', fontSize: 13.5, flex: 1, lineHeight: 18 },
  fotoSlot: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: 'hidden',
    minHeight: 140,
  },
  fotoPlaceholder: {
    flex: 1,
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: colors.cardEl ?? colors.card,
  },
  fotoPreview: {
    width: '100%',
    height: 160,
  },
  fotoLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(55,214,111,0.1)',
  },
});
