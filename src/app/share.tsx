import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { T, radius } from '@/lib/theme';

const LOGO = require('@/assets/images/logo.png');

/**
 * A clean, chrome-free brand card — app name, logo, tagline — meant to be
 * screenshotted for store listings or social posts, typically as the last
 * shot after a few of the colors someone's actually claimed.
 */
export default function ShareScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [showWaitlist, setShowWaitlist] = useState(true);

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
        <Image source={LOGO} style={styles.logo} accessibilityLabel="Swatchy" />
        <Text style={styles.tagline}>Every color tells a story.{'\n'}Snap it, name it, claim it.</Text>
        {showWaitlist && (
          <Pressable
            onPress={() => setShowWaitlist(false)}
            accessibilityRole="button"
            accessibilityLabel="Join the waitlist at getswatchy.com. Tap to hide.">
            <Text style={styles.waitlist}>Join the waitlist at getswatchy.com</Text>
          </Pressable>
        )}
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

  logo: { width: 220, height: 220, borderRadius: 50, marginBottom: 36 },
  tagline: {
    color: T.textDim,
    fontSize: 17,
    lineHeight: 25,
    textAlign: 'center',
    marginTop: 16,
  },
  waitlist: {
    color: T.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
    textAlign: 'center',
    marginTop: 28,
  },
});
