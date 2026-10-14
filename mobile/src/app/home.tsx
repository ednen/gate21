import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/Icon';
import { Logo } from '@/components/Logo';
import { TabBar } from '@/components/TabBar';
import { Body, Button, Card, Label, ProgressBar } from '@/components/ui';
import { chapterInfo } from '@/lib/content';
import { flushProgress } from '@/lib/progress';
import { invalidateProgress, useMe, usePassport } from '@/lib/queries';
import type { PassportChapter } from '@/lib/types';
import { colors, fonts } from '@/theme';

const WEEK_LABEL = ['1. HAFTA · TRAVEL READY', '2. HAFTA · TRAVEL CONFIDENT', '3. HAFTA · TRAVEL PRO'];

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
  // Show the week the learner is actually working on: if this week's chapters are not out yet,
  // that is the week of the next chapter.
  const chapters = passport.data?.chapters ?? [];
  const nextWeek = chapters.find((c) => c.slug === next?.slug)?.week;
  const shownWeek = chapters.some((c) => c.week === week && c.available) ? week : (nextWeek ?? week);
  const weekChapters = chapters.filter((c) => c.week === shownWeek);

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
              <Label color={colors.yellow}>{WEEK_LABEL[week - 1] ?? WEEK_LABEL[0]}</Label>
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
            <Label>BUGÜNÜN GÖREVİ</Label>
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
              <Button
                label={data?.todayDone ? 'Bir bölüm daha yap' : 'Bugünkü 8 dakikalık derse başla'}
                icon="arrowRight"
                onPress={() => router.push(`/lesson/${next.slug}`)}
              />
            </>
          ) : (
            <Body>Bu haftanın bütün bölümlerini bitirdin. Yeni bölümler yakında; o zamana kadar 3 yıldız için tekrar edebilirsin.</Body>
          )}
          {data && !data.todayDone ? (
            <View style={{ gap: 6 }}>
              <ProgressBar value={data.todayXp / data.dailyGoalXp} color={colors.yellow} track={colors.ground} />
              <Text style={styles.goalText}>{`Günlük hedef: ${Math.min(data.todayXp, data.dailyGoalXp)} / ${data.dailyGoalXp} XP`}</Text>
            </View>
          ) : null}
        </Card>

        <View style={styles.stats}>
          <Stat icon="flame" iconColor={colors.red} value={String(data?.streak ?? 0)} label="günlük seri" />
          <Stat icon="star" iconFill={colors.yellow} value={(data?.xp ?? 0).toLocaleString('en-US')} label="XP" />
          <Stat icon="target" value={data?.speakingAccuracy != null ? `${data.speakingAccuracy}%` : '—'} label="konuşma doğruluğu" />
        </View>

        <View style={styles.section}>
          <Label>{`${shownWeek}. HAFTANIN BÖLÜMLERİ`}</Label>
          <View style={styles.grid}>
            {weekChapters.map((c) => (
              <ChapterTile key={c.slug} chapter={c} isNext={c.slug === next?.slug} />
            ))}
          </View>
        </View>
      </ScrollView>
      <TabBar active="home" />
    </View>
  );
}

function DayBar({ day, todayDone }: { day: number; todayDone: boolean }) {
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[0, 1, 2].map((w) => (
          <View key={w} style={{ flex: 1, flexDirection: 'row', gap: 3 }}>
            {Array.from({ length: 7 }, (_, i) => {
              const n = w * 7 + i + 1;
              const done = n < day || (n === day && todayDone);
              const color = done ? colors.yellow : n === day ? colors.surface : colors.inkLine;
              return <View key={n} style={{ flex: 1, height: 10, borderRadius: 2, backgroundColor: color }} />;
            })}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {['TRAVEL READY', 'CONFIDENT', 'TRAVEL PRO'].map((t) => (
          <Text key={t} style={styles.barLabel}>{t}</Text>
        ))}
      </View>
    </View>
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

function ChapterTile({ chapter, isNext }: { chapter: PassportChapter; isNext: boolean }) {
  const locked = !chapter.unlocked;
  const content = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {locked ? <Icon name="lock" size={16} color={colors.muted} strokeWidth={2} /> : null}
        <Text style={[styles.tileTitle, locked && { color: colors.muted, fontFamily: fonts.bodyMedium }]}>{chapter.title}</Text>
      </View>
      {locked ? (
        <Text style={styles.tileNote}>{chapter.available ? 'Kilitli' : 'Yakında'}</Text>
      ) : chapter.complete ? (
        <Text style={styles.tileNote}>{'★'.repeat(chapter.stars) + '☆'.repeat(3 - chapter.stars)}</Text>
      ) : (
        <>
          <ProgressBar value={chapter.stepsDone / 6} track={colors.ground} />
          <Text style={styles.tileNote}>{isNext ? 'Bugünün görevi' : `${chapter.stepsDone} / 6 adım`}</Text>
        </>
      )}
    </>
  );
  if (locked) {
    return <View style={[styles.tile, styles.tileLocked]}>{content}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${chapter.title} bölümü`}
      onPress={() => router.push(`/lesson/${chapter.slug}`)}
      style={[styles.tile, isNext && { borderWidth: 2, borderColor: colors.yellow }]}
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
  barLabel: { fontFamily: fonts.monoMedium, fontSize: 11, color: colors.mutedOnInk, letterSpacing: 0.8 },
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '48.5%', minHeight: 76, backgroundColor: colors.surface, borderRadius: 14, padding: 12, gap: 8 },
  tileLocked: { backgroundColor: '#E4E7EB' },
  tileTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink, flexShrink: 1 },
  tileNote: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.muted },
});
