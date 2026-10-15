import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { hasPicture, Picture } from '@/components/Picture';
import { TabBar } from '@/components/TabBar';
import { Body, Button, Label, ProgressBar } from '@/components/ui';
import { chapter as getChapter, manifest, stop } from '@/lib/content';
import { pendingAttempts } from '@/lib/progress';
import { usePassport } from '@/lib/queries';
import type { Step } from '@/lib/types';
import { say } from '@/lib/voice';
import { buildCollection, type CollectionWord, learnedChapters } from '@/lib/words';
import { colors, fonts } from '@/theme';

/**
 * Every word of the journey, four to a row. Learned words show their picture and name;
 * the rest are grey silhouettes with a question mark until their lesson is done.
 */
export default function Words() {
  const passport = usePassport();
  const [pending, setPending] = useState<{ chapter: string; step: Step }[]>([]);
  const [open, setOpen] = useState<CollectionWord | null>(null);

  useFocusEffect(
    useCallback(() => {
      void pendingAttempts().then(setPending);
    }, []),
  );

  const collection = useMemo(() => {
    const progress = passport.data?.chapters ?? [];
    const learned = learnedChapters(progress, pending);
    const chapters = manifest()
      .chapters.filter((c) => c.available && c.kind !== 'simulation')
      // Travel words first, in journey order; the Starter pack (letters, numbers) at the end.
      .sort((a, b) => Number(a.kind === 'starter') - Number(b.kind === 'starter') || a.order - b.order)
      .map((c) => ({
        slug: c.slug,
        title: c.kind === 'starter' ? `Başlangıç · ${c.titleTr}` : `${c.day}. gün · ${c.titleTr}`,
        subtitle: c.kind === 'starter' ? 'Başlangıç paketi' : `${stop(c.stop)?.titleTr ?? ''}`,
        words: getChapter(c.slug)?.words ?? [],
      }));
    return buildCollection(chapters, learned);
  }, [passport.data, pending]);

  const level = (slug: string) => manifest().chapters.find((c) => c.slug === slug);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <SafeAreaView edges={['top']} style={styles.head}>
          <Label>KELİME KOLEKSİYONU</Label>
          <Text accessibilityRole="header" style={styles.title}>{`${collection.learned} / ${collection.total} kelime`}</Text>
          <ProgressBar value={collection.total ? collection.learned / collection.total : 0} color={colors.yellow} track={colors.line} height={8} />
          <Body size={14} color={colors.muted}>Bir dersin eşleştirme adımını bitirince o dersin kelimeleri açılır. Açık kelimeye dokun, dinle.</Body>
        </SafeAreaView>

        {collection.sections.map((section) => (
          <View key={section.key} style={styles.section}>
            <View style={styles.sectionHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionSub}>{section.subtitle}</Text>
              </View>
              <Text style={styles.count}>{`${section.learned}/${section.words.length}`}</Text>
            </View>
            <View style={styles.grid}>
              {section.words.map((w) => (
                <Tile
                  key={w.en}
                  word={w}
                  onPress={() => {
                    // A learned word is spoken the moment its picture is tapped.
                    if (w.learned) {
                      say(w.en, { slow: true });
                    }
                    setOpen(w);
                  }}
                />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={!!open} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <Pressable accessibilityLabel="Kapat" style={styles.backdrop} onPress={() => setOpen(null)}>
          {open ? (
            <Pressable style={styles.sheet} onPress={() => undefined}>
              {open.learned ? (
                <>
                  <Pressable accessibilityRole="button" accessibilityLabel={`${open.en}. Dinle`} onPress={() => say(open.en, { slow: true })}>
                    {hasPicture(open.picture) ? <Picture name={open.picture} size={140} /> : <Text style={styles.bigText}>{open.en}</Text>}
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={`${open.en}. Dinle`} onPress={() => say(open.en, { slow: true })} style={styles.wordRow}>
                    <Text style={styles.sheetWord}>{open.en}</Text>
                    <Icon name="speaker" size={22} />
                  </Pressable>
                  <Text style={styles.sheetTr}>{open.tr}</Text>
                  {open.example ? (
                    <Pressable accessibilityRole="button" onPress={() => say(open.example ?? '')} style={styles.example}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.exampleEn}>{open.example}</Text>
                        {open.exampleTr ? <Text style={styles.exampleTr}>{open.exampleTr}</Text> : null}
                      </View>
                      <Icon name="speaker" size={18} />
                    </Pressable>
                  ) : null}
                </>
              ) : (
                <>
                  {hasPicture(open.picture) ? <Picture name={open.picture} size={140} shadow /> : <Text style={[styles.bigText, { color: colors.line }]}>?</Text>}
                  <Text style={styles.sheetWord}>?</Text>
                  <Body color={colors.muted} style={{ textAlign: 'center' }}>
                    {`Bu kelime ${level(open.chapter)?.kind === 'starter' ? 'Başlangıç paketinde' : `${level(open.chapter)?.day}. günün dersinde`} açılacak.`}
                  </Body>
                  <Button label="Derse git" variant="accent" onPress={() => { setOpen(null); router.push(`/lesson/${open.chapter}`); }} />
                </>
              )}
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>
      <TabBar active="words" />
    </View>
  );
}

function Tile({ word, onPress }: { word: CollectionWord; onPress: () => void }) {
  const picture = hasPicture(word.picture);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={word.learned ? `${word.en}, ${word.tr}` : 'Henüz öğrenilmedi'}
      accessibilityHint={word.learned ? 'Dinle' : undefined}
      onPress={onPress}
      style={[styles.tile, !word.learned && styles.tileLocked]}
    >
      <View style={styles.tilePicture}>
        {picture ? (
          <Picture name={word.picture as string} size={52} shadow={!word.learned} />
        ) : (
          <Text style={[styles.tileText, !word.learned && { color: colors.line }]} numberOfLines={1} adjustsFontSizeToFit>
            {word.learned ? word.en : '?'}
          </Text>
        )}
      </View>
      <Text style={[styles.tileName, !word.learned && styles.tileNameLocked, !picture && word.learned && styles.tileReading]} numberOfLines={2}>
        {/* Without a picture the word itself is the big text, so the label gives its Turkish reading. */}
        {word.learned ? (picture ? word.en : word.tr) : '?'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  head: { padding: 20, paddingBottom: 8, gap: 10 },
  title: { fontFamily: fonts.display, fontSize: 32, color: colors.ink },
  section: { marginHorizontal: 12, marginTop: 14, gap: 8 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  sectionSub: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  count: { fontFamily: fonts.mono, fontSize: 12, color: colors.ink, backgroundColor: colors.surface, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, overflow: 'hidden' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '23%', flexGrow: 1, maxWidth: '24%', minHeight: 104, backgroundColor: colors.surface, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 4, alignItems: 'center', gap: 4 },
  tileLocked: { backgroundColor: '#E4E7EB' },
  tilePicture: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  tileText: { fontFamily: fonts.displayBold, fontSize: 22, color: colors.ink, maxWidth: 70 },
  tileName: { fontFamily: fonts.bodyBold, fontSize: 11, lineHeight: 14, color: colors.ink, textAlign: 'center' },
  tileNameLocked: { fontFamily: fonts.mono, fontSize: 14, color: colors.disabled },
  tileReading: { fontFamily: fonts.body, color: colors.muted },
  backdrop: { flex: 1, backgroundColor: 'rgba(20,23,28,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36, alignItems: 'center', gap: 10 },
  bigText: { fontFamily: fonts.display, fontSize: 64, color: colors.ink },
  wordRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  sheetWord: { fontFamily: fonts.display, fontSize: 30, color: colors.ink, textAlign: 'center' },
  sheetTr: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.muted },
  example: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.ground, borderRadius: 12, padding: 12 },
  exampleEn: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  exampleTr: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
});
