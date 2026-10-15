import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { LessonChapter } from '@/lib/content';
import { average, joinTiles, shuffledOrder } from '@/lib/sentence';
import { say } from '@/lib/voice';
import { colors, fonts } from '@/theme';

import { Icon } from '../Icon';
import { OptionButton } from '../OptionButton';
import { SceneArt } from '../SceneArt';
import { SpeakPanel } from '../SpeakPanel';
import { Body, Button, Card, Label, Title } from '../ui';

/** Each step reports its speaking score (or null) through onDone; the screen records and advances. */
type StepProps = { chapter: LessonChapter; consent: boolean; onDone: (score: number | null) => void };

export function DiscoverStep({ chapter, onDone }: StepProps) {
  const [heard, setHeard] = useState<Set<number>>(new Set());
  const need = Math.min(5, chapter.words.length);
  return (
    <View style={styles.step}>
      <Title>Bu bölümde duyacağın kelimeler</Title>
      <Body color={colors.muted}>{`Dinlemek için karta dokun. ${heard.size} / ${chapter.words.length} dinlendi.`}</Body>
      <View style={styles.grid}>
        {chapter.words.map((w, i) => {
          const on = heard.has(i);
          return (
            <Pressable
              key={w.en}
              accessibilityRole="button"
              accessibilityLabel={`${w.en}, ${w.tr}. Dinle`}
              onPress={() => {
                say(w.en);
                setHeard((h) => new Set(h).add(i));
              }}
              style={[styles.word, on && { backgroundColor: colors.yellowTint, borderColor: colors.yellow }]}
            >
              <View style={styles.wordTop}>
                <Text style={styles.wordEn}>{w.en}</Text>
                <Icon name="speaker" size={16} />
              </View>
              <Text style={styles.wordTr}>{w.tr}</Text>
            </Pressable>
          );
        })}
      </View>
      <Button label={heard.size >= need ? 'Devam' : `En az ${need} kelimeyi dinle`} disabled={heard.size < need} onPress={() => onDone(null)} />
    </View>
  );
}

export function PronounceStep({ chapter, consent, onDone }: StepProps) {
  const [index, setIndex] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [said, setSaid] = useState(false);
  const item = chapter.pronounce[index];
  const last = index === chapter.pronounce.length - 1;
  return (
    <View style={styles.step}>
      <Body color={colors.muted}>{`Dinle, sonra kendin söyle. ${index + 1} / ${chapter.pronounce.length}`}</Body>
      <Card style={styles.center}>
        <Text style={styles.bigWord}>{item.word}</Text>
        <Text style={styles.ipa}>{`${item.ipa} · ${item.stress}`}</Text>
        <Body size={14} color={colors.inkLine} style={{ textAlign: 'center' }}>{item.tipTr}</Body>
      </Card>
      <SpeakPanel
        key={item.word}
        reference={item.word}
        consent={consent}
        onResult={(score) => {
          if (score !== null) {
            setScores((s) => [...s, score]);
          }
          setSaid(true);
        }}
      />
      <Button
        label={last ? 'Devam' : 'Sonraki kelime'}
        disabled={!said}
        onPress={() => {
          if (last) {
            onDone(average(scores));
          } else {
            setIndex(index + 1);
            setSaid(false);
          }
        }}
      />
    </View>
  );
}

export function RecognizeStep({ chapter, onDone }: StepProps) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const q = chapter.recognize[index];
  const last = index === chapter.recognize.length - 1;
  return (
    <View style={styles.step}>
      <Label>{`SORU ${index + 1} / ${chapter.recognize.length}`}</Label>
      <Title>{q.prompt}</Title>
      <View style={{ gap: 10 }}>
        {q.options.map((text, i) => (
          <OptionButton
            key={text}
            index={i}
            text={text}
            disabled={picked !== null}
            state={picked === null ? 'idle' : i === q.answer ? 'correct' : i === picked ? 'wrong' : 'idle'}
            onPress={() => setPicked(i)}
          />
        ))}
      </View>
      {picked !== null ? (
        <Card live>
          <Body size={14}>{q.explainTr}</Body>
        </Card>
      ) : null}
      <Button
        label={last ? 'Devam' : 'Sonraki soru'}
        disabled={picked === null}
        onPress={() => {
          if (last) {
            onDone(null);
          } else {
            setIndex(index + 1);
            setPicked(null);
          }
        }}
      />
    </View>
  );
}

export function SpeakStep({ chapter, consent, onDone }: StepProps) {
  const [score, setScore] = useState<number | null | undefined>(undefined);
  return (
    <View style={styles.step}>
      <Title>{chapter.speak.prompt}</Title>
      <SceneArt scene={chapter.speak.scene} />
      <Body color={colors.muted}>Gördüğünü İngilizce söyle. Kelimeler ilk adımdaydı.</Body>
      <SpeakPanel reference={chapter.speak.answer} consent={consent} onResult={setScore} idleLabel="Dokun ve gördüğünü söyle" size={80} />
      {score !== undefined ? (
        <Card style={{ gap: 4 }}>
          <Label>CEVAP</Label>
          <Text style={styles.answer}>{`“${chapter.speak.answer}”`}</Text>
        </Card>
      ) : null}
      <Button label="Devam" disabled={score === undefined} onPress={() => onDone(score ?? null)} />
    </View>
  );
}

export function UseStep({ chapter, consent, onDone }: StepProps) {
  const tiles = chapter.use.tiles;
  const order = useMemo(() => shuffledOrder(tiles.length, chapter.slug), [tiles.length, chapter.slug]);
  const [built, setBuilt] = useState<number[]>([]);
  const [spoken, setSpoken] = useState<number | null | undefined>(undefined);
  const complete = built.length === tiles.length;
  const correct = complete && built.every((t, i) => t === i);

  return (
    <View style={styles.step}>
      <Card style={{ paddingVertical: 4 }}>
        <Layer label="KELİME" text={chapter.use.word} bold />
        <Layer label="CÜMLE" text={chapter.use.phrase} />
        <Layer label="DURUM" text={chapter.use.situationTr} last />
      </Card>
      <Title size={22}>Cümleyi kur</Title>
      <View
        accessible
        accessibilityLabel={built.length ? `Kurduğun cümle: ${joinTiles(built.map((i) => tiles[i]))}` : 'Henüz kelime seçmedin'}
        style={[
          styles.buildBox,
          correct && { borderColor: colors.green, backgroundColor: colors.greenTint, borderStyle: 'solid' },
          complete && !correct && { borderColor: colors.red, backgroundColor: colors.redTint },
        ]}
      >
        {built.map((i) => (
          <Text key={i} style={styles.builtTile}>{tiles[i]}</Text>
        ))}
      </View>
      <View style={styles.bank}>
        {order.map((i) => {
          const used = built.includes(i);
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={tiles[i]}
              accessibilityState={{ disabled: used || complete }}
              disabled={used || complete}
              onPress={() => {
                const next = [...built, i];
                setBuilt(next);
                if (next.length === tiles.length && next.every((t, k) => t === k)) {
                  say(chapter.use.phrase);
                }
              }}
              style={[styles.tile, used && { backgroundColor: '#E4E7EB' }]}
            >
              <Text style={[styles.tileText, used && { color: '#8A929C' }]}>{tiles[i]}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.rowBetween}>
        <Text style={[styles.buildMsg, { color: correct ? colors.green : complete ? colors.red : colors.muted }]}>
          {correct ? '✓ Harika. Şimdi sesli söyle.' : complete ? 'Tam değil, başka bir sıra dene.' : 'Kelimelere sırayla dokun.'}
        </Text>
        <Button label="Sıfırla" variant="ghost" onPress={() => setBuilt([])} style={{ minHeight: 44, paddingHorizontal: 8 }} />
      </View>
      {correct ? (
        <SpeakPanel reference={chapter.use.phrase} consent={consent} onResult={setSpoken} idleLabel="Dokun ve cümleyi söyle" size={72} />
      ) : null}
      <Button label="Devam" disabled={!correct || spoken === undefined} onPress={() => onDone(spoken ?? null)} />
    </View>
  );
}

function Layer({ label, text, bold, last }: { label: string; text: string; bold?: boolean; last?: boolean }) {
  return (
    <View style={[styles.layer, !last && { borderBottomWidth: 1, borderBottomColor: colors.ground }]}>
      <Text style={styles.layerLabel}>{label}</Text>
      <Text style={[styles.layerText, bold && { fontFamily: fonts.bodyBold }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  step: { gap: 16 },
  center: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  word: {
    width: '48%',
    minHeight: 80,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: colors.surface,
    padding: 12,
    justifyContent: 'space-between',
    gap: 6,
  },
  wordTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  wordEn: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink, flexShrink: 1 },
  wordTr: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  bigWord: { fontFamily: fonts.display, fontSize: 46, lineHeight: 50, color: colors.ink, textAlign: 'center' },
  ipa: { fontFamily: fonts.monoMedium, fontSize: 15, color: colors.muted },
  answer: { fontFamily: fonts.displayBold, fontSize: 20, color: colors.ink },
  buildBox: {
    minHeight: 64,
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#A0A7B0',
    padding: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  builtTile: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.surface,
    backgroundColor: colors.ink,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    overflow: 'hidden',
  },
  bank: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  tileText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  buildMsg: { fontFamily: fonts.bodyBold, fontSize: 14, flex: 1 },
  layer: { flexDirection: 'row', gap: 12, paddingVertical: 10 },
  layerLabel: { width: 70, fontFamily: fonts.mono, fontSize: 11, color: colors.muted, paddingTop: 2 },
  layerText: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.ink, lineHeight: 21 },
});
