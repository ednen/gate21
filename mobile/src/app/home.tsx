import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/Icon';
import { cityTr, JourneyLine, StripRow, Ticket } from '@/components/Journey';
import { Logo } from '@/components/Logo';
import { TabBar } from '@/components/TabBar';
import { Body, Button, isHovered } from '@/components/ui';
import { canPlay, chapterInfo, level, manifest, stop } from '@/lib/content';
import { flushProgress } from '@/lib/progress';
import { invalidateProgress, useMe, usePassport } from '@/lib/queries';
import type { Me, PassportChapter } from '@/lib/types';
import { colors, fonts, gutter, lineColor, radius } from '@/theme';

export default function Home() {
  const me = useMe();
  const passport = usePassport();

  useFocusEffect(
    useCallback(() => {
      void flushProgress().then(invalidateProgress);
    }, []),
  );

  const data = me.data;
  const day = data?.journeyDay ?? 1;
  const week = data?.week ?? 1;
  const next = data?.nextChapter ?? null;
  const member = data?.membership.active ?? false;
  const freeDays = manifest().freeDays;
  const chapters = passport.data?.chapters ?? [];
  const currentWeek = next?.kind === 'lesson' ? next.week : week;
  // Any week can be looked at (and, once it is open, replayed); the current one is shown first.
  const [pickedWeek, setPickedWeek] = useState<number | null>(null);
  const shownWeek = pickedWeek ?? currentWeek;
  const weekLessons = chapters.filter((c) => c.kind === 'lesson' && c.week === shownWeek).sort((a, b) => a.day - b.day);
  const starter = chapters.filter((c) => c.kind === 'starter').sort((a, b) => a.order - b.order);
  const starterLeft = starter.filter((c) => !c.complete);
  const nextAllowed = !next || canPlay(next, member, freeDays);
  const lvl = level(week);
  const nextWeek = next?.kind === 'lesson' ? next.week : next?.kind === 'simulation' ? 3 : 0;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={me.isFetching} onRefresh={() => void flushProgress().then(invalidateProgress)} />}
      >
        {/* The departures sign: where you are on the journey. */}
        <View style={styles.sign}>
          <SafeAreaView edges={['top']} style={{ gap: 22 }}>
            <View style={styles.topRow}>
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
            <View style={styles.dayRow} accessible accessibilityLabel={`21 günün ${day}. günü, ${cityTr(lvl?.trip)}`}>
              <View>
                <Text style={styles.dayWord}>Gün</Text>
                <Text style={styles.dayNumber}>{day}</Text>
              </View>
              <View style={{ flex: 1, paddingBottom: 6, paddingLeft: 14 }}>
                <Text style={styles.city}>{cityTr(lvl?.trip)}</Text>
                <Text style={styles.levelName}>{`${lvl?.titleTr ?? ''}, 21 günlük yolculukta`}</Text>
              </View>
            </View>
            <JourneyLine day={day} todayDone={data?.todayDone ?? false} />
          </SafeAreaView>
        </View>

        {/* Today's mission is the boarding pass. */}
        <View style={styles.block}>
          {next ? (
            <Ticket
              stripColor={next.kind === 'starter' ? lineColor(0) : lineColor(nextWeek)}
              strip={next.kind === 'starter' ? 'Başlangıç paketi' : `Bugünün görevi, ${next.day}. gün`}
              stripRight={data?.todayDone ? 'Bugün tamam' : '8 dakika'}
              stub={
                <>
                  <View style={styles.stubRow}>
                    <StubField label="Durak" value={stop(next.stop)?.title ?? chapterInfo(next.slug)?.title ?? ''} />
                    <StubField label="Şehir" value={next.kind === 'starter' ? 'Hazırlık' : cityTr(level(nextWeek)?.trip)} />
                    <StubField label="Hedef" value={`${Math.min(data?.todayXp ?? 0, data?.dailyGoalXp ?? 50)}/${data?.dailyGoalXp ?? 50} XP`} />
                  </View>
                  {nextAllowed ? (
                    <Button
                      label={data?.todayDone ? 'Bir ders daha yap' : 'Derse başla'}
                      variant="accent"
                      onPress={() => router.push(`/lesson/${next.slug}`)}
                    />
                  ) : (
                    <Button label={`${next.day}. gün için plan seç`} icon="lock" onPress={() => router.push(`/membership?from=${next.slug}`)} />
                  )}
                </>
              }
            >
              <View style={styles.missionRow}>
                <Icon name={(chapterInfo(next.slug)?.icon ?? 'plane') as IconName} size={30} strokeWidth={1.8} />
                <View style={{ flex: 1, gap: 6 }}>
                  <Text accessibilityRole="header" style={styles.missionTitle}>{next.mission}</Text>
                  <Body size={14} color={colors.muted}>{next.missionTr}</Body>
                </View>
              </View>
            </Ticket>
          ) : (
            <View style={styles.doneNote}>
              <Text style={styles.doneTitle}>{data?.graduatedAt ? 'Yolculuğu bitirdin.' : 'Açık dersleri bitirdin.'}</Text>
              <Body size={14} color={colors.muted}>
                {data?.graduatedAt
                  ? 'Haftada iki kısa pratikle İngilizceni seyahate hazır tut.'
                  : 'Yeni haftanın dersleri açılana kadar sahneleri tekrar oynayabilirsin.'}
              </Body>
            </View>
          )}
        </View>

        {data?.graduatedAt ? <PracticeRow me={data} /> : null}

        {/* Figures in a sentence, not a dashboard. */}
        <View style={[styles.block, styles.figures]} accessible>
          <Figure icon="flame" iconColor={colors.red} value={`${data?.streak ?? 0}`} unit="gün seri" />
          <View style={styles.figureRule} />
          <Figure icon="star" iconColor={colors.ink} value={(data?.xp ?? 0).toLocaleString('tr-TR')} unit="XP" />
          <View style={styles.figureRule} />
          <Figure icon="target" iconColor={colors.ink} value={data?.speakingAccuracy != null ? `%${data.speakingAccuracy}` : '–'} unit="konuşma" />
        </View>

        {/* The week as a strip map: pick a city, then a stop. */}
        <View style={styles.block}>
          <View style={styles.lines} accessibilityRole="tablist">
            {manifest().levels.map((l) => {
              const active = l.week === shownWeek;
              return (
                <Pressable
                  key={l.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${l.week}. hafta, ${cityTr(l.trip)}`}
                  onPress={() => setPickedWeek(l.week)}
                  style={(st) => [styles.lineTab, isHovered(st) && !active && { backgroundColor: 'rgba(35,42,49,0.05)' }]}
                >
                  <View style={[styles.lineSwatch, { backgroundColor: lineColor(l.week) }]} />
                  <Text style={[styles.lineName, active && { color: colors.ink }]}>{cityTr(l.trip)}</Text>
                  <View style={[styles.lineUnderline, { backgroundColor: active ? lineColor(l.week) : 'transparent' }]} />
                </Pressable>
              );
            })}
          </View>
          <View style={{ marginTop: 6 }}>
            {weekLessons.map((c, i) => (
              <StopRow
                key={c.slug}
                chapter={c}
                isNext={c.slug === next?.slug}
                locked={!canPlay(c, member, freeDays)}
                first={i === 0}
                last={i === weekLessons.length - 1}
              />
            ))}
          </View>
        </View>

        {starterLeft.length > 0 && next?.kind !== 'starter' ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/lesson/${starterLeft[0].slug}`)}
            style={({ pressed }) => [styles.block, styles.starter, pressed && { opacity: 0.8 }]}
          >
            <Icon name="abc" size={26} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.starterTitle}>İngilizcen sıfırdan mı başlıyor?</Text>
              <Text style={styles.starterText}>{`Başlangıç paketi: alfabe, sayılar, ilk kelimeler. ${starter.length - starterLeft.length} / ${starter.length} ders.`}</Text>
            </View>
            <Icon name="arrowRight" size={18} />
          </Pressable>
        ) : null}
      </ScrollView>
      <TabBar active="home" />
    </View>
  );
}

function StubField({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.stubLabel}>{label}</Text>
      <Text style={styles.stubValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function Figure({ icon, iconColor, value, unit }: { icon: IconName; iconColor: string; value: string; unit: string }) {
  return (
    <View style={styles.figure} accessible accessibilityLabel={`${value} ${unit}`}>
      <Icon name={icon} size={16} color={iconColor} strokeWidth={2} />
      <Text style={styles.figureValue}>{value}</Text>
      <Text style={styles.figureUnit}>{unit}</Text>
    </View>
  );
}

function PracticeRow({ me }: { me: Me }) {
  const { thisWeek, weeklyGoal } = me.practice;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push('/practice')}
      style={({ pressed }) => [styles.block, styles.practice, pressed && { backgroundColor: colors.inkSoft }]}
    >
      <Icon name="repeat" size={22} color={colors.yellow} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.practiceTitle}>Keep your English travel ready</Text>
        <Text style={styles.practiceText}>{`Bu hafta ${thisWeek} / ${weeklyGoal} pratik yaptın.`}</Text>
      </View>
      <Icon name="arrowRight" size={18} color={colors.surface} />
    </Pressable>
  );
}

function StopRow({ chapter, isNext, locked, first, last }: { chapter: PassportChapter; isNext: boolean; locked: boolean; first: boolean; last: boolean }) {
  const s = stop(chapter.stop);
  const closed = !chapter.unlocked;
  const state = closed ? 'closed' : chapter.complete ? 'done' : isNext ? 'here' : 'open';
  const right = closed ? (
    <Icon name="lock" size={16} color={colors.disabled} />
  ) : chapter.complete ? (
    <Text style={styles.stars} accessibilityLabel={`${chapter.stars} yıldız`}>{'★'.repeat(chapter.stars) + '☆'.repeat(3 - chapter.stars)}</Text>
  ) : locked ? (
    <Icon name="lock" size={16} color={colors.muted} />
  ) : isNext ? (
    <Text style={styles.today}>Bugün</Text>
  ) : chapter.stepsDone > 0 ? (
    <Text style={styles.partial}>{`${chapter.stepsDone}/${chapter.totalSteps}`}</Text>
  ) : null;
  const body = (
    <StripRow color={lineColor(chapter.week)} state={state} first={first} last={last} right={right}>
      <Text style={[styles.stopTitle, closed && { color: colors.disabled }]}>{chapter.titleTr}</Text>
      <Text style={styles.stopMeta}>{`${chapter.day}. gün, ${s?.title ?? ''}`}</Text>
    </StripRow>
  );
  if (closed) {
    return <View accessible accessibilityLabel={`${chapter.day}. gün, ${chapter.titleTr}, kilitli`}>{body}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${chapter.day}. gün, ${chapter.titleTr}`}
      onPress={() => router.push(locked ? `/membership?from=${chapter.slug}` : `/lesson/${chapter.slug}`)}
      style={(st) => [styles.stopPress, (st.pressed || isHovered(st)) && { backgroundColor: 'rgba(35,42,49,0.05)' }]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  sign: { backgroundColor: colors.ink, paddingHorizontal: gutter, paddingTop: 6, paddingBottom: 22 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sos: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: colors.red },
  sosText: { fontFamily: fonts.display, fontSize: 16, color: colors.surface, letterSpacing: 0.5 },
  dayRow: { flexDirection: 'row', alignItems: 'flex-end' },
  dayNumber: { fontFamily: fonts.display, fontSize: 96, lineHeight: 92, color: colors.yellow, letterSpacing: -3 },
  dayWord: { fontFamily: fonts.displayBold, fontSize: 15, color: colors.mutedOnInk, marginBottom: -4 },
  city: { fontFamily: fonts.display, fontSize: 34, lineHeight: 36, color: colors.surface, letterSpacing: -0.5 },
  levelName: { fontFamily: fonts.displayMedium, fontSize: 15, color: colors.mutedOnInk },
  block: { marginHorizontal: gutter, marginTop: 20 },
  missionRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  missionTitle: { fontFamily: fonts.display, fontSize: 26, lineHeight: 28, color: colors.ink, letterSpacing: -0.3 },
  stubRow: { flexDirection: 'row', gap: 12 },
  stubLabel: { fontFamily: fonts.displayMedium, fontSize: 12, color: colors.muted },
  stubValue: { fontFamily: fonts.displayBold, fontSize: 16, color: colors.ink },
  doneNote: { gap: 6, borderLeftWidth: 4, borderLeftColor: colors.yellow, paddingLeft: 14, paddingVertical: 4 },
  doneTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
  figures: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  figure: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 5, justifyContent: 'center' },
  figureValue: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  figureUnit: { fontFamily: fonts.displayMedium, fontSize: 13, color: colors.muted },
  figureRule: { width: 1, height: 22, backgroundColor: colors.line },
  lines: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.line },
  lineTab: { flex: 1, minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md },
  lineSwatch: { width: 14, height: 4, borderRadius: 1 },
  lineName: { fontFamily: fonts.displayBold, fontSize: 16, color: colors.muted },
  lineUnderline: { position: 'absolute', left: 8, right: 8, bottom: -1, height: 3 },
  stopPress: { marginHorizontal: -8, paddingHorizontal: 8, borderRadius: radius.md },
  stopTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  stopMeta: { fontFamily: fonts.displayMedium, fontSize: 13, color: colors.muted },
  stars: { fontSize: 13, color: colors.ink, letterSpacing: 1 },
  today: { fontFamily: fonts.displayBold, fontSize: 13, color: colors.ink, backgroundColor: colors.yellow, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, overflow: 'hidden' },
  partial: { fontFamily: fonts.displayMedium, fontSize: 13, color: colors.muted },
  starter: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
  starterTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  starterText: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, lineHeight: 19 },
  practice: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.ink, borderRadius: radius.lg, padding: 14 },
  practiceTitle: { fontFamily: fonts.displayBold, fontSize: 17, color: colors.surface },
  practiceText: { fontFamily: fonts.body, fontSize: 13, color: colors.mutedOnInk },
});
