import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { TabBar } from '@/components/TabBar';
import { isHovered, Label } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { sosPhrases } from '@/lib/content';
import { say } from '@/lib/voice';
import { colors, fonts, gutter, radius } from '@/theme';

/** Emergency phrases: bundled in the app, spoken by the device voice, usable offline and signed out. */
export default function Sos() {
  const signedIn = useAuth((s) => s.status) === 'signedIn';
  const [selected, setSelected] = useState<number | null>(null);
  const [slow, setSlow] = useState(false);
  const sel = selected === null ? null : sosPhrases[selected];

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <SafeAreaView edges={['top']} style={{ gap: 12 }}>
          <View style={styles.headerRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Geri"
              onPress={() => (router.canGoBack() ? router.back() : router.replace(signedIn ? '/home' : '/welcome'))}
              style={styles.back}
            >
              <Icon name="arrowLeft" size={20} color={colors.surface} strokeWidth={2} />
            </Pressable>
            <View style={styles.offline}>
              <Icon name="wifiOff" size={14} color={colors.surface} strokeWidth={2} />
              <Text style={styles.offlineText}>İnternetsiz çalışır</Text>
            </View>
          </View>
          <View style={styles.titleRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text accessibilityRole="header" style={styles.title}>SOS English</Text>
              <Text style={styles.subtitle}>Dokun, sesli okunsun. Ya da ekranı karşındakine göster.</Text>
            </View>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: slow }}
              accessibilityLabel="Yavaş okuma"
              onPress={() => setSlow(!slow)}
              style={[styles.slow, slow && { backgroundColor: colors.surface }]}
            >
              <Text style={[styles.slowText, slow && { color: colors.red }]}>Yavaş</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>

      {sel ? (
        <View accessibilityLiveRegion="polite" style={styles.show}>
          <Label color={colors.mutedOnInk}>Bunu karşındakine göster</Label>
          <Text style={styles.showText}>{sel.en}</Text>
          <Text style={styles.showTr}>{sel.tr}</Text>
        </View>
      ) : null}

      <FlatList
        data={sosPhrases}
        keyExtractor={(p) => p.en}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => {
          const on = index === selected;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.en}. ${item.tr}`}
              accessibilityHint="Sesli okur ve büyük gösterir"
              onPress={() => {
                setSelected(index);
                say(item.en, { slow });
              }}
              style={(st) => [styles.item, on && styles.itemOn, !on && isHovered(st) && { backgroundColor: 'rgba(35,42,49,0.05)' }]}
            >
              <View style={[styles.icon, { borderColor: on ? colors.ink : colors.red }]}>
                <Icon name="speaker" size={18} color={on ? colors.ink : colors.red} strokeWidth={2} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.en}>{item.en}</Text>
                <Text style={styles.tr}>{item.tr}</Text>
              </View>
            </Pressable>
          );
        }}
      />
      {signedIn ? <TabBar active="sos" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  header: { backgroundColor: colors.red, paddingHorizontal: gutter, paddingBottom: 18, paddingTop: 6 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { width: 40, height: 40, marginLeft: -8, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  offline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  offlineText: { fontFamily: fonts.displayMedium, fontSize: 14, color: colors.surface },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  title: { fontFamily: fonts.display, fontSize: 40, lineHeight: 42, color: colors.surface, letterSpacing: -0.5 },
  subtitle: { fontFamily: fonts.body, fontSize: 14, color: '#FCE3E0' },
  slow: { minHeight: 40, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.surface, justifyContent: 'center' },
  slowText: { fontFamily: fonts.displayBold, fontSize: 15, color: colors.surface },
  // The phrase to show someone: a notice board, as large as the screen allows.
  show: { margin: gutter, marginBottom: 0, backgroundColor: colors.ink, borderRadius: radius.md, padding: 18, gap: 8 },
  showText: { fontFamily: fonts.display, fontSize: 34, lineHeight: 37, color: colors.surface },
  showTr: { fontFamily: fonts.body, fontSize: 14, color: colors.mutedOnInk },
  list: { paddingHorizontal: gutter, paddingVertical: 12 },
  item: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: colors.line, borderRadius: radius.sm },
  itemOn: { backgroundColor: colors.yellowTint },
  icon: { width: 36, height: 36, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  en: { fontFamily: fonts.displayBold, fontSize: 18, color: colors.ink },
  tr: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
});
