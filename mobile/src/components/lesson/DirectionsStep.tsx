import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { chapterInfo } from '@/lib/content';
import { applyMove, choicesAt, type Heading, isExit, MOVE_LABEL, MOVE_TR, type Move, type PlaceKind, type Point } from '@/lib/directions';
import { say } from '@/lib/voice';
import { colors, fonts, lineColor, radius } from '@/theme';

import { Icon } from '../Icon';
import { GLYPH } from '../directions/glyphs';
import { POI } from '../directions/looks';
import { along, type MapPulse, nodeXY, TownMap, type WalkerState } from '../directions/TownMap';
import { Body, Button, isHovered, Label, Title } from '../ui';
import type { StepProps } from './Steps';

const PRAISE = ['Doğru', 'Aynen böyle', 'Güzel dönüş', 'Doğru yoldasın'];
const KEYS: Record<string, Move> = { ArrowLeft: 'left', ArrowUp: 'straight', ArrowRight: 'right', '1': 'exit1', '2': 'exit2', '3': 'exit3' };
const AS_EXIT: Partial<Record<Move, Move>> = { left: 'exit1', straight: 'exit2', right: 'exit3' };

type Toast = { text: string; tone: 'ok' | 'bad' | 'arrive'; key: number };

/**
 * Follow spoken directions through a city. Bronze: left, right, straight, with the Turkish
 * shown. Silver: street names and "two blocks". Gold: roundabout exits and crossroads, heard
 * first and read only on request, and no flag on the goal until you get there.
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
    const xy = directions && r ? nodeXY(directions.town, r.start) : { x: 0, y: 0 };
    return { ...xy, heading: r?.heading ?? 'N' };
  });
  const [wrong, setWrong] = useState<Move | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [roundMistakes, setRoundMistakes] = useState(0);
  const [shown, setShown] = useState(week < 3);
  const [moving, setMoving] = useState(false);
  const [preview, setPreview] = useState<Move | null>(null);
  const [pulse, setPulse] = useState<MapPulse | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const frame = useRef<number | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const shakeX = useRef(new Animated.Value(0)).current;
  const pulses = useRef(0);

  const r = directions?.rounds[round];
  const step = r?.steps[stepIndex];
  const arrived = !!r && stepIndex >= r.steps.length;
  const goal = r ? directions?.town.places.find((p) => p.id === r.goal) : undefined;

  const flash = useCallback(
    (text: string, tone: Toast['tone']) => {
      setToast({ text, tone, key: ++pulses.current });
      toastOpacity.stopAnimation();
      toastOpacity.setValue(0);
      Animated.sequence([
        Animated.timing(toastOpacity, { toValue: 1, duration: 140, useNativeDriver: Platform.OS !== 'web' }),
        Animated.delay(tone === 'arrive' ? 1600 : 900),
        Animated.timing(toastOpacity, { toValue: 0, duration: 260, useNativeDriver: Platform.OS !== 'web' }),
      ]).start();
    },
    [toastOpacity],
  );

  // Each new instruction is heard; on arrival the traveller hears where the place is.
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

  const animate = (fromPoint: Point, toPoint: Point, nextHeading: Heading, done: () => void) => {
    if (!directions) return;
    const start = Date.now();
    const duration = 560;
    setMoving(true);
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      setWalker({ ...along(directions.town, fromPoint, toPoint, e), heading: nextHeading });
      if (t < 1) {
        frame.current = requestAnimationFrame(tick);
      } else {
        setMoving(false);
        done();
      }
    };
    frame.current = requestAnimationFrame(tick);
  };

  const shake = () => {
    shakeX.setValue(0);
    Animated.sequence(
      [6, -5, 4, -2, 0].map((v) => Animated.timing(shakeX, { toValue: v, duration: 55, useNativeDriver: Platform.OS !== 'web' })),
    ).start();
  };

  const choose = (move: Move) => {
    if (!directions || !r || !step || moving || arrived) {
      return;
    }
    const next = applyMove(directions.town, at, heading, move);
    if (!next) {
      return;
    }
    const expected = step.moves[moveIndex];
    if (move !== expected) {
      setWrong(move);
      setMistakes((m) => m + 1);
      setRoundMistakes((m) => m + 1);
      setPulse({ kind: 'bad', at, move, key: ++pulses.current });
      flash('O yön değil', 'bad');
      shake();
      return;
    }
    setWrong(null);
    setPreview(null);
    const lastMove = moveIndex + 1 >= step.moves.length;
    const lastStep = lastMove && stepIndex + 1 >= r.steps.length;
    animate(at, next.at, next.heading, () => {
      if (lastStep) {
        setPulse({ kind: 'arrive', at: next.at, key: ++pulses.current });
        flash('Vardın', 'arrive');
      } else {
        setPulse({ kind: 'ok', at: next.at, key: ++pulses.current });
        flash(PRAISE[pulses.current % PRAISE.length], 'ok');
      }
    });
    setAt(next.at);
    setHeading(next.heading);
    setTrail((t) => [...t, next.at]);
    if (!lastMove) {
      setMoveIndex(moveIndex + 1);
    } else {
      setMoveIndex(0);
      setStepIndex(stepIndex + 1);
      setShown(week < 3);
    }
  };

  const nextRound = () => {
    if (!directions) return;
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
    setWalker({ ...nodeXY(directions.town, n.start), heading: n.heading });
    setWrong(null);
    setPulse(null);
    setRoundMistakes(0);
  };

  const replay = () => {
    if (arrived && r) say(r.arrive);
    else if (step) say(step.say, { slow: week === 1 });
  };

  // On a keyboard: arrows (or 1–3 at a roundabout) to move, space to hear it again, Enter to go on.
  const keys = useRef({ choose, nextRound, replay, arrived, roundabout: false });
  keys.current = { choose, nextRound, replay, arrived, roundabout: !!directions && isExit(choicesAt(directions.town, at)[0]) };
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      const k = keys.current;
      if (e.key === 'Enter' && k.arrived) {
        k.nextRound();
      } else if (e.key === ' ') {
        e.preventDefault();
        k.replay();
      } else if (KEYS[e.key]) {
        e.preventDefault();
        const m = KEYS[e.key];
        k.choose(k.roundabout ? (AS_EXIT[m] ?? m) : m);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!directions || !r) {
    return null;
  }

  const choices = choicesAt(directions.town, at);
  const textVisible = shown || week < 3;
  const options = moving || arrived ? [] : choices.flatMap((m) => {
    const next = applyMove(directions.town, at, heading, m);
    return next ? [{ move: m, to: next.at }] : [];
  });

  return (
    <View style={styles.step}>
      <View style={styles.titleRow}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={styles.roundRow}>
            <Label>{`Tur ${round + 1} / ${directions.rounds.length}`}</Label>
            <View style={styles.pips}>
              {directions.rounds.map((_, i) => (
                <View key={i} style={[styles.pip, { backgroundColor: i < round || (i === round && arrived) ? color : i === round ? colors.yellow : colors.line }]} />
              ))}
            </View>
          </View>
          <View style={styles.goalRow}>
            {goal ? <GoalGlyph kind={goal.kind} /> : null}
            <Title size={28} style={{ flex: 1 }}>{goal?.name ?? ''}</Title>
          </View>
        </View>
        <Text style={[styles.mistakes, mistakes > 0 && { color: colors.red }]}>{mistakes === 0 ? 'Hatasız' : `${mistakes} yanlış dönüş`}</Text>
      </View>

      <View style={[styles.board, { width: mapSize }]}>
        <View style={styles.map}>
          <TownMap
            town={directions.town}
            walker={walker}
            trail={trail}
            trailColor={color}
            goal={week < 3 || arrived ? r.goal : null}
            size={mapSize}
            options={options}
            at={at}
            preview={preview}
            pulse={pulse}
            arrived={arrived}
          />
          {toast ? (
            <Animated.View
              key={toast.key}
              pointerEvents="none"
              accessibilityLiveRegion="polite"
              style={[
                styles.toast,
                toast.tone === 'ok' && { backgroundColor: colors.green },
                toast.tone === 'bad' && { backgroundColor: colors.red },
                toast.tone === 'arrive' && { backgroundColor: colors.yellow },
                { opacity: toastOpacity, transform: [{ translateY: toastOpacity.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }] },
              ]}
            >
              <Icon name={toast.tone === 'bad' ? 'close' : 'check'} size={15} color={toast.tone === 'arrive' ? colors.ink : colors.surface} strokeWidth={2.6} />
              <Text style={[styles.toastText, toast.tone === 'arrive' && { color: colors.ink }]}>{toast.text}</Text>
            </Animated.View>
          ) : null}
        </View>

        {/* The direction card, attached to the bottom of the map. */}
        <View style={styles.card}>
          <View style={styles.progress}>
            {r.steps.map((_, i) => (
              <View key={i} style={[styles.segment, { backgroundColor: i < stepIndex ? color : i === stepIndex && !arrived ? colors.yellow : colors.inkLine }]} />
            ))}
          </View>
          <View style={styles.cardRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={arrived ? 'Tekrar dinle' : 'Tarifi tekrar dinle'}
              onPress={replay}
              style={(st) => [styles.speaker, (st.pressed || isHovered(st)) && { backgroundColor: colors.inkLine }]}
            >
              <Icon name="speaker" size={22} color={colors.yellow} strokeWidth={2} />
            </Pressable>
            <View style={{ flex: 1, gap: 3 }}>
              {arrived ? (
                <>
                  <Text style={styles.instructionText}>{r.arrive}</Text>
                  {r.arriveTr ? <Text style={styles.instructionTrOnInk}>{r.arriveTr}</Text> : null}
                </>
              ) : textVisible ? (
                <>
                  <Text style={styles.instructionText}>{step?.say}</Text>
                  {week === 1 && step?.sayTr ? <Text style={styles.instructionTrOnInk}>{step.sayTr}</Text> : null}
                </>
              ) : (
                <Pressable accessibilityRole="button" onPress={() => setShown(true)} style={{ minHeight: 40, justifyContent: 'center' }}>
                  <Text style={styles.reveal}>Önce dinle. Metni görmek için dokun.</Text>
                </Pressable>
              )}
            </View>
          </View>
          <Text style={styles.meta}>
            {arrived
              ? roundMistakes === 0
                ? 'Bu turu hatasız bitirdin.'
                : `Bu turda ${roundMistakes} yanlış dönüş.`
              : `Tarif ${stepIndex + 1} / ${r.steps.length}${step && step.moves.length > 1 ? `, ${moveIndex + 1}. hamle / ${step.moves.length}` : ''}`}
          </Text>
        </View>
      </View>

      {!arrived ? (
        <>
          <View style={styles.choices}>
            {choices.map((m) => {
              // No street that way (the edge of town, or a park): the choice is greyed out.
              const blocked = !applyMove(directions.town, at, heading, m);
              const isWrong = wrong === m;
              return (
                <Animated.View key={m} style={{ flex: 1, transform: [{ translateX: isWrong ? shakeX : 0 }] }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${MOVE_LABEL[m]}, ${MOVE_TR[m]}`}
                    accessibilityState={{ disabled: blocked || moving }}
                    disabled={moving || blocked}
                    onPress={() => choose(m)}
                    onHoverIn={() => !blocked && setPreview(m)}
                    onHoverOut={() => setPreview((p) => (p === m ? null : p))}
                    onPressIn={() => !blocked && setPreview(m)}
                    style={(st) => [
                      styles.choice,
                      !blocked && (st.pressed || isHovered(st)) && { backgroundColor: colors.yellowTint },
                      isWrong && { borderColor: colors.red, backgroundColor: colors.redTint },
                      blocked && { borderColor: colors.line, backgroundColor: 'transparent' },
                    ]}
                  >
                    <MoveGlyph move={m} color={blocked ? colors.line : isWrong ? colors.red : colors.ink} />
                    <Text style={[styles.choiceText, blocked && { color: colors.disabled }]}>{MOVE_LABEL[m]}</Text>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
          {wrong ? (
            <Body size={14} color={colors.red}>
              {`“${MOVE_LABEL[wrong]}” ${MOVE_TR[wrong]} demek. Tarifi tekrar dinle; yönleri yürüyen kişiye göre düşün, haritaya göre değil.`}
            </Body>
          ) : (
            <Body size={13} color={colors.muted}>
              {isExit(choices[0])
                ? 'Döner kavşakta saat yönünde dönülür: birinci çıkış solda, ikincisi karşıda, üçüncüsü sağda.'
                : 'Sağ ve sol, sarı oku izleyen yolcuya göre. Haritadaki küçük oklar gidebileceğin sokakları gösterir.'}
            </Body>
          )}
        </>
      ) : (
        <Button label={round + 1 >= directions.rounds.length ? 'Devam' : 'Sonraki tur'} onPress={nextRound} />
      )}
    </View>
  );
}

function GoalGlyph({ kind }: { kind: PlaceKind }) {
  const g = GLYPH[kind];
  return (
    <Svg width={26} height={26} viewBox="0 0 14 14">
      <Rect x={0.5} y={0.5} width={13} height={13} rx={3} fill={POI[kind]} />
      <G transform="translate(1 1)">
        {g.fill ? <Path d={g.fill} fill="#FFFFFF" /> : null}
        {g.stroke ? <Path d={g.stroke} fill="none" stroke="#FFFFFF" strokeWidth={1.15} strokeLinecap="round" strokeLinejoin="round" /> : null}
      </G>
    </Svg>
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
  roundRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pips: { flexDirection: 'row', gap: 4 },
  pip: { width: 14, height: 4, borderRadius: 1 },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mistakes: { fontFamily: fonts.displayMedium, fontSize: 14, color: colors.muted, paddingBottom: 4 },
  board: { alignSelf: 'center', borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.ink },
  map: { position: 'relative' },
  toast: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  toastText: { fontFamily: fonts.displayBold, fontSize: 14, color: colors.surface },
  card: { padding: 12, paddingTop: 0, gap: 10 },
  progress: { flexDirection: 'row', gap: 3, marginHorizontal: -12 },
  segment: { flex: 1, height: 4 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50 },
  speaker: { width: 46, height: 46, borderRadius: 8, borderWidth: 2, borderColor: colors.yellow, alignItems: 'center', justifyContent: 'center' },
  instructionText: { fontFamily: fonts.display, fontSize: 21, lineHeight: 24, color: colors.surface },
  instructionTrOnInk: { fontFamily: fonts.body, fontSize: 13, color: colors.mutedOnInk },
  meta: { fontFamily: fonts.monoMedium, fontSize: 12, color: colors.mutedOnInk },
  reveal: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.surface, textDecorationLine: 'underline' },
  choices: { flexDirection: 'row', gap: 8 },
  choice: {
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
});
