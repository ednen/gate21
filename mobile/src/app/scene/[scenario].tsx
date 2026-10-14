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
import { Button, ErrorNote, Label } from '@/components/ui';
import { apiSend } from '@/lib/api';
import { chapterInfo } from '@/lib/content';
import { messageFor } from '@/lib/errors';
import { recordStep } from '@/lib/progress';
import { useMe } from '@/lib/queries';
import { surviveScore } from '@/lib/sentence';
import type { SceneView } from '@/lib/types';
import { say, sendTurn, useVoiceRecorder } from '@/lib/voice';
import { colors, fonts } from '@/theme';

type Message = { id: number; who: 'ai' | 'you'; text: string; twist?: boolean; note?: string; ok?: boolean };

/** The "Can you actually survive this?" scene: a live role-play with a twist. */
export default function Scene() {
  const { scenario, chapter } = useLocalSearchParams<{ scenario: string; chapter: string }>();
  const me = useMe();
  const consent = me.data?.voiceConsent ?? false;
  const voice = useVoiceRecorder();

  const [view, setView] = useState<SceneView | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [option, setOption] = useState<string | null>(null);
  const [mic, setMic] = useState<MicState>('idle');
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState('');
  const [retries, setRetries] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [startKey, setStartKey] = useState(0);
  const scroll = useRef<ScrollView>(null);
  const nextId = useRef(0);

  const add = (m: Omit<Message, 'id'>) => setMessages((list) => [...list, { ...m, id: nextId.current++ }]);

  useEffect(() => {
    let cancelled = false;
    setMessages([]);
    setRetries(0);
    setOption(null);
    setError(null);
    apiSend<SceneView>('POST', '/api/v1/roleplay/sessions', { scenario })
      .then((v) => {
        if (cancelled) {
          return;
        }
        setView(v);
        add({ who: 'ai', text: v.reply });
        say(v.reply);
      })
      .catch((e) => !cancelled && setError(messageFor(e)));
    return () => {
      cancelled = true;
    };
  }, [scenario, startKey]);

  const intended = option ?? view?.hint ?? '';

  const send = async (text: string, withAudio: boolean) => {
    if (!view) {
      return;
    }
    setMic('scoring');
    setError(null);
    try {
      const recording = withAudio ? await voice.stop() : null;
      const next = await sendTurn(view.sessionId, text, recording);
      add({
        who: 'you',
        text: next.userText ?? text,
        note: next.feedbackTr ?? undefined,
        ok: next.goalMet ?? undefined,
      });
      add({ who: 'ai', text: next.reply, twist: next.twist });
      say(next.reply);
      if (next.goalMet === false) {
        setRetries((r) => r + 1);
      }
      if (next.completed && chapter) {
        void recordStep(chapter, 'SURVIVE', surviveScore(retries + (next.goalMet === false ? 1 : 0)));
      }
      setView(next);
      setOption(null);
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
      // Listen-and-repeat mode: the learner says it aloud, then taps; the hint text is sent.
      void send(intended, false);
      return;
    }
    if (mic === 'recording') {
      void send(intended, true);
      return;
    }
    if (await voice.start()) {
      setMic('recording');
    } else {
      setError('Mikrofon izni verilmedi. Yazarak da cevap verebilirsin.');
    }
  };

  const info = chapter ? chapterInfo(chapter) : undefined;
  const needsOption = (view?.hintOptions.length ?? 0) > 0 && option === null;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Sahneden çık" onPress={() => router.back()} style={styles.back}>
            <Icon name="arrowLeft" size={20} color={colors.surface} strokeWidth={2} />
          </Pressable>
          <View style={styles.avatar}>
            <Icon name={(info?.icon ?? 'chat') as IconName} size={24} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.role}>{view?.role ?? 'AI'}</Text>
            <Text style={styles.setting}>{view?.setting ?? ''}</Text>
          </View>
          <Text style={styles.live}>CANLI</Text>
        </View>
      </View>

      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        contentContainerStyle={styles.chat}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
      >
        {!view && !error ? <ActivityIndicator color={colors.ink} style={{ marginTop: 40 }} /> : null}
        {messages.map((m) => (
          <View key={m.id} style={{ alignItems: m.who === 'ai' ? 'flex-start' : 'flex-end', gap: 4 }}>
            <Text style={[styles.who, m.twist && { color: colors.red }, m.ok && { color: colors.green }]}>
              {m.who === 'ai' ? (m.twist ? `${(view?.role ?? '').toUpperCase()} · BEKLENMEDİK` : (view?.role ?? '').toUpperCase()) : 'SEN'}
            </Text>
            <Pressable
              accessibilityRole={m.who === 'ai' ? 'button' : 'text'}
              accessibilityHint={m.who === 'ai' ? 'Tekrar dinle' : undefined}
              onPress={() => m.who === 'ai' && say(m.text)}
              style={[
                styles.bubble,
                m.who === 'ai' ? styles.aiBubble : styles.youBubble,
                m.twist && { borderColor: colors.red },
              ]}
            >
              <Text style={[styles.bubbleText, m.who === 'you' && { color: colors.surface }]}>{m.text}</Text>
            </Pressable>
            {m.note ? <Text style={[styles.note, { color: m.ok ? colors.green : colors.muted }]}>{m.note}</Text> : null}
          </View>
        ))}
      </ScrollView>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView edges={['bottom']} style={styles.footer}>
          <ErrorNote message={error} />
          {view?.done ? (
            view.completed ? (
              <View style={{ gap: 12 }}>
                <View style={styles.doneRow}>
                  <View style={styles.doneIcon}>
                    <Icon name="check" size={22} color={colors.surface} strokeWidth={2.4} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.doneTitle}>Bu durumdan çıktın.</Text>
                    <Text style={styles.note}>{retries === 0 ? 'Hiç takılmadan!' : `${retries} kez tekrar denedin.`}</Text>
                  </View>
                </View>
                <Button label="Rozetimi al" variant="accent" onPress={() => router.replace(`/badge/${chapter ?? ''}`)} />
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                <Text style={styles.doneTitle}>Bu sefer olmadı — sorun değil.</Text>
                <Button label="Sahneyi baştan dene" onPress={() => setStartKey((k) => k + 1)} />
              </View>
            )
          ) : view ? (
            <View style={{ gap: 12 }}>
              {view.hintOptions.length > 0 ? (
                <View style={{ gap: 8 }}>
                  <Label color={colors.red}>BEKLENMEDİK DURUM · NASIL ÇÖZERSİN?</Label>
                  {view.hintOptions.map((o) => (
                    <Pressable
                      key={o}
                      accessibilityRole="button"
                      accessibilityState={{ selected: option === o }}
                      onPress={() => setOption(o)}
                      style={[styles.option, option === o && { borderColor: colors.ink, backgroundColor: colors.yellowTint }]}
                    >
                      <Text style={styles.optionText}>{o}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

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
                  <MicButton state={mic} onPress={pressMic} size={68} disabled={needsOption} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Label>{mic === 'recording' ? 'DİNLİYORUM… BİTİNCE DOKUN' : consent ? 'MİKROFONA DOKUN VE SÖYLE' : 'SESLİ SÖYLE, SONRA DOKUN'}</Label>
                    <Text style={styles.hint}>{needsOption ? 'Yukarıdan bir cevap seç.' : intended}</Text>
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  header: { backgroundColor: colors.ink, paddingHorizontal: 16, paddingBottom: 14, paddingTop: 6 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.inkSoft, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center' },
  role: { fontFamily: fonts.displayBold, fontSize: 19, color: colors.surface },
  setting: { fontFamily: fonts.body, fontSize: 13, color: colors.mutedOnInk },
  live: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.2, color: colors.ink, backgroundColor: colors.yellow, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, overflow: 'hidden' },
  chat: { backgroundColor: colors.ground, flexGrow: 1, padding: 16, gap: 12 },
  who: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.2, color: colors.muted },
  bubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, borderWidth: 2 },
  aiBubble: { backgroundColor: colors.surface, borderColor: colors.surface },
  youBubble: { backgroundColor: colors.ink, borderColor: colors.ink },
  bubbleText: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22, color: colors.ink },
  note: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.muted },
  footer: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line, padding: 16, gap: 12 },
  option: { minHeight: 44, borderWidth: 2, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'center' },
  optionText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },
  micRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  hint: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 21, color: colors.ink },
  typeLink: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkLine, textDecorationLine: 'underline' },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 12, fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.ink },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  doneIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { fontFamily: fonts.displayBold, fontSize: 19, color: colors.ink },
});
