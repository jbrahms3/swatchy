import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ArtworkDetailModal } from '@/components/ArtworkDetailModal';
import { hexToRgb, readableOn } from '@/lib/color';
import type { Artwork, ArtworkColor } from '@/lib/store';
import { T, radius } from '@/lib/theme';
import { timeAgo } from '@/lib/time';

/**
 * A submitted piece of artwork, presented on the home feed the same way a
 * claimed-color post is: header, photo, then what makes it worth looking
 * at — here, the colors it's tagged with instead of one swatch band. Tap
 * the photo or the colors to expand it (see ArtworkDetailModal).
 */
export function ArtworkFeedCard({ artwork }: { artwork: Artwork }) {
  const [showDetail, setShowDetail] = useState(false);
  const authorName = artwork.authorName ?? 'Someone';
  const accent = artwork.colors[0]?.hex ?? T.surfaceHi;
  const ink = readableOn(hexToRgb(accent));

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: accent }]}>
          <Text style={[styles.avatarText, { color: ink }]}>{authorName.slice(0, 1).toUpperCase()}</Text>
        </View>

        <View style={styles.headerText}>
          <Text style={styles.author}>{authorName}</Text>
          <Text style={styles.meta}>
            {timeAgo(artwork.createdAt)} · shared artwork
          </Text>
        </View>
      </View>

      <Pressable
        onPress={() => setShowDetail(true)}
        accessibilityRole="button"
        accessibilityLabel="Expand this artwork and see its tagged colors">
        <View style={[styles.media, { aspectRatio: artwork.photoAspect ?? 1 }]}>
          <Image
            source={{ uri: artwork.photoUri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={180}
          />
        </View>

        {artwork.colors.length > 0 && (
          <View style={styles.colors}>
            {artwork.colors.map((c: ArtworkColor) => (
              <View key={c.hex} style={[styles.dot, { backgroundColor: c.hex }]} />
            ))}
          </View>
        )}
      </Pressable>

      {!!artwork.caption && <Text style={styles.caption}>{artwork.caption}</Text>}

      <ArtworkDetailModal artwork={showDetail ? artwork : null} onClose={() => setShowDetail(false)} />
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
    marginBottom: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '700' },
  headerText: { flex: 1 },
  author: { color: T.text, fontSize: 15, fontWeight: '600' },
  meta: { color: T.textFaint, fontSize: 12, marginTop: 1 },

  media: { width: '100%', backgroundColor: T.surfaceHi },

  colors: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    padding: 12,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
  },

  caption: {
    color: T.textDim,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
});
