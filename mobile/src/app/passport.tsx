import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { Medal } from '@/components/Medal';
import { Stamp, Stars, stampDate } from '@/components/Stamp';
import { TabBar } from '@/components/TabBar';
import { cityTr } from '@/components/Journey';
import { Body, isHovered } from '@/components/ui';
import Svg, { Path } from 'react-native-svg';
import { stop } from '@/lib/content';
import { usePassport } from '@/lib/queries';
import type { PassportChapter } from '@/lib/types';
import { colors, fonts, gutter, lineColor, radius } from '@/theme';

const STAMP_COLORS = [colors.red, colors.ink, colors.blue, colors.green];

export default function PassportScreen() {
  const passport = usePassport();
  const data = passport.data;
  const chapters = data?.chapters ?? [];
  const stamped = chapters
    .filter((c) => c.stampedAt && c.kind !== 'starter')
    .sort((a, b) => (a.stampedAt ?? '').localeCompare(b.stampedAt ?? ''));
  const travelChapters = chapters.filter((c) => c.kind !== 'starter').length;
  const starter = chapters.filter((c) => c.kind === 'starter');

  const holder = (data?.holder ?? '').toLocaleUpperCase('tr-TR');
  const mrz = `P<GATE21<<${holder.replace(/[^A-Z]/g, '<')}`.padEnd(36, '<').slice(0, 36);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {/* The cover colour, then the data page. */}
        <View style={styles.cover}>
          <SafeAreaView edges={['top']} style={styles.coverInner}>
            <Text style={styles.coverTitle}>Pasaport</Text>
            <Icon name="passport" size={24} color="#E9C46A" strokeWidth={1.6} />
          </SafeAreaView>
        </View>

        <View style={styles.dataPage}>
          <Guilloche />
          <Text style={styles.fieldLabel}>Hamil</Text>
          <Text accessibilityRole="header" style={styles.holder} numberOfLines={1} adjustsFontSizeToFit>{holder || '–'}</Text>
          <View style={styles.fields}>
            <Field label="Veriliş" value={data ? stampDate(data.issuedAt) : '–'} />
            <Field label="Seviye" value={data?.levels.filter((l) => l.earned).slice(-1)[0]?.titleTr ?? 'Yolda'} />
            <Field label="Damga" value={data ? `${data.stamps} / ${travelChapters}` : '–'} />
          </View>
          <View style={styles.medals}>
            {(data?.levels ?? []).map((l) => (
              <Pressable
                key={l.id}
                accessibilityRole="button"
                accessibilityLabel={`${l.titleTr}: ${l.earned ? 'kazanıldı' : `${l.lessonsDone} / ${l.lessons}`}`}
                disabled={!l.earned}
                onPress={() => router.push(`/level/${l.id}`)}
                style={(st) => [styles.medal, l.earned && isHovered(st) && { backgroundColor: colors.paper }]}
              >
                <Medal id={l.id} size={58} earned={l.earned} />
                <Text style={[styles.medalTitle, !l.earned && { color: colors.muted }]}>{l.titleTr}</Text>
                <Text style={styles.medalSub}>{l.earned ? cityTr(l.trip) : `${l.lessonsDone} / ${l.lessons} durak`}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.mrz} numberOfLines={1} accessibilityElementsHidden importantForAccessibility="no">{mrz}</Text>
        </View>

        {/* The visa pages: one stamp per finished stop, slightly crooked, in different inks. */}
        <View style={styles.visaPage}>
          <Text style={styles.pageTitle}>Damgalar</Text>
          {stamped.length === 0 ? (
            <Body color={colors.muted}>İlk damgan, ilk durağı bitirdiğinde bu sayfaya basılacak.</Body>
          ) : (
            <View style={styles.stamps}>
              {stamped.map((c, i) => (
                <Stamp
                  key={c.slug}
                  text={c.stamp ?? c.title.toUpperCase()}
                  date={stampDate(c.stampedAt, false)}
                  size={84}
                  color={STAMP_COLORS[i % STAMP_COLORS.length]}
                  rotate={[-10, 6, -4, 9, -7][i % 5]}
                />
              ))}
            </View>
          )}
        </View>

        {(data?.levels ?? []).map((l) => {
          const rows = chapters.filter((c) => c.week === l.week && c.kind !== 'starter').sort((a, b) => a.order - b.order);
          return (
            <View key={l.id} style={styles.week}>
              <View style={styles.weekHead}>
                <View style={[styles.swatch, { backgroundColor: lineColor(l.week) }]} />
                <Text style={styles.weekTitle}>{cityTr(l.trip)}</Text>
                <Text style={styles.weekSub}>{`${l.week}. hafta, ${l.titleTr}`}</Text>
              </View>
              {rows.map((c) => (
                <Row key={c.slug} chapter={c} />
              ))}
            </View>
          );
        })}

        {starter.length > 0 ? (
          <View style={styles.week}>
            <View style={styles.weekHead}>
              <View style={[styles.swatch, { backgroundColor: lineColor(0) }]} />
              <Text style={styles.weekTitle}>Başlangıç paketi</Text>
            </View>
            {starter.map((c) => (
              <Row key={c.slug} chapter={c} />
            ))}
          </View>
        ) : null}
      </ScrollView>
      <TabBar active="passport" />
    </View>
  );
}

/** The fine wavy security print of a passport page. */
function Guilloche() {
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 300 200" preserveAspectRatio="none" accessibilityElementsHidden importantForAccessibility="no">
      {Array.from({ length: 14 }, (_, i) => (
        <Path
          key={i}
          d={`M0 ${10 + i * 14} C 50 ${i * 14 - 6}, 100 ${i * 14 + 30}, 150 ${10 + i * 14} S 250 ${i * 14 - 10}, 300 ${12 + i * 14}`}
          stroke="#E7D9DD"
          strokeWidth={0.7}
          fill="none"
        />
      ))}
    </Svg>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 1 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function Row({ chapter }: { chapter: PassportChapter }) {
  const locked = !chapter.unlocked;
  const meta = chapter.kind === 'lesson' ? `${chapter.day}. gün, ${stop(chapter.stop)?.title ?? ''}` : chapter.kind === 'simulation' ? 'Final' : '';
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, locked && { color: colors.disabled }]} numberOfLines={1}>{chapter.titleTr}</Text>
        {meta ? <Text style={styles.rowMeta}>{meta}</Text> : null}
      </View>
      {chapter.complete ? (
        <Stars count={chapter.stars} />
      ) : locked ? (
        <Icon name="lock" size={15} color={colors.disabled} />
      ) : chapter.stepsDone > 0 ? (
        <Text style={styles.status}>{`${chapter.stepsDone}/${chapter.totalSteps}`}</Text>
      ) : null}
    </View>
  );
}

const COVER = '#5A1F2B';

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  cover: { backgroundColor: COVER, paddingHorizontal: gutter, paddingBottom: 64 },
  coverInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10 },
  coverTitle: { fontFamily: fonts.display, fontSize: 30, color: '#E9C46A', letterSpacing: 0.5 },
  dataPage: { marginTop: -48, marginHorizontal: gutter, backgroundColor: '#FBF9F8', borderRadius: radius.md, padding: 18, gap: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#E8DDE0' },
  holder: { fontFamily: fonts.display, fontSize: 34, lineHeight: 36, color: colors.ink, letterSpacing: 0.5 },
  fields: { flexDirection: 'row', gap: 12 },
  fieldLabel: { fontFamily: fonts.displayMedium, fontSize: 12, color: '#8A6F76' },
  fieldValue: { fontFamily: fonts.displayBold, fontSize: 16, color: colors.ink },
  medals: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, borderTopWidth: 1, borderTopColor: '#E8DDE0', paddingTop: 10 },
  medal: { alignItems: 'center', gap: 1, flex: 1, borderRadius: radius.md, paddingVertical: 4 },
  medalTitle: { fontFamily: fonts.displayBold, fontSize: 14, color: colors.ink },
  medalSub: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  mrz: { fontFamily: fonts.displayMedium, fontSize: 13, letterSpacing: 2.2, color: '#9C8A8F', marginTop: 2 },
  visaPage: { marginHorizontal: gutter, marginTop: 14, backgroundColor: '#FBF9F8', borderRadius: radius.md, padding: 18, gap: 12, borderWidth: 1, borderColor: '#E8DDE0', minHeight: 140 },
  pageTitle: { fontFamily: fonts.display, fontSize: 20, color: COVER },
  stamps: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'flex-start' },
  week: { marginHorizontal: gutter, marginTop: 26 },
  weekHead: { flexDirection: 'row', alignItems: 'baseline', gap: 10, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: colors.ink },
  swatch: { width: 16, height: 5, borderRadius: 1, alignSelf: 'center' },
  weekTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  weekSub: { fontFamily: fonts.displayMedium, fontSize: 14, color: colors.muted },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 8 },
  rowTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  rowMeta: { fontFamily: fonts.displayMedium, fontSize: 13, color: colors.muted },
  status: { fontFamily: fonts.displayBold, fontSize: 14, color: colors.muted },
});
