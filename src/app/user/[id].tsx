import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PostCard } from '@/components/PostCard';
import { hexToRgb, readableOn } from '@/lib/color';
import { useStore, type PublicProfile } from '@/lib/store';
import { T, radius } from '@/lib/theme';

/**
 * Someone else's profile — read-only. Just enough to see who they are and
 * what they've posted; no saved colors (those stay private to their owner)
 * and nothing editable.
 */
export default function UserProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { loadUserProfile } = useStore();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    loadUserProfile(id)
      .then(setProfile)
      .catch((err) => {
        console.error('[user profile] Failed to load', id, err);
        setFailure("Couldn't load this profile.");
      });
  }, [id, loadUserProfile]);

  const accent = profile?.posts[0]?.swatch.hex ?? T.surfaceHi;

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
        <View style={{ width: 26 }} />
      </View>

      {!profile && !failure ? (
        <View style={styles.center}>
          <ActivityIndicator color={T.text} />
        </View>
      ) : failure ? (
        <View style={styles.center}>
          <Text style={styles.failure}>{failure}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.identity}>
            <View style={[styles.avatar, { backgroundColor: accent }]}>
              <Text style={[styles.avatarText, { color: readableOn(hexToRgb(accent)) }]}>
                {profile!.name.slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.name}>@{profile!.name}</Text>
            <Text style={styles.stats}>{profile!.posts.length} posted</Text>
          </View>

          {profile!.posts.length === 0 ? (
            <Text style={styles.empty}>Nothing posted to the home feed yet.</Text>
          ) : (
            <View style={styles.posts}>
              {profile!.posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </View>
          )}
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

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  failure: { color: T.danger, fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },

  content: { paddingBottom: 40 },
  identity: { alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 30, fontWeight: '800' },
  name: { color: T.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  stats: { color: T.textFaint, fontSize: 13, marginTop: 6 },

  empty: { color: T.textFaint, fontSize: 14, lineHeight: 20, paddingHorizontal: 16, marginTop: 24 },
  posts: { paddingHorizontal: 16, marginTop: 24 },
});
