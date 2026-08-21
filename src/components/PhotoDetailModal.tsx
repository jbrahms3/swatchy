import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { describe, hexToRgb, readableOn, rgbToHsl } from '@/lib/color';
import type { Post } from '@/lib/store';
import { T, radius } from '@/lib/theme';

/** Size of the dot marking where on the photo the color was picked from. */
const MARKER_SIZE = 22;

// The chip's info panel is a fixed light card, like a physical paint swatch —
// it reads the same regardless of how light or dark the color above it is.
const PAPER = '#FFFFFF';
const PAPER_INK = '#111114';
const PAPER_DIM = '#6B6B76';

type Props = {
  post: Post | null;
  onClose: () => void;
};

/**
 * Full-screen "paint chip" view of a single claimed color: the swatch color
 * as a card with the source photo inset at the top, and a white info panel
 * underneath with the hex/RGB/HSL values. Opened by tapping a post's photo.
 */
export function PhotoDetailModal({ post, onClose }: Props) {
  const insets = useSafeAreaInsets();
  if (!post) return null;

  const rgb = hexToRgb(post.swatch.hex);
  const hsl = rgbToHsl(rgb);
  const ink = readableOn(rgb);

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
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
            {/* Colored segment: only as tall as the photo it frames. */}
            <View style={[styles.colorSegment, { backgroundColor: post.swatch.hex }]}>
              {post.photoUri && (
                <View style={styles.photoMat}>
                  <View style={[styles.photoInset, { aspectRatio: post.photoAspect ?? 1 }]}>
                    <Image
                      source={{ uri: post.photoUri }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      transition={150}
                    />
                    {post.pickPoint && (
                      <View
                        pointerEvents="none"
                        style={[
                          styles.marker,
                          { left: `${post.pickPoint.u * 100}%`, top: `${post.pickPoint.v * 100}%` },
                        ]}>
                        <View style={[styles.markerDot, { backgroundColor: post.swatch.hex }]} />
                      </View>
                    )}
                  </View>
                </View>
              )}
              <Text style={[styles.name, { color: ink }]} numberOfLines={2}>
                {post.swatch.name}
              </Text>
            </View>

            {/* White segment: the color's stats, always dark-on-light. */}
            <View style={styles.paper}>
              <Text style={styles.label}>COLOR</Text>
              <Text style={styles.hex}>{post.swatch.hex}</Text>
              <Text style={styles.describe}>{describe(rgb)}</Text>

              <View style={styles.statsBlock}>
                <ValueRow label="RGB" value={`${rgb.r}, ${rgb.g}, ${rgb.b}`} />
                <ValueRow label="HSL" value={`${hsl.h}°, ${hsl.s}%, ${hsl.l}%`} />
              </View>

              {!!post.caption && <Text style={styles.caption}>{post.caption}</Text>}
              <Text style={styles.author}>{post.authorName}</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
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
  root: { flex: 1, backgroundColor: T.bg },
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

  // One card, two segments — color up top, white paper below.
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

  colorSegment: { alignItems: 'center', paddingTop: 20, paddingBottom: 22, paddingHorizontal: 20 },
  photoMat: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    padding: 4,
  },
  photoInset: {
    width: '100%',
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: '#00000010',
  },
  marker: {
    position: 'absolute',
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    borderRadius: MARKER_SIZE / 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateX: -MARKER_SIZE / 2 }, { translateY: -MARKER_SIZE / 2 }],
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },
  markerDot: {
    width: MARKER_SIZE - 6,
    height: MARKER_SIZE - 6,
    borderRadius: (MARKER_SIZE - 6) / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.15)',
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
    marginTop: 16,
  },

  paper: {
    backgroundColor: PAPER,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 22,
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

  caption: { color: PAPER_DIM, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  author: { color: PAPER_DIM, fontSize: 12, fontWeight: '600' },
});
