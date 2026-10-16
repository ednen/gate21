import { router, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import {
  DialogStep,
  DiscoverStep,
  FormStep,
  MatchStep,
  PronounceStep,
  RecognizeStep,
  SpeakStep,
  type StepProps,
  UseStep,
} from '@/components/lesson/Steps';
import { Body, Button, Card, Label, Title } from '@/components/ui';
import { canPlay, chapter as getChapter, chapterInfo, level, manifest, stop } from '@/lib/content';
import { recordStep } from '@/lib/progress';
import { useMe } from '@/lib/queries';
import { accentForWeek, setDefaultAccent } from '@/lib/voice';
import type { Step } from '@/lib/types';
import { colors, fonts } from '@/theme';

const NAMES: Record<Step, string> = {
  DISCOVER: 'Tanış',
  PRONOUNCE: 'Telaffuz',
  MATCH: 'Eşleştir',
  RECOGNIZE: 'Anla',
  DIALOG: 'Diyalog',
  FORM: 'Form',
  SPEAK: 'Söyle',
  USE: 'Kullan',
  SURVIVE: 'Survive',
};

const STEP_VIEWS: Partial<Record<Step, (props: StepProps) => ReactNode>> = {
  DISCOVER: DiscoverStep,
  PRONOUNCE: PronounceStep,
  MATCH: MatchStep,
  RECOGNIZE: RecognizeStep,
  DIALOG: DialogStep,
  FORM: FormStep,
  SPEAK: SpeakStep,
  USE: UseStep,
};

export default function Lesson() {
  const { chapter: slug } = useLocalSearchParams<{ chapter: string }>();
  const chapter = getChapter(slug);
  const info = chapterInfo(slug);
  // Words and sentences are heard in the accent of the week's city.
  useEffect(() => {
    setDefaultAccent(accentForWeek(info?.kind === 'starter' ? 0 : info?.week));
    return () => setDefaultAccent('en-GB');
  }, [info]);
  const me = useMe();
  const consent = me.data?.voiceConsent ?? false;
  const [index, setIndex] = useState(0);

  // Opening a chapter outside the learner's plan leads to the membership page instead.
  const allowed = !info || !me.data || canPlay(info, me.data.membership.active, manifest().freeDays);
  useEffect(() => {
    if (!allowed) {
      router.replace(`/membership?from=${slug}`);
    }
  }, [allowed, slug]);

  if (!chapter || !info) {
    return (
      <SafeAreaView style={[styles.screen, { padding: 20, gap: 16 }]}>
        <Title>Bu bölüm bulunamadı</Title>
        <Button label="Bugüne dön" onPress={() => router.replace('/home')} />
      </SafeAreaView>
    );
  }

  const steps = chapter.steps;
  const step = steps[index];
  const starter = info.kind === 'starter';
  const simulation = info.kind === 'simulation';
  const lvl = level(info.week);
  const header = starter
    ? `BAŞLANGIÇ · ${info.titleTr.toUpperCase()}`
    : simulation
      ? 'FİNAL · BÜTÜN YOLCULUK'
      : `${info.day}. GÜN · ${(stop(info.stop)?.title ?? info.title).toUpperCase()} · ${lvl?.id ?? ''}`;

  const done = (score: number | null) => {
    void recordStep(chapter.slug, step, score);
    if (index === steps.length - 1) {
      router.replace(`/badge/${chapter.slug}`);
    } else {
      setIndex(index + 1);
    }
  };
  const View_ = STEP_VIEWS[step];

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Bölümü kapat" onPress={() => router.back()} style={styles.close}>
            <Icon name="close" size={20} strokeWidth={2} />
          </Pressable>
          <View style={{ alignItems: 'center', gap: 2, flex: 1 }}>
            <Label style={{ textAlign: 'center' }}>{header}</Label>
            <Text style={styles.stepName}>{NAMES[step]}</Text>
          </View>
          <Text style={styles.count} accessibilityLabel={`${steps.length} adımdan ${index + 1}.`}>
            {`${index + 1}/${steps.length}`}
          </Text>
        </View>
        {steps.length > 1 ? (
          <View style={styles.bars}>
            {steps.map((s, i) => (
              <View key={s} style={[styles.bar, { backgroundColor: i <= index ? colors.ink : colors.line }]} />
            ))}
          </View>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {step === 'SURVIVE' ? (
          <View style={{ gap: 16 }}>
            <Text style={styles.surviveTag}>SURVIVE</Text>
            <Title>{simulation ? 'Bütün bir yolculuk' : 'Gerçek hayat simülasyonu'}</Title>
            <Body color={colors.inkLine}>
              {simulation
                ? 'Havalimanı, taksi, otel ve restoran — dört farklı kişi, dört farklı aksan ve yol boyunca birkaç sürpriz. Sonunda neyi hatırladığını da soracağız.'
                : 'Şimdi öğrendiklerini bir sahnede kullanacaksın. Karşındaki kişi seninle konuşacak ve bir noktada beklenmedik bir şey olacak. Sonunda sana bir rapor vereceğiz.'}
            </Body>
            <Card style={{ gap: 6 }}>
              <Label>GÖREV</Label>
              <Text style={styles.mission}>{chapter.mission}</Text>
              <Body size={14} color={colors.muted}>{chapter.missionTr}</Body>
            </Card>
            <Button
              label="Sahneye başla"
              variant="accent"
              icon="arrowRight"
              onPress={() => router.replace(`/scene/${chapter.survive?.scenario}?chapter=${chapter.slug}`)}
            />
          </View>
        ) : View_ ? (
          <View_ key={step} chapter={chapter} consent={consent} onDone={done} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  header: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.line, paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.ground, alignItems: 'center', justifyContent: 'center' },
  stepName: { fontFamily: fonts.displayBold, fontSize: 18, color: colors.ink },
  count: { width: 44, textAlign: 'right', fontFamily: fonts.mono, fontSize: 12, color: colors.ink },
  bars: { flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 6, borderRadius: 3 },
  body: { padding: 16, paddingBottom: 32 },
  surviveTag: {
    alignSelf: 'flex-start',
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.yellow,
    backgroundColor: colors.ink,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    overflow: 'hidden',
  },
  mission: { fontFamily: fonts.displayBold, fontSize: 20, color: colors.ink },
});
