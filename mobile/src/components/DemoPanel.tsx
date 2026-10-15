import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Body, Button, Card, Label } from '@/components/ui';
import { demoSettings, finishWeekButOne, resetProgress, setDemoSettings } from '@/lib/demo/server';
import { queryClient } from '@/lib/queries';
import { colors, fonts } from '@/theme';

/** Shortcuts for trying the app in the browser demo: open every week, skip ahead, start over. */
export function DemoPanel() {
  const [settings, setSettings] = useState(demoSettings);
  const [notice, setNotice] = useState<string | null>(null);

  const apply = async (message: string, change: () => void) => {
    change();
    setSettings(demoSettings());
    await queryClient.invalidateQueries();
    setNotice(message);
  };

  return (
    <Card style={styles.card}>
      <Label color={colors.yellow}>DEMO AYARLARI</Label>
      <Body size={14} color={colors.surface}>
        Bu sürüm sunucusuz çalışır; ilerlemen bu tarayıcıda saklanır. Sahnelerde cevaplar anahtar kelimeyle değerlendirilir.
      </Body>
      <Toggle
        label="Bütün haftalar açık"
        value={settings.unlockAll}
        onChange={(v) => void apply(v ? 'Bütün haftalar açıldı.' : 'Gerçek kilitler: hafta bitince sonraki açılır.', () => setDemoSettings({ unlockAll: v }))}
      />
      <Toggle
        label="Üyelik aktif"
        value={settings.member}
        onChange={(v) => void apply(v ? 'Üyelik açık.' : 'Ücretsiz kullanıcı gibi: 3. günden sonrası kilitli.', () => setDemoSettings({ member: v }))}
      />
      <Body size={13} color="#AEB4BD">Rozet ekranlarını görmek için: haftanın 6 dersini bitmiş say, son dersi (Getting Around) sen oyna.</Body>
      <View style={styles.row}>
        {[1, 2, 3].map((w) => (
          <Button
            key={w}
            label={`${w}. hafta`}
            variant="onDark"
            style={{ flex: 1, minHeight: 44 }}
            onPress={() => void apply(`${w}. haftanın 6 dersi bitti sayıldı. Son durağı oyna.`, () => finishWeekButOne(w))}
          />
        ))}
      </View>
      <Button label="Seviye testini dene" variant="onDark" onPress={() => router.push('/placement')} />
      <Button
        label="İlerlemeyi sıfırla"
        variant="onDark"
        onPress={() => void apply('İlerleme sıfırlandı.', resetProgress).then(() => router.replace('/home'))}
      />
      {notice ? <Body size={13} color={colors.yellow}>{notice}</Body> : null}
    </Card>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} onPress={() => onChange(!value)} style={styles.toggle}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={[styles.track, value && { backgroundColor: colors.yellow }]}>
        <View style={[styles.knob, value && { alignSelf: 'flex-end' }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10, backgroundColor: colors.ink, borderColor: colors.ink },
  row: { flexDirection: 'row', gap: 8 },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  toggleLabel: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.surface },
  track: { width: 46, height: 26, borderRadius: 13, backgroundColor: colors.inkLine, padding: 3, justifyContent: 'center' },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.surface },
});
