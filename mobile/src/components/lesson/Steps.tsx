import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type Chapter, matchPairs } from '@/lib/content';
import { average, joinTiles, shuffledOrder } from '@/lib/sentence';
import { say, sayAll } from '@/lib/voice';
import { colors, fonts, radius } from '@/theme';

import { Icon } from '../Icon';
import { OptionButton } from '../OptionButton';
import { hasPicture, Picture } from '../Picture';
import { SpeakPanel } from '../SpeakPanel';
import { Body, Button, Card, isHovered, Label, ProgressBar, Title } from '../ui';

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
      <View style={styles.wordCard}>
        <View style={styles.wordTop}>
          {hasPicture(w.picture) ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${w.en}. Dinle`}
              onPress={() => say(w.en, { slow: true })}
              style={({ pressed }) => [styles.pictureBox, pressed && { transform: [{ scale: 0.97 }] }]}
            >
              <Picture name={w.picture} size={104} />
            </Pressable>
          ) : (
            <View />
          )}
          <Text style={styles.counter}>
            <Text style={{ color: colors.ink }}>{index + 1}</Text>
            {` / ${words.length}`}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${w.en}. Tekrar dinle`}
          onPress={() => say(w.en, { slow: true })}
          style={styles.wordRow}
        >
          <Text style={styles.flashWord}>{w.en}</Text>
          <Icon name="speaker" size={22} strokeWidth={2} />
        </Pressable>
        <Text style={styles.flashTr}>{w.tr}</Text>
        {w.example ? (
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Cümleyi dinle"
            onPress={() => say(w.example ?? '')}
            style={(st) => [styles.example, (st.pressed || isHovered(st)) && { backgroundColor: colors.ground }]}
          >
            <Icon name="speaker" size={18} color={colors.muted} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.exampleEn}>{w.example}</Text>
              {w.exampleTr ? <Text style={styles.exampleTr}>{w.exampleTr}</Text> : null}
            </View>
          </Pressable>
        ) : null}
      </View>
      <ProgressBar value={(index + 1) / words.length} height={3} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button label="Geri" variant="outline" disabled={index === 0} onPress={() => setIndex(index - 1)} style={{ flex: 1 }} />
        <Button label={last ? 'Devam' : 'Sonraki'} onPress={() => (last ? onDone(null) : setIndex(index + 1))} style={{ flex: 2 }} />
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
      <View style={styles.specimen}>
        <Text style={styles.bigWord}>{item.word}</Text>
        <View style={styles.ipaRow}>
          <Text style={styles.ipa}>{item.ipa}</Text>
          <Text style={styles.stress}>{item.stress}</Text>
        </View>
        <Body size={15} color={colors.inkLine}>{item.tipTr}</Body>
      </View>
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
        {done ? 'Hepsini eşleştirdin.' : `${matched.size} / ${pairs.length} eşleşti`}
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
      <Label>{`Soru ${index + 1} / ${questions.length}`}</Label>
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
      <Label>{dialog?.titleTr ?? 'Diyalog'}</Label>
      <Title size={22}>Boşlukları doldur</Title>
      <View style={{ gap: 10 }}>
        {lines.slice(0, visible).map((l, i) => {
          const you = l.who === 'You';
          const gapDone = l.gap && gaps.indexOf(i) < filled;
          const parts = l.text.split('___');
          return (
            <View key={i} style={{ alignItems: you ? 'flex-end' : 'flex-start', gap: 3 }}>
              <Text style={styles.who}>{you ? 'Sen' : l.who}</Text>
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
          <Label>Boşluğa ne gelir?</Label>
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
      <View style={styles.situation}>
        <Label>Durum</Label>
        <Body size={15}>{form?.situationTr}</Body>
      </View>
      <View style={styles.form}>
        <Text style={styles.formTitle}>{form?.title}</Text>
        {fields.map((f, i) => (
          <View key={f.label} style={[styles.formRow, i === index && styles.formRowActive]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.formLabel}>{f.label}</Text>
              <Text style={styles.formLabelTr}>{f.labelTr}</Text>
            </View>
            <Text style={[styles.formValue, i >= index && { color: colors.line }]}>{i < index ? f.options[f.answer] : '__________'}</Text>
          </View>
        ))}
      </View>
      {!done ? (
        <View style={{ gap: 8 }}>
          <Label>{`${field.label}: ne yazarsın?`}</Label>
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
          <Body size={15} color={colors.green}>{mistakes === 0 ? 'Formu hatasız doldurdun.' : `Form tamam. ${mistakes} kez düzelttin; bir dahakine daha kolay olacak.`}</Body>
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
          <Label>Cevap</Label>
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
        <Layer label="Kelime" text={use.word} bold />
        <Layer label="Cümle" text={use.phrase} />
        <Layer label="Durum" text={use.situationTr} last />
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
              style={[styles.tile, used && { backgroundColor: colors.ground, borderColor: colors.ground }]}
            >
              <Text style={[styles.tileText, used && { color: colors.disabled }]}>{tiles[i]}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.rowBetween}>
        <Text style={[styles.feedback, { flex: 1, color: correct ? colors.green : complete ? colors.red : colors.muted }]}>
          {correct ? 'Doğru sıra. Şimdi sesli söyle.' : complete ? 'Tam değil, başka bir sıra dene.' : 'Kelimelere sırayla dokun.'}
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
  step: { gap: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  soundCard: {
    width: '23%',
    minHeight: 72,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  soundCardEn: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
  soundCardTr: { fontFamily: fonts.body, fontSize: 11, color: colors.muted, textAlign: 'center' },
  wordCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 18, gap: 4 },
  wordTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  counter: { fontFamily: fonts.displayBold, fontSize: 16, color: colors.muted },
  pictureBox: { width: 132, height: 132, borderRadius: radius.md, backgroundColor: colors.yellowTint, alignItems: 'center', justifyContent: 'center' },
  pictureBig: { height: 220, borderRadius: radius.lg, backgroundColor: colors.yellowTint, alignItems: 'center', justifyContent: 'center' },
  wordRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, alignSelf: 'flex-start' },
  flashWord: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, color: colors.ink, letterSpacing: -0.6, flexShrink: 1 },
  flashTr: { fontFamily: fonts.bodyMedium, fontSize: 17, color: colors.muted },
  example: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 14, marginTop: 14, borderRadius: radius.sm },
  exampleEn: { fontFamily: fonts.bodyBold, fontSize: 17, lineHeight: 24, color: colors.ink },
  exampleTr: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
  specimen: { gap: 6, paddingVertical: 8 },
  bigWord: { fontFamily: fonts.display, fontSize: 56, lineHeight: 58, color: colors.ink, letterSpacing: -1 },
  ipaRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' },
  ipa: { fontFamily: fonts.body, fontSize: 18, color: colors.inkLine },
  stress: { fontFamily: fonts.displayBold, fontSize: 18, color: colors.ink, backgroundColor: colors.yellowTint, paddingHorizontal: 6, borderRadius: radius.sm, overflow: 'hidden' },
  answer: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  matchCols: { flexDirection: 'row', gap: 10 },
  matchCol: { flex: 1, gap: 8 },
  matchTile: {
    minHeight: 60,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  matchPicked: { borderColor: colors.ink, borderWidth: 2.5, backgroundColor: colors.yellowTint },
  matchDone: { borderColor: colors.greenTint, backgroundColor: colors.greenTint, opacity: 0.6 },
  matchWrong: { borderColor: colors.red, backgroundColor: colors.redTint },
  matchText: { fontFamily: fonts.displayBold, fontSize: 17, color: colors.ink, textAlign: 'center' },
  feedback: { fontFamily: fonts.bodyMedium, fontSize: 14 },
  listen: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.ink, borderRadius: radius.md, padding: 14, minHeight: 72 },
  listenIcon: { width: 44, height: 44, borderRadius: 8, borderWidth: 2, borderColor: colors.yellow, alignItems: 'center', justifyContent: 'center' },
  listenText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.surface },
  who: { fontFamily: fonts.displayMedium, fontSize: 13, color: colors.muted },
  bubble: { maxWidth: '86%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.xl },
  themBubble: { backgroundColor: colors.surface, borderTopLeftRadius: 2 },
  youBubble: { backgroundColor: colors.ink, borderTopRightRadius: 2 },
  bubbleText: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.ink },
  gap: { fontFamily: fonts.bodyBold },
  gapOpen: { backgroundColor: colors.yellow, color: colors.ink },
  gapDone: { textDecorationLine: 'underline' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 48, paddingHorizontal: 16, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.ink, backgroundColor: colors.surface, justifyContent: 'center' },
  chipText: { fontFamily: fonts.displayBold, fontSize: 17, color: colors.ink },
  situation: { gap: 6, borderLeftWidth: 4, borderLeftColor: colors.yellow, paddingLeft: 14, paddingVertical: 2 },
  form: { backgroundColor: colors.paper, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 12, gap: 0 },
  formTitle: { fontFamily: fonts.display, fontSize: 18, letterSpacing: 1.5, color: colors.ink, marginBottom: 8 },
  formRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: colors.line },
  formRowActive: { backgroundColor: colors.yellowTint },
  formLabel: { fontFamily: fonts.displayBold, fontSize: 14, color: colors.ink },
  formLabelTr: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  formValue: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.blue },
  buildBox: {
    minHeight: 64,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.disabled,
    padding: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  builtTile: {
    fontFamily: fonts.displayBold,
    fontSize: 17,
    color: colors.surface,
    backgroundColor: colors.ink,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  bank: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  tileText: { fontFamily: fonts.displayBold, fontSize: 17, color: colors.ink },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  layer: { flexDirection: 'row', gap: 12, paddingVertical: 10 },
  layerLabel: { width: 64, fontFamily: fonts.displayMedium, fontSize: 13, color: colors.muted, paddingTop: 1 },
  layerText: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.ink, lineHeight: 21 },
});
