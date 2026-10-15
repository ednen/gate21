import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/Icon';
import { Logo } from '@/components/Logo';
import { LEVEL_COLORS } from '@/components/Medal';
import { TabBar } from '@/components/TabBar';
import { Body, Button, Card, Label, ProgressBar } from '@/components/ui';
import { canPlay, chapterInfo, level, manifest, stop } from '@/lib/content';
import { flushProgress } from '@/lib/progress';
import { invalidateProgress, useMe, usePassport } from '@/lib/queries';
import type { LevelId, Me, PassportChapter } from '@/lib/types';
import { colors, fonts } from '@/theme';

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
  // Show the week the learner is working on: the next lesson's week, else the calendar week.
  const shownWeek = next?.kind === 'lesson' ? next.week : week;
  const weekLessons = chapters.filter((c) => c.kind === 'lesson' && c.week === shownWeek).sort((a, b) => a.day - b.day);
  const starter = chapters.filter((c) => c.kind === 'starter').sort((a, b) => a.order - b.order);
  const starterLeft = starter.filter((c) => !c.complete);
  const nextAllowed = !next || canPlay(next, member, freeDays);
  const lvl = level(week);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={me.isFetching} onRefresh={() => void flushProgress().then(invalidateProgress)} />}
      >
        <View style={styles.header}>
          <SafeAreaView edges={['top']} style={{ gap: 18 }}>
            <View style={styles.topRow}>
              <Logo />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="SOS English, acil durum cümleleri"
                onPress={() => router.push('/sos')}
                style={styles.sos}
              >
                <Icon name="alert" size={16} color={colors.surface} strokeWidth={2} />
                <Text style={styles.sosText}>SOS</Text>
              </Pressable>
            </View>
            <View style={{ gap: 4 }}>
              <Label color={LEVEL_COLORS[(lvl?.id ?? 'BRONZE') as LevelId].metal}>
                {`${week}. HAFTA · ${(lvl?.title ?? '').toUpperCase()} · ${(lvl?.trip ?? '').toUpperCase()}`}
              </Label>
              <View style={styles.dayRow} accessible accessibilityLabel={`21 günün ${day}. günü`}>
                <Text style={styles.day}>DAY {day}</Text>
                <Text style={styles.dayOf}>/ 21</Text>
              </View>
            </View>
            <DayBar day={day} todayDone={data?.todayDone ?? false} />
          </SafeAreaView>
        </View>

        <Card style={styles.mission}>
          <View style={styles.missionTop}>
            <Label>{next?.kind === 'starter' ? 'BAŞLANGIÇ PAKETİ' : 'BUGÜNÜN GÖREVİ'}</Label>
            <Text style={styles.badge}>{data?.todayDone ? 'TAMAM ✓' : '8 DK'}</Text>
          </View>
          {next ? (
            <>
              <View style={styles.missionRow}>
                <View style={styles.missionIcon}>
                  <Icon name={(chapterInfo(next.slug)?.icon ?? 'plane') as IconName} size={28} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text accessibilityRole="header" style={styles.missionTitle}>{next.mission}</Text>
                  <Body size={14} color={colors.muted}>{next.missionTr}</Body>
                </View>
              </View>
              {nextAllowed ? (
                <Button
                  label={data?.todayDone ? 'Bir ders daha yap' : 'Bugünkü derse başla'}
                  icon="arrowRight"
                  onPress={() => router.push(`/lesson/${next.slug}`)}
                />
              ) : (
                <Button label={`${next.day}. gün için planını seç`} icon="lock" variant="accent" onPress={() => router.push(`/membership?from=${next.slug}`)} />
              )}
            </>
          ) : data?.graduatedAt ? (
            <Body>Yolculuğu bitirdin! Haftada iki pratikle İngilizceni seyahate hazır tut.</Body>
          ) : (
            <Body>Açık olan bütün dersleri bitirdin. Yeni haftanın dersleri yakında; o zamana kadar sahneleri tekrar oynayabilirsin.</Body>
          )}
          {data && !data.todayDone ? (
            <View style={{ gap: 6 }}>
              <ProgressBar value={data.todayXp / data.dailyGoalXp} color={colors.yellow} track={colors.ground} />
              <Text style={styles.goalText}>{`Günlük hedef: ${Math.min(data.todayXp, data.dailyGoalXp)} / ${data.dailyGoalXp} XP`}</Text>
            </View>
          ) : null}
        </Card>

        {data?.graduatedAt ? <PracticeCard me={data} /> : null}

        <View style={styles.stats}>
          <Stat icon="flame" iconColor={colors.red} value={String(data?.streak ?? 0)} label="günlük seri" />
          <Stat icon="star" iconFill={colors.yellow} value={(data?.xp ?? 0).toLocaleString('en-US')} label="XP" />
          <Stat icon="target" value={data?.speakingAccuracy != null ? `${data.speakingAccuracy}%` : '—'} label="konuşma doğruluğu" />
        </View>

        <View style={styles.section}>
          <Label>{`${shownWeek}. HAFTA · YOLCULUĞUN 7 DURAĞI`}</Label>
          <View style={styles.stops}>
            {weekLessons.map((c) => (
              <StopRow key={c.slug} chapter={c} isNext={c.slug === next?.slug} locked={!canPlay(c, member, freeDays)} />
            ))}
          </View>
        </View>

        {starterLeft.length > 0 && next?.kind !== 'starter' ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/lesson/${starterLeft[0].slug}`)}
            style={[styles.section, styles.starter]}
          >
            <Icon name="abc" size={26} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.starterTitle}>İngilizcen sıfır mı?</Text>
              <Text style={styles.starterText}>{`Başlangıç paketi: alfabe, sayılar, ilk kelimeler · ${starter.length - starterLeft.length}/${starter.length}`}</Text>
            </View>
            <Icon name="arrowRight" size={18} />
          </Pressable>
        ) : null}
      </ScrollView>
      <TabBar active="home" />
    </View>
  );
}

function DayBar({ day, todayDone }: { day: number; todayDone: boolean }) {
  const levels = manifest().levels;
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {levels.map((l, w) => (
          <View key={l.id} style={{ flex: 1, flexDirection: 'row', gap: 3 }}>
            {Array.from({ length: 7 }, (_, i) => {
              const n = w * 7 + i + 1;
              const done = n < day || (n === day && todayDone);
              const color = done ? LEVEL_COLORS[l.id].metal : n === day ? colors.surface : colors.inkLine;
              return <View key={n} style={{ flex: 1, height: 10, borderRadius: 2, backgroundColor: color }} />;
            })}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {levels.map((l) => (
          <Text key={l.id} style={[styles.barLabel, { color: LEVEL_COLORS[l.id].metal }]}>{l.id}</Text>
        ))}
      </View>
    </View>
  );
}

function PracticeCard({ me }: { me: Me }) {
  const { thisWeek, weeklyGoal } = me.practice;
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push('/practice')} style={[styles.section, styles.practice]}>
      <Icon name="repeat" size={24} color={colors.yellow} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.practiceTitle}>Keep your English travel ready</Text>
        <Text style={styles.practiceText}>{`Bu hafta ${thisWeek} / ${weeklyGoal} pratik`}</Text>
      </View>
      <Icon name="arrowRight" size={18} color={colors.surface} />
    </Pressable>
  );
}

function Stat({ icon, value, label, iconColor = colors.ink, iconFill = 'none' }: { icon: IconName; value: string; label: string; iconColor?: string; iconFill?: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${value} ${label}`}>
      <Icon name={icon} size={20} color={iconColor} fill={iconFill} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function StopRow({ chapter, isNext, locked }: { chapter: PassportChapter; isNext: boolean; locked: boolean }) {
  const s = stop(chapter.stop);
  const closed = !chapter.unlocked;
  const status = closed
    ? chapter.available ? 'Kilitli' : 'Yakında'
    : chapter.complete
      ? '★'.repeat(chapter.stars) + '☆'.repeat(3 - chapter.stars)
      : locked
        ? 'Üyelikle'
        : isNext
          ? 'Bugün'
          : `${chapter.stepsDone}/${chapter.totalSteps}`;
  const content = (
    <>
      <View style={[styles.stopIcon, chapter.complete && { backgroundColor: colors.yellow }, closed && { backgroundColor: colors.ground }]}>
        <Icon name={(s?.icon ?? chapter.icon) as IconName} size={20} color={closed ? colors.muted : colors.ink} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.stopDay}>{`${chapter.day}. GÜN · ${(s?.title ?? '').toUpperCase()}`}</Text>
        <Text style={[styles.stopTitle, closed && { color: colors.muted }]}>{chapter.titleTr}</Text>
      </View>
      {locked && !closed && !chapter.complete ? <Icon name="lock" size={16} color={colors.muted} /> : null}
      <Text style={[styles.stopStatus, isNext && !locked && { backgroundColor: colors.yellow }]}>{status}</Text>
    </>
  );
  if (closed) {
    return <View style={styles.stopRow}>{content}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${chapter.day}. gün, ${chapter.titleTr}`}
      onPress={() => router.push(locked ? `/membership?from=${chapter.slug}` : `/lesson/${chapter.slug}`)}
      style={[styles.stopRow, isNext && { borderColor: colors.yellow, borderWidth: 2 }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  header: { backgroundColor: colors.ink, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 76 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sos: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: colors.red },
  sosText: { fontFamily: fonts.mono, fontSize: 13, color: colors.surface, letterSpacing: 1.3 },
  dayRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  day: { fontFamily: fonts.display, fontSize: 66, lineHeight: 70, color: colors.surface },
  dayOf: { fontFamily: fonts.displayMedium, fontSize: 30, color: '#9AA3AE' },
  barLabel: { fontFamily: fonts.monoMedium, fontSize: 11, letterSpacing: 0.8 },
  mission: {
    marginTop: -56,
    marginHorizontal: 16,
    gap: 16,
    padding: 20,
    borderRadius: 20,
    shadowColor: colors.ink,
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  missionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { fontFamily: fonts.mono, fontSize: 11, backgroundColor: colors.ground, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, overflow: 'hidden', color: colors.ink },
  missionRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  missionIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center' },
  missionTitle: { fontFamily: fonts.displayBold, fontSize: 24, lineHeight: 27, color: colors.ink },
  goalText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.muted },
  stats: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 14 },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 12, gap: 6 },
  statValue: { fontFamily: fonts.displayBold, fontSize: 22, color: colors.ink },
  statLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  section: { marginHorizontal: 16, marginTop: 18, gap: 10 },
  stops: { gap: 8 },
  stopRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 2, borderColor: colors.surface },
  stopIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.yellowTint, alignItems: 'center', justifyContent: 'center' },
  stopDay: { fontFamily: fonts.monoMedium, fontSize: 10, letterSpacing: 0.8, color: colors.muted },
  stopTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  stopStatus: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink, backgroundColor: colors.ground, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, overflow: 'hidden' },
  starter: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 2, borderColor: colors.blue },
  starterTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  starterText: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  practice: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.ink, borderRadius: 14, padding: 14 },
  practiceTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.surface },
  practiceText: { fontFamily: fonts.body, fontSize: 13, color: colors.mutedOnInk },
});
