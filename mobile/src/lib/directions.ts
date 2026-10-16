/**
 * The walking-directions game: a grid town of 4×4 crossings, a walker who stands on a crossing
 * facing a direction, and spoken directions to follow ("Turn left", "Take the second exit").
 * Pure logic, shared by the map, the step and the content tests.
 */
export type Heading = 'N' | 'E' | 'S' | 'W';
export type Turn = 'left' | 'straight' | 'right';
export type Exit = 'exit1' | 'exit2' | 'exit3';
export type Move = Turn | Exit;
export type Point = [number, number];

export type PlaceKind =
  | 'hotel' | 'bank' | 'museum' | 'cafe' | 'pharmacy' | 'post' | 'supermarket'
  | 'station' | 'theatre' | 'park' | 'market' | 'restaurant' | 'gallery';

/** A place fills one block; block [c, r] lies between crossings c..c+1 and r..r+1. */
export type Place = { id: string; name: string; kind: PlaceKind; block: Point };

export type TownSpec = {
  /** Names of the streets running west–east, from north to south (one per row of crossings). */
  streetsH: string[];
  /** Names of the streets running north–south, from west to east. */
  streetsV: string[];
  /** A crossing that is a roundabout (traffic goes clockwise, as in the UK and Australia). */
  roundabout?: Point | null;
  /** Water along one edge of the map: a river or a harbour. */
  water?: 'north' | 'south' | 'east' | 'west' | null;
  places: Place[];
};

export type RoundStep = { say: string; sayTr?: string; moves: Move[] };
export type Round = {
  goal: string;
  start: Point;
  heading: Heading;
  steps: RoundStep[];
  /** Said on arrival, e.g. "The hotel is on your left." */
  arrive: string;
  arriveTr?: string;
};

export type Directions = { titleTr: string; town: TownSpec; rounds: Round[] };

export const SIZE = 4;
const ORDER: Heading[] = ['N', 'E', 'S', 'W'];
const STEP: Record<Heading, Point> = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };

export function turnTo(heading: Heading, turn: Turn): Heading {
  const i = ORDER.indexOf(heading);
  return ORDER[(i + (turn === 'left' ? 3 : turn === 'right' ? 1 : 0)) % 4];
}

/** Clockwise roundabout with four arms: first exit is on the left, second straight on, third on the right. */
const EXIT_TURN: Record<Exit, Turn> = { exit1: 'left', exit2: 'straight', exit3: 'right' };

export const isExit = (m: Move): m is Exit => m.startsWith('exit');

export function isRoundabout(spec: TownSpec, p: Point): boolean {
  return !!spec.roundabout && spec.roundabout[0] === p[0] && spec.roundabout[1] === p[1];
}

const inside = ([c, r]: Point) => c >= 0 && r >= 0 && c < SIZE && r < SIZE;

/** Where a move leads, or null when there is no street that way (or the move doesn't fit the crossing). */
export function applyMove(spec: TownSpec, at: Point, heading: Heading, move: Move): { at: Point; heading: Heading } | null {
  if (isExit(move) !== isRoundabout(spec, at)) {
    return null;
  }
  const next = turnTo(heading, isExit(move) ? EXIT_TURN[move] : move);
  const [dc, dr] = STEP[next];
  const to: Point = [at[0] + dc, at[1] + dr];
  return inside(to) ? { at: to, heading: next } : null;
}

/** The moves offered at a crossing: the three turns, or the three exits of a roundabout. */
export function choicesAt(spec: TownSpec, at: Point): Move[] {
  return isRoundabout(spec, at) ? ['exit1', 'exit2', 'exit3'] : ['left', 'straight', 'right'];
}

export function cornersOf([c, r]: Point): Point[] {
  return [[c, r], [c + 1, r], [c, r + 1], [c + 1, r + 1]];
}

/** Problems with a round: moves that leave the map, or an end point away from the goal. */
export function checkRound(spec: TownSpec, round: Round): string[] {
  const errors: string[] = [];
  const goal = spec.places.find((p) => p.id === round.goal);
  if (!goal) {
    errors.push(`unknown goal ${round.goal}`);
  }
  let at = round.start;
  let heading = round.heading;
  round.steps.forEach((step, i) => {
    step.moves.forEach((move) => {
      const next = applyMove(spec, at, heading, move);
      if (!next) {
        errors.push(`step ${i + 1}: "${move}" is impossible at ${at.join(',')} facing ${heading}`);
        return;
      }
      ({ at, heading } = next);
    });
  });
  if (goal && !cornersOf(goal.block).some(([c, r]) => c === at[0] && r === at[1])) {
    errors.push(`ends at ${at.join(',')}, not next to ${goal.name}`);
  }
  return errors;
}

/** Every crossing visited by a round, in order, starting with the start. */
export function routeOf(spec: TownSpec, round: Round): Point[] {
  const points: Point[] = [round.start];
  let at = round.start;
  let heading = round.heading;
  for (const step of round.steps) {
    for (const move of step.moves) {
      const next = applyMove(spec, at, heading, move);
      if (!next) {
        return points;
      }
      ({ at, heading } = next);
      points.push(at);
    }
  }
  return points;
}

export const MOVE_LABEL: Record<Move, string> = {
  left: 'Turn left',
  straight: 'Go straight',
  right: 'Turn right',
  exit1: '1st exit',
  exit2: '2nd exit',
  exit3: '3rd exit',
};

export const MOVE_TR: Record<Move, string> = {
  left: 'sola dön',
  straight: 'düz devam et',
  right: 'sağa dön',
  exit1: 'birinci çıkış',
  exit2: 'ikinci çıkış',
  exit3: 'üçüncü çıkış',
};
