import { Ionicons } from '@expo/vector-icons';
import { type ReactNode, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { useStore } from '@/lib/store';
import { T, radius } from '@/lib/theme';

const LOGO_COLORS = ['#E2574C', '#E8B04B', '#3F8F6F', '#2F6DB0', '#8A5FBF', '#C97A3D'];

type Slide = { title: string; body: string; art: ReactNode };

function WelcomeArt() {
  return (
    <View style={styles.logoBars}>
      {LOGO_COLORS.map((hex) => (
        <View key={hex} style={[styles.logoBar, { backgroundColor: hex }]} />
      ))}
    </View>
  );
}

function ClaimArt() {
  return (
    <View style={styles.artPhoto}>
      <View style={styles.artMarkerRing}>
        <View style={[styles.artMarkerDot, { backgroundColor: '#E2574C' }]} />
      </View>
    </View>
  );
}

function DiscoverArt() {
  return (
    <View style={styles.artGrid}>
      {LOGO_COLORS.map((hex) => (
        <View key={hex} style={[styles.artTile, { backgroundColor: hex }]} />
      ))}
    </View>
  );
}

function WeeklyArt() {
  return (
    <View style={styles.artCompare}>
      <View style={[styles.artCompareSwatch, { backgroundColor: '#2F6DB0' }]} />
      <Ionicons name="arrow-forward" size={20} color={T.textFaint} />
      <View style={[styles.artCompareSwatch, { backgroundColor: '#3169A6' }]} />
    </View>
  );
}

function CollectionArt() {
  return (
    <View style={styles.artSegmented}>
      {['Photos', 'Colors', 'Artwork'].map((label, i) => (
        <View key={label} style={[styles.artSegment, i === 1 && styles.artSegmentActive]}>
          <Text style={[styles.artSegmentText, i === 1 && styles.artSegmentTextActive]}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

const SLIDES: Slide[] = [
  {
    title: 'Swatchy',
    body: 'Every color tells a story. Snap it, name it, claim it.',
    art: <WelcomeArt />,
  },
  {
    title: 'Pull a color out of any photo',
    body: 'Take a picture or choose one from your library, then press and drag across it — lift your finger to claim the exact color underneath. Swatchy suggests a name; make it yours.',
    art: <ClaimArt />,
  },
  {
    title: 'See what everyone else has found',
    body: 'Discover is a wall of every color anyone has claimed. Like the ones you love, and press and hold any photo to see exactly where its color came from.',
    art: <DiscoverArt />,
  },
  {
    title: 'A new challenge every week',
    body: 'Every Monday, Swatchy hands out a new palette. Find something in the real world that matches one of its colors, photograph it, and see how close you got — scored channel by channel.',
    art: <WeeklyArt />,
  },
  {
    title: 'Build your collection',
    body: 'Saved colors, posted colors, and artwork made from them — it all lives on your profile.',
    art: <CollectionArt />,
  },
];

type Props = {
  /**
   * Called on "Skip" or the final "Get started". Defaults to marking the
   * account onboarded server-side — the real first-run behavior. Pass this
   * in (e.g. `router.back`) when reopening the flow just to preview it, so
   * a look-around from Profile doesn't touch that flag.
   */
  onFinish?: () => void;
};

/**
 * Shown once, right after sign-up, in place of the tabs — gated on
 * `profile.onboarded` (server-side, so it survives reinstalls but never
 * resurfaces for existing accounts; see ensureUser() in server/index.js).
 * Also reachable anytime from Profile as a preview, via /onboarding.
 */
export function Onboarding({ onFinish }: Props) {
  const { completeOnboarding } = useStore();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);

  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;
  const finish = onFinish ?? (() => completeOnboarding().catch(() => {}));

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Pressable
        onPress={finish}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Skip onboarding"
        style={styles.skip}>
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>

      <View style={styles.center}>
        <View style={styles.art}>{slide.art}</View>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View key={s.title} style={[styles.dot, i === step && styles.dotActive]} />
          ))}
        </View>
        <Button
          label={isLast ? 'Get started' : 'Next'}
          onPress={isLast ? finish : () => setStep((s) => s + 1)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  skip: { position: 'absolute', top: 0, right: 16, padding: 14, zIndex: 1 },
  skipText: { color: T.textFaint, fontSize: 14, fontWeight: '600' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 },
  art: { height: 110, alignItems: 'center', justifyContent: 'center', marginBottom: 36 },

  title: { color: T.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
  body: {
    color: T.textDim,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 14,
    maxWidth: 320,
  },

  footer: { paddingHorizontal: 24, gap: 20 },
  dots: { flexDirection: 'row', gap: 7, alignSelf: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: T.border },
  dotActive: { backgroundColor: T.text, width: 18 },

  // Welcome
  logoBars: { flexDirection: 'row', gap: 7 },
  logoBar: {
    width: 20,
    height: 68,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },

  // Claim
  artPhoto: {
    width: 130,
    height: 96,
    borderRadius: radius.md,
    backgroundColor: T.surfaceHi,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artMarkerRing: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  artMarkerDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.15)',
  },

  // Discover
  artGrid: { flexDirection: 'row', flexWrap: 'wrap', width: 130, gap: 7 },
  artTile: { width: 39, height: 39, borderRadius: radius.sm },

  // Weekly
  artCompare: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  artCompareSwatch: {
    width: 52,
    height: 52,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },

  // Collection
  artSegmented: {
    flexDirection: 'row',
    backgroundColor: T.surfaceHi,
    borderRadius: radius.pill,
    padding: 4,
    gap: 3,
  },
  artSegment: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill },
  artSegmentActive: { backgroundColor: T.text },
  artSegmentText: { color: T.textDim, fontSize: 13, fontWeight: '700' },
  artSegmentTextActive: { color: T.bg },
});
