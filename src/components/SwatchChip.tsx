import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { T, radius } from '@/lib/theme';
import type { Swatch } from '@/lib/store';

type Props = {
  swatch: Swatch;
  size?: number;
  onPress?: () => void;
  /** Renders the hex under the name. Off in dense grids. */
  showHex?: boolean;
  /** A small "tagged N times" badge on the tile itself, if it's been tagged at all. */
  showTaggedBadge?: boolean;
};

export function SwatchChip({ swatch, size = 92, onPress, showHex = true, showTaggedBadge = false }: Props) {
  const body = (
    <View style={{ width: size }}>
      <View style={[styles.tile, { height: size, backgroundColor: swatch.hex }]}>
        {showTaggedBadge && swatch.artworkCount > 0 && (
          <View style={styles.badge}>
            <Ionicons name="brush" size={10} color="#fff" />
            <Text style={styles.badgeText} numberOfLines={1}>
              {swatch.artworkCount}
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {swatch.name}
      </Text>
      {showHex && <Text style={styles.hex}>{swatch.hex}</Text>}
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        showTaggedBadge && swatch.artworkCount > 0
          ? `${swatch.name}, ${swatch.hex}, tagged in ${swatch.artworkCount} ${swatch.artworkCount === 1 ? 'artwork' : 'artworks'}`
          : `${swatch.name}, ${swatch.hex}`
      }
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: '100%',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  // Dark and fixed rather than derived from the tile's own color — at this
  // size a per-color knockout tint isn't worth the cost, and a dark chip
  // reads fine on every swatch, light or dark.
  badge: {
    position: 'absolute',
    top: 5,
    right: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800', fontVariant: ['tabular-nums'] },
  name: {
    color: T.text,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  hex: {
    color: T.textFaint,
    fontSize: 11,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
});
