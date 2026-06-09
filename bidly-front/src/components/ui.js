// BIDLY — shared UI kit (RN). Mirrors preview/components.jsx.
import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, radius, fonts } from '../theme/theme';

export const Display = (props) => (
  <Text {...props} style={[{ fontFamily: fonts.display, color: colors.text }, props.style]} />
);

// Full screen container with dark bg + top inset.
export function Screen({ children, scroll, contentStyle, style }) {
  const insets = useSafeAreaInsets();
  const Container = scroll ? ScrollView : View;
  const extra = scroll
    ? { contentContainerStyle: [{ paddingBottom: 28 }, contentStyle], showsVerticalScrollIndicator: false }
    : {};
  return (
    <View style={[{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }, style]}>
      <Container style={{ flex: 1 }} {...extra}>{children}</Container>
    </View>
  );
}

// Header: back chevron + BIDLY wordmark (or custom right node).
export function Header({ right, onBack, hideBack }) {
  const nav = useNavigation();
  return (
    <View style={s.header}>
      {hideBack ? <View style={{ width: 30 }} /> : (
        <TouchableOpacity onPress={onBack || (() => nav.goBack())} hitSlop={10}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
      )}
      {right !== undefined ? right : <Display style={{ color: colors.blueLogo, fontSize: 19 }}>BIDLY</Display>}
    </View>
  );
}

export const Title = ({ children, style }) => (
  <Display style={[{ fontSize: 33, lineHeight: 36, marginBottom: 6 }, style]}>{children}</Display>
);
export const Sub = ({ children, style }) => (
  <Text style={[{ color: colors.muted, fontSize: 14.5, lineHeight: 20, marginBottom: 18 }, style]}>{children}</Text>
);
export const SectionLabel = ({ children, style }) => (
  <Display style={[{ fontSize: 14, marginTop: 18, marginBottom: 10 }, style]}>{children}</Display>
);

export function Btn({ title, onPress, kind = 'primary', style, disabled }) {
  const bg = { primary: colors.blue, danger: colors.red, ghost: colors.cardEl }[kind];
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} disabled={disabled}
      style={[s.btn, { backgroundColor: bg, opacity: disabled ? 0.5 : 1,
        borderWidth: kind === 'ghost' ? 1 : 0, borderColor: colors.border }, style]}>
      <Text style={s.btnTxt}>{title}</Text>
    </TouchableOpacity>
  );
}

export function Chip({ label, active, dot, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[s.chip, {
      backgroundColor: active ? 'transparent' : colors.cardEl,
      borderColor: active ? colors.gold : 'transparent' }]}>
      {dot && <View style={s.dot} />}
      <Text style={{ color: active ? colors.gold : colors.muted, fontWeight: '700', fontSize: 13.5 }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Card({ children, el, style }) {
  return <View style={[s.card, { backgroundColor: el ? colors.cardEl : colors.card }, style]}>{children}</View>;
}

export function Field({ value, onChangeText, placeholder, secureTextEntry, keyboardType, style, multiline }) {
  return (
    <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder}
      placeholderTextColor={colors.muted} secureTextEntry={secureTextEntry} keyboardType={keyboardType}
      multiline={multiline}
      style={[s.field, multiline && { height: 92, textAlignVertical: 'top' }, style]} />
  );
}

export function LiveBadge({ style }) {
  return (
    <View style={[s.live, style]}>
      <View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: '#fff' }} />
      <Text style={s.liveTxt}>EN VIVO</Text>
    </View>
  );
}

export function Tag({ label, color = colors.blue, fill }) {
  return (
    <View style={{ borderWidth: 1.4, borderColor: color, backgroundColor: fill || 'transparent',
      borderRadius: 6, paddingVertical: 4, paddingHorizontal: 9, alignSelf: 'flex-start' }}>
      <Text style={{ color: fill ? '#fff' : color, fontWeight: '800', fontSize: 11.5 }}>{label}</Text>
    </View>
  );
}

export function ImgBox({ style, size = 32 }) {
  return (
    <View style={[{ backgroundColor: colors.cardEl, borderRadius: 12, borderWidth: 1,
      borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Ionicons name="image-outline" size={size} color="#6b7494" />
    </View>
  );
}

// Bottom action bar pinned over content.
export function BottomBar({ children }) {
  const insets = useSafeAreaInsets();
  return <View style={[s.bottomBar, { paddingBottom: insets.bottom + 14 }]}>{children}</View>;
}

// Detail row (key / value).
export function Row({ k, v, vc, bold }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 }}>
      <Text style={{ color: bold ? '#fff' : colors.muted, fontSize: 14, fontWeight: bold ? '800' : '500' }}>{k}</Text>
      <Text style={{ color: vc || '#fff', fontSize: 14, fontWeight: '800' }}>{v}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  header: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22 },
  btn: { borderRadius: radius.btn, paddingVertical: 16, paddingHorizontal: 20, alignItems: 'center' },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 16,
    borderRadius: radius.pill, borderWidth: 1.5 },
  dot: { width: 6, height: 6, borderRadius: 6, backgroundColor: colors.gold },
  card: { borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: 16 },
  field: { backgroundColor: colors.input, borderRadius: radius.input, borderWidth: 1, borderColor: colors.border,
    paddingVertical: 15, paddingHorizontal: 16, color: '#fff', fontSize: 15 },
  live: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.red,
    borderRadius: 6, paddingVertical: 4, paddingHorizontal: 9, alignSelf: 'flex-start' },
  liveTxt: { color: '#fff', fontSize: 10.5, fontWeight: '800', letterSpacing: 0.6 },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 22, paddingTop: 14,
    backgroundColor: colors.bg },
});

export default { Screen, Header, Title, Sub, SectionLabel, Btn, Chip, Card, Field, LiveBadge, Tag, ImgBox, BottomBar, Row, Display };
