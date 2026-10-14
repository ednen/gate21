import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type TextStyle, View, type ViewStyle } from 'react-native';

import { colors, fonts, radius } from '@/theme';

import { Icon, type IconName } from './Icon';

/** Small uppercase mono label, the design's "boarding pass" voice. */
export function Label({ children, color = colors.muted, style }: { children: ReactNode; color?: string; style?: TextStyle }) {
  return <Text style={[styles.label, { color }, style]}>{children}</Text>;
}

export function Title({ children, size = 26, color = colors.ink, style }: { children: ReactNode; size?: number; color?: string; style?: TextStyle }) {
  return (
    <Text accessibilityRole="header" style={[styles.title, { fontSize: size, lineHeight: Math.round(size * 1.12), color }, style]}>
      {children}
    </Text>
  );
}

export function Body({ children, color = colors.ink, size = 15, style }: { children: ReactNode; color?: string; size?: number; style?: TextStyle }) {
  return <Text style={[styles.body, { color, fontSize: size, lineHeight: Math.round(size * 1.45) }, style]}>{children}</Text>;
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'accent' | 'outline' | 'ghost' | 'danger' | 'onDark';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  accessibilityHint?: string;
};

export function Button({ label, onPress, variant = 'primary', icon, disabled, loading, style, accessibilityHint }: ButtonProps) {
  const palette = {
    primary: { bg: colors.ink, fg: colors.surface, border: colors.ink },
    accent: { bg: colors.yellow, fg: colors.ink, border: colors.yellow },
    outline: { bg: 'transparent', fg: colors.ink, border: colors.line },
    ghost: { bg: 'transparent', fg: colors.inkLine, border: 'transparent' },
    danger: { bg: colors.red, fg: colors.surface, border: colors.red },
    onDark: { bg: 'transparent', fg: colors.surface, border: '#4A515C' },
  }[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: inactive && variant === 'primary' ? colors.line : palette.bg,
          borderColor: inactive && variant === 'primary' ? colors.line : palette.border,
          opacity: pressed ? 0.85 : 1,
        },
        variant === 'ghost' && { minHeight: 44 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <>
          <Text style={[styles.buttonText, { color: inactive && variant === 'primary' ? colors.disabled : palette.fg }]}>{label}</Text>
          {icon ? <Icon name={icon} size={18} color={variant === 'primary' ? colors.yellow : palette.fg} strokeWidth={2.2} /> : null}
        </>
      )}
    </Pressable>
  );
}

export function Card({ children, style, live }: { children: ReactNode; style?: ViewStyle; live?: boolean }) {
  return (
    <View accessibilityLiveRegion={live ? 'polite' : undefined} style={[styles.card, style]}>
      {children}
    </View>
  );
}

export function ProgressBar({ value, color = colors.ink, track = colors.line, height = 6 }: { value: number; color?: string; track?: string; height?: number }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={{ height, borderRadius: height / 2, backgroundColor: track, overflow: 'hidden' }}
    >
      <View style={{ width: `${pct * 100}%`, height, backgroundColor: color, borderRadius: height / 2 }} />
    </View>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }
  return (
    <View accessibilityLiveRegion="polite" style={styles.error}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.5 },
  title: { fontFamily: fonts.displayBold },
  body: { fontFamily: fonts.body },
  button: {
    minHeight: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  buttonText: { fontFamily: fonts.bodyBold, fontSize: 16 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16 },
  error: { backgroundColor: colors.redTint, borderRadius: 12, padding: 12 },
  errorText: { fontFamily: fonts.bodyMedium, color: colors.red, fontSize: 14 },
});
