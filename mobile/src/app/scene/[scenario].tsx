import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/Icon';
import { MicButton, type MicState } from '@/components/MicButton';
import { MemoryQuiz } from '@/components/scene/MemoryQuiz';
import { ReportView } from '@/components/scene/ReportView';
import { Body, Button, Card, ErrorNote, Label, Title } from '@/components/ui';
import { apiGet, apiSend } from '@/lib/api';
import { messageFor } from '@/lib/errors';
import { recordStep } from '@/lib/progress';
import { useMe } from '@/lib/queries';
import { surviveScore } from '@/lib/sentence';
import type { Difficulty, SceneMessage, SceneReport, SceneView } from '@/lib/types';
import { sayAll, sendTurn, useVoiceRecorder } from '@/lib/voice';
import { colors, fonts } from '@/theme';

type Item =
  | { id: number; who: 'ai'; kind: SceneMessage['kind']; role: string; text: string; voice: string | null }
  | { id: number; who: 'you'; text: string; note?: string; ok?: boolean }
  | { id: number; who: 'scene'; text: string; role: string };

type Phase = 'scene' | 'report' | 'memory' | 'finished';

const ROLE_ICON: Record<string, IconName> = {
  'Airline staff': 'plane',
  'Taxi driver': 'map',
  Receptionist: 'bed',
  Waiter: 'utensils',
  'Shop assistant': 'bag',
};

/** Speech rate grows with the level; READY also keeps one clear accent. */
const RATE: Record<Difficulty, number> = { READY: 0.85, CONFIDENT: 0.95, PRO: 1.05 };
const LEVEL_LABEL: Record<Difficulty, string> = { READY: 'READY', CONFIDENT: 'CONFIDENT', PRO: 'PRO' };

/** The "Can you actually survive this?" scene, then its coaching report and memory check. */
export default function Scene() {
  const { scenario, chapter } = useLocalSearchParams<{ scenario: string; chapter: string }>();
  const me = useMe();
  const consent = me.data?.voiceConsent ?? false;
  const voice = useVoiceRecorder();

  const [view, setView] = useState<SceneView | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [option, setOption] = useState<string | null>(null);
  const [hintShown, setHintShown] = useState(false);
  const [mic, setMic] = useState<MicState>('idle');
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [startKey, setStartKey] = useState(0);
  const [phase, setPhase] = useState<Phase>('scene');
  const [report, setReport] = useState<SceneReport | null>(null);
  const [missed, setMissed] = useState(0);
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const nextId = useRef(0);

  const difficulty: Difficulty = view?.difficulty ?? 'READY';
  const hideText = difficulty !== 'READY';

  const show = (messages: SceneMessage[], level: Difficulty) => {
    const added: Item[] = messages.map((m) =>
      m.kind === 'transition'
        ? { id: nextId.current++, who: 'scene', text: m.text, role: m.role }
        : { id: nextId.current++, who: 'ai', kind: m.kind, role: m.role, text: m.text, voice: m.voice },
    );
    setItems((list) => [...list, ...added]);
    sayAll(
      messages
        .filter((m) => m.kind !== 'transition')
        .map((m) => ({ text: m.text, voice: level === 'READY' ? 'en-US' : m.voice })),
      RATE[level],
    );
  };

  useEffect(() => {
    let cancelled = false;
    setItems([]);
    setRevealed(new Set());
    setOption(null);
    setHintShown(false);
    setError(null);
    setPhase('scene');
    setReport(null);
    apiSend<SceneView>('POST', '/api/v1/roleplay/sessions', { scenario })
      .then((v) => {
        if (cancelled) {
          return;
        }
        setView(v);
        show(v.messages, v.difficulty);
      })
      .catch((e) => !cancelled && setError(messageFor(e)));
    return () => {
      cancelled = true;
    };
    // `show` only uses refs and setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario, startKey]);

  // A new step: forget the chosen option and hide the hint again.
  useEffect(() => {
    setOption(null);
    setHintShown(false);
  }, [view?.stepIndex]);

  const hintVisible = !!view?.hintsAllowed && (difficulty === 'READY' || hintShown);
  const intended = option ?? (hintVisible ? view?.hint ?? null : null);

  const send = async (text: string, withAudio: boolean) => {
    if (!view) {
      return;
    }
    setMic('scoring');
    setError(null);
    try {
      const recording = withAudio ? await voice.stop() : null;
      const next = await sendTurn(view.sessionId, text, recording, difficulty === 'CONFIDENT' && hintShown);
      setItems((list) => [
        ...list,
        { id: nextId.current++, who: 'you', text: next.userText ?? text, note: next.feedbackTr ?? undefined, ok: next.goalMet ?? undefined },
      ]);
      show(next.messages, next.difficulty);
      setView(next);
      setTyped('');
      setTyping(false);
      setMic('idle');
    } catch (e) {
      setError(messageFor(e));
      setMic('idle');
    }
  };

  const pressMic = async () => {
    setError(null);
    if (!consent) {
      // Listen-and-repeat: the learner says the suggestion aloud, then taps.
      if (intended) {
        void send(intended, false);
      }
      return;
    }
    if (mic === 'recording') {
      void send(intended ?? '', true);
      return;
    }
    if (await voice.start()) {
      setMic('recording');
    } else {
      setError('Mikrofon izni verilmedi. Yazarak da cevap verebilirsin.');
    }
  };

  const openReport = async () => {
    if (!view) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setReport(await apiGet<SceneReport>(`/api/v1/roleplay/sessions/${view.sessionId}/report`));
      setPhase('report');
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  };

  const finish = (memoryMissed: number) => {
    setMissed(memoryMissed);
    if (report?.completed && chapter) {
      void recordStep(chapter, 'SURVIVE', surviveScore(report.score, memoryMissed));
    }
    setPhase('finished');
  };

  const header = (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Sahneden çık" onPress={() => router.back()} style={styles.back}>
          <Icon name="arrowLeft" size={20} color={colors.surface} strokeWidth={2} />
        </Pressable>
        <View style={styles.avatar}>
          <Icon name={ROLE_ICON[view?.role ?? ''] ?? 'chat'} size={24} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.role} numberOfLines={1}>{phase === 'scene' ? view?.role ?? '' : 'Sahne raporu'}</Text>
          <Text style={styles.setting} numberOfLines={1}>{phase === 'scene' ? view?.setting ?? '' : view?.title ?? ''}</Text>
        </View>
        <Text style={styles.level}>{LEVEL_LABEL[difficulty]}</Text>
      </View>
      {phase === 'scene' && view ? (
        <View style={styles.progress} accessibilityLabel={`${view.totalSteps} adımdan ${Math.min(view.stepIndex + 1, view.totalSteps)}.`}>
          {Array.from({ length: view.totalSteps }, (_, i) => (
            <View key={i} style={[styles.progressBar, { backgroundColor: i < view.stepIndex ? colors.yellow : colors.inkLine }]} />
          ))}
        </View>
      ) : null}
    </View>
  );

  if (phase !== 'scene' && report) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
        {header}
        <ScrollView key={phase} style={{ backgroundColor: colors.ground }} contentContainerStyle={styles.body}>
          {phase === 'report' ? (
            <>
              <ReportView report={report} />
              <Button
                label={report.memory.length > 0 ? 'Neyi hatırlıyorsun? (kısa test)' : 'Devam'}
                onPress={() => (report.memory.length > 0 ? setPhase('memory') : finish(0))}
              />
            </>
          ) : phase === 'memory' ? (
            <MemoryQuiz questions={report.memory} onDone={finish} />
          ) : (
            <View style={{ gap: 16 }}>
              <Title size={28}>{report.completed ? 'Bu durumdan çıktın.' : 'Bu sefer olmadı — sorun değil.'}</Title>
              <Card style={{ gap: 8 }}>
                <Label>SONUÇ</Label>
                <Body>{`Sahne puanı: ${report.score}`}</Body>
                {report.memory.length > 0 ? (
                  <Body>{`Akılda tutma: ${report.memory.length - missed} / ${report.memory.length}`}</Body>
                ) : null}
              </Card>
              {report.completed && chapter ? (
                <Button label="Rozetimi al" variant="accent" onPress={() => router.replace(`/badge/${chapter}`)} />
              ) : null}
              <Button label="Sahneyi baştan oyna" variant="outline" onPress={() => setStartKey((k) => k + 1)} />
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      {header}

      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        contentContainerStyle={styles.chat}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
      >
        {view?.briefTr ? (
          <View style={styles.brief}>
            <Label>GÖREVİN</Label>
            <Text style={styles.briefText}>{view.briefTr}</Text>
            {hideText ? <Text style={styles.briefNote}>Karşındakini önce dinle; metni sonra açabilirsin.</Text> : null}
          </View>
        ) : null}
        {!view && !error ? <ActivityIndicator color={colors.ink} style={{ marginTop: 40 }} /> : null}

        {items.map((m) => {
          if (m.who === 'scene') {
            return (
              <View key={m.id} style={styles.transition} accessibilityRole="header">
                <View style={styles.transitionLine} />
                <Text style={styles.transitionText}>{`${m.role} · ${m.text}`}</Text>
                <View style={styles.transitionLine} />
              </View>
            );
          }
          if (m.who === 'you') {
            return (
              <View key={m.id} style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={[styles.who, m.ok && { color: colors.green }]}>SEN</Text>
                <View style={[styles.bubble, styles.youBubble]}>
                  <Text style={[styles.bubbleText, { color: colors.surface }]}>{m.text}</Text>
                </View>
                {m.note ? <Text style={[styles.note, { color: m.ok ? colors.green : colors.muted }]}>{m.note}</Text> : null}
              </View>
            );
          }
          const twist = m.kind === 'twist';
          const hidden = hideText && !revealed.has(m.id);
          return (
            <View key={m.id} style={{ alignItems: 'flex-start', gap: 4 }}>
              <Text style={[styles.who, twist && { color: colors.red }]}>
                {twist ? `${m.role.toUpperCase()} · BEKLENMEDİK` : m.role.toUpperCase()}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={hidden ? 'Tekrar dinle. Metni göstermek için uzun bas' : m.text}
                accessibilityHint={hidden ? undefined : 'Tekrar dinle'}
                onPress={() => sayAll([{ text: m.text, voice: difficulty === 'READY' ? 'en-US' : m.voice }], RATE[difficulty])}
                onLongPress={() => setRevealed((r) => new Set(r).add(m.id))}
                style={[styles.bubble, styles.aiBubble, twist && { borderColor: colors.red }]}
              >
                {hidden ? (
                  <View style={styles.hiddenRow}>
                    <Icon name="speaker" size={18} />
                    <Text style={styles.hiddenText}>Dinle</Text>
                  </View>
                ) : (
                  <Text style={styles.bubbleText}>{m.text}</Text>
                )}
              </Pressable>
              {hidden ? (
                <Pressable accessibilityRole="button" onPress={() => setRevealed((r) => new Set(r).add(m.id))} style={styles.revealBtn}>
                  <Text style={styles.reveal}>Metni göster</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView edges={['bottom']} style={styles.footer}>
          <ErrorNote message={error} />
          {view?.done ? (
            <View style={{ gap: 12 }}>
              <View style={styles.doneRow}>
                <View style={[styles.doneIcon, !view.completed && { backgroundColor: colors.red }]}>
                  <Icon name={view.completed ? 'check' : 'close'} size={22} color={colors.surface} strokeWidth={2.4} />
                </View>
                <Text style={styles.doneTitle}>{view.completed ? 'Sahne bitti!' : 'Sahne burada bitti.'}</Text>
              </View>
              <Button label="Sahne raporunu gör" variant="accent" onPress={() => void openReport()} loading={busy} />
            </View>
          ) : view ? (
            <View style={{ gap: 12 }}>
              <HintArea
                view={view}
                difficulty={difficulty}
                hintVisible={hintVisible}
                option={option}
                onOption={setOption}
                onReveal={() => setHintShown(true)}
              />
              {typing ? (
                <View style={{ gap: 8 }}>
                  <TextInput
                    value={typed}
                    onChangeText={setTyped}
                    placeholder="İngilizce yaz…"
                    placeholderTextColor={colors.muted}
                    accessibilityLabel="Cevabını yaz"
                    style={styles.input}
                    maxLength={300}
                    autoFocus
                  />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Button label="Vazgeç" variant="outline" onPress={() => setTyping(false)} style={{ flex: 1 }} />
                    <Button label="Gönder" onPress={() => void send(typed, false)} disabled={!typed.trim()} loading={mic === 'scoring'} style={{ flex: 1 }} />
                  </View>
                </View>
              ) : (
                <View style={styles.micRow}>
                  <MicButton state={mic} onPress={pressMic} size={68} disabled={!consent && !intended} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Label>
                      {mic === 'recording'
                        ? 'DİNLİYORUM… BİTİNCE DOKUN'
                        : consent
                          ? 'MİKROFONA DOKUN, KENDİ CÜMLENİ KUR'
                          : intended
                            ? 'SESLİ SÖYLE, SONRA DOKUN'
                            : hintVisible && view.hintOptions.length > 0
                              ? 'BİR SEÇENEK SEÇ YA DA YAZ'
                              : 'YAZARAK CEVAP VER'}
                    </Label>
                    {intended ? <Text style={styles.intended}>{intended}</Text> : null}
                    <Pressable accessibilityRole="button" onPress={() => setTyping(true)} style={{ minHeight: 32, justifyContent: 'center' }}>
                      <Text style={styles.typeLink}>Yazarak cevapla</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          ) : null}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * READY: the suggestion (or the ways out of a surprise) is always shown and free.
 * CONFIDENT: hidden behind "Show hint", which costs points. PRO: no hints at all.
 */
function HintArea({ view, difficulty, hintVisible, option, onOption, onReveal }: {
  view: SceneView;
  difficulty: Difficulty;
  hintVisible: boolean;
  option: string | null;
  onOption: (o: string | null) => void;
  onReveal: () => void;
}) {
  const twistNow = view.hintOptions.length > 0 || (!view.hintsAllowed && view.messages.some((m) => m.kind === 'twist'));
  if (!view.hintsAllowed) {
    return (
      <Text style={styles.noHint}>
        {twistNow ? 'Beklenmedik bir durum! Kendi çözümünü söyle.' : 'İpucu yok — kendi cümleni kur.'}
      </Text>
    );
  }
  if (!hintVisible) {
    return (
      <View style={styles.hintRow}>
        <Text style={styles.noHint}>{view.hintOptions.length > 0 ? 'Beklenmedik bir durum! Nasıl çözersin?' : 'Ne diyeceğini biliyor musun?'}</Text>
        <Pressable accessibilityRole="button" accessibilityHint="İpucu puanını 10 düşürür" onPress={onReveal} style={styles.hintBtn}>
          <Text style={styles.hintBtnText}>İpucu (−10)</Text>
        </Pressable>
      </View>
    );
  }
  if (view.hintOptions.length > 0) {
    return (
      <View style={{ gap: 8 }}>
        <Label color={colors.red}>BEKLENMEDİK DURUM · BİRİNİ SEÇ YA DA KENDİN SÖYLE</Label>
        {view.hintOptions.map((o) => (
          <Pressable
            key={o}
            accessibilityRole="button"
            accessibilityState={{ selected: option === o }}
            onPress={() => onOption(option === o ? null : o)}
            style={[styles.option, option === o && { borderColor: colors.ink, backgroundColor: colors.yellowTint }]}
          >
            <Text style={styles.optionText}>{o}</Text>
          </Pressable>
        ))}
      </View>
    );
  }
  return view.hintTr && difficulty !== 'PRO' ? <Text style={styles.hintTr}>{view.hintTr}</Text> : null;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  header: { backgroundColor: colors.ink, paddingHorizontal: 16, paddingBottom: 12, paddingTop: 6, gap: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.inkSoft, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center' },
  role: { fontFamily: fonts.displayBold, fontSize: 19, color: colors.surface },
  setting: { fontFamily: fonts.body, fontSize: 13, color: colors.mutedOnInk },
  level: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.2, color: colors.ink, backgroundColor: colors.yellow, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, overflow: 'hidden' },
  progress: { flexDirection: 'row', gap: 3 },
  progressBar: { flex: 1, height: 4, borderRadius: 2 },
  chat: { backgroundColor: colors.ground, flexGrow: 1, padding: 16, gap: 12 },
  brief: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, gap: 6, borderWidth: 2, borderColor: colors.yellow },
  briefText: { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 21, color: colors.ink },
  briefNote: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  transition: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 6 },
  transitionLine: { flex: 1, height: 1, backgroundColor: colors.line },
  transitionText: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1, color: colors.muted, maxWidth: '75%', textAlign: 'center' },
  who: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.2, color: colors.muted },
  bubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, borderWidth: 2 },
  aiBubble: { backgroundColor: colors.surface, borderColor: colors.surface },
  youBubble: { backgroundColor: colors.ink, borderColor: colors.ink },
  bubbleText: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22, color: colors.ink },
  hiddenRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hiddenText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  revealBtn: { minHeight: 32, justifyContent: 'center' },
  reveal: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkLine, textDecorationLine: 'underline' },
  note: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.muted },
  footer: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line, padding: 16, gap: 12 },
  hintRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  hintBtn: { minHeight: 40, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.line, justifyContent: 'center' },
  hintBtnText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
  noHint: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.inkLine },
  hintTr: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  option: { minHeight: 44, borderWidth: 2, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'center' },
  optionText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },
  micRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  intended: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 21, color: colors.ink },
  typeLink: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkLine, textDecorationLine: 'underline' },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 12, fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.ink },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  doneIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { fontFamily: fonts.displayBold, fontSize: 19, color: colors.ink },
  body: { padding: 16, gap: 16, paddingBottom: 32 },
});
