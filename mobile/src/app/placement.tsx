import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Logo } from '@/components/Logo';
import { OptionButton } from '@/components/OptionButton';
import { SpeakPanel } from '@/components/SpeakPanel';
import { Body, Button, Card, ErrorNote, Label, ProgressBar, Title } from '@/components/ui';
import { apiSend } from '@/lib/api';
import { placement } from '@/lib/content';
import { messageFor } from '@/lib/errors';
import { invalidateProgress, useMe } from '@/lib/queries';
import { scheduleDailyReminder } from '@/lib/reminders';
import type { PlacementResult } from '@/lib/types';
import { colors, fonts } from '@/theme';

type Phase = 'intro' | 'questions' | 'speaking' | 'result';

/** The 2-minute travel check: 5 questions + 2 speaking tasks. Also the Day 21 final check. */
export default function Placement() {
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  const isFinal = kind === 'FINAL';
  const me = useMe();
  const consent = me.data?.voiceConsent ?? false;

  const [phase, setPhase] = useState<Phase>('intro');
  const [qi, setQi] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [si, setSi] = useState(0);
  const [speakingScores, setSpeakingScores] = useState<number[]>([]);
  const [spokenStep, setSpokenStep] = useState(false);
  const [result, setResult] = useState<PlacementResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const questions = placement.questions;
  const total = questions.length + placement.speaking.length;
  const picked = answers[qi] ?? null;

  const submit = async (scores: number[]) => {
    setBusy(true);
    setError(null);
    try {
      const r = await apiSend<PlacementResult>('POST', '/api/v1/placement', {
        kind: isFinal ? 'FINAL' : 'INITIAL',
        answers,
        speakingScores: scores,
      });
      setResult(r);
      setPhase('result');
      void invalidateProgress();
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  };

  const nextQuestion = () => {
    if (qi < questions.length - 1) {
      setQi(qi + 1);
    } else {
      setPhase('speaking');
    }
  };

  const nextSpeaking = () => {
    if (si < placement.speaking.length - 1) {
      setSi(si + 1);
      setSpokenStep(false);
    } else {
      void submit(speakingScores);
    }
  };

  const start = async () => {
    if (!isFinal && me.data) {
      await scheduleDailyReminder(me.data.reminderHour).catch(() => false);
    }
    router.replace(isFinal ? '/progress' : result?.starter ? '/lesson/starter-alphabet' : '/home');
  };

  if (phase === 'intro') {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.ink }]}>
        <View style={styles.introBody}>
          <Logo />
          <View style={{ flex: 1, justifyContent: 'center', gap: 18 }}>
            <Label color={colors.yellow}>{isFinal ? '21. GÜN · FİNAL TESTİ' : '2 DAKİKALIK SEYAHAT TESTİ'}</Label>
            <Text accessibilityRole="header" style={styles.introTitle}>You're flying tomorrow.</Text>
            <Body color="#D4D9DF" size={19}>Bu durumlarla İngilizce başa çıkabilir misin?</Body>
            <View style={styles.chips}>
              {['5 kısa soru', '2 konuşma görevi', 'yaklaşık 2 dakika'].map((c) => (
                <Text key={c} style={styles.chip}>{c}</Text>
              ))}
            </View>
          </View>
          <Button label="Teste başla" variant="accent" onPress={() => setPhase('questions')} />
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'result' && result) {
    return (
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.body}>
          <Label>SEYAHAT İNGİLİZCESİ PUANIN</Label>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Text style={styles.bigScore}>{result.score}</Text>
            <Text style={styles.outOf}>/100</Text>
          </View>
          <ProgressBar value={result.score / 100} height={12} />
          <Body size={17}>{result.messageTr}</Body>
          {isFinal ? (
            me.data?.placementScore != null ? (
              <Card>
                <Label>ÖNCE → SONRA</Label>
                <Text style={styles.beforeAfter}>{me.data.placementScore} → {result.score}</Text>
              </Card>
            ) : null
          ) : (
            <Card style={{ borderWidth: 2, borderColor: colors.yellow, gap: 4 }}>
              <Label>ÖNERİLEN BAŞLANGIÇ</Label>
              <Title size={20}>
                {result.starter ? 'Başlangıç paketi: 5 kısa ders' : `${result.level} — ${result.startDayApplied ? result.startDay : 1}. gün`}
              </Title>
              {result.starter ? (
                <Body size={14} color={colors.muted}>Alfabe, sayılar, kodlama, zamirler ve ilk kelimeler. 21 günün bundan sonra başlar.</Body>
              ) : null}
            </Card>
          )}
          {!isFinal ? <Body color={colors.muted} size={14}>21. günde tekrar test olacaksın, farkı kendin göreceksin.</Body> : null}
          <View style={{ flex: 1 }} />
          <Button label={isFinal ? 'Sonuçlarıma git' : result.starter ? 'Başlangıç paketiyle başla' : '21 günümü başlat'} onPress={start} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const done = phase === 'questions' ? qi + (picked !== null ? 1 : 0) : questions.length + si + (spokenStep ? 1 : 0);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={{ gap: 10 }}>
          <View style={styles.progressRow}>
            <Label>{`SORU ${phase === 'questions' ? qi + 1 : questions.length + si + 1} / ${total}`}</Label>
            <Label>{phase === 'questions' ? questions[qi].tag ?? '' : 'KONUŞMA'}</Label>
          </View>
          <ProgressBar value={done / total} />
        </View>

        {phase === 'questions' ? (
          <>
            <Title size={26}>{questions[qi].prompt}</Title>
            <View style={{ gap: 10 }}>
              {questions[qi].options.map((text, i) => (
                <OptionButton
                  key={text}
                  index={i}
                  text={text}
                  disabled={picked !== null}
                  state={picked === null ? 'idle' : i === questions[qi].answer ? 'correct' : i === picked ? 'wrong' : 'idle'}
                  onPress={() => setAnswers((a) => Object.assign([...a], { [qi]: i }))}
                />
              ))}
            </View>
            {picked !== null ? (
              <Card>
                <Body size={14}>{questions[qi].explainTr}</Body>
              </Card>
            ) : null}
            <View style={{ flex: 1 }} />
            <Button label="İleri" onPress={nextQuestion} disabled={picked === null} />
          </>
        ) : (
          <>
            <Body color={colors.muted} size={16}>{placement.speaking[si].situationTr}</Body>
            <Card style={{ gap: 10 }}>
              <Label>SESLİ SÖYLE</Label>
              <Title size={26}>{`“${placement.speaking[si].phrase}”`}</Title>
            </Card>
            <SpeakPanel
              key={si}
              reference={placement.speaking[si].phrase}
              consent={consent}
              onResult={(score) => {
                if (score !== null) {
                  setSpeakingScores((s) => [...s, score]);
                }
                setSpokenStep(true);
              }}
            />
            <ErrorNote message={error} />
            <View style={{ flex: 1 }} />
            <Button
              label={si < placement.speaking.length - 1 ? 'İleri' : 'Puanımı göster'}
              onPress={nextSpeaking}
              disabled={!spokenStep}
              loading={busy}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  introBody: { flex: 1, padding: 24, gap: 24 },
  introTitle: { fontFamily: fonts.display, fontSize: 50, lineHeight: 50, color: colors.surface },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#4A515C',
  },
  body: { flexGrow: 1, padding: 20, gap: 18 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  bigScore: { fontFamily: fonts.display, fontSize: 112, lineHeight: 112, color: colors.ink },
  outOf: { fontFamily: fonts.displayMedium, fontSize: 30, color: colors.muted },
  beforeAfter: { fontFamily: fonts.display, fontSize: 36, color: colors.ink },
});
