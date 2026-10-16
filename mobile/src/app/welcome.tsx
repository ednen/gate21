import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { cityTr } from '@/components/Journey';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui';
import { manifest } from '@/lib/content';
import { colors, fonts, gutter, lineColor, radius } from '@/theme';

/** The first screen is a departures board: three cities, 21 days, one way in. */
export default function Welcome() {
  const levels = manifest().levels;
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.top}>
          <Logo />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="SOS English, acil durum cümleleri"
            onPress={() => router.push('/sos')}
            style={({ pressed }) => [styles.sos, pressed && { backgroundColor: colors.redDeep }]}
          >
            <Icon name="alert" size={16} color={colors.surface} strokeWidth={2.2} />
            <Text style={styles.sosText}>SOS</Text>
          </Pressable>
        </View>

        <View style={styles.middle}>
          <Text accessibilityRole="header" style={styles.headline}>
            Don't learn English.{'\n'}Learn how to travel in English.
          </Text>
          <Text style={styles.sub}>Biri seninle İngilizce konuştuğunda donup kalma. Havalimanından otele, her gün 8 dakika.</Text>
        </View>

        <View style={styles.board} accessible accessibilityLabel="21 gün, üç şehir: Londra, New York, Sidney">
          <Text style={styles.boardTitle}>Kalkışlar</Text>
          {levels.map((l) => (
            <View key={l.id} style={styles.row}>
              <View style={[styles.swatch, { backgroundColor: lineColor(l.week) }]} />
              <Text style={styles.city}>{cityTr(l.trip)}</Text>
              <Text style={styles.days}>{`${l.startDay}–${l.startDay + 6}. gün`}</Text>
              <Text style={styles.level}>{l.titleTr.split(' ')[0]}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <Button label="Yolculuğa başla" variant="accent" onPress={() => router.push('/auth?mode=register')} />
          <Button label="Hesabım var" variant="onDark" onPress={() => router.push('/auth?mode=login')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  content: { flexGrow: 1, paddingHorizontal: gutter + 4, paddingBottom: 16, gap: 28 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12 },
  sos: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: colors.red },
  sosText: { fontFamily: fonts.display, fontSize: 16, color: colors.surface, letterSpacing: 0.5 },
  middle: { flex: 1, justifyContent: 'flex-end', gap: 16, paddingTop: 24 },
  headline: { fontFamily: fonts.display, fontSize: 48, lineHeight: 48, color: colors.surface, letterSpacing: -1 },
  sub: { fontFamily: fonts.body, fontSize: 17, lineHeight: 25, color: colors.mutedOnInk, maxWidth: 420 },
  board: { borderTopWidth: 1, borderTopColor: colors.inkLine },
  boardTitle: { fontFamily: fonts.displayMedium, fontSize: 13, color: colors.mutedOnInk, paddingVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderTopWidth: 1, borderTopColor: colors.inkSoft },
  swatch: { width: 18, height: 5, borderRadius: 1 },
  city: { flex: 1, fontFamily: fonts.display, fontSize: 22, color: colors.surface },
  days: { fontFamily: fonts.displayMedium, fontSize: 15, color: colors.yellow, width: 92 },
  level: { fontFamily: fonts.displayMedium, fontSize: 15, color: colors.mutedOnInk, width: 48, textAlign: 'right' },
  actions: { gap: 10 },
});
