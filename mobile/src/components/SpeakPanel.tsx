import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiError, messageFor } from '@/lib/errors';
import type { Assessment } from '@/lib/types';
import { assessPronunciation, say, useVoiceRecorder } from '@/lib/voice';
import { colors, fonts } from '@/theme';

import { Icon } from './Icon';
import { MicButton, type MicState } from './MicButton';
import { ScoreCard } from './ScoreCard';
import { Button, ErrorNote } from './ui';

/** Errors after which scoring cannot work right now, so the step continues without a score. */
const FALLBACK_CODES = ['SPEECH_QUOTA_EXCEEDED', 'VOICE_CONSENT_REQUIRED', 'SPEECH_UNAVAILABLE'];

type Props = {
  /** The sentence or word the learner should say; also what the score is measured against. */
  reference: string;
  consent: boolean;
  /** Called with the score, or null in listen-and-repeat mode. */
  onResult: (score: number | null) => void;
  idleLabel?: string;
  size?: number;
};

/**
 * Listen → speak → score. Without voice consent (or when the daily quota is used up) it falls
 * back to "listen and repeat": the learner says it aloud and taps "I said it", no score.
 */
export function SpeakPanel({ reference, consent, onResult, idleLabel = 'Dokun ve söyle', size = 96 }: Props) {
  const voice = useVoiceRecorder();
  const [state, setState] = useState<MicState>('idle');
  const [result, setResult] = useState<Assessment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [repeatMode, setRepeatMode] = useState(!consent);
  // Times in a row nothing was heard; after two the step goes on as listen-and-repeat.
  const [unheard, setUnheard] = useState(0);

  // Consent granted on the consent screen: switch from listen-and-repeat to scored speaking.
  useEffect(() => {
    if (consent) {
      setRepeatMode(false);
    }
  }, [consent]);

  const press = async () => {
    setError(null);
    if (state === 'recording') {
      setState('scoring');
      try {
        const recording = await voice.stop();
        if (!recording) {
          throw new Error('no recording');
        }
        const r = await assessPronunciation(recording, reference);
        setResult(r);
        setState('done');
        setUnheard(0);
        onResult(r.overall);
      } catch (e) {
        setState('idle');
        if (e instanceof ApiError && e.code === 'SPEECH_NOT_RECOGNIZED') {
          const times = unheard + 1;
          setUnheard(times);
          if (times >= 2) {
            setError('Mikrofon seni bu ortamda zor duyuyor. Sesli söyle ve "Söyledim"e dokun; puan olmadan devam edersin.');
            setRepeatMode(true);
          } else {
            setError('Seni tam duyamadım. Telefonu biraz yaklaştırıp tek nefeste, net söyle.');
          }
          return;
        }
        setError(messageFor(e));
        if (e instanceof ApiError && FALLBACK_CODES.includes(e.code)) {
          setRepeatMode(true);
        }
      }
      return;
    }
    setResult(null);
    const started = await voice.start();
    if (!started) {
      setError('Mikrofon izni verilmedi. Ayarlardan açabilir ya da dinle ve tekrar et moduyla devam edebilirsin.');
      setRepeatMode(true);
      return;
    }
    setState('recording');
  };

  if (repeatMode) {
    return (
      <View style={styles.wrap}>
        <ErrorNote message={error} />
        <View style={styles.row}>
          <Button label="Dinle" variant="outline" icon="speaker" onPress={() => say(reference, { slow: true })} style={{ flex: 1 }} />
          <Button label="Söyledim" onPress={() => onResult(null)} style={{ flex: 1 }} />
        </View>
        {!consent ? (
          <Pressable accessibilityRole="link" onPress={() => router.push('/consent')} style={styles.link}>
            <Text style={styles.linkText}>Puan almak için ses iznini aç</Text>
          </Pressable>
        ) : unheard >= 2 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setRepeatMode(false);
              setUnheard(0);
              setError(null);
            }}
            style={styles.link}
          >
            <Text style={styles.linkText}>Mikrofonla tekrar dene</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  const label = { idle: idleLabel, recording: 'Dinliyorum… bitirince dokun', scoring: 'Puanlanıyor…', done: 'Tekrar denemek için dokun' }[state];
  return (
    <View style={styles.wrap}>
      <Pressable accessibilityRole="button" onPress={() => say(reference)} style={styles.listen}>
        <Icon name="speaker" size={18} />
        <Text style={styles.listenText}>Önce dinle</Text>
      </Pressable>
      <MicButton state={state} onPress={press} label={label} size={size} />
      <ErrorNote message={error} />
      {result ? <ScoreCard result={result} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14, alignItems: 'stretch' },
  row: { flexDirection: 'row', gap: 10 },
  listen: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  listenText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  link: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
  linkText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink, textDecorationLine: 'underline' },
});
