import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import type { Artwork, ArtworkColor } from '@/lib/store';
import { T, radius } from '@/lib/theme';

/**
 * One uploaded piece: photo, the colors it's tagged with, and its caption.
 * `artwork.authorName` is only present when this came from the cross-user
 * by-color listing (see loadArtworksByColor) — your own artworks (from
 * Profile) don't carry it, since it'd always just say "you".
 */
export function ArtworkCard({ artwork }: { artwork: Artwork }) {
  return (
    <View style={styles.card}>
      <View style={[styles.photo, { aspectRatio: artwork.photoAspect ?? 1 }]}>
        <Image source={{ uri: artwork.photoUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      </View>
      {(artwork.authorName || artwork.colors.length > 0) && (
        <View style={styles.meta}>
          {artwork.authorName && <Text style={styles.author}>{artwork.authorName}</Text>}
          {artwork.colors.length > 0 && (
            <View style={styles.colors}>
              {artwork.colors.map((c: ArtworkColor) => (
                <View key={c.hex} style={[styles.dot, { backgroundColor: c.hex }]} />
              ))}
            </View>
          )}
        </View>
      )}
      {!!artwork.caption && <Text style={styles.caption}>{artwork.caption}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: T.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    overflow: 'hidden',
  },
  photo: { width: '100%', backgroundColor: T.surfaceHi },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: 12,
  },
  author: { color: T.textDim, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  colors: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' },
  dot: {
    width: 20,
    height: 20,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  caption: { color: T.textDim, fontSize: 13, lineHeight: 18, paddingHorizontal: 12, paddingBottom: 12 },
});
