import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';

import type { LevelId } from '@/lib/types';
import { colors, fonts } from '@/theme';

export const LEVEL_COLORS: Record<LevelId, { metal: string; deep: string; tint: string }> = {
  BRONZE: { metal: '#C8834A', deep: '#8A5226', tint: '#F6E6D8' },
  SILVER: { metal: '#B9C1CA', deep: '#7A848F', tint: '#EEF1F4' },
  GOLD: { metal: '#FFC629', deep: '#B38300', tint: '#FFF4CC' },
};

/** The Bronze / Silver / Gold Traveller medal. Unearned medals are drawn as a grey outline. */
export function Medal({ id, size = 160, earned = true, label }: { id: LevelId; size?: number; earned?: boolean; label?: string }) {
  const c = LEVEL_COLORS[id];
  const metal = earned ? c.metal : colors.line;
  const deep = earned ? c.deep : colors.disabled;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessible accessibilityLabel={label ?? id}>
      <Path d="M30 4h14l10 30H40zM70 4H56L46 34h14z" fill={earned ? colors.red : colors.line} stroke={colors.ink} strokeWidth={2} />
      <Circle cx={50} cy={62} r={32} fill={metal} stroke={colors.ink} strokeWidth={2.5} />
      <Circle cx={50} cy={62} r={24} fill="none" stroke={deep} strokeWidth={2} strokeDasharray="3 3" />
      <Path
        d="M50 46l4.7 9.6 10.6 1.5-7.7 7.5 1.8 10.5L50 70.2l-9.4 4.9 1.8-10.5-7.7-7.5 10.6-1.5z"
        fill={earned ? colors.surface : colors.ground}
        stroke={colors.ink}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <SvgText x={50} y={90} fontSize={7} fontFamily={fonts.mono} fontWeight="700" fill={colors.ink} textAnchor="middle">
        {id}
      </SvgText>
    </Svg>
  );
}
