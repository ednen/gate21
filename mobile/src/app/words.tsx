import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { hasPicture, Picture } from '@/components/Picture';
import { TabBar } from '@/components/TabBar';
import { Body, Button, isHovered, ProgressBar } from '@/components/ui';
import { chapter as getChapter, chapterInfo, manifest, stop } from '@/lib/content';
import { pendingAttempts } from '@/lib/progress';
import { usePassport } from '@/lib/queries';
import type { Step } from '@/lib/types';
import { accentForWeek, say } from '@/lib/voice';
import { buildCollection, type CollectionWord, learnedChapters } from '@/lib/words';
import { colors, fonts, gutter, lineColor, radius } from '@/theme';

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
        title: c.titleTr,
        subtitle: c.kind === 'starter' ? 'Başlangıç paketi' : `${c.day}. gün, ${stop(c.stop)?.title ?? ''}`,
        words: getChapter(c.slug)?.words ?? [],
      }));
    return buildCollection(chapters, learned);
  }, [passport.data, pending]);

  const level = (slug: string) => manifest().chapters.find((c) => c.slug === slug);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <SafeAreaView edges={['top']} style={styles.head}>
          <Text accessibilityRole="header" style={styles.title}>Kelimeler</Text>
          <View style={styles.tally}>
            <Text style={styles.tallyNumber}>{collection.learned}</Text>
            <Text style={styles.tallyOf}>{`/ ${collection.total} kelime açıldı`}</Text>
          </View>
          <ProgressBar value={collection.total ? collection.learned / collection.total : 0} color={colors.ink} track={colors.line} height={3} />
          <Body size={14} color={colors.muted}>Bir dersin eşleştirme adımını bitirince kelimeleri burada açılır. Açık bir kelimeye dokun, dinle.</Body>
        </SafeAreaView>

        {collection.sections.map((section) => (
          <View key={section.key} style={styles.section}>
            <View style={styles.sectionHead}>
              <View style={[styles.swatch, { backgroundColor: lineColor(level(section.key)?.kind === 'starter' ? 0 : level(section.key)?.week) }]} />
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
                      say(w.en, { slow: true, voice: accentForWeek(chapterInfo(w.chapter)?.week) });
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
                  {hasPicture(open.picture) ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${open.en}. Dinle`}
                      onPress={() => say(open.en, { slow: true, voice: accentForWeek(chapterInfo(open.chapter)?.week) })}
                      style={styles.sheetPicture}
                    >
                      <Picture name={open.picture} size={112} />
                    </Pressable>
                  ) : null}
                  <Pressable accessibilityRole="button" accessibilityLabel={`${open.en}. Dinle`} onPress={() => say(open.en, { slow: true, voice: accentForWeek(chapterInfo(open.chapter)?.week) })} style={styles.wordRow}>
                    <Text style={styles.sheetWord}>{open.en}</Text>
                    <Icon name="speaker" size={22} />
                  </Pressable>
                  <Text style={styles.sheetTr}>{open.tr}</Text>
                  {open.example ? (
                    <Pressable accessibilityRole="button" onPress={() => say(open.example ?? '', { voice: accentForWeek(chapterInfo(open.chapter)?.week) })} style={styles.example}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.exampleEn}>{open.example}</Text>
                        {open.exampleTr ? <Text style={styles.exampleTr}>{open.exampleTr}</Text> : null}
                      </View>
                      <Icon name="speaker" size={18} color={colors.muted} />
                    </Pressable>
                  ) : null}
                </>
              ) : (
                <>
                  <View style={[styles.sheetPicture, { backgroundColor: colors.ground }]}>
                    {hasPicture(open.picture) ? <Picture name={open.picture} size={112} shadow /> : <Text style={[styles.bigText, { color: colors.disabled }]}>?</Text>}
                  </View>
                  <Text style={styles.sheetWord}>Henüz açılmadı</Text>
                  <Body color={colors.muted}>
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
      style={(st) => [styles.tile, !word.learned && styles.tileLocked, (st.pressed || isHovered(st)) && { backgroundColor: word.learned ? colors.yellowTint : colors.line }]}
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
  head: { paddingHorizontal: gutter, paddingTop: 16, paddingBottom: 8, gap: 10 },
  title: { fontFamily: fonts.display, fontSize: 34, color: colors.ink, letterSpacing: -0.5 },
  tally: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  tallyNumber: { fontFamily: fonts.display, fontSize: 56, lineHeight: 58, color: colors.ink, letterSpacing: -1.5 },
  tallyOf: { fontFamily: fonts.displayMedium, fontSize: 17, color: colors.muted },
  section: { marginHorizontal: gutter, marginTop: 26, gap: 10 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  swatch: { width: 5, alignSelf: 'stretch', borderRadius: 1 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 19, color: colors.ink },
  sectionSub: { fontFamily: fonts.displayMedium, fontSize: 13, color: colors.muted },
  count: { fontFamily: fonts.displayBold, fontSize: 15, color: colors.muted },
  // One sheet of cells sharing their edges, like a sticker album page.
  grid: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderLeftWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, borderRadius: radius.sm, overflow: 'hidden' },
  tile: { width: '25%', minHeight: 104, paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center', gap: 4, borderRightWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
  tileLocked: { backgroundColor: colors.paper },
  tilePicture: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center' },
  tileText: { fontFamily: fonts.display, fontSize: 24, color: colors.ink, maxWidth: 70 },
  tileName: { fontFamily: fonts.displayBold, fontSize: 13, lineHeight: 15, color: colors.ink, textAlign: 'center' },
  tileNameLocked: { fontFamily: fonts.display, fontSize: 15, color: colors.disabled },
  tileReading: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  backdrop: { flex: 1, backgroundColor: 'rgba(35,42,49,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: 24, paddingBottom: 36, gap: 8, width: '100%', maxWidth: 560, alignSelf: 'center' },
  sheetPicture: { width: 132, height: 132, borderRadius: radius.md, backgroundColor: colors.yellowTint, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  bigText: { fontFamily: fonts.display, fontSize: 64, color: colors.ink },
  wordRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, alignSelf: 'flex-start' },
  sheetWord: { fontFamily: fonts.display, fontSize: 34, color: colors.ink, letterSpacing: -0.5 },
  sheetTr: { fontFamily: fonts.bodyMedium, fontSize: 17, color: colors.muted },
  example: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12, marginTop: 6 },
  exampleEn: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  exampleTr: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
});
