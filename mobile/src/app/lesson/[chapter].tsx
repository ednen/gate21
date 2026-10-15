import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { DiscoverStep, PronounceStep, RecognizeStep, SpeakStep, UseStep } from '@/components/lesson/Steps';
import { Body, Button, Card, Label, Title } from '@/components/ui';
import { chapter as getChapter, chapterInfo, isSimulation } from '@/lib/content';
import { recordStep } from '@/lib/progress';
import { useMe } from '@/lib/queries';
import { STEPS } from '@/lib/types';
import { colors, fonts } from '@/theme';

const NAMES = ['Discover', 'Pronounce', 'Recognize', 'Speak', 'Use', 'Survive'];

export default function Lesson() {
  const { chapter: slug } = useLocalSearchParams<{ chapter: string }>();
  const chapter = getChapter(slug);
  const info = chapterInfo(slug);
  const me = useMe();
  const consent = me.data?.voiceConsent ?? false;
  // Full Trip has no lesson steps: it opens straight on the Survive step.
  const simulation = chapter ? isSimulation(chapter) : false;
  const [step, setStep] = useState(simulation ? 5 : 0);

  if (!chapter || !info) {
    return (
      <SafeAreaView style={[styles.screen, { padding: 20, gap: 16 }]}>
        <Title>Bu bölüm bulunamadı</Title>
        <Button label="Bugüne dön" onPress={() => router.replace('/home')} />
      </SafeAreaView>
    );
  }

  const done = (score: number | null) => {
    void recordStep(chapter.slug, STEPS[step], score);
    setStep(step + 1);
  };
  const props = isSimulation(chapter) ? null : { chapter, consent, onDone: done };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Bölümü kapat" onPress={() => router.back()} style={styles.close}>
            <Icon name="close" size={20} strokeWidth={2} />
          </Pressable>
          <View style={{ alignItems: 'center', gap: 2 }}>
            <Label>{`BÖLÜM ${info.order} · ${info.title.toUpperCase()}`}</Label>
            <Text style={styles.stepName}>{NAMES[step]}</Text>
          </View>
          <Text style={styles.count} accessibilityLabel={simulation ? 'Tek sahne' : `6 adımdan ${step + 1}.`}>
            {simulation ? '1/1' : `${step + 1}/6`}
          </Text>
        </View>
        {simulation ? null : (
          <View style={styles.bars}>
            {NAMES.map((n, i) => (
              <View key={n} style={[styles.bar, { backgroundColor: i <= step ? colors.ink : colors.line }]} />
            ))}
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {props && step === 0 && <DiscoverStep {...props} />}
        {props && step === 1 && <PronounceStep {...props} />}
        {props && step === 2 && <RecognizeStep {...props} />}
        {props && step === 3 && <SpeakStep {...props} />}
        {props && step === 4 && <UseStep {...props} />}
        {step === 5 && (
          <View style={{ gap: 16 }}>
            <Text style={styles.surviveTag}>SURVIVE</Text>
            <Title>{simulation ? 'Bütün bir yolculuk' : 'Gerçek hayat simülasyonu'}</Title>
            <Body color={colors.inkLine}>
              {simulation
                ? 'Havalimanı, taksi, otel ve restoran — dört farklı kişi, dört farklı aksan ve yol boyunca birkaç sürpriz. Sonunda neyi hatırladığını da soracağız.'
                : 'Şimdi öğrendiklerini bir sahnede kullanacaksın. Karşındaki yapay zekâ seninle konuşacak ve bir noktada beklenmedik bir şey olacak. Sonunda sana bir rapor vereceğiz.'}
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
              onPress={() => router.replace(`/scene/${chapter.survive.scenario}?chapter=${chapter.slug}`)}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  header: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.line, paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
