import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { chapterInfo } from '@/lib/content';
import { applyMove, choicesAt, type Heading, isExit, MOVE_LABEL, MOVE_TR, type Move, type Point } from '@/lib/directions';
import { say } from '@/lib/voice';
import { colors, fonts, lineColor, radius } from '@/theme';

import { Icon } from '../Icon';
import { px, TownMap, type WalkerState } from '../directions/TownMap';
import { Body, Button, isHovered, Label, Title } from '../ui';
import type { StepProps } from './Steps';

/**
 * Follow spoken directions through a town. Bronze: left, right, straight, with the Turkish
 * shown. Silver: street names and "two blocks". Gold: roundabout exits and crossroads, heard
 * first and read only on request, and no pin on the goal.
 */
export function DirectionsStep({ chapter, onDone }: StepProps) {
  const directions = chapter.directions;
  const week = chapterInfo(chapter.slug)?.week ?? 1;
  const color = lineColor(week);
  const { width } = useWindowDimensions();
  const mapSize = Math.min(width - 40, 440);

  const [round, setRound] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [moveIndex, setMoveIndex] = useState(0);
  const [at, setAt] = useState<Point>(directions?.rounds[0].start ?? [0, 0]);
  const [heading, setHeading] = useState<Heading>(directions?.rounds[0].heading ?? 'N');
  const [trail, setTrail] = useState<Point[]>(directions ? [directions.rounds[0].start] : []);
  const [walker, setWalker] = useState<WalkerState>(() => {
    const r = directions?.rounds[0];
    return { x: px(r?.start[0] ?? 0), y: px(r?.start[1] ?? 0), heading: r?.heading ?? 'N' };
  });
  const [wrong, setWrong] = useState<Move | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [shown, setShown] = useState(week < 3);
  const [moving, setMoving] = useState(false);
  const frame = useRef<number | null>(null);

  const r = directions?.rounds[round];
  const step = r?.steps[stepIndex];
  const arrived = !!r && stepIndex >= r.steps.length;
  const goal = r ? directions?.town.places.find((p) => p.id === r.goal) : undefined;

  // Each new instruction is heard; on arrival the walker hears where the place is.
  useEffect(() => {
    if (arrived && r) {
      say(r.arrive);
    } else if (step) {
      say(step.say);
    }
  }, [arrived, r, step]);

  useEffect(() => () => {
    if (frame.current) {
      cancelAnimationFrame(frame.current);
    }
  }, []);

  if (!directions || !r) {
    return null;
  }

  const animate = (from: Point, to: Point, nextHeading: Heading) => {
    const start = Date.now();
    const duration = 520;
    setMoving(true);
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      setWalker({ x: px(from[0] + (to[0] - from[0]) * e), y: px(from[1] + (to[1] - from[1]) * e), heading: nextHeading });
      if (t < 1) {
        frame.current = requestAnimationFrame(tick);
      } else {
        setMoving(false);
      }
    };
    frame.current = requestAnimationFrame(tick);
  };

  const choose = (move: Move) => {
    if (!step || moving) {
      return;
    }
    const expected = step.moves[moveIndex];
    if (move !== expected) {
      setWrong(move);
      setMistakes((m) => m + 1);
      return;
    }
    const next = applyMove(directions.town, at, heading, move);
    if (!next) {
      return;
    }
    setWrong(null);
    animate(at, next.at, next.heading);
    setAt(next.at);
    setHeading(next.heading);
    setTrail((t) => [...t, next.at]);
    if (moveIndex + 1 < step.moves.length) {
      setMoveIndex(moveIndex + 1);
    } else {
      setMoveIndex(0);
      setStepIndex(stepIndex + 1);
      setShown(week < 3);
    }
  };

  const nextRound = () => {
    if (round + 1 >= directions.rounds.length) {
      onDone(Math.max(40, 100 - 12 * mistakes));
      return;
    }
    const n = directions.rounds[round + 1];
    setRound(round + 1);
    setStepIndex(0);
    setMoveIndex(0);
    setAt(n.start);
    setHeading(n.heading);
    setTrail([n.start]);
    setWalker({ x: px(n.start[0]), y: px(n.start[1]), heading: n.heading });
    setWrong(null);
  };

  const choices = choicesAt(directions.town, at);
  const textVisible = shown || week < 3;

  return (
    <View style={styles.step}>
      <View style={styles.titleRow}>
        <View style={{ flex: 1, gap: 2 }}>
          <Label>{`Tur ${round + 1} / ${directions.rounds.length}, hedef`}</Label>
          <Title size={30}>{goal?.name ?? ''}</Title>
        </View>
        <Text style={styles.mistakes}>{mistakes === 0 ? 'Hatasız' : `${mistakes} yanlış dönüş`}</Text>
      </View>

      <View style={styles.map}>
        <TownMap
          town={directions.town}
          walker={walker}
          trail={trail}
          trailColor={color}
          goal={week < 3 || arrived ? r.goal : null}
          size={mapSize}
        />
      </View>

      {arrived ? (
        <View style={styles.arrival} accessibilityLiveRegion="polite">
          <Icon name="check" size={22} color={colors.green} strokeWidth={2.4} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.arrivalText}>{r.arrive}</Text>
            {r.arriveTr ? <Text style={styles.instructionTr}>{r.arriveTr}</Text> : null}
          </View>
        </View>
      ) : (
        <View style={styles.instruction}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tarifi tekrar dinle"
            onPress={() => step && say(step.say, { slow: week === 1 })}
            style={(st) => [styles.speaker, (st.pressed || isHovered(st)) && { backgroundColor: colors.inkLine }]}
          >
            <Icon name="speaker" size={22} color={colors.yellow} strokeWidth={2} />
          </Pressable>
          <View style={{ flex: 1, gap: 3 }}>
            {textVisible ? (
              <>
                <Text style={styles.instructionText}>{step?.say}</Text>
                {week === 1 && step?.sayTr ? <Text style={styles.instructionTrOnInk}>{step.sayTr}</Text> : null}
                {step && step.moves.length > 1 ? (
                  <Text style={styles.instructionTrOnInk}>{`${moveIndex + 1}. hamle / ${step.moves.length}`}</Text>
                ) : null}
              </>
            ) : (
              <Pressable accessibilityRole="button" onPress={() => setShown(true)} style={{ minHeight: 40, justifyContent: 'center' }}>
                <Text style={styles.reveal}>Önce dinle. Metni görmek için dokun.</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {!arrived ? (
        <>
          <View style={styles.choices}>
            {choices.map((m) => (
              <Pressable
                key={m}
                accessibilityRole="button"
                accessibilityLabel={`${MOVE_LABEL[m]}, ${MOVE_TR[m]}`}
                disabled={moving}
                onPress={() => choose(m)}
                style={(st) => [
                  styles.choice,
                  (st.pressed || isHovered(st)) && { backgroundColor: colors.yellowTint },
                  wrong === m && { borderColor: colors.red, backgroundColor: colors.redTint },
                ]}
              >
                <MoveGlyph move={m} color={wrong === m ? colors.red : colors.ink} />
                <Text style={styles.choiceText}>{MOVE_LABEL[m]}</Text>
              </Pressable>
            ))}
          </View>
          {wrong ? (
            <Body size={14} color={colors.red}>
              {`“${MOVE_LABEL[wrong]}” ${MOVE_TR[wrong]} demek. Tarifi tekrar dinle; yönleri yürüyen kişiye göre düşün, haritaya göre değil.`}
            </Body>
          ) : (
            <Body size={13} color={colors.muted}>
              {isExit(choices[0])
                ? 'Döner kavşakta saat yönünde dönülür: birinci çıkış solda, ikincisi karşıda, üçüncüsü sağda.'
                : 'Sağ ve sol, sarı oku izleyen yolcuya göre. Okun baktığı yöne dön.'}
            </Body>
          )}
        </>
      ) : (
        <Button label={round + 1 >= directions.rounds.length ? 'Devam' : 'Sonraki tur'} onPress={nextRound} />
      )}
    </View>
  );
}

/** Arrows drawn like road-sign arrows; roundabout exits as a ring with the exit marked. */
function MoveGlyph({ move, color }: { move: Move; color: string }) {
  const stroke = { stroke: color, strokeWidth: 3.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  if (isExit(move)) {
    const exits: Record<string, string> = { exit1: 'M14 16H5M8 13l-3 3 3 3', exit2: 'M16 14V4M13 7l3-3 3 3', exit3: 'M18 16h9M24 13l3 3-3 3' };
    return (
      <Svg width={34} height={34} viewBox="0 0 32 32">
        <Circle cx={16} cy={18} r={6} {...stroke} strokeWidth={2.4} />
        <Path d="M16 24v6" {...stroke} strokeWidth={2.4} />
        <Path d={exits[move]} {...stroke} />
      </Svg>
    );
  }
  const d = move === 'left' ? 'M20 29V17a5 5 0 0 0-5-5H6M10 7l-5 5 5 5' : move === 'right' ? 'M12 29V17a5 5 0 0 1 5-5h9M22 7l5 5-5 5' : 'M16 29V5M10 11l6-6 6 6';
  return (
    <Svg width={34} height={34} viewBox="0 0 32 32">
      <Path d={d} {...stroke} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  step: { gap: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  mistakes: { fontFamily: fonts.displayMedium, fontSize: 14, color: colors.muted, paddingBottom: 4 },
  map: { borderRadius: radius.lg, overflow: 'hidden', alignSelf: 'center' },
  instruction: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.ink, borderRadius: radius.md, padding: 12, minHeight: 72 },
  speaker: { width: 46, height: 46, borderRadius: 8, borderWidth: 2, borderColor: colors.yellow, alignItems: 'center', justifyContent: 'center' },
  instructionText: { fontFamily: fonts.display, fontSize: 22, lineHeight: 25, color: colors.surface },
  instructionTrOnInk: { fontFamily: fonts.body, fontSize: 13, color: colors.mutedOnInk },
  instructionTr: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  reveal: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.surface, textDecorationLine: 'underline' },
  choices: { flexDirection: 'row', gap: 8 },
  choice: {
    flex: 1,
    minHeight: 84,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  choiceText: { fontFamily: fonts.displayBold, fontSize: 15, color: colors.ink },
  arrival: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', borderLeftWidth: 4, borderLeftColor: colors.green, paddingLeft: 12, paddingVertical: 4 },
  arrivalText: { fontFamily: fonts.display, fontSize: 20, lineHeight: 23, color: colors.ink },
});
