import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius } from '@/theme';

/** The wordmark is a gate sign: "Gate" in the panel's colour, the number on a yellow plate. */
export function Logo({ color = colors.surface }: { color?: string }) {
  return (
    <View style={styles.row} accessible accessibilityLabel="Gate 21">
      <Text style={[styles.gate, { color }]}>Gate</Text>
      <View style={styles.plate}>
        <Text style={styles.number}>21</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gate: { fontFamily: fonts.display, fontSize: 22, letterSpacing: -0.3 },
  plate: { backgroundColor: colors.yellow, borderRadius: radius.sm, paddingHorizontal: 6, height: 26, justifyContent: 'center' },
  number: { fontFamily: fonts.display, fontSize: 20, color: colors.ink, letterSpacing: -0.3 },
});
