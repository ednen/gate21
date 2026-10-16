import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/Icon';
import { SpeakPanel } from '@/components/SpeakPanel';
import { TabBar } from '@/components/TabBar';
import { Body, Button, Card, ErrorNote, isHovered, Label, Title } from '@/components/ui';
import { apiGet, apiSend } from '@/lib/api';
import { messageFor } from '@/lib/errors';
import { invalidateProgress, useMe } from '@/lib/queries';
import type { PracticeOverview } from '@/lib/types';
import { say } from '@/lib/voice';
import { colors, fonts, gutter, lineColor, radius } from '@/theme';

const DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const PHRASES_PER_SESSION = 5;

/** Keep your English travel ready: twice a week, a few phrases from your own scenes, or a replay. */
export default function Practice() {
  const me = useMe();
  const overview = useQuery({ queryKey: ['practice'], queryFn: () => apiGet<PracticeOverview>('/api/v1/practice') });
  const [drill, setDrill] = useState<number | null>(null);
  const [said, setSaid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const member = me.data?.membership.active ?? false;
  const data = overview.data;
  const phrases = (data?.phrases ?? []).slice(0, PHRASES_PER_SESSION);

  const finish = async () => {
    try {
      await apiSend<PracticeOverview>('POST', '/api/v1/practice/done');
      await overview.refetch();
      await invalidateProgress();
      setDrill(null);
    } catch (e) {
      setError(messageFor(e));
    }
  };

  if (drill !== null && phrases[drill]) {
    const p = phrases[drill];
    const last = drill === phrases.length - 1;
    return (
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.body}>
          <Label>{`Kalıp ${drill + 1} / ${phrases.length}`}</Label>
          <Pressable accessibilityRole="button" accessibilityHint="Dinle" onPress={() => say(p.en)} style={styles.phraseCard}>
            <Text style={styles.phraseBig}>{p.en}</Text>
            {p.tr ? <Text style={styles.phraseTr}>{p.tr}</Text> : null}
            <Icon name="speaker" size={22} />
          </Pressable>
          <SpeakPanel key={p.en} reference={p.en} consent={me.data?.voiceConsent ?? false} onResult={() => setSaid(true)} />
          <ErrorNote message={error} />
          <Button
            label={last ? 'Pratiği bitir' : 'Sonraki kalıp'}
            disabled={!said}
            onPress={() => {
              setSaid(false);
              if (last) {
                void finish();
              } else {
                setDrill(drill + 1);
              }
            }}
          />
          <Button label="Vazgeç" variant="ghost" onPress={() => setDrill(null)} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const practiced = new Set((data?.practiceDays ?? []).map((d) => (new Date(`${d}T12:00:00`).getDay() + 6) % 7));
  return (
    <View style={styles.screen}>
      <ScrollView>
        <SafeAreaView edges={['top']} style={styles.body}>
          <Title size={34}>Pratik</Title>
          <Body color={colors.muted}>Keep your English travel ready: haftada iki kısa pratik yeter.</Body>
          <View style={styles.punchCard}>
            <View style={styles.weekRow}>
              {DAYS.map((d, i) => (
                <View key={d} style={{ alignItems: 'center', gap: 4 }}>
                  <View style={[styles.dayDot, practiced.has(i) && { backgroundColor: colors.yellow, borderColor: colors.yellow }]}>
                    {practiced.has(i) ? <Icon name="check" size={14} strokeWidth={2.6} /> : null}
                  </View>
                  <Text style={styles.dayLabel}>{d}</Text>
                </View>
              ))}
            </View>
            <Body>
              {(data?.thisWeek ?? 0) >= (data?.weeklyGoal ?? 2)
                ? 'Bu haftanın hedefi tamam. İngilizcen seyahate hazır!'
                : `Bu hafta ${data?.thisWeek ?? 0} / ${data?.weeklyGoal ?? 2} pratik. Birkaç dakika yeter.`}
            </Body>
          </View>

          {!member ? (
            <Card style={{ gap: 10, borderLeftWidth: 4, borderLeftColor: colors.yellow }}>
              <Body>Pratik araçları üyelikle açılır. Yolculuğu bitirenler için daha uygun bir plan var.</Body>
              <Button label="Planları gör" variant="accent" onPress={() => router.push('/membership?plan=KEEP_READY')} />
            </Card>
          ) : (
            <>
              <Text style={styles.section}>Senin kalıpların</Text>
              {phrases.length === 0 ? (
                <Body color={colors.muted}>Sahne raporlarındaki “bir dahakine kullan” kalıpları burada toplanır.</Body>
              ) : (
                <View style={{ gap: 12 }}>
                  <View>
                    {phrases.map((p) => (
                      <Text key={p.en} style={styles.phraseLine}>{p.en}</Text>
                    ))}
                  </View>
                  <Button label={`${phrases.length} kalıbı tekrar et`} icon="repeat" onPress={() => setDrill(0)} />
                </View>
              )}
              <Text style={styles.section}>Sahneleri yeniden oyna</Text>
              <Body color={colors.muted} size={14}>Her seferinde farklı sürprizler çıkar.</Body>
              {(data?.scenes ?? []).map((s) => (
                <Pressable
                  key={s.chapter}
                  accessibilityRole="button"
                  onPress={() => router.push(`/scene/${s.scenario}?chapter=${s.chapter}`)}
                  style={(st) => [styles.scene, (st.pressed || isHovered(st)) && { backgroundColor: 'rgba(35,42,49,0.05)' }]}
                >
                  <View style={[styles.sceneSwatch, { backgroundColor: lineColor(s.week) }]} />
                  <Icon name={s.icon as IconName} size={22} />
                  <Text style={styles.sceneTitle}>{s.titleTr}</Text>
                  <Icon name="arrowRight" size={18} />
                </Pressable>
              ))}
            </>
          )}
          <ErrorNote message={overview.isError ? messageFor(overview.error) : null} />
        </SafeAreaView>
      </ScrollView>
      <TabBar active="practice" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  body: { padding: gutter, gap: 14 },
  punchCard: { gap: 12, paddingVertical: 14, borderTopWidth: 2, borderBottomWidth: 1, borderTopColor: colors.ink, borderBottomColor: colors.line },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayDot: { width: 36, height: 36, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  dayLabel: { fontFamily: fonts.displayMedium, fontSize: 13, color: colors.muted },
  section: { fontFamily: fonts.display, fontSize: 21, color: colors.ink, marginTop: 14 },
  phraseLine: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.ink, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  phraseCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 22, gap: 10 },
  phraseBig: { fontFamily: fonts.display, fontSize: 30, lineHeight: 33, color: colors.ink },
  phraseTr: { fontFamily: fonts.body, fontSize: 15, color: colors.muted },
  scene: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line, paddingHorizontal: 4, borderRadius: radius.sm },
  sceneSwatch: { width: 4, height: 28, borderRadius: 1 },
  sceneTitle: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
});
