import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ArtworkCard } from '@/components/ArtworkCard';
import { hexToRgb, readableOn } from '@/lib/color';
import { useStore, type Artwork } from '@/lib/store';
import { T, radius } from '@/lib/theme';

/**
 * Every artwork (anyone's) tagged with one color — what "tagged N times"
 * on a color card links to. `name`/`count` are just what the caller already
 * had on hand for the header while the real list loads.
 */
export default function ColorArtworksScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hex, name, count } = useLocalSearchParams<{ hex: string; name?: string; count?: string }>();
  const { loadArtworksByColor } = useStore();

  const [artworks, setArtworks] = useState<Artwork[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setArtworks(null);
    setError(null);

    loadArtworksByColor(hex)
      .then((result) => {
        if (!cancelled) setArtworks(result);
      })
      .catch((err) => {
        console.error('[color-artworks] Failed to load', err);
        if (!cancelled) setError('Could not load these artworks. Try again.');
      });

    return () => {
      cancelled = true;
    };
  }, [hex, loadArtworksByColor]);

  const ink = readableOn(hexToRgb(hex));
  const shownCount = artworks?.length ?? (count ? Number(count) : undefined);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close">
          <Ionicons name="close" size={26} color={T.text} />
        </Pressable>
        <Text style={styles.topTitle}>Tagged in artwork</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={[styles.swatch, { backgroundColor: hex }]}>
        <Text style={[styles.swatchName, { color: ink }]} numberOfLines={1}>
          {name || hex}
        </Text>
        <Text style={[styles.swatchMeta, { color: ink }]}>
          {hex}
          {shownCount !== undefined
            ? ` · tagged ${shownCount} ${shownCount === 1 ? 'time' : 'times'}`
            : ''}
        </Text>
      </View>

      {artworks === null ? (
        <ActivityIndicator color={T.textDim} style={styles.spinner} />
      ) : error ? (
        <Text style={styles.empty}>{error}</Text>
      ) : artworks.length === 0 ? (
        <Text style={styles.empty}>No artwork has been tagged with this color yet.</Text>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}>
          {artworks.map((artwork) => (
            <ArtworkCard key={artwork.id} artwork={artwork} />
          ))}
        </ScrollView>
      )}
    </View>
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

  swatch: {
    marginHorizontal: 16,
    marginBottom: 18,
    borderRadius: radius.lg,
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  swatchName: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  swatchMeta: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
    opacity: 0.85,
    fontVariant: ['tabular-nums'],
  },

  spinner: { marginTop: 40 },
  empty: {
    color: T.textFaint,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  list: { paddingHorizontal: 16, gap: 14 },
});
