import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { describe, hexToRgb, readableOn, rgbToHsl } from '@/lib/color';
import type { ArtworkColor } from '@/lib/store';
import { T, radius } from '@/lib/theme';

type Props = {
  color: ArtworkColor | null;
  onClose: () => void;
};

/**
 * "More information" about one of an artwork's tagged colors — the same
 * slide-up bottom sheet chrome as ColorDetailSheet (Discover) and
 * SwatchEditor (Profile), so tapping a color anywhere in the app opens the
 * same kind of window. The content itself can't be identical to
 * ColorDetailSheet's, though: that one shows the specific claimed Post
 * behind a Discover color, and an artwork's tagged color isn't tied to any
 * single post — it's a catalog match (see colorExtract.ts), so there may
 * be many posts sharing this hex, or none. Shows hex/RGB/HSL instead, plus
 * how many other artworks are tagged with it, linking through to that list.
 *
 * Deliberately NOT its own <Modal>: this is always opened from inside
 * ArtworkDetailModal's Modal, and a second native Modal nested inside a
 * first one doesn't reliably show or take touches (most visible on
 * Android). Rendered as a plain full-screen overlay instead, so there's
 * only ever one real Modal in play.
 */
export function ColorInfoModal({ color, onClose }: Props) {
  const router = useRouter();
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
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Dismiss" />

      <View style={styles.sheetWrap} pointerEvents="box-none">
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={styles.close}>
            <Ionicons name="close" size={20} color={T.textDim} />
          </Pressable>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} bounces={false}>
            <View style={[styles.preview, { backgroundColor: color.hex }]}>
              <Text style={[styles.previewName, { color: ink }]} numberOfLines={1}>
                {color.name}
              </Text>
              <Text style={[styles.previewHex, { color: ink }]}>{color.hex}</Text>
              <Text style={[styles.previewMeta, { color: ink }]}>
                {describe(rgb)} · hsl({hsl.h}, {hsl.s}%, {hsl.l}%) · rgb({rgb.r}, {rgb.g}, {rgb.b})
              </Text>
            </View>

            <Pressable
              onPress={count > 0 ? seeArtworks : undefined}
              disabled={count === 0}
              accessibilityRole={count > 0 ? 'link' : undefined}
              accessibilityLabel={
                count > 0 ? `See the ${count} artworks tagged with this color` : undefined
              }
              style={({ pressed }) => [styles.taggedRow, { opacity: pressed ? 0.6 : 1 }]}>
              <Ionicons name="brush" size={16} color={T.text} />
              <Text style={styles.taggedText}>
                {count > 0
                  ? `Tagged in ${count} ${count === 1 ? 'artwork' : 'artworks'}`
                  : 'Not tagged in any other artwork yet'}
              </Text>
              {count > 0 && <Ionicons name="chevron-forward" size={16} color={T.textFaint} />}
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Absolute, not fixed to the window: this sits inside ArtworkDetailModal's
  // own Modal, on top of its ScrollView, and needs to fully cover it.
  root: { ...StyleSheet.absoluteFillObject, zIndex: 10, elevation: 10 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: T.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    overflow: 'hidden',
  },
  grabber: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: T.border,
    alignSelf: 'center',
    marginBottom: 8,
  },
  close: {
    position: 'absolute',
    top: 14,
    right: 16,
    zIndex: 1,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.surfaceHi,
  },
  content: { padding: 16, paddingBottom: 28 },

  preview: {
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
  },
  previewName: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  previewHex: { fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'], marginTop: 2 },
  previewMeta: { fontSize: 12, opacity: 0.8, marginTop: 6, fontVariant: ['tabular-nums'] },

  taggedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: T.surfaceHi,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    paddingHorizontal: 14,
    height: 50,
    marginTop: 14,
  },
  taggedText: { flex: 1, color: T.text, fontSize: 14, fontWeight: '700' },
});
