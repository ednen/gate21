import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { Body, Button, Card, ErrorNote, Label, Title } from '@/components/ui';
import { apiGet, apiSend } from '@/lib/api';
import { chapterInfo, manifest } from '@/lib/content';
import { ApiError, messageFor } from '@/lib/errors';
import { invalidateProgress } from '@/lib/queries';
import type { Membership, Offers } from '@/lib/types';
import { colors, fonts } from '@/theme';

/**
 * The plans. Prices and payment will come from the App Store / Google Play; until the store is
 * connected the server only grants plans in sandbox mode, and says so.
 */
export default function MembershipScreen() {
  const { from, plan: wanted } = useLocalSearchParams<{ from?: string; plan?: string }>();
  const offers = useQuery({ queryKey: ['membership'], queryFn: () => apiGet<Offers>('/api/v1/membership') });
  const [selected, setSelected] = useState<string>(wanted ?? 'JOURNEY');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const lockedChapter = from ? chapterInfo(from) : undefined;
  const current = offers.data?.current;

  const buy = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiSend<Membership>('POST', '/api/v1/membership/purchase', { plan: selected });
      await invalidateProgress();
      await offers.refetch();
      if (from) {
        router.replace(`/lesson/${from}`);
      } else {
        setNotice('Üyeliğin açıldı. İyi yolculuklar!');
      }
    } catch (e) {
      if (e instanceof ApiError && e.code === 'STORE_NOT_CONNECTED') {
        setNotice('Mağaza ödemesi çok yakında açılacak. Şimdilik Başlangıç paketi ve ilk iki gün ücretsiz.');
      } else {
        setError(messageFor(e));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Kapat" onPress={() => router.back()} style={styles.close}>
          <Icon name="close" size={20} strokeWidth={2} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Label>Üyelik</Label>
        <Title size={30}>{lockedChapter ? `${lockedChapter.day}. gün seni bekliyor` : 'Yolculuğuna devam et'}</Title>
        <Body color={colors.muted}>
          {`Başlangıç paketi, SOS ve ilk ${manifest().freeDays} gün herkese ücretsiz. Bütün yolculuk ve sahneler için bir plan seç.`}
        </Body>
        {current?.active ? (
          <Card style={{ backgroundColor: colors.greenTint }}>
            <Body color={colors.green}>
              {`Şu anki planın: ${current.plan === 'JOURNEY' ? '21 günlük yolculuk' : 'Keep your English travel ready'}${current.expiresAt ? `, ${new Date(current.expiresAt).toLocaleDateString('tr-TR')} tarihine kadar` : ''}`}
            </Body>
          </Card>
        ) : null}

        {(offers.data?.plans ?? []).map((p) => {
          const on = selected === p.id;
          return (
            <Pressable
              key={p.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => setSelected(p.id)}
              style={[styles.plan, on && styles.planOn]}
            >
              <View style={styles.planTop}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.planTitle}>{p.titleTr}</Text>
                  <Text style={styles.planSub}>{p.title}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.price}>{p.price}</Text>
                  <Text style={styles.planSub}>{p.periodTr}</Text>
                </View>
              </View>
              {p.featuresTr.map((f) => (
                <View key={f} style={styles.feature}>
                  <Icon name="check" size={16} color={colors.green} strokeWidth={2.4} />
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
            </Pressable>
          );
        })}
        <ErrorNote message={error ?? (offers.isError ? messageFor(offers.error) : null)} />
        {notice ? <Card live style={{ backgroundColor: colors.yellowTint }}><Body>{notice}</Body></Card> : null}
      </ScrollView>
      <View style={{ padding: 16, gap: 8 }}>
        <Button label="Planı seç" variant="accent" onPress={() => void buy()} loading={busy} disabled={!offers.data} />
        <Text style={styles.small}>Fiyatlar örnektir; ödeme App Store ve Google Play üzerinden alınacak.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  top: { paddingHorizontal: 16, paddingTop: 8 },
  close: { width: 44, height: 44, borderRadius: 8, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 16, gap: 14 },
  plan: { backgroundColor: colors.surface, borderRadius: 8, padding: 16, gap: 8, borderWidth: 2, borderColor: colors.surface },
  planOn: { borderColor: colors.ink },
  planTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 4 },
  planTitle: { fontFamily: fonts.displayBold, fontSize: 20, color: colors.ink },
  planSub: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  price: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  feature: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  featureText: { flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink },
  small: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, textAlign: 'center' },
});
