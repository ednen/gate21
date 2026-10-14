import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { TabBar } from '@/components/TabBar';
import { Label } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { sosPhrases } from '@/lib/content';
import { say } from '@/lib/voice';
import { colors, fonts } from '@/theme';

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
              <Text style={styles.offlineText}>İNTERNETSİZ ÇALIŞIR</Text>
            </View>
          </View>
          <View style={styles.titleRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text accessibilityRole="header" style={styles.title}>SOS English</Text>
              <Text style={styles.subtitle}>Dokun, sesli okunsun — ya da ekranı göster.</Text>
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
          <Label>BUNU KARŞINDAKİNE GÖSTER</Label>
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
              style={[styles.item, on && { borderColor: colors.ink }]}
            >
              <View style={[styles.icon, { backgroundColor: on ? colors.ink : colors.redTint }]}>
                <Icon name="speaker" size={18} color={on ? colors.yellow : colors.red} strokeWidth={2} />
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
  header: { backgroundColor: colors.red, paddingHorizontal: 16, paddingBottom: 18, paddingTop: 6 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.redDeep, alignItems: 'center', justifyContent: 'center' },
  offline: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.redDeep, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 16 },
  offlineText: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, color: colors.surface },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  title: { fontFamily: fonts.display, fontSize: 36, color: colors.surface },
  subtitle: { fontFamily: fonts.body, fontSize: 14, color: '#FCE3E0' },
  slow: { minHeight: 44, paddingHorizontal: 12, borderRadius: 12, borderWidth: 2, borderColor: colors.surface, justifyContent: 'center' },
  slowText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.surface },
  show: { margin: 16, marginBottom: 0, backgroundColor: colors.surface, borderRadius: 18, borderWidth: 3, borderColor: colors.ink, padding: 18, gap: 8 },
  showText: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, color: colors.ink },
  showTr: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
  list: { padding: 16, gap: 8 },
  item: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, borderWidth: 2, borderColor: colors.surface, backgroundColor: colors.surface },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  en: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  tr: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
});
