import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { hexToRgb, readableOn } from '@/lib/color';
import { useStore, type WeeklyLeaderboardSlot } from '@/lib/store';
import { T, radius } from '@/lib/theme';

/**
 * Every weekly-challenge color, everyone who's matched it so far, closest
 * first — a straight ranking, not a social feed. Tapping a name jumps to
 * that person's public profile.
 */
export default function WeeklyLeaderboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loadWeeklyLeaderboard } = useStore();

  const [slots, setSlots] = useState<WeeklyLeaderboardSlot[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    loadWeeklyLeaderboard()
      .then(setSlots)
      .catch((err) => {
        console.error('[weekly-leaderboard] Failed to load', err);
        setFailure("Couldn't load the leaderboard. Try again later.");
      });
  }, [loadWeeklyLeaderboard]);

  const openProfile = (userId: string) => {
    router.push({ pathname: '/user/[id]', params: { id: userId } });
  };

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
        <Text style={styles.topTitle}>Leaderboard</Text>
        <View style={{ width: 26 }} />
      </View>

      {!slots && !failure ? (
        <View style={styles.center}>
          <ActivityIndicator color={T.text} />
        </View>
      ) : failure ? (
        <View style={styles.center}>
          <Text style={styles.failure}>{failure}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {slots!.map((slot) => (
            <SlotSection key={slot.slot} slot={slot} onPressUser={openProfile} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function SlotSection({
  slot,
  onPressUser,
}: {
  slot: WeeklyLeaderboardSlot;
  onPressUser: (userId: string) => void;
}) {
  const ink = readableOn(hexToRgb(slot.hex));

  return (
    <View style={styles.section}>
      <View style={[styles.slotHeader, { backgroundColor: slot.hex }]}>
        <Text style={[styles.slotHex, { color: ink }]}>{slot.hex}</Text>
      </View>

      {slot.entries.length === 0 ? (
        <Text style={styles.empty}>Nobody's matched this one yet.</Text>
      ) : (
        <View style={styles.list}>
          {slot.entries.map((entry, i) => (
            <Pressable
              key={entry.userId}
              onPress={() => onPressUser(entry.userId)}
              accessibilityRole="button"
              accessibilityLabel={`${entry.userName}, score ${entry.score}. View profile.`}
              style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
              <Text style={styles.rank}>{i + 1}</Text>
              <Text style={styles.name} numberOfLines={1}>
                {entry.userName}
              </Text>
              <Text style={styles.score}>{entry.score}</Text>
              <Ionicons name="chevron-forward" size={16} color={T.textFaint} />
            </Pressable>
          ))}
        </View>
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

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  failure: { color: T.danger, fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },

  content: { padding: 16, gap: 22 },
  section: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    overflow: 'hidden',
    backgroundColor: T.surface,
  },
  slotHeader: { height: 48, alignItems: 'center', justifyContent: 'center' },
  slotHex: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },

  empty: { color: T.textFaint, fontSize: 13, padding: 16 },
  list: { paddingVertical: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  rank: { color: T.textFaint, fontSize: 13, fontWeight: '700', width: 24, fontVariant: ['tabular-nums'] },
  name: { color: T.text, fontSize: 15, fontWeight: '600', flex: 1 },
  score: { color: T.textDim, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
