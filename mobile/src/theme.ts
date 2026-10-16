/**
 * Gate 21's look comes from the places a trip passes through: the charcoal-and-yellow of
 * airport wayfinding signs, the coloured lines of a metro map, the paper of a passport.
 * One type family (IBM Plex): the condensed cut speaks like a sign, the regular cut reads.
 */
export const colors = {
  /** Sign charcoal: text, dark panels, the primary button. */
  ink: '#232A31',
  inkSoft: '#2F3740',
  inkLine: '#45505B',
  /** The terminal floor: a cool, light stone. */
  ground: '#ECEEEA',
  surface: '#FFFFFF',
  paper: '#F7F8F5',
  line: '#D3D8D1',
  muted: '#5B6570',
  mutedOnInk: '#AEB7C0',
  disabled: '#8C949C',
  /** Wayfinding yellow: only for "you are here" and the one action that moves you on. */
  yellow: '#FFC72C',
  yellowTint: '#FFF1C6',
  red: '#C0392B',
  redDeep: '#8E2A1F',
  redTint: '#F7E0DC',
  green: '#2E7D4F',
  greenTint: '#DDEDE2',
  blue: '#1F5FA8',
} as const;

/** Each week is a line on the journey map, like a metro line: London red, New York green, Sydney blue. */
export const lineColors: Record<number, string> = { 0: '#7A848E', 1: '#D2452F', 2: '#12866A', 3: '#1F6FB2' };
export const lineColor = (week: number | undefined) => lineColors[week ?? 0] ?? lineColors[0];

export const fonts = {
  display: 'IBMPlexSansCondensed_700Bold',
  displayBold: 'IBMPlexSansCondensed_600SemiBold',
  displayMedium: 'IBMPlexSansCondensed_500Medium',
  body: 'IBMPlexSans_400Regular',
  bodyMedium: 'IBMPlexSans_500Medium',
  bodyBold: 'IBMPlexSans_600SemiBold',
  /** Small labels and data: the condensed cut, never all caps. */
  mono: 'IBMPlexSansCondensed_600SemiBold',
  monoMedium: 'IBMPlexSansCondensed_500Medium',
} as const;

/** Small radii: signs and tickets have crisp corners; only round things are round. */
export const radius = { sm: 3, md: 6, lg: 8, xl: 12 } as const;

/** Screen gutter. */
export const gutter = 20;
