import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { Stamp, Stars, stampDate } from '@/components/Stamp';
import { TabBar } from '@/components/TabBar';
import { Body, Label } from '@/components/ui';
import { usePassport } from '@/lib/queries';
import type { PassportChapter } from '@/lib/types';
import { colors, fonts } from '@/theme';

const STAMP_COLORS = [colors.red, colors.ink, colors.blue, colors.green];
const WEEKS = ['1. HAFTA · TRAVEL READY', '2. HAFTA · TRAVEL CONFIDENT', '3. HAFTA · TRAVEL PRO'];

export default function PassportScreen() {
  const passport = usePassport();
  const data = passport.data;
  const stamped = (data?.chapters ?? [])
    .filter((c) => c.stampedAt)
    .sort((a, b) => (a.stampedAt ?? '').localeCompare(b.stampedAt ?? ''));

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={styles.cover}>
          <SafeAreaView edges={['top']} style={{ gap: 14 }}>
            <View style={styles.coverTop}>
              <Label color={colors.yellow}>TRAVEL PASSPORT</Label>
              <Icon name="passport" size={26} color={colors.yellow} strokeWidth={1.6} />
            </View>
            <Text accessibilityRole="header" style={styles.holder}>{(data?.holder ?? '').toUpperCase()}</Text>
            <View style={styles.fields}>
              <Field label="VERİLİŞ" value={data ? stampDate(data.issuedAt) : '—'} />
              <Field label="SEVİYE" value={data?.level.replace('Travel ', '').toUpperCase() ?? '—'} />
              <Field label="DAMGA" value={data ? `${data.stamps} / ${data.chapters.length}` : '—'} />
            </View>
          </SafeAreaView>
        </View>

        <View style={styles.stamps}>
          {stamped.length === 0 ? (
            <Body color={colors.muted} style={{ textAlign: 'center' }}>İlk damgan, ilk bölümü bitirdiğinde buraya basılacak.</Body>
          ) : (
            stamped.map((c, i) => (
              <Stamp
                key={c.slug}
                text={c.stamp ?? c.title.toUpperCase()}
                date={stampDate(c.stampedAt, false)}
                size={84}
                color={STAMP_COLORS[i % STAMP_COLORS.length]}
                rotate={[-10, 6, -4, 9][i % 4]}
              />
            ))
          )}
        </View>

        {[1, 2, 3].map((week) => {
          const chapters = (data?.chapters ?? []).filter((c) => c.week === week);
          if (chapters.length === 0) {
            return null;
          }
          return (
            <View key={week} style={styles.week}>
              <Label>{WEEKS[week - 1]}</Label>
              <View style={styles.list}>
                {chapters.map((c, i) => (
                  <Row key={c.slug} chapter={c} last={i === chapters.length - 1} />
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
      <TabBar active="passport" />
    </View>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 3 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

function Row({ chapter, last }: { chapter: PassportChapter; last: boolean }) {
  const locked = !chapter.unlocked;
  return (
    <View style={[styles.row, !last && { borderBottomWidth: 1, borderBottomColor: colors.ground }]}>
      <Text style={[styles.rowTitle, locked && { color: colors.disabled, fontFamily: fonts.body }]}>{chapter.title}</Text>
      {chapter.complete ? (
        <Stars count={chapter.stars} />
      ) : locked ? (
        <Text style={styles.status}>{chapter.available ? 'Kilitli' : 'Yakında'}</Text>
      ) : (
        <Text style={[styles.status, { backgroundColor: colors.yellow }]}>{`${chapter.stepsDone}/${chapter.totalSteps}`}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  cover: { backgroundColor: colors.ink, paddingHorizontal: 20, paddingBottom: 20, paddingTop: 8 },
  coverTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  holder: { fontFamily: fonts.display, fontSize: 30, color: colors.surface },
  fields: { flexDirection: 'row', gap: 10 },
  fieldLabel: { fontFamily: fonts.monoMedium, fontSize: 9, letterSpacing: 1.3, color: '#9AA3AE' },
  fieldValue: { fontFamily: fonts.mono, fontSize: 12, color: colors.surface },
  stamps: {
    margin: 16,
    marginBottom: 0,
    minHeight: 110,
    backgroundColor: colors.paper,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    alignItems: 'center',
    gap: 12,
  },
  week: { marginHorizontal: 16, marginTop: 16, gap: 6 },
  list: { backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 14 },
  row: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  rowTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink, flex: 1 },
  status: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.ink,
    backgroundColor: colors.ground,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
});
