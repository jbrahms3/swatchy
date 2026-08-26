import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { hexToRgb, readableOn } from '@/lib/color';
import { useStore, type WeeklyEntry, type WeeklySlot } from '@/lib/store';
import { FAB_CLEARANCE, T, radius } from '@/lib/theme';

export default function WeeklyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { weekly, loadWeekly, previewWeeklyPalette } = useStore();
  const [refreshing, setRefreshing] = useState(false);
  const [preview, setPreview] = useState<WeeklySlot[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    loadWeekly().catch((err) => console.error('[weekly] Failed to load', err));
  }, [loadWeekly]);

  const generatePreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      setPreview(await previewWeeklyPalette());
    } catch (err) {
      console.error('[weekly] Failed to preview palette', err);
    } finally {
      setPreviewLoading(false);
    }
  }, [previewWeeklyPalette]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadWeekly();
    } catch (err) {
      console.error('[weekly] Failed to refresh', err);
    } finally {
      setRefreshing(false);
    }
  }, [loadWeekly]);

  const openSlot = (item: WeeklySlot) => {
    router.push({ pathname: '/weekly-capture', params: { slot: String(item.slot), hex: item.hex } });
  };

  const doneCount = weekly?.entries.length ?? 0;
  const totalCount = weekly?.palette.length ?? 0;

  return (
    <FlatList
      data={weekly?.palette ?? []}
      keyExtractor={(item) => String(item.slot)}
      style={styles.list}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 8, paddingBottom: FAB_CLEARANCE },
      ]}
      onRefresh={refresh}
      refreshing={refreshing}
      renderItem={({ item }) => (
        <WeeklyRow
          target={item}
          entry={weekly?.entries.find((e) => e.slot === item.slot)}
          onPress={() => openSlot(item)}
        />
      )}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>Weekly palette</Text>
          <Text style={styles.subtitle}>
            {weekly
              ? `Five colors for ${weekly.weekKey}. Find something in the real world for each — ${doneCount}/${totalCount} matched so far.`
              : 'Five colors, chosen for this week. Find something in the real world for each one.'}
          </Text>

          <Pressable
            onPress={generatePreview}
            disabled={previewLoading}
            accessibilityRole="button"
            accessibilityLabel="Generate a preview palette"
            style={({ pressed }) => [styles.previewBtn, { opacity: pressed || previewLoading ? 0.6 : 1 }]}>
            <Ionicons name="shuffle-outline" size={14} color={T.textDim} />
            <Text style={styles.previewBtnText}>
              {previewLoading ? 'Generating…' : preview ? 'Generate another' : 'See how the generator works'}
            </Text>
          </Pressable>

          {preview && (
            <>
              <Text style={styles.previewNote}>
                Preview only — not this week's real challenge, and nothing here is saved.
              </Text>
              <View style={styles.previewRow}>
                {preview.map((p) => (
                  <View key={p.slot} style={[styles.previewSwatch, { backgroundColor: p.hex }]}>
                    <Text style={[styles.previewHex, { color: readableOn(hexToRgb(p.hex)) }]}>
                      {p.hex}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Loading this week's colors…</Text>
        </View>
      }
    />
  );
}

function WeeklyRow({
  target,
  entry,
  onPress,
}: {
  target: WeeklySlot;
  entry?: WeeklyEntry;
  onPress: () => void;
}) {
  const ink = readableOn(hexToRgb(target.hex));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        entry
          ? `${target.hex}. Matched with a score of ${entry.score}. Tap to retake.`
          : `${target.hex}. Not matched yet. Tap to take a photo.`
      }
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.85 : 1 }]}>
      <View style={[styles.swatch, { backgroundColor: target.hex }]}>
        <Text style={[styles.swatchHex, { color: ink }]}>{target.hex}</Text>
      </View>

      {entry ? (
        <View style={styles.result}>
          <Image source={{ uri: entry.photoUri }} style={styles.thumb} contentFit="cover" />
          <View style={styles.resultText}>
            <Text style={styles.score}>Score {entry.score}</Text>
            <Text style={styles.diff}>
              R {entry.diffR} · G {entry.diffG} · B {entry.diffB}
            </Text>
            <Text style={styles.retake}>Tap to retake</Text>
          </View>
        </View>
      ) : (
        <View style={styles.prompt}>
          <Ionicons name="camera-outline" size={18} color={T.textDim} />
          <Text style={styles.promptText}>Take a photo to match this color</Text>
          <Ionicons name="chevron-forward" size={16} color={T.textFaint} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: T.bg },
  content: { paddingHorizontal: 16 },

  header: { marginBottom: 18 },
  title: { color: T.text, fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: T.textFaint, fontSize: 14, marginTop: 4, lineHeight: 20 },

  previewBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, alignSelf: 'flex-start' },
  previewBtnText: { color: T.textDim, fontSize: 13, fontWeight: '600' },
  previewNote: { color: T.textFaint, fontSize: 11, marginTop: 10, lineHeight: 15 },
  previewRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  previewSwatch: {
    flex: 1,
    height: 56,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  previewHex: { fontSize: 10, fontWeight: '700', fontVariant: ['tabular-nums'] },

  row: {
    backgroundColor: T.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    overflow: 'hidden',
    marginBottom: 12,
  },
  swatch: { height: 64, justifyContent: 'center', paddingHorizontal: 16 },
  swatchHex: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },

  prompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  promptText: { color: T.textDim, fontSize: 14, flex: 1 },

  result: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  thumb: { width: 52, height: 52, borderRadius: radius.sm, backgroundColor: T.surfaceHi },
  resultText: { flex: 1 },
  score: { color: T.text, fontSize: 15, fontWeight: '700' },
  diff: { color: T.textDim, fontSize: 12, marginTop: 2, fontVariant: ['tabular-nums'] },
  retake: { color: T.textFaint, fontSize: 12, marginTop: 4 },

  empty: { paddingTop: 64, alignItems: 'center', paddingHorizontal: 24 },
  emptyTitle: { color: T.text, fontSize: 17, fontWeight: '700' },
});
