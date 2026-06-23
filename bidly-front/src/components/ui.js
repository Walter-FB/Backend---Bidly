// BIDLY — shared UI kit (RN). Mirrors preview/components.jsx.
import React, { useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Image, Modal, Dimensions, Animated,
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

export function Field({ value, onChangeText, placeholder, secureTextEntry, keyboardType, style, multiline, ...rest }) {
  return (
    <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder}
      placeholderTextColor={colors.muted} secureTextEntry={secureTextEntry} keyboardType={keyboardType}
      multiline={multiline}
      style={[s.field, multiline && { height: 92, textAlignVertical: 'top' }, style]}
      {...rest} />
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

export function SuccessBanner({ message, onDismiss }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-10)).current;

  useEffect(() => {
    if (!message) return undefined;
    opacity.setValue(0);
    translateY.setValue(-10);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
    ]).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 450, useNativeDriver: true }).start(({ finished }) => {
        if (finished) onDismiss?.();
      });
    }, 3000);
    return () => clearTimeout(timer);
  }, [message, onDismiss, opacity, translateY]);

  if (!message) return null;

  return (
    <Animated.View style={[s.successBanner, { opacity, transform: [{ translateY }] }]}>
      <Ionicons name="checkmark-circle" size={20} color={colors.green} />
      <Text style={s.successBannerTxt}>{message}</Text>
    </Animated.View>
  );
}

export function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onDismiss} style={s.errorBanner}>
      <Ionicons name="alert-circle" size={20} color={colors.red} />
      <Text style={s.errorBannerTxt}>{message}</Text>
      <Ionicons name="close" size={18} color={colors.muted} />
    </TouchableOpacity>
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

export function ImgBox({ style, size = 32, src, onPress }) {
  const [failed, setFailed] = React.useState(false);
  const canPress = Boolean(onPress && src && !failed);

  const inner = src && !failed ? (
    <Image
      source={{ uri: src }}
      style={[{ backgroundColor: colors.cardEl, borderRadius: 12 }, style]}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  ) : (
    <View style={[{ backgroundColor: colors.cardEl, borderRadius: 12, borderWidth: 1,
      borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Ionicons name="image-outline" size={size} color="#6b7494" />
    </View>
  );

  if (!canPress) return inner;

  return (
    <TouchableOpacity activeOpacity={0.92} onPress={onPress}>
      {inner}
    </TouchableOpacity>
  );
}

const SCREEN = Dimensions.get('window');

// Visor fullscreen: tap en foto → ampliar. Soporta varias imágenes con swipe.
export function ImageLightbox({ visible, images = [], initialIndex = 0, onClose }) {
  const insets = useSafeAreaInsets();
  const scrollRef = React.useRef(null);
  const [idx, setIdx] = React.useState(initialIndex);

  React.useEffect(() => {
    if (!visible) return;
    setIdx(initialIndex);
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ x: initialIndex * SCREEN.width, animated: false });
    }, 40);
    return () => clearTimeout(t);
  }, [visible, initialIndex]);

  if (!images.length) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={lb.backdrop}>
        <TouchableOpacity
          style={[lb.closeBtn, { top: insets.top + 8 }]}
          onPress={onClose}
          hitSlop={12}
        >
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>

        {images.length > 1 && (
          <Text style={[lb.counter, { top: insets.top + 14 }]}>
            {idx + 1} / {images.length}
          </Text>
        )}

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            setIdx(Math.round(e.nativeEvent.contentOffset.x / SCREEN.width));
          }}
          style={{ flex: 1 }}
        >
          {images.map((uri, i) => (
            <TouchableOpacity
              key={`${uri}-${i}`}
              activeOpacity={1}
              onPress={onClose}
              style={lb.slide}
            >
              <Image source={{ uri }} style={lb.image} resizeMode="contain" />
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={[lb.hint, { paddingBottom: insets.bottom + 12 }]}>
          Tocá para cerrar{images.length > 1 ? ' · Deslizá para ver más' : ''}
        </Text>
      </View>
    </Modal>
  );
}

const lb = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)' },
  closeBtn: { position: 'absolute', right: 18, zIndex: 10 },
  counter: {
    position: 'absolute', alignSelf: 'center', zIndex: 10,
    color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '700',
  },
  slide: {
    width: SCREEN.width,
    height: SCREEN.height,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: { width: SCREEN.width, height: SCREEN.height * 0.78 },
  hint: {
    position: 'absolute', bottom: 0, left: 0, right: 0, textAlign: 'center',
    color: 'rgba(255,255,255,0.45)', fontSize: 12,
  },
});

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
  successBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 10, marginBottom: 2,
    backgroundColor: 'rgba(55, 214, 111, 0.12)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(55, 214, 111, 0.35)',
    paddingVertical: 12, paddingHorizontal: 14,
  },
  successBannerTxt: { color: colors.green, fontSize: 14, fontWeight: '700', flex: 1 },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.red + '22', borderRadius: 10, borderWidth: 1, borderColor: colors.red + '55',
    paddingVertical: 12, paddingHorizontal: 14, marginHorizontal: 16, marginTop: 8,
  },
  errorBannerTxt: { color: '#ffb4b4', fontSize: 13, fontWeight: '600', flex: 1, lineHeight: 18 },
});

export default { Screen, Header, Title, Sub, SectionLabel, Btn, Chip, Card, Field, LiveBadge, SuccessBanner, ErrorBanner, Tag, ImgBox, ImageLightbox, BottomBar, Row, Display };
