import { useClerk } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PostCard } from '@/components/PostCard';
import { SwatchChip } from '@/components/SwatchChip';
import { SwatchEditor } from '@/components/SwatchEditor';
import { hexToRgb, readableOn } from '@/lib/color';
import { useStore, type Swatch } from '@/lib/store';
import { FAB_CLEARANCE, T, radius } from '@/lib/theme';

const GUTTER = 16;
const COLUMNS = 3;

export default function ProfileScreen() {
  const { profile, myPosts, renameProfile, removeSaved, renameSaved } = useStore();
  const { signOut } = useClerk();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(profile.name);
  const [editing, setEditing] = useState<Swatch | null>(null);
  const [postsView, setPostsView] = useState<'photos' | 'colors'>('photos');

  const chipSize = (width - GUTTER * 2 - 12 * (COLUMNS - 1)) / COLUMNS;
  const accent = profile.saved[0]?.hex ?? T.surfaceHi;

  const commitName = () => {
    setEditingName(false);
    if (draftName.trim() && draftName.trim() !== profile.name) {
      renameProfile(draftName).catch((err) => {
        console.error('[profile] Failed to rename', err);
        Alert.alert('Could not rename', 'Something went wrong. Try again.');
      });
    }
  };

  const confirmSignOut = () => {
    Alert.alert('Sign out?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <>
      <ScrollView
        style={styles.root}
        contentContainerStyle={{ paddingBottom: FAB_CLEARANCE, paddingTop: insets.top + 8 }}
        keyboardShouldPersistTaps="handled">
        <View style={styles.identity}>
          <View style={[styles.avatar, { backgroundColor: accent }]}>
            <Text style={[styles.avatarText, { color: readableOn(hexToRgb(accent)) }]}>
              {profile.name.slice(0, 1).toUpperCase()}
            </Text>
          </View>

          {editingName ? (
            <TextInput
              value={draftName}
              onChangeText={setDraftName}
              onBlur={commitName}
              onSubmitEditing={commitName}
              style={styles.nameInput}
              autoFocus
              selectTextOnFocus
              maxLength={24}
              returnKeyType="done"
            />
          ) : (
            <Pressable
              onPress={() => {
                setDraftName(profile.name);
                setEditingName(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Edit display name"
              style={styles.nameRow}>
              <Text style={styles.name}>{profile.name}</Text>
              <Ionicons name="pencil" size={15} color={T.textFaint} />
            </Pressable>
          )}

          <Text style={styles.stats}>
            {profile.saved.length} saved · {myPosts.length} posted
          </Text>

          <Pressable
            onPress={() => router.push('/share')}
            accessibilityRole="button"
            accessibilityLabel="Open the shareable brand card"
            style={({ pressed }) => [styles.shareLink, { opacity: pressed ? 0.6 : 1 }]}>
            <Ionicons name="image-outline" size={14} color={T.textDim} />
            <Text style={styles.shareLinkText}>Get a share card</Text>
          </Pressable>
        </View>

        <Section title="Saved colors" hint={profile.saved.length ? 'Tap to rename' : undefined} />

        {profile.saved.length === 0 ? (
          <Text style={styles.empty}>
            Colors you save while picking land here — they stay private unless you post them.
          </Text>
        ) : (
          <View style={styles.grid}>
            {profile.saved.map((s) => (
              <SwatchChip key={s.id} swatch={s} size={chipSize} onPress={() => setEditing(s)} />
            ))}
          </View>
        )}

        <Section
          title="My posts"
          right={
            myPosts.length > 0 ? (
              <View style={styles.segmented}>
                <SegmentButton
                  label="Photos"
                  active={postsView === 'photos'}
                  onPress={() => setPostsView('photos')}
                />
                <SegmentButton
                  label="Colors"
                  active={postsView === 'colors'}
                  onPress={() => setPostsView('colors')}
                />
              </View>
            ) : undefined
          }
        />

        {myPosts.length === 0 ? (
          <Text style={styles.empty}>You haven’t posted to the home feed yet.</Text>
        ) : postsView === 'photos' ? (
          <View style={styles.posts}>
            {myPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </View>
        ) : (
          <View style={styles.grid}>
            {myPosts.map((post) => (
              <SwatchChip key={post.id} swatch={post.swatch} size={chipSize} />
            ))}
          </View>
        )}

        <Pressable
          onPress={confirmSignOut}
          accessibilityRole="button"
          style={({ pressed }) => [styles.signOut, { opacity: pressed ? 0.6 : 1 }]}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>

      <SwatchEditor
        swatch={editing}
        onClose={() => setEditing(null)}
        onSave={(name) => editing && renameSaved(editing.id, name).catch(() => {})}
        onDelete={() => editing && removeSaved(editing.id).catch(() => {})}
      />
    </>
  );
}

function Section({ title, hint, right }: { title: string; hint?: string; right?: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {right ?? (!!hint && <Text style={styles.sectionHint}>{hint}</Text>)}
    </View>
  );
}

/** One pill in the Photos/Colors toggle above "My posts". */
function SegmentButton({
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
      style={[styles.segmentBtn, active && styles.segmentBtnActive]}>
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  identity: { paddingHorizontal: GUTTER, alignItems: 'center', paddingVertical: 12 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 30, fontWeight: '800' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  name: { color: T.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  nameInput: {
    color: T.text,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: T.border,
    minWidth: 180,
    paddingVertical: 2,
  },
  stats: { color: T.textFaint, fontSize: 13, marginTop: 6 },
  shareLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  shareLinkText: { color: T.textDim, fontSize: 13, fontWeight: '600' },

  section: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: GUTTER,
    marginTop: 30,
    marginBottom: 14,
  },
  sectionTitle: { color: T.text, fontSize: 18, fontWeight: '700' },
  sectionHint: { color: T.textFaint, fontSize: 12 },

  segmented: {
    flexDirection: 'row',
    backgroundColor: T.surfaceHi,
    borderRadius: radius.pill,
    padding: 3,
    gap: 2,
  },
  segmentBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.pill },
  segmentBtnActive: { backgroundColor: T.text },
  segmentText: { color: T.textDim, fontSize: 12, fontWeight: '700' },
  segmentTextActive: { color: T.bg },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: GUTTER,
  },
  posts: { paddingHorizontal: GUTTER },
  empty: {
    color: T.textFaint,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: GUTTER,
  },
  signOut: { alignSelf: 'center', marginTop: 32, padding: 12 },
  signOutText: { color: T.danger, fontSize: 14, fontWeight: '600' },
});
