import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PostCard } from '@/components/PostCard';
import { useStore } from '@/lib/store';
import { FAB_CLEARANCE, T } from '@/lib/theme';

export default function HomeScreen() {
  const { posts } = useStore();
  const insets = useSafeAreaInsets();

  return (
    <FlatList
      data={posts}
      keyExtractor={(post) => post.id}
      renderItem={({ item }) => <PostCard post={item} />}
      style={styles.list}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 8, paddingBottom: FAB_CLEARANCE },
      ]}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>Home</Text>
          <Text style={styles.subtitle}>Every color claimed on this device</Text>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nothing claimed yet</Text>
          <Text style={styles.emptyBody}>
            Tap “Claim a color”, pick a photo, then press anywhere on it to pull the color out.
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: T.bg },
  content: { paddingHorizontal: 16 },
  header: { marginBottom: 18 },
  title: { color: T.text, fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: T.textFaint, fontSize: 14, marginTop: 4 },
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
