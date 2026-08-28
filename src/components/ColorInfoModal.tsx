import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { describe, hexToRgb, readableOn, rgbToHsl } from '@/lib/color';
import type { ArtworkColor } from '@/lib/store';
import { T, radius } from '@/lib/theme';

// Same "paint chip" treatment as PhotoDetailModal — a fixed light card so
// the info panel reads the same regardless of how light or dark the color
// above it is.
const PAPER = '#FFFFFF';
const PAPER_INK = '#111114';
const PAPER_DIM = '#6B6B76';

type Props = {
  color: ArtworkColor | null;
  onClose: () => void;
};

/**
 * "More information" about one of an artwork's tagged colors: hex/RGB/HSL,
 * and — since this color came from the shared catalog, not a one-off pick —
 * how many other artworks are tagged with it, linking through to the full
 * list. Opened by tapping a color chip in ArtworkDetailModal.
 *
 * Deliberately NOT its own <Modal>: this is always opened from inside
 * ArtworkDetailModal's Modal, and a second native Modal nested inside a
 * first one doesn't reliably show or take touches (most visible on
 * Android). Rendered as a plain full-screen overlay instead, so there's
 * only ever one real Modal in play.
 */
export function ColorInfoModal({ color, onClose }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  if (!color) return null;

  const rgb = hexToRgb(color.hex);
  const hsl = rgbToHsl(rgb);
  const ink = readableOn(rgb);
  const count = color.artworkCount ?? 0;

  const seeArtworks = () => {
    onClose();
    router.push({
      pathname: '/color-artworks',
      params: { hex: color.hex, name: color.name, count: String(count) },
    });
  };

  return (
    <View style={styles.root}>
      <Pressable
        onPress={onClose}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={[styles.close, { top: insets.top + 10 }]}>
        <Ionicons name="close" size={22} color={T.text} />
      </Pressable>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 28 },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.chip}>
          <View style={[styles.colorSegment, { backgroundColor: color.hex }]}>
            <Text style={[styles.name, { color: ink }]} numberOfLines={2}>
              {color.name}
            </Text>
          </View>

          <View style={styles.paper}>
            <Text style={styles.label}>COLOR</Text>
            <Text style={styles.hex}>{color.hex}</Text>
            <Text style={styles.describe}>{describe(rgb)}</Text>

            <View style={styles.statsBlock}>
              <ValueRow label="RGB" value={`${rgb.r}, ${rgb.g}, ${rgb.b}`} />
              <ValueRow label="HSL" value={`${hsl.h}°, ${hsl.s}%, ${hsl.l}%`} />
            </View>

            <Pressable
              onPress={count > 0 ? seeArtworks : undefined}
              disabled={count === 0}
              accessibilityRole={count > 0 ? 'link' : undefined}
              accessibilityLabel={
                count > 0 ? `See the ${count} artworks tagged with this color` : undefined
              }
              style={({ pressed }) => [styles.taggedRow, { opacity: pressed ? 0.6 : 1 }]}>
              <Ionicons name="brush" size={14} color={PAPER_INK} />
              <Text style={styles.taggedText}>
                {count > 0
                  ? `Tagged in ${count} ${count === 1 ? 'artwork' : 'artworks'}`
                  : 'Not tagged in any other artwork yet'}
              </Text>
              {count > 0 && <Ionicons name="chevron-forward" size={14} color={PAPER_DIM} />}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function ValueRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statsRow}>
      <Text style={styles.statsLabel}>{label}</Text>
      <Text style={styles.statsValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Absolute + a solid background: this sits inside ArtworkDetailModal's
  // own Modal, on top of its ScrollView, and needs to fully cover it.
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: T.bg, zIndex: 10, elevation: 10 },
  close: {
    position: 'absolute',
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.surfaceHi,
    zIndex: 1,
  },

  scroll: { paddingHorizontal: 24, alignItems: 'center' },

  chip: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },

  colorSegment: { alignItems: 'center', paddingTop: 28, paddingBottom: 28, paddingHorizontal: 20 },
  name: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3, textAlign: 'center' },

  paper: {
    backgroundColor: PAPER,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
    alignItems: 'center',
    gap: 12,
  },
  label: { color: PAPER_DIM, fontSize: 12, fontWeight: '700', letterSpacing: 1.5 },
  hex: {
    color: PAPER_INK,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 0.5,
    fontVariant: ['tabular-nums'],
    marginTop: -6,
  },
  describe: { color: PAPER_DIM, fontSize: 14, fontWeight: '600', marginTop: -6 },

  statsBlock: { width: '100%', gap: 6 },
  statsRow: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  statsLabel: { color: PAPER_DIM, fontSize: 13, fontWeight: '700', letterSpacing: 0.5, width: 34 },
  statsValue: {
    color: PAPER_INK,
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },

  taggedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#00000014',
    width: '100%',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  taggedText: { color: PAPER_INK, fontSize: 13, fontWeight: '700' },
});
