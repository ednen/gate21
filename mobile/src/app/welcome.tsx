import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui';
import { colors, fonts } from '@/theme';

export default function Welcome() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.top}>
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

      <View style={styles.middle}>
        <Text style={styles.kicker}>21 GÜN · 7 DURAK · 3 ŞEHİR</Text>
        <Text accessibilityRole="header" style={styles.headline}>
          Don't learn English.{'\n'}Learn how to travel in English.
        </Text>
        <Text style={styles.sub}>
          Biri seninle İngilizce konuştuğunda donup kalma. Havalimanından otele, her gün 8 dakika.
        </Text>
      </View>

      <View style={styles.actions}>
        <Button label="Başla" variant="accent" onPress={() => router.push('/auth?mode=register')} />
        <Button label="Hesabım var" variant="onDark" onPress={() => router.push('/auth?mode=login')} style={{ minHeight: 48 }} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink, paddingHorizontal: 24, paddingBottom: 16 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12 },
  sos: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: colors.red },
  sosText: { fontFamily: fonts.mono, fontSize: 13, color: colors.surface, letterSpacing: 1.3 },
  middle: { flex: 1, justifyContent: 'center', gap: 18 },
  kicker: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 1.7, color: colors.yellow },
  headline: { fontFamily: fonts.display, fontSize: 44, lineHeight: 46, color: colors.surface },
  sub: { fontFamily: fonts.body, fontSize: 18, lineHeight: 26, color: '#D4D9DF' },
  actions: { gap: 6 },
});
