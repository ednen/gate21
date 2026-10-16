import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type Chapter, matchPairs } from '@/lib/content';
import { average, joinTiles, shuffledOrder } from '@/lib/sentence';
import { say, sayAll } from '@/lib/voice';
import { colors, fonts } from '@/theme';

import { Icon } from '../Icon';
import { OptionButton } from '../OptionButton';
import { hasPicture, Picture } from '../Picture';
import { SpeakPanel } from '../SpeakPanel';
import { Body, Button, Card, Label, Title } from '../ui';

/** Each step reports its speaking score (or null) through onDone; the screen records and advances. */
export type StepProps = { chapter: Chapter; consent: boolean; onDone: (score: number | null) => void };

/**
 * Meet the words: the word, its picture, and the word used in a sentence. Words without
 * pictures or sentences (letters, numbers) are shown as a grid of sound cards instead.
 */
export function DiscoverStep({ chapter, onDone }: StepProps) {
  const words = chapter.words ?? [];
  // Words with pictures get flashcards; long sets without pictures (the alphabet, numbers)
  // are quicker to hear as a grid.
  const cards = words.some((w) => hasPicture(w.picture)) || (words.length <= 12 && words.some((w) => w.example));
  const [index, setIndex] = useState(0);
  const [heard, setHeard] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (cards && words[index]) {
      say(words[index].en, { slow: true });
    }
  }, [cards, index, words]);

  if (!cards) {
    const need = Math.min(8, words.length);
    return (
      <View style={styles.step}>
        <Title>Dinle ve tanı</Title>
        <Body color={colors.muted}>{`Dinlemek için karta dokun. ${heard.size} / ${words.length} dinlendi.`}</Body>
        <View style={styles.grid}>
          {words.map((w, i) => {
            const on = heard.has(i);
            return (
              <Pressable
                key={w.en}
                accessibilityRole="button"
                accessibilityLabel={`${w.en}, ${w.tr}. Dinle`}
                onPress={() => {
                  say(w.en, { slow: true });
                  setHeard((h) => new Set(h).add(i));
                }}
                style={[styles.soundCard, on && { backgroundColor: colors.yellowTint, borderColor: colors.yellow }]}
              >
                <Text style={styles.soundCardEn} adjustsFontSizeToFit numberOfLines={1}>{w.en}</Text>
                <Text style={styles.soundCardTr} numberOfLines={2}>{w.tr}</Text>
              </Pressable>
            );
          })}
        </View>
        <Button label={heard.size >= need ? 'Devam' : `En az ${need} kartı dinle`} disabled={heard.size < need} onPress={() => onDone(null)} />
      </View>
    );
  }

  const w = words[index];
  const last = index === words.length - 1;
  return (
    <View style={styles.step}>
      <Label>{`KELİME ${index + 1} / ${words.length}`}</Label>
      <Card style={styles.flashcard}>
        {hasPicture(w.picture) ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${w.en}. Dinle`}
            onPress={() => say(w.en, { slow: true })}
            style={({ pressed }) => [styles.pictureBox, pressed && { transform: [{ scale: 0.96 }] }]}
          >
            <Picture name={w.picture} size={120} />
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${w.en}. Tekrar dinle`}
          onPress={() => say(w.en, { slow: true })}
          style={styles.wordRow}
        >
          <Text style={styles.flashWord}>{w.en}</Text>
          <Icon name="speaker" size={22} />
        </Pressable>
        <Text style={styles.flashTr}>{w.tr}</Text>
        {w.example ? (
          <Pressable accessibilityRole="button" accessibilityHint="Cümleyi dinle" onPress={() => say(w.example ?? '')} style={styles.example}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.exampleEn}>{w.example}</Text>
              {w.exampleTr ? <Text style={styles.exampleTr}>{w.exampleTr}</Text> : null}
            </View>
            <Icon name="speaker" size={18} />
          </Pressable>
        ) : null}
      </Card>
      <View style={styles.dots} accessibilityElementsHidden>
        {words.map((x, i) => (
          <View key={x.en} style={[styles.dot, i === index && { backgroundColor: colors.ink, width: 16 }]} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button label="Geri" variant="outline" disabled={index === 0} onPress={() => setIndex(index - 1)} style={{ flex: 1 }} />
        <Button
          label={last ? 'Devam' : 'Sonraki'}
          icon={last ? undefined : 'arrowRight'}
          onPress={() => (last ? onDone(null) : setIndex(index + 1))}
          style={{ flex: 2 }}
        />
      </View>
    </View>
  );
}

export function PronounceStep({ chapter, consent, onDone }: StepProps) {
  const items = chapter.pronounce ?? [];
  const [index, setIndex] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [said, setSaid] = useState(false);
  const item = items[index];
  const last = index === items.length - 1;
  return (
    <View style={styles.step}>
      <Body color={colors.muted}>{`Dinle, sonra kendin söyle. ${index + 1} / ${items.length}`}</Body>
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

/** Match each picture (or English word) to its partner. Right answers lock in and are spoken. */
export function MatchStep({ chapter, onDone }: StepProps) {
  const pairs = useMemo(() => matchPairs(chapter), [chapter]);
  const right = useMemo(() => shuffledOrder(pairs.length, `${chapter.slug}-match`), [pairs.length, chapter.slug]);
  const [picked, setPicked] = useState<number | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [wrong, setWrong] = useState<number | null>(null);
  const done = matched.size === pairs.length;
  const pictures = pairs.every((p) => hasPicture(p.picture));

  const choose = (target: number) => {
    if (picked === null) {
      return;
    }
    if (target === picked) {
      setMatched((m) => new Set(m).add(target));
      say(pairs[target].en);
      setPicked(null);
    } else {
      setWrong(target);
      setTimeout(() => setWrong(null), 600);
    }
  };

  return (
    <View style={styles.step}>
      <Title>{pictures ? 'Resmi kelimeyle eşleştir' : 'Eşleştir'}</Title>
      <Body color={colors.muted}>Soldan birine, sonra sağdaki eşine dokun.</Body>
      <View style={styles.matchCols}>
        <View style={styles.matchCol}>
          {pairs.map((p, i) => {
            const isMatched = matched.has(i);
            return (
              <Pressable
                key={p.en}
                accessibilityRole="button"
                accessibilityLabel={pictures ? `Resim: ${p.tr}` : p.en}
                accessibilityState={{ selected: picked === i, disabled: isMatched }}
                disabled={isMatched}
                onPress={() => setPicked(i)}
                style={[styles.matchTile, picked === i && styles.matchPicked, isMatched && styles.matchDone]}
              >
                {pictures && hasPicture(p.picture) ? <Picture name={p.picture} size={44} /> : <Text style={styles.matchText}>{p.en}</Text>}
              </Pressable>
            );
          })}
        </View>
        <View style={styles.matchCol}>
          {right.map((i) => {
            const p = pairs[i];
            const isMatched = matched.has(i);
            return (
              <Pressable
                key={p.en}
                accessibilityRole="button"
                accessibilityLabel={pictures ? p.en : p.tr}
                accessibilityState={{ disabled: isMatched }}
                disabled={isMatched}
                onPress={() => choose(i)}
                style={[styles.matchTile, isMatched && styles.matchDone, wrong === i && styles.matchWrong]}
              >
                <Text style={styles.matchText} numberOfLines={2} adjustsFontSizeToFit>{pictures ? p.en : p.tr}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <Text accessibilityLiveRegion="polite" style={[styles.feedback, { color: done ? colors.green : colors.muted }]}>
        {done ? '✓ Hepsini eşleştirdin!' : `${matched.size} / ${pairs.length} eşleşti`}
      </Text>
      <Button label="Devam" disabled={!done} onPress={() => onDone(null)} />
    </View>
  );
}

/** Situation questions. Questions with audio are heard first, and their text appears after answering. */
export function RecognizeStep({ chapter, onDone }: StepProps) {
  const questions = chapter.recognize ?? [];
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const q = questions[index];
  const last = index === questions.length - 1;

  useEffect(() => {
    if (q?.audio) {
      say(q.audio, { slow: true });
    }
  }, [q]);

  return (
    <View style={styles.step}>
      <Label>{`SORU ${index + 1} / ${questions.length}`}</Label>
      {q.audio ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Tekrar dinle" onPress={() => say(q.audio ?? '', { slow: true })} style={styles.listen}>
          <View style={styles.listenIcon}>
            <Icon name="speaker" size={28} color={colors.yellow} />
          </View>
          <Text style={styles.listenText}>{picked === null ? 'Dinle (tekrar için dokun)' : `“${q.audio}”`}</Text>
        </Pressable>
      ) : null}
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

/** A short dialogue with gaps: fill each gap, then listen to the whole conversation. */
export function DialogStep({ chapter, onDone }: StepProps) {
  const dialog = chapter.dialog;
  const lines = dialog?.lines ?? [];
  const gaps = lines.map((l, i) => (l.gap ? i : -1)).filter((i) => i >= 0);
  const [filled, setFilled] = useState(0);
  const [wrong, setWrong] = useState<string | null>(null);
  const done = filled === gaps.length;
  const current = done ? -1 : gaps[filled];
  const visible = done ? lines.length : current + 1;

  const choose = (option: string) => {
    const line = lines[current];
    if (option === line.gap) {
      setFilled(filled + 1);
      setWrong(null);
    } else {
      setWrong(option);
    }
  };

  const listen = () =>
    sayAll(
      lines.map((l) => ({ text: l.text.replace('___', l.gap ?? ''), voice: l.who === 'You' ? 'en-US' : null })),
      0.9,
    );

  return (
    <View style={styles.step}>
      <Label>{`DİYALOG · ${dialog?.titleTr.toUpperCase() ?? ''}`}</Label>
      <Title size={22}>Boşlukları doldur</Title>
      <View style={{ gap: 10 }}>
        {lines.slice(0, visible).map((l, i) => {
          const you = l.who === 'You';
          const gapDone = l.gap && gaps.indexOf(i) < filled;
          const parts = l.text.split('___');
          return (
            <View key={i} style={{ alignItems: you ? 'flex-end' : 'flex-start', gap: 3 }}>
              <Text style={styles.who}>{you ? 'SEN' : l.who.toUpperCase()}</Text>
              <View style={[styles.bubble, you ? styles.youBubble : styles.themBubble]}>
                <Text style={[styles.bubbleText, you && { color: colors.surface }]}>
                  {parts[0]}
                  {l.gap ? (
                    <Text style={[styles.gap, gapDone ? styles.gapDone : styles.gapOpen]}>{gapDone ? l.gap : '  ___  '}</Text>
                  ) : null}
                  {parts[1] ?? ''}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
      {!done ? (
        <View style={{ gap: 8 }}>
          <Label>BOŞLUĞA NE GELİR?</Label>
          <View style={styles.chips}>
            {(lines[current].options ?? []).map((o) => (
              <Pressable
                key={o}
                accessibilityRole="button"
                onPress={() => choose(o)}
                style={[styles.chip, wrong === o && { borderColor: colors.red, backgroundColor: colors.redTint }]}
              >
                <Text style={styles.chipText}>{o}</Text>
              </Pressable>
            ))}
          </View>
          {wrong ? <Text style={[styles.feedback, { color: colors.red }]}>{`“${wrong}” buraya uymuyor, tekrar dene.`}</Text> : null}
        </View>
      ) : (
        <Button label="Bütün diyaloğu dinle" variant="outline" icon="speaker" onPress={listen} />
      )}
      <Button label="Devam" disabled={!done} onPress={() => onDone(null)} />
    </View>
  );
}

/** Fill in an official form (arrival card, complaint form) from a situation described in Turkish. */
export function FormStep({ chapter, onDone }: StepProps) {
  const form = chapter.form;
  const fields = form?.fields ?? [];
  const [index, setIndex] = useState(0);
  const [wrong, setWrong] = useState<number | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const done = index === fields.length;
  const field = fields[index];

  const choose = (i: number) => {
    if (i === field.answer) {
      setIndex(index + 1);
      setWrong(null);
    } else {
      setWrong(i);
      setMistakes((m) => m + 1);
    }
  };

  return (
    <View style={styles.step}>
      <Card style={{ gap: 6, borderWidth: 2, borderColor: colors.yellow }}>
        <Label>DURUM</Label>
        <Body size={15}>{form?.situationTr}</Body>
      </Card>
      <View style={styles.form}>
        <Text style={styles.formTitle}>{form?.title}</Text>
        {fields.map((f, i) => (
          <View key={f.label} style={[styles.formRow, i === index && styles.formRowActive]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.formLabel}>{f.label.toUpperCase()}</Text>
              <Text style={styles.formLabelTr}>{f.labelTr}</Text>
            </View>
            <Text style={[styles.formValue, i >= index && { color: colors.line }]}>{i < index ? f.options[f.answer] : '__________'}</Text>
          </View>
        ))}
      </View>
      {!done ? (
        <View style={{ gap: 8 }}>
          <Label>{`${field.label.toUpperCase()} · NE YAZARSIN?`}</Label>
          <View style={styles.chips}>
            {field.options.map((o, i) => (
              <Pressable
                key={o}
                accessibilityRole="button"
                onPress={() => choose(i)}
                style={[styles.chip, wrong === i && { borderColor: colors.red, backgroundColor: colors.redTint }]}
              >
                <Text style={styles.chipText}>{o}</Text>
              </Pressable>
            ))}
          </View>
          {wrong !== null ? <Card live><Body size={14}>{field.explainTr}</Body></Card> : null}
        </View>
      ) : (
        <Card live style={{ backgroundColor: colors.greenTint }}>
          <Body size={15} color={colors.green}>{mistakes === 0 ? '✓ Formu hatasız doldurdun!' : `✓ Form tamam. ${mistakes} kez düzelttin; bir dahakine daha kolay olacak.`}</Body>
        </Card>
      )}
      <Button label="Devam" disabled={!done} onPress={() => onDone(null)} />
    </View>
  );
}

/** "What do you see?": say the word for the picture. */
export function SpeakStep({ chapter, consent, onDone }: StepProps) {
  const speak = chapter.speak;
  const [score, setScore] = useState<number | null | undefined>(undefined);
  if (!speak) {
    return null;
  }
  return (
    <View style={styles.step}>
      <Title>{speak.prompt}</Title>
      <View style={styles.pictureBig}>
        <Picture name={speak.picture} size={160} label="Bu ne?" />
      </View>
      <Body color={colors.muted}>Gördüğünü İngilizce söyle. Kelimeler ilk adımdaydı.</Body>
      <SpeakPanel reference={speak.answer} consent={consent} onResult={setScore} idleLabel="Dokun ve gördüğünü söyle" size={80} />
      {score !== undefined ? (
        <Card style={{ gap: 4 }}>
          <Label>CEVAP</Label>
          <Text style={styles.answer}>{`“${speak.answer}”`}</Text>
        </Card>
      ) : null}
      <Button label="Devam" disabled={score === undefined} onPress={() => onDone(score ?? null)} />
    </View>
  );
}

export function UseStep({ chapter, consent, onDone }: StepProps) {
  const use = chapter.use;
  const tiles = use?.tiles ?? [];
  const order = useMemo(() => shuffledOrder(tiles.length, chapter.slug), [tiles.length, chapter.slug]);
  const [built, setBuilt] = useState<number[]>([]);
  const [spoken, setSpoken] = useState<number | null | undefined>(undefined);
  const complete = built.length === tiles.length;
  const correct = complete && built.every((t, i) => t === i);
  if (!use) {
    return null;
  }

  return (
    <View style={styles.step}>
      <Card style={{ paddingVertical: 4 }}>
        <Layer label="KELİME" text={use.word} bold />
        <Layer label="CÜMLE" text={use.phrase} />
        <Layer label="DURUM" text={use.situationTr} last />
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
                  say(use.phrase);
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
        <Text style={[styles.feedback, { flex: 1, color: correct ? colors.green : complete ? colors.red : colors.muted }]}>
          {correct ? '✓ Harika. Şimdi sesli söyle.' : complete ? 'Tam değil, başka bir sıra dene.' : 'Kelimelere sırayla dokun.'}
        </Text>
        <Button label="Sıfırla" variant="ghost" onPress={() => setBuilt([])} style={{ minHeight: 44, paddingHorizontal: 8 }} />
      </View>
      {correct ? (
        <SpeakPanel reference={use.phrase} consent={consent} onResult={setSpoken} idleLabel="Dokun ve cümleyi söyle" size={72} />
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  soundCard: {
    width: '23%',
    minHeight: 72,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: colors.surface,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  soundCardEn: { fontFamily: fonts.displayBold, fontSize: 22, color: colors.ink },
  soundCardTr: { fontFamily: fonts.body, fontSize: 11, color: colors.muted, textAlign: 'center' },
  flashcard: { alignItems: 'center', gap: 10, paddingVertical: 22 },
  pictureBox: { width: 168, height: 168, borderRadius: 24, backgroundColor: colors.yellowTint, alignItems: 'center', justifyContent: 'center' },
  pictureBig: { height: 220, borderRadius: 20, backgroundColor: colors.yellowTint, alignItems: 'center', justifyContent: 'center' },
  wordRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  flashWord: { fontFamily: fonts.display, fontSize: 34, color: colors.ink, textAlign: 'center' },
  flashTr: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.muted },
  example: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.ground, borderRadius: 12, padding: 12, marginTop: 4 },
  exampleEn: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  exampleTr: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, flexWrap: 'wrap' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.line },
  bigWord: { fontFamily: fonts.display, fontSize: 46, lineHeight: 50, color: colors.ink, textAlign: 'center' },
  ipa: { fontFamily: fonts.monoMedium, fontSize: 15, color: colors.muted },
  answer: { fontFamily: fonts.displayBold, fontSize: 20, color: colors.ink },
  matchCols: { flexDirection: 'row', gap: 12 },
  matchCol: { flex: 1, gap: 8 },
  matchTile: {
    minHeight: 60,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  matchPicked: { borderColor: colors.ink, backgroundColor: colors.yellowTint },
  matchDone: { borderColor: colors.green, backgroundColor: colors.greenTint, opacity: 0.7 },
  matchWrong: { borderColor: colors.red, backgroundColor: colors.redTint },
  matchText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink, textAlign: 'center' },
  feedback: { fontFamily: fonts.bodyBold, fontSize: 14 },
  listen: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.ink, borderRadius: 16, padding: 14, minHeight: 72 },
  listenIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.inkSoft, alignItems: 'center', justifyContent: 'center' },
  listenText: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 16, color: colors.surface },
  who: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.2, color: colors.muted },
  bubble: { maxWidth: '85%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  themBubble: { backgroundColor: colors.surface },
  youBubble: { backgroundColor: colors.ink },
  bubbleText: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.ink },
  gap: { fontFamily: fonts.bodyBold },
  gapOpen: { backgroundColor: colors.yellow, color: colors.ink },
  gapDone: { color: colors.green, textDecorationLine: 'underline' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 48, paddingHorizontal: 16, borderRadius: 12, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.surface, justifyContent: 'center' },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  form: { backgroundColor: colors.paper, borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 2 },
  formTitle: { fontFamily: fonts.mono, fontSize: 13, letterSpacing: 2, color: colors.ink, marginBottom: 6 },
  formRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: colors.line, borderRadius: 6 },
  formRowActive: { backgroundColor: colors.yellowTint },
  formLabel: { fontFamily: fonts.monoMedium, fontSize: 11, letterSpacing: 1, color: colors.ink },
  formLabelTr: { fontFamily: fonts.body, fontSize: 11, color: colors.muted },
  formValue: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.blue },
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
  layer: { flexDirection: 'row', gap: 12, paddingVertical: 10 },
  layerLabel: { width: 70, fontFamily: fonts.mono, fontSize: 11, color: colors.muted, paddingTop: 2 },
  layerText: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.ink, lineHeight: 21 },
});
