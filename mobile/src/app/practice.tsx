import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/Icon';
import { SpeakPanel } from '@/components/SpeakPanel';
import { TabBar } from '@/components/TabBar';
import { Body, Button, Card, ErrorNote, Label, Title } from '@/components/ui';
import { apiGet, apiSend } from '@/lib/api';
import { messageFor } from '@/lib/errors';
import { invalidateProgress, useMe } from '@/lib/queries';
import type { PracticeOverview } from '@/lib/types';
import { say } from '@/lib/voice';
import { colors, fonts } from '@/theme';

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
          <Label>{`KALIP ${drill + 1} / ${phrases.length}`}</Label>
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
          <Label>KEEP YOUR ENGLISH TRAVEL READY</Label>
          <Title size={30}>Haftada iki pratik</Title>
          <Card style={{ gap: 12 }}>
            <View style={styles.weekRow}>
              {DAYS.map((d, i) => (
                <View key={d} style={{ alignItems: 'center', gap: 4 }}>
                  <View style={[styles.dayDot, practiced.has(i) && { backgroundColor: colors.yellow, borderColor: colors.ink }]}>
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
          </Card>

          {!member ? (
            <Card style={{ gap: 10, borderWidth: 2, borderColor: colors.yellow }}>
              <Body>Pratik araçları üyelikle açılır. Yolculuğu bitirenler için daha uygun bir plan var.</Body>
              <Button label="Planları gör" variant="accent" onPress={() => router.push('/membership?plan=KEEP_READY')} />
            </Card>
          ) : (
            <>
              <Label style={{ marginTop: 8 }}>SENİN KALIPLARIN</Label>
              {phrases.length === 0 ? (
                <Body color={colors.muted}>Sahne raporlarındaki “bir dahakine kullan” kalıpları burada toplanır.</Body>
              ) : (
                <Card style={{ gap: 10 }}>
                  {phrases.map((p) => (
                    <Text key={p.en} style={styles.phraseLine}>{`• ${p.en}`}</Text>
                  ))}
                  <Button label={`${phrases.length} kalıbı tekrar et`} onPress={() => setDrill(0)} />
                </Card>
              )}
              <Label style={{ marginTop: 8 }}>SAHNELERİ YENİDEN OYNA</Label>
              <Body color={colors.muted} size={14}>Her seferinde farklı sürprizler çıkar.</Body>
              {(data?.scenes ?? []).map((s) => (
                <Pressable
                  key={s.chapter}
                  accessibilityRole="button"
                  onPress={() => router.push(`/scene/${s.scenario}?chapter=${s.chapter}`)}
                  style={styles.scene}
                >
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
  body: { padding: 20, gap: 14 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayDot: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  dayLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.muted },
  phraseLine: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },
  phraseCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 24, alignItems: 'center', gap: 10 },
  phraseBig: { fontFamily: fonts.displayBold, fontSize: 26, lineHeight: 31, color: colors.ink, textAlign: 'center' },
  phraseTr: { fontFamily: fonts.body, fontSize: 15, color: colors.muted, textAlign: 'center' },
  scene: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 14 },
  sceneTitle: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
});
