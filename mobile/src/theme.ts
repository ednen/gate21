/** "Departure board" look from the design: ink, wayfinding yellow and stamp red. */
export const colors = {
  ink: '#14171C',
  inkSoft: '#2A2F37',
  inkLine: '#3A404A',
  ground: '#EEF0F2',
  surface: '#FFFFFF',
  paper: '#F7F8F6',
  line: '#D8DCE1',
  muted: '#4E5560',
  mutedOnInk: '#B8C0CA',
  disabled: '#5C636E',
  yellow: '#FFC629',
  yellowTint: '#FFF4CC',
  red: '#B42318',
  redDeep: '#8E1B12',
  redTint: '#FBEAE8',
  green: '#1E6B45',
  greenTint: '#E7F3EC',
  blue: '#1E4FA8',
} as const;

export const fonts = {
  display: 'BricolageGrotesque_800ExtraBold',
  displayBold: 'BricolageGrotesque_700Bold',
  displayMedium: 'BricolageGrotesque_500Medium',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodyBold: 'DMSans_700Bold',
  mono: 'JetBrainsMono_700Bold',
  monoMedium: 'JetBrainsMono_500Medium',
} as const;

export const radius = { sm: 8, md: 14, lg: 18, xl: 22 } as const;
