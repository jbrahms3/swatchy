import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { hexToRgb, normalizeHex, readableOn } from '@/lib/color';
import { useStore, type QueuedPalette, type WeeklyQueue } from '@/lib/store';
import { T, radius } from '@/lib/theme';

/** Mirrors MAX_PALETTE_COLORS on the server. */
const MAX_COLORS = 24;

/**
 * Curator-only. Type the colors for a week's challenge in by hex and queue
 * them up; one palette is promoted every Monday, in the order they were
 * added. Reachable from Profile, and only for accounts the server marks as
 * admin — every route behind it is checked there too.
 */
export default function PaletteQueueScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loadWeeklyQueue, queuePalette, removeQueuedPalette, previewWeeklyPalette } = useStore();

  const [queue, setQueue] = useState<WeeklyQueue | null>(null);
  const [colors, setColors] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    try {
      setQueue(await loadWeeklyQueue());
    } catch (err) {
      console.error('[palette-queue] Failed to load', err);
    }
  }, [loadWeeklyQueue]);

  useEffect(() => {
    reload();
  }, [reload]);

  /** Takes one hex or a whole pasted list — commas, spaces and newlines all separate. */
  const addFromDraft = () => {
    const tokens = draft.split(/[\s,;]+/).filter(Boolean);
    if (tokens.length === 0) return;

    const parsed = tokens.map((token) => ({ token, hex: normalizeHex(token) }));
    const good = parsed.filter((p) => p.hex).map((p) => p.hex as string);
    const bad = parsed.filter((p) => !p.hex).map((p) => p.token);

    if (good.length > 0) {
      setColors((current) => {
        const merged = [...current];
        for (const hex of good) if (!merged.includes(hex)) merged.push(hex);
        return merged.slice(0, MAX_COLORS);
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    setDraft(bad.length > 0 && good.length === 0 ? draft : '');
    setError(bad.length > 0 ? `Not a hex color: ${bad.join(', ')}` : null);
  };

  const startFromGenerated = async () => {
    try {
      const palette = await previewWeeklyPalette();
      setColors(palette.map((p) => p.hex));
      setError(null);
    } catch (err) {
      console.error('[palette-queue] Failed to generate a starting point', err);
    }
  };

  const submit = async () => {
    if (colors.length === 0) return;
    setSaving(true);
    try {
      await queuePalette(colors);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setColors([]);
      setDraft('');
      setError(null);
      await reload();
    } catch (err) {
      console.error('[palette-queue] Failed to queue palette', err);
      Alert.alert('Could not queue that', 'Something went wrong saving the palette. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const confirmRemove = (palette: QueuedPalette) => {
    Alert.alert('Remove this palette?', 'It comes out of the queue and the rest move up a week.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeQueuedPalette(palette.id);
            await reload();
          } catch (err) {
            console.error('[palette-queue] Failed to remove palette', err);
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close">
          <Ionicons name="close" size={26} color={T.text} />
        </Pressable>
        <Text style={styles.topTitle}>Weekly palettes</Text>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 8}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            Type in the colors for a week and queue them. One palette goes live every Monday at
            midnight UTC, in the order below.
          </Text>

          {/* Composer */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>
              New palette{colors.length > 0 ? ` · ${colors.length}` : ''}
            </Text>

            {colors.length > 0 && (
              <View style={styles.chipWrap}>
                {colors.map((hex) => (
                  <Chip
                    key={hex}
                    hex={hex}
                    onRemove={() => setColors((c) => c.filter((x) => x !== hex))}
                  />
                ))}
              </View>
            )}

            <View style={styles.inputRow}>
              <TextInput
                value={draft}
                onChangeText={(text) => {
                  setDraft(text);
                  if (error) setError(null);
                }}
                onSubmitEditing={addFromDraft}
                placeholder="#A1B2C3"
                placeholderTextColor={T.textFaint}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="done"
                submitBehavior="submit"
                style={styles.input}
                accessibilityLabel="Hex code"
              />
              <Pressable
                onPress={addFromDraft}
                disabled={!draft.trim() || colors.length >= MAX_COLORS}
                accessibilityRole="button"
                accessibilityLabel="Add this color"
                style={({ pressed }) => [
                  styles.addBtn,
                  { opacity: !draft.trim() || colors.length >= MAX_COLORS ? 0.4 : pressed ? 0.7 : 1 },
                ]}>
                <Ionicons name="add" size={22} color={T.bg} />
              </Pressable>
            </View>

            <Text style={error ? styles.errorText : styles.hint}>
              {error ??
                `Paste a whole list if you like — commas, spaces and new lines all separate. Up to ${MAX_COLORS} per week.`}
            </Text>

            <Button
              label="Queue this palette"
              onPress={submit}
              busy={saving}
              disabled={colors.length === 0}
              style={{ marginTop: 14 }}
            />

            <Pressable
              onPress={startFromGenerated}
              accessibilityRole="button"
              accessibilityLabel="Fill the composer with a generated palette"
              style={({ pressed }) => [styles.link, { opacity: pressed ? 0.6 : 1 }]}>
              <Ionicons name="shuffle-outline" size={14} color={T.textDim} />
              <Text style={styles.linkText}>Start from a generated one</Text>
            </Pressable>
          </View>

          {/* Live now */}
          <Text style={styles.sectionTitle}>Live now</Text>
          {!queue ? (
            <ActivityIndicator color={T.textDim} style={{ marginTop: 12 }} />
          ) : (
            <View style={styles.card}>
              <View style={styles.rowHead}>
                <Text style={styles.weekKey}>{queue.current.weekKey}</Text>
                {queue.current.source === 'generated' && (
                  <Text style={styles.badge}>generated</Text>
                )}
              </View>
              <SwatchRow colors={queue.current.colors} />
              <Text style={styles.hint}>
                {queue.current.source === 'generated'
                  ? "Nothing was queued when this week started, so it was generated. Queueing now won't change it — the next one takes effect Monday."
                  : 'Locked in for the rest of the week.'}
              </Text>
            </View>
          )}

          {/* Queue */}
          <Text style={styles.sectionTitle}>Up next</Text>
          {queue && queue.queued.length === 0 && (
            <Text style={styles.empty}>
              Nothing queued. Every Monday with an empty queue gets a generated palette instead.
            </Text>
          )}
          {queue?.queued.map((palette, i) => (
            <View key={palette.id} style={styles.card}>
              <View style={styles.rowHead}>
                <Text style={styles.weekKey}>
                  {i === 0 ? 'Next Monday' : `In ${i + 1} weeks`} · {palette.goesLiveWeekKey}
                </Text>
                <Pressable
                  onPress={() => confirmRemove(palette)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove the palette queued for ${palette.goesLiveWeekKey}`}>
                  <Ionicons name="trash-outline" size={18} color={T.textFaint} />
                </Pressable>
              </View>
              <SwatchRow colors={palette.colors} />
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function SwatchRow({ colors }: { colors: string[] }) {
  return (
    <View style={styles.swatchRow}>
      {colors.map((hex, i) => (
        <View key={`${hex}-${i}`} style={[styles.swatch, { backgroundColor: hex }]}>
          <Text style={[styles.swatchHex, { color: readableOn(hexToRgb(hex)) }]} numberOfLines={1}>
            {hex.replace('#', '')}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Chip({ hex, onRemove }: { hex: string; onRemove: () => void }) {
  const ink = readableOn(hexToRgb(hex));
  return (
    <Pressable
      onPress={onRemove}
      accessibilityRole="button"
      accessibilityLabel={`Remove ${hex}`}
      style={({ pressed }) => [styles.chip, { backgroundColor: hex, opacity: pressed ? 0.7 : 1 }]}>
      <Text style={[styles.chipText, { color: ink }]}>{hex}</Text>
      <Ionicons name="close" size={13} color={ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  flex: { flex: 1 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 52,
  },
  topTitle: { color: T.text, fontSize: 16, fontWeight: '700' },

  content: { paddingHorizontal: 16 },
  intro: { color: T.textFaint, fontSize: 13, lineHeight: 19, marginBottom: 18 },

  card: {
    backgroundColor: T.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    padding: 14,
    marginBottom: 12,
  },
  cardLabel: {
    color: T.textFaint,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 12,
  },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
  },
  chipText: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },

  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: {
    flex: 1,
    backgroundColor: T.surfaceHi,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    color: T.text,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    paddingHorizontal: 14,
    height: 46,
  },
  addBtn: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: T.text,
    alignItems: 'center',
    justifyContent: 'center',
  },

  hint: { color: T.textFaint, fontSize: 12, lineHeight: 17, marginTop: 10 },
  errorText: { color: T.danger, fontSize: 12, lineHeight: 17, marginTop: 10 },

  link: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, alignSelf: 'center' },
  linkText: { color: T.textDim, fontSize: 13, fontWeight: '600' },

  sectionTitle: {
    color: T.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 10,
  },
  empty: { color: T.textFaint, fontSize: 13, lineHeight: 19, marginBottom: 12 },

  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  weekKey: { color: T.text, fontSize: 14, fontWeight: '700' },
  badge: {
    color: T.textFaint,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  swatch: {
    minWidth: 58,
    flexGrow: 1,
    height: 48,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  swatchHex: { fontSize: 10, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
