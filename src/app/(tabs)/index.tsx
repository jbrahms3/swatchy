import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ArtworkFeedCard } from '@/components/ArtworkFeedCard';
import { PostCard } from '@/components/PostCard';
import { useStore, type Artwork, type Post } from '@/lib/store';
import { FAB_CLEARANCE, T, radius } from '@/lib/theme';

type FeedItem = { key: string; createdAt: number } & (
  | { kind: 'post'; post: Post }
  | { kind: 'artwork'; artwork: Artwork }
);

type Filter = 'all' | 'colors' | 'artwork';

export default function HomeScreen() {
  const { posts, artworkFeed } = useStore();
  const insets = useSafeAreaInsets();

  const [filter, setFilter] = useState<Filter>('all');

  // Two separate feeds, interleaved by time so the newest of either kind
  // always leads — a fresh piece of artwork shouldn't wait behind a week
  // of claimed colors just because it's a different kind of post.
  const feed = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [];
    if (filter !== 'artwork') {
      items.push(
        ...posts.map((post): FeedItem => ({ kind: 'post', post, key: `post-${post.id}`, createdAt: post.createdAt }))
      );
    }
    if (filter !== 'colors') {
      items.push(
        ...artworkFeed.map(
          (artwork): FeedItem => ({
            kind: 'artwork',
            artwork,
            key: `artwork-${artwork.id}`,
            createdAt: artwork.createdAt,
          })
        )
      );
    }
    return items.sort((a, b) => b.createdAt - a.createdAt);
  }, [posts, artworkFeed, filter]);

  return (
    <FlatList
      data={feed}
      keyExtractor={(item) => item.key}
      renderItem={({ item }) =>
        item.kind === 'post' ? <PostCard post={item.post} /> : <ArtworkFeedCard artwork={item.artwork} />
      }
      style={styles.list}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 8, paddingBottom: FAB_CLEARANCE },
      ]}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>Home</Text>
          <Text style={styles.subtitle}>Colors claimed and artwork shared by everyone</Text>

          <View style={styles.filterRow}>
            <FilterChip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
            <FilterChip label="Colors" active={filter === 'colors'} onPress={() => setFilter('colors')} />
            <FilterChip
              label="Artwork"
              active={filter === 'artwork'}
              onPress={() => setFilter('artwork')}
            />
          </View>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>
            {filter === 'colors'
              ? 'No colors yet'
              : filter === 'artwork'
                ? 'No artwork yet'
                : 'Nothing here yet'}
          </Text>
          <Text style={styles.emptyBody}>
            Tap the button in the corner to claim a color from a photo, or share a piece of
            artwork.
          </Text>
        </View>
      }
    />
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: T.bg },
  content: { paddingHorizontal: 16 },
  header: { marginBottom: 18 },
  title: { color: T.text, fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: T.textFaint, fontSize: 14, marginTop: 4 },

  filterRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  chip: {
    paddingHorizontal: 14,
    height: 32,
    borderRadius: radius.pill,
    justifyContent: 'center',
    backgroundColor: T.surfaceHi,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
  },
  chipActive: { backgroundColor: T.text, borderColor: T.text },
  chipText: { color: T.textDim, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: T.bg },

  empty: { paddingTop: 64, alignItems: 'center', paddingHorizontal: 24 },
  emptyTitle: { color: T.text, fontSize: 17, fontWeight: '700' },
  emptyBody: {
    color: T.textFaint,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
  },
});
