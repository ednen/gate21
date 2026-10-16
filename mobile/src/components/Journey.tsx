import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { manifest } from '@/lib/content';
import { colors, fonts, lineColor, radius } from '@/theme';

export const CITY_TR: Record<string, string> = { London: 'Londra', 'New York': 'New York', Sydney: 'Sidney' };
export const cityTr = (trip: string | undefined) => (trip ? CITY_TR[trip] ?? trip : '');

/**
 * The whole 21-day journey as a metro line: three coloured legs (London, New York, Sydney),
 * one station a day. Days behind you are filled, today wears the yellow ring.
 */
export function JourneyLine({ day, todayDone }: { day: number; todayDone: boolean }) {
  const levels = manifest().levels;
  return (
    <View accessible accessibilityLabel={`21 günlük yolculukta ${day}. gün`} style={{ gap: 8 }}>
      <View style={styles.legs}>
        {levels.map((l, w) => {
          const color = lineColor(l.week);
          return (
            <View key={l.id} style={styles.leg}>
              <View style={[styles.legTrack, { backgroundColor: color, opacity: day > w * 7 ? 1 : 0.35 }]} />
              {Array.from({ length: 7 }, (_, i) => {
                const n = w * 7 + i + 1;
                const done = n < day || (n === day && todayDone);
                const here = n === day && !todayDone;
                return (
                  <View
                    key={n}
                    style={[
                      styles.dot,
                      { borderColor: color, backgroundColor: done ? color : colors.ink },
                      n > day && { borderColor: colors.inkLine },
                      here && styles.here,
                    ]}
                  />
                );
              })}
            </View>
          );
        })}
      </View>
      <View style={styles.legs}>
        {levels.map((l) => (
          <Text key={l.id} style={[styles.legName, { color: day >= l.startDay ? colors.surface : colors.mutedOnInk }]}>
            {cityTr(l.trip)}
          </Text>
        ))}
      </View>
    </View>
  );
}

/**
 * A boarding pass: a coloured header strip, the body, and a stub separated by a perforation.
 * The notches are cut in the page colour, so it reads as paper on the floor.
 */
export function Ticket({ stripColor, strip, stripRight, children, stub, ground = colors.ground, style }: {
  stripColor: string;
  strip: string;
  stripRight?: string;
  children: ReactNode;
  stub?: ReactNode;
  ground?: string;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.ticket, style]}>
      <View style={[styles.strip, { backgroundColor: stripColor }]}>
        <Text style={styles.stripText}>{strip}</Text>
        {stripRight ? <Text style={styles.stripText}>{stripRight}</Text> : null}
      </View>
      <View style={styles.ticketBody}>{children}</View>
      {stub ? (
        <>
          <View style={styles.perforation}>
            <View style={[styles.notch, styles.notchLeft, { backgroundColor: ground }]} />
            <View style={styles.dashes} />
            <View style={[styles.notch, styles.notchRight, { backgroundColor: ground }]} />
          </View>
          <View style={styles.stub}>{stub}</View>
        </>
      ) : null}
    </View>
  );
}

/** A row on a metro strip map: the line runs through the station on the left. */
export function StripRow({ color, state, first, last, children, right }: {
  color: string;
  state: 'done' | 'here' | 'open' | 'closed';
  first?: boolean;
  last?: boolean;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <View style={styles.stripRow}>
      <View style={styles.rail}>
        <View style={[styles.railLine, { backgroundColor: color, top: first ? 26 : 0, bottom: last ? undefined : 0, height: last ? 26 : undefined, opacity: state === 'closed' ? 0.35 : 1 }]} />
        <View
          style={[
            styles.stop,
            { borderColor: color },
            state === 'done' && { backgroundColor: color },
            state === 'here' && styles.stopHere,
            state === 'closed' && { borderColor: colors.line },
          ]}
        />
      </View>
      <View style={styles.stripMain}>{children}</View>
      {right ? <View style={styles.stripRight}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  legs: { flexDirection: 'row', gap: 10 },
  leg: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 16 },
  legTrack: { position: 'absolute', left: 3, right: 3, height: 4, top: 6 },
  dot: { width: 9, height: 9, borderRadius: 4.5, borderWidth: 2 },
  here: { width: 15, height: 15, borderRadius: 7.5, borderWidth: 3, borderColor: colors.yellow, backgroundColor: colors.ink },
  legName: { flex: 1, fontFamily: fonts.displayMedium, fontSize: 13 },
  ticket: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' },
  strip: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  stripText: { fontFamily: fonts.displayBold, fontSize: 14, color: colors.surface, letterSpacing: 0.2 },
  ticketBody: { padding: 16, gap: 10 },
  perforation: { height: 16, justifyContent: 'center' },
  dashes: { marginHorizontal: 14, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line },
  notch: { position: 'absolute', width: 16, height: 16, borderRadius: 8, top: 0 },
  notchLeft: { left: -8 },
  notchRight: { right: -8 },
  stub: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 6, gap: 12 },
  stripRow: { flexDirection: 'row', alignItems: 'stretch', minHeight: 64 },
  rail: { width: 28, alignItems: 'center' },
  railLine: { position: 'absolute', width: 4, left: 12 },
  stop: { marginTop: 18, width: 16, height: 16, borderRadius: 8, borderWidth: 3.5, backgroundColor: colors.ground },
  stopHere: { width: 22, height: 22, borderRadius: 11, marginTop: 15, borderWidth: 4, borderColor: colors.ink, backgroundColor: colors.yellow },
  stripMain: { flex: 1, paddingVertical: 12, paddingLeft: 8, gap: 2 },
  stripRight: { justifyContent: 'center', paddingLeft: 8 },
});
