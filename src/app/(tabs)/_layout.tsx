import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { T, radius } from '@/lib/theme';

export default function TabsLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: T.text,
          tabBarInactiveTintColor: T.textFaint,
          tabBarStyle: {
            backgroundColor: T.surface,
            borderTopColor: T.border,
            borderTopWidth: StyleSheet.hairlineWidth,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          sceneStyle: { backgroundColor: T.bg },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="discover"
          options={{
            title: 'Discover',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="color-palette" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="weekly"
          options={{
            title: 'Weekly',
            tabBarIcon: ({ color, size }) => <Ionicons name="trophy" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
          }}
        />
      </Tabs>

      <Pressable
        onPress={() => router.push('/pick')}
        accessibilityRole="button"
        accessibilityLabel="Claim a color from a photo"
        style={({ pressed }) => [
          styles.fab,
          { bottom: insets.bottom + 66, opacity: pressed ? 0.85 : 1 },
        ]}>
        <Ionicons name="add" size={20} color={T.bg} />
        <Text style={styles.fabLabel}>Claim a color</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  fab: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 46,
    paddingHorizontal: 20,
    borderRadius: radius.pill,
    backgroundColor: T.text,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  fabLabel: { color: T.bg, fontSize: 15, fontWeight: '700' },
});
