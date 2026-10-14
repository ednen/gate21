import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Stamp, Stars, stampDate } from '@/components/Stamp';
import { Button, Label } from '@/components/ui';
import { chapter as getChapter, chapterInfo } from '@/lib/content';
import { flushProgress } from '@/lib/progress';
import { invalidateProgress, usePassport } from '@/lib/queries';
import { colors, fonts } from '@/theme';

/** Chapter complete: the passport stamp lands, then the stars arrive once the sync confirms them. */
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

  const progress = passport.data?.chapters.find((c) => c.slug === slug);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Label color={colors.yellow}>BÖLÜM TAMAMLANDI</Label>
        <Text accessibilityRole="header" style={styles.title}>{`${info?.titleTr ?? ''} artık senin için sorun değil.`}</Text>
      </View>

      <View style={styles.page}>
        <Text style={[styles.pageLabel, { left: 20 }]}>TRAVEL PASSPORT</Text>
        <Text style={[styles.pageLabel, { right: 20 }]}>VİZELER</Text>
        <Animated.View style={{ opacity, transform: [{ scale }] }}>
          <Stamp text={chapter?.stamp ?? 'CLEARED'} date={stampDate(progress?.stampedAt)} place={info?.title.toUpperCase()} />
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
        <Button label="Pasaportumu aç" variant="accent" onPress={() => router.replace('/passport')} />
        <Button label="Bugüne dön" variant="onDark" onPress={() => router.replace('/home')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink, padding: 20, gap: 20 },
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, color: colors.surface, textAlign: 'center' },
  page: { flex: 1, backgroundColor: colors.paper, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  pageLabel: { position: 'absolute', top: 18, fontFamily: fonts.monoMedium, fontSize: 10, letterSpacing: 1.4, color: colors.disabled },
  starsRow: { alignItems: 'center', gap: 8 },
  starsText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: '#C9CFD6', textAlign: 'center' },
});
