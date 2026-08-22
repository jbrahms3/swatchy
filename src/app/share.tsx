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
      {/* Invisible on purpose — this is a screenshot card, so no visible
          chrome, but the close tap target stays right where it looks like
          it'd be, for whoever's holding the phone. */}
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={[styles.close, { top: insets.top + 10 }]}
      />

      <View style={styles.center}>
        <View style={styles.logo}>
          {LOGO_COLORS.map((hex) => (
            <View key={hex} style={[styles.bar, { backgroundColor: hex }]} />
          ))}
        </View>

        <Text style={styles.name}>Swatchy</Text>
        <Text style={styles.tagline}>Every color tells a story.{'\n'}Snap it, name it, claim it.</Text>
        <Text style={styles.waitlist}>Join the waitlist at getswatchy.com</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  // Invisible — no background, no icon — but still sized and positioned
  // as a real tap target so the card stays chrome-free in screenshots.
  close: {
    position: 'absolute',
    right: 16,
    width: 36,
    height: 36,
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
  waitlist: {
    color: T.textFaint,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 28,
  },
});
