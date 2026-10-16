import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { SceneReport } from '@/lib/types';
import { colors, fonts } from '@/theme';

import { OptionButton } from '../OptionButton';
import { Button, Label, Title } from '../ui';

type Question = SceneReport['memory'][number];

/**
 * "Did you catch it?" — questions about what the characters said (room number, gate, price).
 * Calls onDone with how many were missed.
 */
export function MemoryQuiz({ questions, onDone }: { questions: Question[]; onDone: (missed: number) => void }) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [missed, setMissed] = useState(0);
  const q = questions[index];
  const last = index === questions.length - 1;

  return (
    <View style={{ gap: 16 }}>
      <Label>{`Neyi hatırlıyorsun? ${index + 1} / ${questions.length}`}</Label>
      <Title size={24}>{q.question}</Title>
      <Text style={styles.tr}>{q.questionTr}</Text>
      <View style={{ gap: 10 }}>
        {q.options.map((text, i) => (
          <OptionButton
            key={text}
            index={i}
            text={text}
            disabled={picked !== null}
            state={picked === null ? 'idle' : i === q.answer ? 'correct' : i === picked ? 'wrong' : 'idle'}
            onPress={() => {
              setPicked(i);
              if (i !== q.answer) {
                setMissed((m) => m + 1);
              }
            }}
          />
        ))}
      </View>
      {picked !== null ? (
        <Text accessibilityLiveRegion="polite" style={[styles.feedback, { color: picked === q.answer ? colors.green : colors.red }]}>
          {picked === q.answer ? 'Doğru. Kulağın açık.' : 'Bunu kaçırdın. Gerçek hayatta tekrar sormaktan çekinme.'}
        </Text>
      ) : null}
      <Button
        label={last ? 'Bitir' : 'Sonraki soru'}
        disabled={picked === null}
        onPress={() => {
          if (last) {
            onDone(missed);
          } else {
            setIndex(index + 1);
            setPicked(null);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tr: { fontFamily: fonts.body, fontSize: 14, color: colors.muted, marginTop: -8 },
  feedback: { fontFamily: fonts.bodyBold, fontSize: 14 },
});
