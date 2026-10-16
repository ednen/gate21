import type { ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, type PressableStateCallbackType, StyleSheet, Text, type TextStyle, View, type ViewStyle } from 'react-native';

import { colors, fonts, radius } from '@/theme';

import { Icon, type IconName } from './Icon';

/** Pressable state on the web also says whether the pointer is over it. */
export const isHovered = (state: PressableStateCallbackType) => !!(state as { hovered?: boolean }).hovered;

/** A short caption over a piece of content, in the condensed cut. Sentence case, never shouted. */
export function Label({ children, color = colors.muted, style }: { children: ReactNode; color?: string; style?: TextStyle }) {
  return <Text style={[styles.label, { color }, style]}>{children}</Text>;
}

/** Headings speak like signs: condensed, bold, set tight. */
export function Title({ children, size = 28, color = colors.ink, style }: { children: ReactNode; size?: number; color?: string; style?: TextStyle }) {
  return (
    <Text
      accessibilityRole="header"
      style={[styles.title, { fontSize: size, lineHeight: Math.round(size * 1.08), letterSpacing: size >= 32 ? -0.6 : -0.2, color }, style]}
    >
      {children}
    </Text>
  );
}

export function Body({ children, color = colors.ink, size = 15, style }: { children: ReactNode; color?: string; size?: number; style?: TextStyle }) {
  return <Text style={[styles.body, { color, fontSize: size, lineHeight: Math.round(size * 1.5) }, style]}>{children}</Text>;
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'accent' | 'outline' | 'ghost' | 'danger' | 'onDark';
  /** A pictogram before the label, as on a sign. */
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  accessibilityHint?: string;
};

const PALETTE = {
  primary: { bg: colors.ink, hover: colors.inkSoft, fg: colors.surface, border: colors.ink },
  accent: { bg: colors.yellow, hover: '#F5B800', fg: colors.ink, border: colors.yellow },
  outline: { bg: 'transparent', hover: 'rgba(35,42,49,0.06)', fg: colors.ink, border: colors.ink },
  ghost: { bg: 'transparent', hover: 'rgba(35,42,49,0.06)', fg: colors.ink, border: 'transparent' },
  danger: { bg: colors.red, hover: colors.redDeep, fg: colors.surface, border: colors.red },
  onDark: { bg: 'transparent', hover: 'rgba(255,255,255,0.08)', fg: colors.surface, border: colors.inkLine },
} as const;

/** Keyboard focus is shown only after the Tab key, not after a click or tap (like :focus-visible). */
let keyboardMode = false;
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      keyboardMode = true;
    }
  });
  document.addEventListener('pointerdown', () => {
    keyboardMode = false;
  });
}

/** A focus ring for keyboards on the web; touch never shows it. */
const focusRing = Platform.OS === 'web' ? ({ outlineColor: colors.blue, outlineStyle: 'solid', outlineWidth: 2, outlineOffset: 2 } as unknown as ViewStyle) : {};

export function Button({ label, onPress, variant = 'primary', icon, disabled, loading, style, accessibilityHint }: ButtonProps) {
  const p = PALETTE[variant];
  const inactive = disabled || loading;
  const fg = inactive && (variant === 'primary' || variant === 'accent') ? colors.disabled : p.fg;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      disabled={inactive}
      style={(state) => {
        const { pressed, hovered, focused } = state as { pressed: boolean; hovered?: boolean; focused?: boolean };
        const off = inactive && (variant === 'primary' || variant === 'accent');
        return [
          styles.button,
          {
            backgroundColor: off ? colors.line : hovered || pressed ? p.hover : p.bg,
            borderColor: off ? colors.line : p.border,
            transform: [{ translateY: pressed ? 1 : 0 }],
          },
          variant === 'ghost' && styles.ghost,
          focused && keyboardMode && focusRing,
          style,
        ];
      }}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={19} color={variant === 'primary' && !inactive ? colors.yellow : fg} strokeWidth={2.2} /> : null}
          <Text style={[styles.buttonText, { color: fg }, variant === 'ghost' && styles.ghostText]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

/** A plain white surface. Use it for things that are objects (a ticket, a form), not for every section. */
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
      style={{ height, borderRadius: 1, backgroundColor: track, overflow: 'hidden' }}
    >
      <View style={{ width: `${pct * 100}%`, height, backgroundColor: color }} />
    </View>
  );
}

/**
 * Progress as stations on a line: done stations are filled with the line colour, the current
 * one wears the yellow "you are here" ring.
 */
export function Stations({ total, done, current, color = colors.ink, onDark }: { total: number; done: number; current?: number; color?: string; onDark?: boolean }) {
  const base = onDark ? colors.inkLine : colors.line;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: done }}
      style={styles.stations}
    >
      <View style={[styles.stationsTrack, { backgroundColor: base }]} />
      <View style={[styles.stationsTrack, { backgroundColor: color, right: undefined, width: `${total > 1 ? (Math.min(done, total - 1) / (total - 1)) * 100 : 0}%` }]} />
      {Array.from({ length: total }, (_, i) => {
        const isDone = i < done;
        const isHere = i === (current ?? done);
        return (
          <View
            key={i}
            style={[
              styles.station,
              { borderColor: isDone ? color : base, backgroundColor: isDone ? color : onDark ? colors.ink : colors.surface },
              isHere && !isDone && { borderColor: colors.ink, backgroundColor: colors.yellow, transform: [{ scale: 1.25 }] },
            ]}
          />
        );
      })}
    </View>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }
  return (
    <View accessibilityLiveRegion="polite" style={styles.error}>
      <Icon name="alert" size={16} color={colors.red} strokeWidth={2} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.mono, fontSize: 13, letterSpacing: 0.1 },
  title: { fontFamily: fonts.display },
  body: { fontFamily: fonts.body },
  button: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  ghost: { minHeight: 44, borderWidth: 0 },
  ghostText: { textDecorationLine: 'underline', fontFamily: fonts.displayMedium },
  buttonText: { fontFamily: fonts.displayBold, fontSize: 17, letterSpacing: 0.1 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16 },
  stations: { height: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stationsTrack: { position: 'absolute', left: 5, right: 5, height: 3, top: 5.5 },
  station: { width: 12, height: 12, borderRadius: 6, borderWidth: 2.5 },
  error: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderLeftWidth: 3, borderLeftColor: colors.red, paddingLeft: 10, paddingVertical: 4 },
  errorText: { flex: 1, fontFamily: fonts.bodyMedium, color: colors.red, fontSize: 14, lineHeight: 20 },
});
