import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DemoPanel } from '@/components/DemoPanel';
import { TabBar } from '@/components/TabBar';
import { Body, Button, Card, ErrorNote, Label, ProgressBar, Title } from '@/components/ui';
import { apiSend } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { DEMO } from '@/lib/demo/flag';
import { messageFor } from '@/lib/errors';
import { keys, queryClient, useMe, usePassport } from '@/lib/queries';
import { scheduleDailyReminder } from '@/lib/reminders';
import type { Me } from '@/lib/types';
import { colors, fonts, radius } from '@/theme';

export default function Progress() {
  const me = useMe();
  const passport = usePassport();
  const logout = useAuth((s) => s.logout);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const data = me.data;
  const before = data?.placementScore ?? null;
  const after = data?.finalScore ?? null;
  const finalOpen = (data?.journeyDay ?? 0) >= 21;

  const setConsent = async (value: boolean) => {
    setError(null);
    try {
      queryClient.setQueryData(keys.me, await apiSend<Me>('PATCH', '/api/v1/me', { voiceConsent: value }));
    } catch (e) {
      setError(messageFor(e));
    }
  };

  const reminders = async () => {
    const ok = await scheduleDailyReminder(data?.reminderHour ?? 20);
    setNotice(ok ? `Her gün ${String(data?.reminderHour ?? 20).padStart(2, '0')}:00'da hatırlatacağız.` : 'Bildirim izni verilmedi.');
  };

  const deleteAccount = () =>
    Alert.alert('Hesabını sil', 'Bütün ilerlemen, damgaların ve puanların kalıcı olarak silinecek.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiSend('DELETE', '/api/v1/me');
            await logout();
            router.replace('/welcome');
          } catch (e) {
            setError(messageFor(e));
          }
        },
      },
    ]);

  return (
    <View style={styles.screen}>
      <ScrollView>
        <SafeAreaView edges={['top']} style={styles.body}>
          <Label>{`İlerleme, ${data?.journeyDay ?? 1}. gün`}</Label>
          <Title size={34}>{after !== null ? 'Artık donup kalmıyorsun.' : 'Yolculuğun nasıl gidiyor?'}</Title>

          {DEMO ? <DemoPanel /> : null}

          <View style={styles.pair}>
            <ScoreBox title="Önce, 1. gün" value={before} dark={false} />
            <ScoreBox title="Sonra, 21. gün" value={after} dark />
          </View>

          {before !== null && after !== null ? (
            <View style={styles.gain}>
              <Text style={styles.gainValue}>{`${after - before >= 0 ? '+' : ''}${after - before}`}</Text>
              <Body size={15} style={{ flex: 1 }}>21 günde Seyahat İngilizcesi puanındaki değişim</Body>
            </View>
          ) : (
            <Card style={{ gap: 10 }}>
              <Body>
                {finalOpen
                  ? 'Final testi açıldı. Aynı testi tekrar çöz, farkı gör.'
                  : `Final testi 21. günde açılır. ${21 - (data?.journeyDay ?? 1)} gün kaldı.`}
              </Body>
              {finalOpen ? <Button label="Final testini yap" onPress={() => router.push('/placement?kind=FINAL')} /> : null}
            </Card>
          )}

          <Card style={{ paddingVertical: 4 }}>
            <Row label="En uzun seri" value={`${data?.streakBest ?? 0} gün`} />
            <Row label="Toplam XP" value={(data?.xp ?? 0).toLocaleString('en-US')} />
            <Row label="Konuşma doğruluğu" value={data?.speakingAccuracy != null ? `%${data.speakingAccuracy}` : '—'} />
            <Row label="Pasaport damgası" value={`${passport.data?.stamps ?? 0}`} last />
          </Card>
          {data?.speakingAccuracy != null ? <ProgressBar value={data.speakingAccuracy / 100} color={colors.green} /> : null}

          <Text style={styles.section}>Hesap</Text>
          <ErrorNote message={error} />
          {notice ? <Body size={14} color={colors.green}>{notice}</Body> : null}
          <Card style={{ gap: 10 }}>
            <Body size={14} color={colors.muted}>
              {data?.voiceConsent
                ? 'Ses değerlendirmesi açık. Kapatırsan dersler dinle ve tekrar et moduyla devam eder.'
                : 'Ses değerlendirmesi kapalı. Telaffuz puanı ve canlı sahneler için açabilirsin.'}
            </Body>
            {data?.voiceConsent ? (
              <Button label="Ses iznini geri al" variant="outline" onPress={() => void setConsent(false)} />
            ) : (
              <Button label="Ses iznini aç" variant="outline" onPress={() => router.push('/consent')} />
            )}
            <Button label="Günlük hatırlatmayı aç" variant="outline" onPress={() => void reminders()} />
            <Button label="Çıkış yap" variant="outline" onPress={() => void logout().then(() => router.replace('/welcome'))} />
            <Button label="Hesabımı sil" variant="ghost" onPress={deleteAccount} />
          </Card>
        </SafeAreaView>
      </ScrollView>
      <TabBar active="progress" />
    </View>
  );
}

function ScoreBox({ title, value, dark }: { title: string; value: number | null; dark: boolean }) {
  const fg = dark ? colors.surface : colors.disabled;
  return (
    <View style={[styles.box, dark && { backgroundColor: colors.ink }]}>
      <Label color={dark ? colors.yellow : colors.muted}>{title}</Label>
      <Text style={[styles.boxValue, { color: fg }]}>{value ?? '—'}</Text>
      <ProgressBar value={(value ?? 0) / 100} color={dark ? colors.yellow : '#8A929C'} track={dark ? colors.inkLine : colors.ground} height={8} />
    </View>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && { borderBottomWidth: 1, borderBottomColor: colors.ground }]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  body: { padding: 20, gap: 16 },
  pair: { flexDirection: 'row', gap: 10 },
  box: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, gap: 8 },
  boxValue: { fontFamily: fonts.display, fontSize: 72, lineHeight: 72, letterSpacing: -2 },
  gain: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.yellow, borderRadius: radius.md, padding: 14 },
  gainValue: { fontFamily: fonts.display, fontSize: 36, color: colors.ink },
  section: { fontFamily: fonts.display, fontSize: 21, color: colors.ink, marginTop: 12 },
  row: { minHeight: 48, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { fontFamily: fonts.body, fontSize: 15, color: colors.ink },
  rowValue: { fontFamily: fonts.displayBold, fontSize: 17, color: colors.ink },
});
