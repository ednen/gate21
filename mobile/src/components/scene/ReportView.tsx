import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { SceneReport } from '@/lib/types';
import { say } from '@/lib/voice';
import { colors, fonts } from '@/theme';

import { Icon } from '../Icon';
import { Card, Label, ProgressBar } from '../ui';

/** The coaching report: score, a more natural way to say each line, the hardest moment, phrases to keep. */
export function ReportView({ report }: { report: SceneReport }) {
  const tone = report.score >= 85 ? colors.green : report.score >= 60 ? colors.ink : colors.red;
  return (
    <View style={{ gap: 14 }}>
      <Card style={{ gap: 10 }}>
        <View style={styles.scoreRow}>
          <View style={{ gap: 2 }}>
            <Label>SAHNE PUANI</Label>
            <Text style={styles.meta}>
              {report.failedTurns === 0 && report.hintsUsed === 0
                ? 'Hiç takılmadan, ipucusuz!'
                : `${report.failedTurns} tekrar · ${report.hintsUsed} ipucu`}
            </Text>
          </View>
          <Text style={[styles.score, { color: tone }]} accessibilityLabel={`Sahne puanı ${report.score}`}>
            {report.score}
          </Text>
        </View>
        <ProgressBar value={report.score / 100} color={tone} track={colors.ground} height={8} />
      </Card>

      <Label>DAHA DOĞAL SÖYLEYİŞ</Label>
      <Card style={{ paddingVertical: 4 }}>
        {report.lines.map((line, i) => (
          <View key={i} style={[styles.line, i < report.lines.length - 1 && styles.divider]}>
            <View style={styles.lineTop}>
              <View style={[styles.mark, { backgroundColor: line.ok ? colors.green : colors.yellow }]}>
                <Icon name={line.ok ? 'check' : 'edit'} size={14} color={line.ok ? colors.surface : colors.ink} strokeWidth={2.4} />
              </View>
              <Text style={[styles.said, !line.ok && styles.saidChanged]}>{`“${line.said}”`}</Text>
            </View>
            {line.ok ? null : (
              <Pressable accessibilityRole="button" accessibilityHint="Dinle" onPress={() => say(line.better)} style={styles.betterRow}>
                <Text style={styles.better}>{line.better}</Text>
                <Icon name="speaker" size={16} />
              </Pressable>
            )}
            {line.noteTr ? <Text style={styles.note}>{line.noteTr}</Text> : null}
          </View>
        ))}
      </Card>

      <Card style={styles.hardest}>
        <Label color={colors.red}>EN ZORLANDIĞIN AN</Label>
        <Text style={styles.hardestText}>{report.hardestTr}</Text>
      </Card>

      {report.phrases.length > 0 ? (
        <>
          <Label>BİR DAHAKİNE KULLAN</Label>
          <View style={{ gap: 8 }}>
            {report.phrases.map((p) => (
              <Pressable
                key={p.en}
                accessibilityRole="button"
                accessibilityLabel={`${p.en}. ${p.tr}. Dinle`}
                onPress={() => say(p.en)}
                style={styles.phrase}
              >
                <View style={styles.phraseIcon}>
                  <Icon name="speaker" size={16} color={colors.yellow} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.phraseEn}>{p.en}</Text>
                  {p.tr ? <Text style={styles.phraseTr}>{p.tr}</Text> : null}
                </View>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.muted },
  score: { fontFamily: fonts.display, fontSize: 48, lineHeight: 50 },
  line: { paddingVertical: 12, gap: 6 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.ground },
  lineTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  mark: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  said: { flex: 1, fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.ink },
  saidChanged: { color: colors.muted },
  betterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 32, minHeight: 32 },
  better: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 22, color: colors.ink },
  note: { marginLeft: 32, fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.inkLine },
  hardest: { gap: 6, borderWidth: 2, borderColor: colors.redTint },
  hardestText: { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 21, color: colors.ink },
  phrase: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, backgroundColor: colors.surface },
  phraseIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  phraseEn: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  phraseTr: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
});
