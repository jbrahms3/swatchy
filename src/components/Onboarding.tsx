import { Ionicons } from '@expo/vector-icons';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { useStore } from '@/lib/store';
import { T, radius } from '@/lib/theme';

const LOGO_COLORS = ['#E2574C', '#E8B04B', '#3F8F6F', '#2F6DB0', '#8A5FBF', '#C97A3D'];

type Slide = { title: string; body: string; art: ReactNode };

/** A soft radial-ish glow behind an illustration, tinted to that slide's accent. */
function Glow({ color }: { color: string }) {
  return (
    <View pointerEvents="none" style={styles.glowWrap}>
      <View style={[styles.glowOuter, { backgroundColor: color }]} />
      <View style={[styles.glowInner, { backgroundColor: color }]} />
    </View>
  );
}

// Uneven heights read as an equalizer/palette strip rather than a row of
// identical bricks — the same colors carry more energy for it.
const WELCOME_HEIGHTS = [44, 70, 52, 78, 40, 60];

function WelcomeArt() {
  return (
    <View style={styles.logoBars}>
      {LOGO_COLORS.map((hex, i) => (
        <View key={hex} style={[styles.logoBar, { backgroundColor: hex, height: WELCOME_HEIGHTS[i] }]} />
      ))}
    </View>
  );
}

function ClaimArt() {
  return (
    <View style={styles.artStack}>
      <Glow color="#E2574C" />
      <View style={styles.artPhoto}>
        {/* Stands in for a real photographed scene — two irregular fields of
            color, the way a subject actually breaks up a frame. */}
        <View style={[styles.artPhotoBlock, { backgroundColor: '#E8B04B', top: 0, left: 0, width: '58%', height: '62%' }]} />
        <View style={[styles.artPhotoBlock, { backgroundColor: '#3F8F6F', bottom: 0, right: 0, width: '52%', height: '58%' }]} />
        <View style={[styles.artMarker, { left: '60%', top: '36%' }]}>
          <View style={styles.artMarkerRing}>
            <View style={[styles.artMarkerDot, { backgroundColor: '#E2574C' }]} />
          </View>
        </View>
      </View>
    </View>
  );
}

function DiscoverArt() {
  return (
    <View style={styles.artStack}>
      <Glow color="#8A5FBF" />
      <View style={styles.artGrid}>
        {LOGO_COLORS.map((hex, i) => (
          <View
            key={hex}
            style={[styles.artTile, { backgroundColor: hex, height: i % 2 === 0 ? 46 : 34 }]}>
            {i === 1 && (
              <View style={styles.artTileHeart}>
                <Ionicons name="heart" size={10} color="#fff" />
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

function WeeklyArt() {
  return (
    <View style={styles.artStack}>
      <Glow color="#2F6DB0" />
      <View style={styles.artCard}>
        <View style={styles.artCompare}>
          <View style={styles.artCompareCol}>
            <View style={[styles.artCompareSwatch, { backgroundColor: '#2F6DB0' }]} />
            <Text style={styles.artCompareLabel}>Target</Text>
          </View>
          <Ionicons name="arrow-forward" size={16} color={T.textFaint} style={{ marginTop: -14 }} />
          <View style={styles.artCompareCol}>
            <View style={[styles.artCompareSwatch, { backgroundColor: '#3169A6' }]} />
            <Text style={styles.artCompareLabel}>Found</Text>
          </View>
        </View>
        <View style={styles.artScoreChip}>
          <Ionicons name="checkmark" size={12} color={T.bg} />
          <Text style={styles.artScoreText}>Score 14</Text>
        </View>
      </View>
    </View>
  );
}

function CollectionArt() {
  return (
    <View style={styles.artStack}>
      <Glow color="#3F8F6F" />
      <View style={styles.artCard}>
        <View style={styles.artSegmented}>
          {['Photos', 'Colors', 'Artwork'].map((label, i) => (
            <View key={label} style={[styles.artSegment, i === 1 && styles.artSegmentActive]}>
              <Text style={[styles.artSegmentText, i === 1 && styles.artSegmentTextActive]}>
                {label}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.artCollectionRow}>
          {['#E2574C', '#E8B04B', '#3F8F6F', '#2F6DB0'].map((hex) => (
            <View key={hex} style={[styles.artCollectionSwatch, { backgroundColor: hex }]} />
          ))}
        </View>
      </View>
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

  // A quick crossfade between slides instead of a hard cut — the content
  // still swaps instantly underneath, only the transition is animated.
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 240, useNativeDriver: true }).start();
  }, [step, fade]);

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
        <Animated.View style={[styles.fadeGroup, { opacity: fade }]}>
          <View style={styles.art}>{slide.art}</View>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.body}>{slide.body}</Text>
        </Animated.View>
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
  fadeGroup: { alignItems: 'center' },
  art: { height: 140, alignItems: 'center', justifyContent: 'center', marginBottom: 32 },

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

  // Shared: the soft glow sitting behind every illustration but Welcome's.
  artStack: { alignItems: 'center', justifyContent: 'center' },
  glowWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowOuter: { width: 200, height: 200, borderRadius: 100, opacity: 0.08 },
  glowInner: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    opacity: 0.14,
  },

  // Welcome
  logoBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 7 },
  logoBar: {
    width: 20,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },

  // Claim
  artPhoto: {
    width: 140,
    height: 104,
    borderRadius: radius.md,
    backgroundColor: T.surfaceHi,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    overflow: 'hidden',
  },
  artPhotoBlock: { position: 'absolute' },
  artMarker: {
    position: 'absolute',
    transform: [{ translateX: -17 }, { translateY: -17 }],
  },
  artMarkerRing: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  artMarkerDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.15)',
  },

  // Discover
  artGrid: { flexDirection: 'row', flexWrap: 'wrap', width: 140, gap: 7 },
  artTile: {
    width: 42,
    borderRadius: radius.sm,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    padding: 4,
  },
  artTileHeart: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Weekly + Collection share a small "card" surface
  artCard: {
    backgroundColor: T.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },

  // Weekly
  artCompare: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  artCompareCol: { alignItems: 'center', gap: 6 },
  artCompareSwatch: {
    width: 46,
    height: 46,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  artCompareLabel: { color: T.textFaint, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  artScoreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: T.text,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    height: 22,
  },
  artScoreText: { color: T.bg, fontSize: 11, fontWeight: '800', fontVariant: ['tabular-nums'] },

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
  artCollectionRow: { flexDirection: 'row', gap: 8 },
  artCollectionSwatch: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
});
