import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme';

import { Icon } from './Icon';

export function Logo({ color = colors.surface }: { color?: string }) {
  return (
    <View style={styles.row} accessible accessibilityLabel="Gate 21">
      <View style={styles.mark}>
        <Icon name="plane" size={18} color={colors.ink} />
      </View>
      <Text style={[styles.text, { color }]}>GATE 21</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: fonts.mono, fontSize: 14, letterSpacing: 2 },
});
