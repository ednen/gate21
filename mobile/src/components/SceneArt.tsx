import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme';

/**
 * Simple drawn scenes for the "What do you see?" step. Words that would give the answer away
 * are left out of the drawings.
 */
export function SceneArt({ scene }: { scene: string }) {
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={DESCRIPTIONS[scene] ?? 'Bir sahne'} style={styles.frame}>
      {scene === 'checkin-desk' && <CheckinDesk />}
      {scene === 'key-card' && <KeyCard />}
      {scene === 'bill' && <Bill />}
      {scene === 'price-tag' && <PriceTag />}
    </View>
  );
}

const DESCRIPTIONS: Record<string, string> = {
  'checkin-desk': 'Havalimanında bir banko ve önünde bir bavul',
  'key-card': 'Otel odası kapısı ve bir kart',
  bill: 'Restoranda masaya bırakılmış bir kâğıt',
  'price-tag': 'Bir tişörte bağlı küçük bir etiket',
};

function CheckinDesk() {
  return (
    <>
      <View style={[styles.sign, { left: 24, right: 24, top: 26 }]}>
        <Text style={styles.signText}>✈ 12–18</Text>
        <Text style={styles.signText}>IST → LIS</Text>
      </View>
      <View style={[styles.floor]} />
      <View style={{ position: 'absolute', left: 36, right: 120, bottom: 34, height: 70, borderTopLeftRadius: 10, borderTopRightRadius: 10, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.ink }} />
      <View style={{ position: 'absolute', left: 60, bottom: 104, width: 46, height: 30, borderRadius: 4, backgroundColor: colors.inkLine }} />
      <View style={{ position: 'absolute', right: 48, bottom: 34, width: 54, height: 78, borderRadius: 10, backgroundColor: colors.yellow, borderWidth: 2, borderColor: colors.ink }} />
      <View style={{ position: 'absolute', right: 66, bottom: 112, width: 18, height: 14, borderWidth: 2, borderBottomWidth: 0, borderColor: colors.ink, borderTopLeftRadius: 6, borderTopRightRadius: 6 }} />
    </>
  );
}

function KeyCard() {
  return (
    <>
      <View style={styles.floor} />
      <View style={{ position: 'absolute', left: 40, bottom: 34, width: 110, height: 160, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.ink, borderTopLeftRadius: 6, borderTopRightRadius: 6 }}>
        <Text style={{ fontFamily: fonts.mono, fontSize: 16, color: colors.ink, textAlign: 'center', marginTop: 16 }}>512</Text>
        <View style={{ position: 'absolute', right: 10, top: 80, width: 14, height: 26, borderRadius: 4, backgroundColor: colors.inkLine }} />
      </View>
      <View style={{ position: 'absolute', right: 56, top: 70, width: 110, height: 70, borderRadius: 10, backgroundColor: colors.yellow, borderWidth: 2, borderColor: colors.ink, transform: [{ rotate: '-12deg' }] }}>
        <View style={{ position: 'absolute', left: 12, top: 14, width: 24, height: 18, borderRadius: 4, backgroundColor: colors.ink }} />
      </View>
    </>
  );
}

function Bill() {
  return (
    <>
      <View style={[styles.floor, { height: 110, backgroundColor: '#C9B79C' }]} />
      <View style={{ position: 'absolute', left: 110, top: 40, width: 120, height: 150, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.ink, padding: 12, gap: 8, transform: [{ rotate: '4deg' }] }}>
        {[60, 80, 50, 70].map((w, i) => (
          <View key={i} style={{ height: 6, width: `${w}%`, backgroundColor: colors.line }} />
        ))}
        <View style={{ height: 2, backgroundColor: colors.ink, marginTop: 8 }} />
        <Text style={{ fontFamily: fonts.mono, fontSize: 14, color: colors.ink, alignSelf: 'flex-end' }}>€ 34.50</Text>
      </View>
      <View style={{ position: 'absolute', left: 40, bottom: 26, width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.surface }} />
    </>
  );
}

function PriceTag() {
  return (
    <>
      <View style={{ position: 'absolute', left: 50, top: 30, width: 150, height: 160, backgroundColor: colors.blue, borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: 2, borderColor: colors.ink }} />
      <View style={{ position: 'absolute', left: 190, top: 60, width: 60, height: 2, backgroundColor: colors.ink, transform: [{ rotate: '25deg' }] }} />
      <View style={{ position: 'absolute', left: 230, top: 80, width: 70, height: 44, borderRadius: 6, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: fonts.mono, fontSize: 15, color: colors.ink }}>$19</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  frame: { height: 220, borderRadius: 20, backgroundColor: '#DCE3EA', overflow: 'hidden' },
  floor: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 84, backgroundColor: '#9AA8B6' },
  sign: { position: 'absolute', height: 40, borderRadius: 8, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14 },
  signText: { fontFamily: fonts.mono, fontSize: 14, color: colors.yellow, letterSpacing: 1.4 },
});
