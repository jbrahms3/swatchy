import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { hexToRgb, readableOn } from '@/lib/color';
import { T, radius } from '@/lib/theme';

type Props = {
  name: string;
  hex: string;
  artworkCount: number;
  onPressTagged: () => void;
  /** Photo-less contexts have nothing else to show — the band becomes the hero visual. */
  hero?: boolean;
  /** Extra content on the right, after the tagged badge (PostCard's locate hint). */
  rightExtra?: ReactNode;
};

/**
 * The full-bleed color card: a swatch-colored rectangle with the name, hex,
 * and — if it's been used — a "tagged in N artworks" badge. This is *the*
 * color card in this app; every place a color gets shown as more than a
 * small chip (a post, the color-info sheet opened from an artwork) uses
 * this same component so they read identically.
 */
export function ColorBand({ name, hex, artworkCount, onPressTagged, hero, rightExtra }: Props) {
  const ink = readableOn(hexToRgb(hex));
  // The band's background is whatever color it's showing, so the badge
  // needs a knockout treatment that stays legible against any of them — a
  // tint of whichever ink color already reads clearly there.
  const badgeTint = ink === '#FFFFFF' ? 'rgba(255,255,255,0.24)' : 'rgba(17,17,17,0.14)';

  return (
    <View style={[styles.band, { backgroundColor: hex }, hero && styles.bandHero]}>
      <View style={styles.bandRow}>
        <View style={styles.bandShrink}>
          <Text style={[styles.bandName, { color: ink }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.bandHex, { color: ink }]}>{hex}</Text>
        </View>

        <View style={styles.bandRight}>
          {artworkCount > 0 && (
            <Pressable
              onPress={onPressTagged}
              hitSlop={8}
              accessibilityRole="link"
              accessibilityLabel={`Tagged in ${artworkCount} ${
                artworkCount === 1 ? 'artwork' : 'artworks'
              }. See them.`}
              style={[styles.taggedBadge, { backgroundColor: badgeTint }]}>
              <Ionicons name="brush" size={13} color={ink} />
              <Text style={[styles.taggedCount, { color: ink }]}>{artworkCount}</Text>
            </Pressable>
          )}
          {rightExtra}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 16,
    justifyContent: 'center',
  },
  bandHero: { aspectRatio: 1.8, paddingVertical: 20 },
  bandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  bandShrink: { flexShrink: 1 },
  bandRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bandName: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  bandHex: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
    opacity: 0.85,
    fontVariant: ['tabular-nums'],
  },
  // A stat, not a footnote: its own pill so it reads as a real number
  // rather than trailing text competing with the hex for attention.
  taggedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 30,
    paddingHorizontal: 11,
    borderRadius: radius.pill,
  },
  taggedCount: { fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
