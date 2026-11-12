import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme';

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const c = useTheme();
  return <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.background }}>
    {scroll ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.screen}>{children}</ScrollView> : children}
  </SafeAreaView>;
}
export function Heading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  const c = useTheme();
  return <View style={{ marginBottom: 24, gap: 12 }}>
    <Text style={{ color: c.accent, fontSize: 10, letterSpacing: 2 }}>{eyebrow.toUpperCase()}</Text>
    <Text accessibilityRole="header" style={{ color: c.text, fontFamily: 'serif', fontSize: 34, lineHeight: 41 }}>{title}</Text>
    {subtitle && <Text style={{ color: c.muted, fontSize: 14, lineHeight: 22 }}>{subtitle}</Text>}
  </View>;
}
export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const c = useTheme();
  return <View style={[{ backgroundColor: c.paper, borderWidth: 1, borderColor: c.border, borderRadius: 18, padding: 20, gap: 12, marginBottom: 14 }, style]}>{children}</View>;
}
export function Button({ label, onPress, disabled, quiet = false }: { label: string; onPress: () => void; disabled?: boolean; quiet?: boolean }) {
  const c = useTheme();
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ backgroundColor: quiet ? c.wash : c.accent, borderRadius: 10, paddingHorizontal: 16, minHeight: 46, justifyContent: 'center', alignItems: 'center', opacity: disabled ? .45 : pressed ? .75 : 1 })}>
    <Text style={{ color: quiet ? c.accent : c.onAccent, fontWeight: '600', fontSize: 13 }}>{label}</Text>
  </Pressable>;
}
export function Notice({ message, retry }: { message: string; retry?: () => void }) {
  const c = useTheme();
  return <Card><Text accessibilityRole="alert" style={{ color: c.muted, lineHeight: 23 }}>{message}</Text>{retry && <Button label="Try again" onPress={retry} quiet />}</Card>;
}
export function Loading() { const c = useTheme(); return <ActivityIndicator accessibilityLabel="Loading your journal" color={c.accent} style={{ padding: 35 }} />; }
export const s = StyleSheet.create({ screen: { padding: 23, paddingBottom: 40 }, row: { flexDirection: 'row', alignItems: 'center', gap: 9, flexWrap: 'wrap' } });
