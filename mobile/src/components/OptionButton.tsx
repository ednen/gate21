import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme';

import { isHovered } from './ui';

type Props = {
  index: number;
  text: string;
  state: 'idle' | 'correct' | 'wrong' | 'selected';
  onPress: () => void;
  disabled?: boolean;
};

const LETTERS = ['A', 'B', 'C', 'D'];

export function OptionButton({ index, text, state, onPress, disabled }: Props) {
  const look = {
    idle: { border: colors.line, bg: colors.surface, badgeBg: colors.ground, badgeFg: colors.ink, mark: LETTERS[index] },
    selected: { border: colors.ink, bg: colors.yellowTint, badgeBg: colors.ink, badgeFg: colors.yellow, mark: LETTERS[index] },
    correct: { border: colors.green, bg: colors.greenTint, badgeBg: colors.green, badgeFg: colors.surface, mark: '✓' },
    wrong: { border: colors.red, bg: colors.redTint, badgeBg: colors.red, badgeFg: colors.surface, mark: '✕' },
  }[state];
  const a11yState = state === 'correct' ? ', doğru' : state === 'wrong' ? ', yanlış' : '';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${LETTERS[index]}: ${text}${a11yState}`}
      accessibilityState={{ disabled: !!disabled, selected: state !== 'idle' }}
      disabled={disabled}
      onPress={onPress}
      style={(st) => [styles.option, { borderColor: look.border, backgroundColor: look.bg }, state === 'idle' && !disabled && (st.pressed || isHovered(st)) && { borderColor: colors.ink }]}
    >
      <View style={[styles.badge, { backgroundColor: look.badgeBg }]}>
        <Text style={[styles.badgeText, { color: look.badgeFg }]}>{look.mark}</Text>
      </View>
      <Text style={styles.text}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  option: {
    minHeight: 58,
    borderWidth: 1.5,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  badge: { width: 28, height: 28, borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.display, fontSize: 15 },
  text: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.ink },
});
