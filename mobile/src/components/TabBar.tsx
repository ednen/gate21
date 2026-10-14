import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts } from '@/theme';

import { Icon, type IconName } from './Icon';

type Tab = 'home' | 'passport' | 'sos' | 'progress';

const TABS: { key: Tab; label: string; icon: IconName; href: '/home' | '/passport' | '/sos' | '/progress' }[] = [
  { key: 'home', label: 'Bugün', icon: 'home', href: '/home' },
  { key: 'passport', label: 'Pasaport', icon: 'passport', href: '/passport' },
  { key: 'sos', label: 'SOS', icon: 'alert', href: '/sos' },
  { key: 'progress', label: 'İlerleme', icon: 'chart', href: '/progress' },
];

export function TabBar({ active }: { active: Tab }) {
  const insets = useSafeAreaInsets();
  return (
    <View accessibilityRole="tablist" style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {TABS.map((tab) => {
        const selected = tab.key === active;
        const tint = selected ? (tab.key === 'sos' ? colors.red : colors.ink) : colors.muted;
        const fill = selected ? (tab.key === 'sos' ? colors.redTint : colors.yellow) : 'none';
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={tab.label}
            onPress={() => !selected && router.replace(tab.href)}
            style={styles.tab}
          >
            <Icon name={tab.icon} size={22} color={tint} fill={fill} strokeWidth={1.8} />
            <Text style={[styles.text, { color: tint, fontFamily: selected ? fonts.bodyBold : fonts.bodyMedium }]}>{tab.label}</Text>
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
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 52 },
  text: { fontSize: 11 },
});
