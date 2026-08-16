import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ColorDetailSheet } from '@/components/ColorDetailSheet';
import { SwatchChip } from '@/components/SwatchChip';
import { useStore, type Post } from '@/lib/store';
import { FAB_CLEARANCE, T, radius } from '@/lib/theme';

const GUTTER = 16;
const COLUMNS = 3;
type SortMode = 'newest' | 'name';

export default function DiscoverScreen() {
  const { posts } = useStore();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const chipSize = (width - GUTTER * 2 - 12 * (COLUMNS - 1)) / COLUMNS;

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('newest');
  const [viewing, setViewing] = useState<Post | null>(null);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? posts.filter(
          (p) =>
            p.swatch.name.toLowerCase().includes(needle) ||
            p.swatch.hex.toLowerCase().includes(needle.replace('#', ''))
        )
      : posts;

    return [...filtered].sort((a, b) =>
      sort === 'newest' ? b.createdAt - a.createdAt : a.swatch.name.localeCompare(b.swatch.name)
    );
  }, [posts, query, sort]);

  return (
    <>
      <FlatList
        data={results}
        keyExtractor={(post) => post.id}
        numColumns={COLUMNS}
        columnWrapperStyle={styles.row}
        style={styles.list}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 8, paddingBottom: FAB_CLEARANCE },
        ]}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <SwatchChip swatch={item.swatch} size={chipSize} onPress={() => setViewing(item)} />
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Discover</Text>
            <Text style={styles.subtitle}>Every named color, browsable in one place</Text>

            <View style={styles.search}>
              <Ionicons name="search" size={16} color={T.textFaint} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search by name or hex…"
                placeholderTextColor={T.textFaint}
                style={styles.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              {query.length > 0 && (
                <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Clear search">
                  <Ionicons name="close-circle" size={16} color={T.textFaint} />
                </Pressable>
              )}
            </View>

            <View style={styles.sortRow}>
              <SortChip label="Newest" active={sort === 'newest'} onPress={() => setSort('newest')} />
              <SortChip label="A–Z" active={sort === 'name'} onPress={() => setSort('name')} />
              <Text style={styles.count}>
                {results.length} {results.length === 1 ? 'color' : 'colors'}
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{query ? 'No matches' : 'Nothing to discover yet'}</Text>
            <Text style={styles.emptyBody}>
              {query
                ? 'Try a different name or hex code.'
                : 'Colors show up here as soon as anyone posts one.'}
            </Text>
          </View>
        }
      />

      <ColorDetailSheet post={viewing} onClose={() => setViewing(null)} />
    </>
  );
}

function SortChip({
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
  content: { paddingHorizontal: GUTTER },
  row: { gap: 12 },

  header: { marginBottom: 18 },
  title: { color: T.text, fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: T.textFaint, fontSize: 14, marginTop: 4 },

  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: T.surfaceHi,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    paddingHorizontal: 12,
    height: 44,
    marginTop: 18,
  },
  searchInput: { flex: 1, color: T.text, fontSize: 15, height: '100%' },

  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  chip: {
    paddingHorizontal: 12,
    height: 30,
    borderRadius: radius.pill,
    justifyContent: 'center',
    backgroundColor: T.surfaceHi,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
  },
  chipActive: { backgroundColor: T.text, borderColor: T.text },
  chipText: { color: T.textDim, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: T.bg },
  count: { color: T.textFaint, fontSize: 12, marginLeft: 'auto' },

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
