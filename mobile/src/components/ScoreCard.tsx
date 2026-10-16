import { StyleSheet, Text, View } from 'react-native';

import type { Assessment } from '@/lib/types';
import { colors, fonts } from '@/theme';

import { Card, Label, ProgressBar } from './ui';

export function ScoreCard({ result }: { result: Assessment }) {
  const color = result.overall >= 80 ? colors.green : result.overall >= 60 ? colors.ink : colors.red;
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <Label>Telaffuz puanı</Label>
        <Text style={[styles.score, { color }]} accessibilityLabel={`Telaffuz puanı yüzde ${result.overall}`}>
          {result.overall}%
        </Text>
      </View>
      <ProgressBar value={result.overall / 100} color={color} track={colors.ground} height={4} />
      <Text style={styles.tip}>{result.tipTr}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  score: { fontFamily: fonts.display, fontSize: 40, letterSpacing: -1 },
  tip: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.inkLine },
});
