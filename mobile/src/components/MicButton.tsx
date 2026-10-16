import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme';

import { Icon } from './Icon';

export type MicState = 'idle' | 'recording' | 'scoring' | 'done';

type Props = { state: MicState; onPress: () => void; size?: number; label?: string; disabled?: boolean };

/** Tap to start, tap again to stop. The ring shows the state: grey, yellow while listening, green when scored. */
export function MicButton({ state, onPress, size = 96, label, disabled }: Props) {
  const ring = state === 'recording' ? colors.yellow : state === 'done' ? colors.green : colors.line;
  const a11y = state === 'recording' ? 'Kaydı durdur' : 'Konuşmak için dokun';
  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={a11y}
        accessibilityState={{ disabled: !!disabled || state === 'scoring', busy: state === 'scoring' }}
        disabled={disabled || state === 'scoring'}
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: size > 70 ? 6 : 4,
            borderColor: ring,
            backgroundColor: disabled ? colors.disabled : colors.ink,
            transform: [{ scale: pressed ? 0.96 : 1 }],
          },
        ]}
      >
        {state === 'scoring' ? (
          <ActivityIndicator color={colors.yellow} />
        ) : (
          <Icon name={state === 'recording' ? 'close' : 'mic'} size={size * 0.38} color={colors.yellow} />
        )}
      </Pressable>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 12 },
  button: { alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.displayBold, fontSize: 16, color: colors.ink, textAlign: 'center' },
});
