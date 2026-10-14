import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { Body, Button, Card, ErrorNote, Label, Title } from '@/components/ui';
import { apiSend } from '@/lib/api';
import { messageFor } from '@/lib/errors';
import { keys, queryClient } from '@/lib/queries';
import type { Me } from '@/lib/types';
import { colors } from '@/theme';

/**
 * Explicit consent before the first recording (KVKK): what is processed, where, and for how
 * long. Without consent the app works in "listen and repeat" mode with no scores.
 */
export default function Consent() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      const me = await apiSend<Me>('PATCH', '/api/v1/me', { voiceConsent: true });
      queryClient.setQueryData(keys.me, me);
      router.back();
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.icon}>
          <Icon name="mic" size={28} color={colors.yellow} />
        </View>
        <Title size={28}>Sesini değerlendirmemize izin verir misin?</Title>
        <Body color={colors.inkLine}>
          Telaffuz puanı ve yapay zekâlı sahneler için konuşmanı kaydedip değerlendiriyoruz.
        </Body>

        <Card style={{ gap: 12 }}>
          <Label>NE OLUYOR</Label>
          <Body>• Kayıt yalnızca mikrofon düğmesine bastığında başlar, en fazla 15 saniye sürer.</Body>
          <Body>• Ses, puanlanmak için Microsoft Azure'a (Batı Avrupa), konuşma metni sahne cevabı için Google Gemini'ye gönderilir. Bu, yurt dışına veri aktarımıdır.</Body>
          <Body>• Ses kaydını saklamıyoruz. Yalnızca puanları saklıyoruz; sahne metinleri 90 gün sonra silinir.</Body>
          <Body>• İznini istediğin zaman İlerleme › Hesap bölümünden geri alabilirsin.</Body>
        </Card>

        <ErrorNote message={error} />
        <Button label="İzin veriyorum" onPress={accept} loading={busy} />
        <Button label="Şimdi değil, dinle ve tekrar et" variant="ghost" onPress={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: { padding: 20, gap: 16 },
  icon: { width: 56, height: 56, borderRadius: 16, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
});
