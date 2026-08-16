import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
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
  const { profile, myPosts, hasSamples, renameProfile, removeSaved, renameSaved, removeSamples } =
    useStore();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(profile.name);
  const [editing, setEditing] = useState<Swatch | null>(null);

  const chipSize = (width - GUTTER * 2 - 12 * (COLUMNS - 1)) / COLUMNS;
  const accent = profile.saved[0]?.hex ?? T.surfaceHi;

  const commitName = () => {
    renameProfile(draftName);
    setEditingName(false);
  };

  const confirmRemoveSamples = () => {
    Alert.alert('Remove sample posts?', 'The three seeded example posts will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: removeSamples },
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

        <Section title="My posts" />

        {myPosts.length === 0 ? (
          <Text style={styles.empty}>You haven’t posted to the home feed yet.</Text>
        ) : (
          <View style={styles.posts}>
            {myPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </View>
        )}

        {hasSamples && (
          <Pressable
            onPress={confirmRemoveSamples}
            accessibilityRole="button"
            style={({ pressed }) => [styles.samples, { opacity: pressed ? 0.6 : 1 }]}>
            <Text style={styles.samplesText}>Remove sample posts</Text>
          </Pressable>
        )}
      </ScrollView>

      <SwatchEditor
        swatch={editing}
        onClose={() => setEditing(null)}
        onSave={(name) => editing && renameSaved(editing.id, name)}
        onDelete={() => editing && removeSaved(editing.id)}
      />
    </>
  );
}

function Section({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {!!hint && <Text style={styles.sectionHint}>{hint}</Text>}
    </View>
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
  samples: { alignSelf: 'center', marginTop: 32, padding: 12 },
  samplesText: { color: T.danger, fontSize: 14, fontWeight: '600' },
});
