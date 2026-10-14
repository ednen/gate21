import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme';

import { Icon } from './Icon';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function stampDate(iso: string | null | undefined, withYear = true): string {
  const d = iso ? new Date(iso) : new Date();
  const day = `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}`;
  return withYear ? `${day} ${d.getFullYear()}` : day;
}

/** A passport stamp. `size` large is the chapter badge, small sits in the passport strip. */
export function Stamp({ text, date, color = colors.red, size = 250, rotate = -8, place }: {
  text: string;
  date: string;
  color?: string;
  size?: number;
  rotate?: number;
  place?: string;
}) {
  const big = size >= 160;
  const lines = text.split(' ');
  return (
    <View
      accessible
      accessibilityLabel={`Damga: ${text}, ${date}`}
      style={[styles.outer, { width: size, height: size, borderRadius: size / 2, borderColor: color, borderWidth: big ? 6 : 3, transform: [{ rotate: `${rotate}deg` }] }]}
    >
      <View style={[styles.inner, { width: size * 0.86, height: size * 0.86, borderRadius: size * 0.43, borderColor: color, borderWidth: big ? 2 : 0 }]}>
        {place && big ? <Text style={[styles.place, { color }]}>{place}</Text> : null}
        <Text
          numberOfLines={lines.length}
          adjustsFontSizeToFit
          style={[styles.text, { color, fontSize: big ? 38 : 9, lineHeight: big ? 38 : 10, maxWidth: size * 0.78 }]}
        >
          {lines.join('\n')}
        </Text>
        {big ? <Icon name="check" size={32} color={color} strokeWidth={2.6} /> : null}
        <Text style={[styles.date, { color, fontSize: big ? 13 : 8 }]}>{date}</Text>
      </View>
    </View>
  );
}

export function Stars({ count, size = 16 }: { count: number; size?: number }) {
  return (
    <View accessible accessibilityLabel={`3 yıldızdan ${count}`} style={{ flexDirection: 'row', gap: 2 }}>
      {[0, 1, 2].map((i) => (
        <Icon key={i} name="star" size={size} color={colors.ink} fill={i < count ? colors.yellow : 'none'} strokeWidth={1.6} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { alignItems: 'center', justifyContent: 'center' },
  inner: { alignItems: 'center', justifyContent: 'center', gap: 4 },
  place: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 2.4 },
  text: { fontFamily: fonts.display, textAlign: 'center' },
  date: { fontFamily: fonts.mono, letterSpacing: 1.6 },
});
