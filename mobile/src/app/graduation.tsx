import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Medal } from '@/components/Medal';
import { Body, Button, Card, Label } from '@/components/ui';
import { manifest } from '@/lib/content';
import { useMe } from '@/lib/queries';
import { colors, fonts } from '@/theme';

/** The end of the 21 days: the closing message, the final check and the way to stay travel ready. */
export default function Graduation() {
  const me = useMe();
  const g = manifest().graduation;
  const keepReady = me.data?.membership.plan === 'KEEP_READY' && me.data.membership.active;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.medals}>
          <Medal id="BRONZE" size={84} />
          <Medal id="SILVER" size={96} />
          <Medal id="GOLD" size={84} />
        </View>
        <Label color={colors.yellow}>21 gün tamamlandı</Label>
        <Text accessibilityRole="header" style={styles.title}>{g.title}</Text>
        <Body color={colors.mutedOnInk} size={16} style={{ textAlign: 'center' }}>{g.titleTr}</Body>
        <View style={{ gap: 12, alignSelf: 'stretch' }}>
          {g.lines.map((line, i) => (
            <View key={line} style={styles.line}>
              <Text style={styles.lineEn}>{line}</Text>
              <Text style={styles.lineTr}>{g.linesTr[i]}</Text>
            </View>
          ))}
        </View>

        <Card style={styles.offer}>
          <Label>Keep your English travel ready</Label>
          <Body size={15}>
            Öğrendiklerini unutma: sahneleri her seferinde yeni sürprizlerle tekrar oyna, raporlarındaki kalıplarla kısa
            tekrarlar yap. Haftada iki pratik yeter.
          </Body>
          <Button
            label={keepReady ? 'Pratiğe git' : 'Daha uygun fiyatla devam et'}
            variant="accent"
            onPress={() => router.push(keepReady ? '/practice' : '/membership?plan=KEEP_READY')}
          />
        </Card>
      </ScrollView>
      <View style={{ gap: 10, padding: 20, paddingTop: 0 }}>
        {me.data?.finalScore == null ? (
          <Button label="Final testini yap: farkını gör" variant="onDark" onPress={() => router.push('/placement?kind=FINAL')} />
        ) : null}
        <Button label="Bugüne dön" variant="onDark" onPress={() => router.replace('/home')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  body: { alignItems: 'center', padding: 20, gap: 16 },
  medals: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  title: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, color: colors.surface, textAlign: 'center' },
  line: { backgroundColor: colors.inkSoft, borderRadius: 8, padding: 14, gap: 4 },
  lineEn: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 22, color: colors.surface },
  lineTr: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.mutedOnInk },
  offer: { alignSelf: 'stretch', gap: 10 },
});
