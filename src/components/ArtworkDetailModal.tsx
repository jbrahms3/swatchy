import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ColorDetailSheet } from '@/components/ColorDetailSheet';
import { ColorInfoModal } from '@/components/ColorInfoModal';
import { hexToRgb, readableOn } from '@/lib/color';
import { useStore, type Artwork, type ArtworkColor, type Post } from '@/lib/store';
import { T, radius } from '@/lib/theme';
import { timeAgo } from '@/lib/time';

type Props = {
  artwork: Artwork | null;
  onClose: () => void;
};

/**
 * The expanded view of a piece of artwork: full photo, caption, and every
 * color it's tagged with as its own chip. Tapping a chip brings up the
 * same color card tapping a color on Discover does — a real post claiming
 * that hex, if one exists. Most catalog colors do, since they're most
 * often reached that way; ones that only ever came from someone's saved
 * swatches fall back to a plainer color card instead (see ColorInfoModal).
 */
export function ArtworkDetailModal({ artwork, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { loadPostByColor } = useStore();

  const [activeColor, setActiveColor] = useState<ArtworkColor | null>(null);
  const [activePost, setActivePost] = useState<Post | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  // Tapping a second chip before the first's lookup resolves shouldn't let
  // the stale one clobber it — only the most recent request is allowed to
  // apply its result.
  const lookupSeq = useRef(0);

  const openColor = async (color: ArtworkColor) => {
    const seq = ++lookupSeq.current;
    setActiveColor(color);
    setActivePost(null);
    setLookingUp(true);
    try {
      const post = await loadPostByColor(color.hex);
      if (seq === lookupSeq.current) setActivePost(post);
    } catch (err) {
      console.error('[artwork-detail] Failed to look up a post for this color', err);
      if (seq === lookupSeq.current) setActivePost(null); // falls back to ColorInfoModal below
    } finally {
      if (seq === lookupSeq.current) setLookingUp(false);
    }
  };

  const closeColor = () => {
    lookupSeq.current++; // invalidates any lookup still in flight
    setActiveColor(null);
    setActivePost(null);
  };

  if (!artwork) return null;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close">
            <Ionicons name="close" size={26} color={T.text} />
          </Pressable>
          <Text style={styles.topTitle}>Artwork</Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}>
          <View style={[styles.photoWrap, { aspectRatio: artwork.photoAspect ?? 1 }]}>
            <Image
              source={{ uri: artwork.photoUri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          </View>

          <View style={styles.body}>
            <Text style={styles.author}>{artwork.authorName ?? 'You'}</Text>
            <Text style={styles.time}>{timeAgo(artwork.createdAt)}</Text>

            {!!artwork.caption && <Text style={styles.caption}>{artwork.caption}</Text>}

            <Text style={styles.sectionTitle}>
              Colors used{artwork.colors.length > 0 ? ` (${artwork.colors.length})` : ''}
            </Text>

            {artwork.colors.length === 0 ? (
              <Text style={styles.empty}>Nothing from the community palette showed up in this one.</Text>
            ) : (
              <View style={styles.colorWrap}>
                {artwork.colors.map((c) => (
                  <ColorChip key={c.hex} color={c} onPress={() => openColor(c)} />
                ))}
              </View>
            )}
          </View>
        </ScrollView>

        {/* Overlays, not second Modals — a native Modal nested inside this
            one doesn't reliably show or take touches. */}
        {lookingUp && (
          <View style={styles.loading}>
            <ActivityIndicator color={T.text} />
          </View>
        )}
        {activeColor && !lookingUp && activePost && (
          <ColorDetailSheet post={activePost} onClose={closeColor} embedded />
        )}
        {activeColor && !lookingUp && !activePost && (
          <ColorInfoModal color={activeColor} onClose={closeColor} />
        )}
      </View>
    </Modal>
  );
}

function ColorChip({ color, onPress }: { color: ArtworkColor; onPress: () => void }) {
  const ink = readableOn(hexToRgb(color.hex));
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${color.name}, ${color.hex}. See more information about this color.`}
      style={({ pressed }) => [styles.chip, { backgroundColor: color.hex, opacity: pressed ? 0.8 : 1 }]}>
      <Text style={[styles.chipText, { color: ink }]} numberOfLines={1}>
        {color.name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 52,
  },
  topTitle: { color: T.text, fontSize: 16, fontWeight: '700' },

  photoWrap: { width: '100%', backgroundColor: T.surfaceHi },

  body: { padding: 16 },
  author: { color: T.text, fontSize: 17, fontWeight: '800' },
  time: { color: T.textFaint, fontSize: 13, marginTop: 2 },
  caption: { color: T.textDim, fontSize: 15, lineHeight: 21, marginTop: 12 },

  sectionTitle: {
    color: T.textFaint,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 22,
    marginBottom: 12,
  },
  empty: { color: T.textFaint, fontSize: 13, lineHeight: 19 },

  colorWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
    maxWidth: 180,
  },
  chipText: { fontSize: 13, fontWeight: '700' },

  loading: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    elevation: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
