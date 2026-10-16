import { router, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { DirectionsStep } from '@/components/lesson/DirectionsStep';
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
import { cityTr } from '@/components/Journey';
import { Body, Button, isHovered, Stations, Title } from '@/components/ui';
import { canPlay, chapter as getChapter, chapterInfo, level, manifest, stop } from '@/lib/content';
import { recordStep } from '@/lib/progress';
import { useMe } from '@/lib/queries';
import { accentForWeek, setDefaultAccent } from '@/lib/voice';
import type { Step } from '@/lib/types';
import { colors, fonts, gutter, lineColor, radius } from '@/theme';

const NAMES: Record<Step, string> = {
  DISCOVER: 'Tanış',
  PRONOUNCE: 'Telaffuz',
  MATCH: 'Eşleştir',
  RECOGNIZE: 'Anla',
  DIALOG: 'Diyalog',
  FORM: 'Form',
  SPEAK: 'Söyle',
  USE: 'Kullan',
  DIRECTIONS: 'Yol tarifi',
  SURVIVE: 'Sahne',
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
  DIRECTIONS: DirectionsStep,
};

export default function Lesson() {
  const { chapter: slug, step: startAt } = useLocalSearchParams<{ chapter: string; step?: string }>();
  const chapter = getChapter(slug);
  const info = chapterInfo(slug);
  // Words and sentences are heard in the accent of the week's city.
  useEffect(() => {
    setDefaultAccent(accentForWeek(info?.kind === 'starter' ? 0 : info?.week));
    return () => setDefaultAccent('en-GB');
  }, [info]);
  const me = useMe();
  const consent = me.data?.voiceConsent ?? false;
  // ?step=DIRECTIONS opens a lesson at that step (used by the demo and for testing).
  const [index, setIndex] = useState(() => Math.max(0, chapter?.steps.indexOf((startAt ?? '') as Step) ?? 0));

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
    ? `Başlangıç paketi, ${info.titleTr}`
    : simulation
      ? 'Final, bütün yolculuk'
      : `${info.day}. gün, ${stop(info.stop)?.title ?? info.title}, ${cityTr(lvl?.trip)}`;
  const line = lineColor(starter ? 0 : info.week);

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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Bölümü kapat"
            onPress={() => router.back()}
            style={(st) => [styles.close, (st.pressed || isHovered(st)) && { backgroundColor: colors.line }]}
          >
            <Icon name="close" size={22} strokeWidth={2.2} />
          </Pressable>
          <View style={{ flex: 1, gap: 1 }}>
            <Text style={styles.stepName}>{NAMES[step]}</Text>
            <Text style={styles.where} numberOfLines={1}>{header}</Text>
          </View>
          <Text style={styles.count} accessibilityLabel={`${steps.length} adımdan ${index + 1}.`}>
            <Text style={{ color: colors.ink }}>{index + 1}</Text>
            {` / ${steps.length}`}
          </Text>
        </View>
        {steps.length > 1 ? <Stations total={steps.length} done={index} color={line} /> : null}
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {step === 'SURVIVE' ? (
          <View style={{ gap: 18 }}>
            <View style={styles.sceneSign}>
              <Icon name="chat" size={20} color={colors.yellow} />
              <Text style={styles.sceneSignText}>{simulation ? 'Final sahnesi' : 'Sahne'}</Text>
            </View>
            <Title size={34}>{simulation ? 'Bütün bir yolculuk' : 'Şimdi gerçeği gibi'}</Title>
            <Body color={colors.inkLine}>
              {simulation
                ? 'Havalimanı, taksi, otel ve restoran: dört farklı kişi, dört farklı aksan ve yol boyunca birkaç sürpriz. Sonunda neyi hatırladığını da soracağız.'
                : 'Öğrendiklerini bir konuşmada kullanacaksın. Karşındaki kişi seninle konuşacak ve bir noktada beklenmedik bir şey olacak. Sonunda bir rapor alırsın.'}
            </Body>
            <View style={[styles.missionBox, { borderLeftColor: line }]}>
              <Text style={styles.missionLabel}>Görevin</Text>
              <Text style={styles.mission}>{chapter.mission}</Text>
              <Body size={14} color={colors.muted}>{chapter.missionTr}</Body>
            </View>
            <Button
              label="Sahneye başla"
              variant="accent"
              icon="mic"
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
  header: { paddingHorizontal: gutter, paddingTop: 8, paddingBottom: 14, gap: 14, borderBottomWidth: 1, borderBottomColor: colors.line },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  close: { width: 40, height: 40, marginLeft: -8, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  stepName: { fontFamily: fonts.display, fontSize: 24, lineHeight: 26, color: colors.ink, letterSpacing: -0.3 },
  where: { fontFamily: fonts.displayMedium, fontSize: 13, color: colors.muted },
  count: { fontFamily: fonts.displayBold, fontSize: 16, color: colors.muted },
  body: { padding: gutter, paddingBottom: 40 },
  sceneSign: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.ink, paddingHorizontal: 12, height: 36, borderRadius: radius.sm },
  sceneSignText: { fontFamily: fonts.display, fontSize: 16, color: colors.surface },
  missionBox: { borderLeftWidth: 4, paddingLeft: 14, gap: 4, paddingVertical: 2 },
  missionLabel: { fontFamily: fonts.displayMedium, fontSize: 13, color: colors.muted },
  mission: { fontFamily: fonts.display, fontSize: 22, lineHeight: 25, color: colors.ink },
});
