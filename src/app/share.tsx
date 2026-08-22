import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { T, radius } from '@/lib/theme';

// The app's own signature swatches (already the de facto logomark on the
// auth screen and the claim-a-photo chooser) plus two more from the same
// family, so this card reads as a fuller version of the same identity.
const LOGO_COLORS = ['#E2574C', '#E8B04B', '#3F8F6F', '#2F6DB0', '#8A5FBF', '#C97A3D'];

/**
 * A clean, chrome-free brand card — app name, logo, tagline — meant to be
 * screenshotted for store listings or social posts, typically as the last
 * shot after a few of the colors someone's actually claimed.
 */
export default function ShareScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={[styles.close, { top: insets.top + 10 }]}>
        <Ionicons name="close" size={20} color={T.textDim} />
      </Pressable>

      <View style={styles.center}>
        <View style={styles.logo}>
          {LOGO_COLORS.map((hex) => (
            <View key={hex} style={[styles.bar, { backgroundColor: hex }]} />
          ))}
        </View>

        <Text style={styles.name}>Swatchy</Text>
        <Text style={styles.tagline}>Every color tells a story.{'\n'}Snap it, name it, claim it.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  close: {
    position: 'absolute',
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.surfaceHi,
    zIndex: 1,
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },

  logo: { flexDirection: 'row', gap: 10, marginBottom: 40 },
  bar: {
    width: 30,
    height: 92,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },

  name: {
    color: T.text,
    fontSize: 46,
    fontWeight: '800',
    letterSpacing: -1.2,
  },
  tagline: {
    color: T.textDim,
    fontSize: 17,
    lineHeight: 25,
    textAlign: 'center',
    marginTop: 16,
  },
});
