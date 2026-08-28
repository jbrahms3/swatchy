import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ColorInfoModal } from '@/components/ColorInfoModal';
import { hexToRgb, readableOn } from '@/lib/color';
import type { Artwork, ArtworkColor } from '@/lib/store';
import { T, radius } from '@/lib/theme';
import { timeAgo } from '@/lib/time';

type Props = {
  artwork: Artwork | null;
  onClose: () => void;
};

/**
 * The expanded view of a piece of artwork: full photo, caption, and every
 * color it's tagged with as its own chip — tap one for more information
 * about that color (see ColorInfoModal).
 */
export function ArtworkDetailModal({ artwork, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [activeColor, setActiveColor] = useState<ArtworkColor | null>(null);

  if (!artwork) return null;

  return (
    <>
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
                    <ColorChip key={c.hex} color={c} onPress={() => setActiveColor(c)} />
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>

      <ColorInfoModal color={activeColor} onClose={() => setActiveColor(null)} />
    </>
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
});
