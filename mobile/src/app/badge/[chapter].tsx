import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Stamp, Stars, stampDate } from '@/components/Stamp';
import { Button, Label } from '@/components/ui';
import { chapter as getChapter, chapterInfo, stop } from '@/lib/content';
import { flushProgress } from '@/lib/progress';
import { invalidateProgress, usePassport } from '@/lib/queries';
import { colors, fonts } from '@/theme';

/**
 * Chapter complete: the passport stamp lands, then the stars arrive once the sync confirms them.
 * When this chapter finished its week, the week's Traveller badge is offered next.
 */
export default function Badge() {
  const { chapter: slug } = useLocalSearchParams<{ chapter: string }>();
  const chapter = getChapter(slug);
  const info = chapterInfo(slug);
  const passport = usePassport();
  const scale = useRef(new Animated.Value(1.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    void flushProgress().then(invalidateProgress);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5, delay: 150 }),
      Animated.timing(opacity, { toValue: 1, duration: 250, delay: 150, useNativeDriver: true }),
    ]).start();
  }, [scale, opacity]);

  const chapters = passport.data?.chapters ?? [];
  const progress = chapters.find((c) => c.slug === slug);
  const starter = info?.kind === 'starter';
  // The week's badge belongs to this moment only if this chapter's stamp, just now, completed the week.
  const justStamped = !!progress?.stampedAt && Date.now() - new Date(progress.stampedAt).getTime() < 15 * 60_000;
  const weekBadge = passport.data?.levels.find(
    (l) => l.week === info?.week && l.earned && justStamped && l.earnedAt === progress?.stampedAt,
  );
  const nextStarter = chapters
    .filter((c) => c.kind === 'starter' && !c.complete && c.slug !== slug)
    .sort((a, b) => a.order - b.order)[0];
  const place = starter ? 'STARTER' : (stop(info?.stop)?.title ?? info?.title ?? '').toUpperCase();

  return (
    <SafeAreaView style={styles.screen}>
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Label color={colors.yellow}>{starter ? 'Başlangıç dersi tamam' : 'Durak tamamlandı'}</Label>
        <Text accessibilityRole="header" style={styles.title}>
          {starter ? `${info?.titleTr ?? ''}: bir adım daha hazırsın.` : `${info?.titleTr ?? ''} artık senin için sorun değil.`}
        </Text>
      </View>

      <View style={styles.page}>
        <Text style={[styles.pageLabel, { left: 20 }]}>{starter ? 'STARTER PACK' : 'TRAVEL PASSPORT'}</Text>
        <Text style={[styles.pageLabel, { right: 20 }]}>{info?.day ? `DAY ${info.day}` : ''}</Text>
        <Animated.View style={{ opacity, transform: [{ scale }] }}>
          <Stamp
            text={chapter?.stamp ?? 'CLEARED'}
            date={stampDate(progress?.stampedAt)}
            place={place}
            color={starter ? colors.blue : colors.red}
          />
        </Animated.View>
      </View>

      <View style={styles.starsRow}>
        {progress?.complete ? (
          <>
            <Stars count={progress.stars} size={28} />
            <Text style={styles.starsText}>
              {progress.stars === 3 ? 'Mükemmel telaffuz!' : 'Daha yüksek puan için bölümü tekrar edebilirsin.'}
            </Text>
          </>
        ) : (
          <Text style={styles.starsText}>İnternete bağlanınca yıldızların hesaplanacak.</Text>
        )}
      </View>

      <View style={{ gap: 10 }}>
        {weekBadge ? (
          <Button label={`${weekBadge.title} rozetini al`} variant="accent" icon="medal" onPress={() => router.replace(`/level/${weekBadge.id}`)} />
        ) : starter ? (
          nextStarter ? (
            <Button label={`Sıradaki: ${nextStarter.titleTr}`} variant="accent" icon="arrowRight" onPress={() => router.replace(`/lesson/${nextStarter.slug}`)} />
          ) : (
            <Button label="Yolculuğa başla" variant="accent" icon="arrowRight" onPress={() => router.replace('/home')} />
          )
        ) : (
          <Button label="Pasaportumu aç" variant="accent" onPress={() => router.replace('/passport')} />
        )}
        <Button label="Bugüne dön" variant="onDark" onPress={() => router.replace('/home')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink, padding: 20, gap: 20 },
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, color: colors.surface, textAlign: 'center' },
  page: { flex: 1, backgroundColor: colors.paper, borderRadius: 8, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  pageLabel: { position: 'absolute', top: 18, fontFamily: fonts.monoMedium, fontSize: 10, letterSpacing: 1.4, color: colors.disabled },
  starsRow: { alignItems: 'center', gap: 8 },
  starsText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: '#C9CFD6', textAlign: 'center' },
});
