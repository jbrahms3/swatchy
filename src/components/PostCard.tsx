import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { ColorBand } from '@/components/ColorBand';
import { PhotoDetailModal } from '@/components/PhotoDetailModal';
import { readableOn, hexToRgb } from '@/lib/color';
import { useStore, type Post } from '@/lib/store';
import { T, radius } from '@/lib/theme';
import { timeAgo } from '@/lib/time';

/** Size of the dot marking where on the photo the color was picked from. */
const PHOTO_MARKER_SIZE = 24;

export function PostCard({ post }: { post: Post }) {
  const router = useRouter();
  const { toggleLike, deletePost } = useStore();
  const [holding, setHolding] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const liked = post.likedByMe;
  const mine = post.mine;
  // Nothing to reveal on photo-less posts or posts saved before pickPoint existed.
  const canLocate = !!(post.photoUri && post.pickPoint);

  const confirmDelete = () => {
    Alert.alert('Delete post?', 'This removes it from the home feed and deletes the photo.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deletePost(post.id) },
    ]);
  };

  const swatch = post.swatch;
  const ink = readableOn(hexToRgb(swatch.hex));

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: swatch.hex }]}>
          <Text style={[styles.avatarText, { color: ink }]}>
            {post.authorName.slice(0, 1).toUpperCase()}
          </Text>
        </View>

        <View style={styles.headerText}>
          <Text style={styles.author}>{post.authorName}</Text>
          <Text style={styles.meta}>{timeAgo(post.createdAt)}</Text>
        </View>

        {mine && (
          <Pressable
            onPress={confirmDelete}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Delete post">
            <Ionicons name="ellipsis-horizontal" size={20} color={T.textFaint} />
          </Pressable>
        )}
      </View>

      {post.photoUri && (
        <Pressable
          onPress={() => setShowDetail(true)}
          accessibilityRole="button"
          accessibilityLabel="View photo and color details">
          <View style={[styles.media, { aspectRatio: post.photoAspect ?? 1 }]}>
            <Image
              source={{ uri: post.photoUri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={180}
            />

            {/* Marks the exact spot the color was pulled from — only while holding the band below. */}
            {holding && post.pickPoint && (
              <View
                pointerEvents="none"
                style={[
                  styles.photoMarker,
                  { left: `${post.pickPoint.u * 100}%`, top: `${post.pickPoint.v * 100}%` },
                ]}>
                <View style={[styles.photoMarkerDot, { backgroundColor: swatch.hex }]} />
              </View>
            )}
          </View>
        </Pressable>
      )}

      {/* The claimed color, full-bleed — the point of the post, not a footnote.
          Press and hold to reveal where on the photo it was picked from. */}
      <Pressable
        onPressIn={() => canLocate && setHolding(true)}
        onPressOut={() => setHolding(false)}
        disabled={!canLocate}
        accessibilityRole={canLocate ? 'button' : undefined}
        accessibilityLabel={
          canLocate ? `${swatch.name}. Press and hold to see where on the photo it's from.` : undefined
        }
        style={holding && styles.bandHolding}>
        <ColorBand
          name={swatch.name}
          hex={swatch.hex}
          artworkCount={swatch.artworkCount}
          hero={!post.photoUri}
          onPressTagged={() =>
            router.push({
              pathname: '/color-artworks',
              params: { hex: swatch.hex, name: swatch.name, count: String(swatch.artworkCount) },
            })
          }
          rightExtra={
            canLocate ? <Ionicons name="locate-outline" size={18} color={ink} style={styles.bandHint} /> : undefined
          }
        />
      </Pressable>

      {!!post.caption && <Text style={styles.caption}>{post.caption}</Text>}

      <View style={styles.actions}>
        <Pressable
          onPress={() => toggleLike(post.id)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={liked ? 'Unlike' : 'Like'}
          style={({ pressed }) => [styles.like, { opacity: pressed ? 0.6 : 1 }]}>
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={20}
            color={liked ? '#FF4D6D' : T.textDim}
          />
          {post.likeCount > 0 && (
            <Text style={[styles.likeCount, liked && { color: '#FF4D6D' }]}>{post.likeCount}</Text>
          )}
        </Pressable>
      </View>

      <PhotoDetailModal post={showDetail ? post : null} onClose={() => setShowDetail(false)} />
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

  media: { width: '100%', backgroundColor: T.surfaceHi, overflow: 'hidden' },
  photoMarker: {
    position: 'absolute',
    width: PHOTO_MARKER_SIZE,
    height: PHOTO_MARKER_SIZE,
    borderRadius: PHOTO_MARKER_SIZE / 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [
      { translateX: -PHOTO_MARKER_SIZE / 2 },
      { translateY: -PHOTO_MARKER_SIZE / 2 },
    ],
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },
  photoMarkerDot: {
    width: PHOTO_MARKER_SIZE - 8,
    height: PHOTO_MARKER_SIZE - 8,
    borderRadius: (PHOTO_MARKER_SIZE - 8) / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.15)',
  },

  // Dims the band slightly while press-and-hold is revealing the photo
  // marker — ColorBand itself owns the rest of the band's look now.
  bandHolding: { opacity: 0.85 },
  bandHint: { opacity: 0.7 },

  caption: {
    color: T.textDim,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  like: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  likeCount: { color: T.textDim, fontSize: 13, fontWeight: '600' },
});
