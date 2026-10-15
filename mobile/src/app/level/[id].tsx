import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LEVEL_COLORS, Medal } from '@/components/Medal';
import { Body, Button, Label } from '@/components/ui';
import { level, levelById } from '@/lib/content';
import { useMe } from '@/lib/queries';
import type { LevelId } from '@/lib/types';
import { colors, fonts } from '@/theme';

/** A week finished: Bronze, Silver or Gold Traveller, with the week's message. */
export default function LevelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const info = levelById(id);
  const me = useMe();
  const scale = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start();
  }, [scale]);

  if (!info) {
    return null;
  }
  const next = level(info.week + 1);
  const tint = LEVEL_COLORS[info.id as LevelId];

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.body}>
        <Label color={colors.yellow}>{`${info.week}. HAFTA TAMAMLANDI`}</Label>
        <Animated.View style={{ transform: [{ scale }] }}>
          <Medal id={info.id as LevelId} size={190} label={info.title} />
        </Animated.View>
        <Text accessibilityRole="header" style={styles.title}>{info.title}</Text>
        <Text style={[styles.tagline, { color: tint.metal }]}>{`“${info.tagline}”`}</Text>
        <View style={styles.card}>
          <Text style={styles.message}>{info.message}</Text>
          <Body color={colors.mutedOnInk} size={15}>{info.messageTr}</Body>
        </View>
        {next ? (
          <Body color={colors.mutedOnInk} size={14} style={{ textAlign: 'center' }}>
            {`Sıradaki yolculuk: ${next.trip}. Aynı yedi durak, ${next.titleTr} seviyesinde.`}
          </Body>
        ) : null}
      </ScrollView>
      <View style={{ gap: 10, padding: 20 }}>
        {info.id === 'GOLD' || me.data?.graduatedAt ? (
          <Button label="Mezuniyetine geç" variant="accent" icon="arrowRight" onPress={() => router.replace('/graduation')} />
        ) : (
          <Button label="Pasaportumu aç" variant="accent" onPress={() => router.replace('/passport')} />
        )}
        <Button label="Bugüne dön" variant="onDark" onPress={() => router.replace('/home')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  body: { alignItems: 'center', padding: 20, gap: 16 },
  title: { fontFamily: fonts.display, fontSize: 36, color: colors.surface, textAlign: 'center' },
  tagline: { fontFamily: fonts.displayBold, fontSize: 20, textAlign: 'center' },
  card: { alignSelf: 'stretch', backgroundColor: colors.inkSoft, borderRadius: 18, padding: 18, gap: 8 },
  message: { fontFamily: fonts.bodyBold, fontSize: 18, lineHeight: 25, color: colors.surface },
});
