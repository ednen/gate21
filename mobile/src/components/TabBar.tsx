import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts } from '@/theme';

import { Icon, type IconName } from './Icon';
import { isHovered } from './ui';

type Tab = 'home' | 'words' | 'passport' | 'practice' | 'sos' | 'progress';

const TABS: { key: Tab; label: string; icon: IconName; href: '/home' | '/words' | '/passport' | '/practice' | '/sos' | '/progress' }[] = [
  { key: 'home', label: 'Bugün', icon: 'home', href: '/home' },
  { key: 'words', label: 'Kelimeler', icon: 'book', href: '/words' },
  { key: 'passport', label: 'Pasaport', icon: 'passport', href: '/passport' },
  { key: 'practice', label: 'Pratik', icon: 'repeat', href: '/practice' },
  { key: 'sos', label: 'SOS', icon: 'alert', href: '/sos' },
  { key: 'progress', label: 'İlerleme', icon: 'chart', href: '/progress' },
];

export function TabBar({ active }: { active: Tab }) {
  const insets = useSafeAreaInsets();
  return (
    <View accessibilityRole="tablist" style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 6) }]}>
      {TABS.map((tab) => {
        const selected = tab.key === active;
        const sos = tab.key === 'sos';
        const tint = sos ? colors.red : selected ? colors.ink : colors.muted;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={tab.label}
            onPress={() => !selected && router.replace(tab.href)}
            style={(st) => [styles.tab, isHovered(st) && !selected && { backgroundColor: colors.paper }]}
          >
            {/* "You are here": a yellow bar on the top edge, like the marker on a sign. */}
            <View style={[styles.marker, selected && { backgroundColor: sos ? colors.red : colors.yellow }]} />
            <Icon name={tab.icon} size={22} color={tint} strokeWidth={selected ? 2.2 : 1.8} />
            <Text style={[styles.text, { color: tint, fontFamily: selected ? fonts.displayBold : fonts.displayMedium }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 56, paddingTop: 6 },
  marker: { position: 'absolute', top: -1, left: 10, right: 10, height: 3, backgroundColor: 'transparent' },
  text: { fontSize: 12 },
});
