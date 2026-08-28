import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ColorBand } from '@/components/ColorBand';
import type { ArtworkColor } from '@/lib/store';
import { T } from '@/lib/theme';

type Props = {
  color: ArtworkColor | null;
  onClose: () => void;
};

/**
 * The color card for one of an artwork's tagged colors — the exact same
 * ColorBand used everywhere else a color is shown as more than a small
 * chip, in the exact same bottom-sheet chrome as Discover's
 * ColorDetailSheet, so tapping a color anywhere in the app brings up an
 * identical card. Opened by tapping a color chip in ArtworkDetailModal.
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

          <View style={styles.content}>
            <ColorBand
              name={color.name}
              hex={color.hex}
              artworkCount={count}
              onPressTagged={seeArtworks}
              hero
            />
          </View>
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
    maxHeight: '86%',
    backgroundColor: T.bg,
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
});
