import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { SwatchEditor } from '@/components/SwatchEditor';
import { describe, rgbToHex, suggestName, type RGB } from '@/lib/color';
import { loadSampler, type Sampler } from '@/lib/sampler';
import { newId, useStore, type Swatch } from '@/lib/store';
import { T, radius } from '@/lib/theme';

const LOUPE_SIZE = 118;
const LOUPE_ZOOM = 3.4;
/** How far above the fingertip the loupe floats, so the thumb doesn't cover it. */
const LOUPE_LIFT = 30;
/** Size of the marker left behind at the claimed spot once you lift your finger. */
const MARKER_SIZE = 26;

type Photo = { uri: string; width: number; height: number };
type Probe = { x: number; y: number; rgb: RGB };
/** Normalized (0–1) location within the photo — resolution-independent, so it
 *  survives into the saved post and still lines up when rendered at any size. */
type NormPoint = { u: number; v: number };

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Where to draw the loupe for a given touch point. Normally it floats above
 * the fingertip (thumbs reach up from the bottom of the screen, so "above"
 * clears them). Near the top edge there's no room for that — and flipping it
 * below would put it right back under the thumb — so instead it slides out to
 * whichever side has more clearance, staying roughly level with the touch.
 */
function loupePosition(
  touch: { x: number; y: number },
  area: { width: number; height: number }
): { left: number; top: number } {
  const spaceAbove = touch.y - LOUPE_SIZE - LOUPE_LIFT;

  if (spaceAbove >= 0) {
    return {
      left: Math.max(0, Math.min(area.width - LOUPE_SIZE, touch.x - LOUPE_SIZE / 2)),
      top: spaceAbove,
    };
  }

  const placeRight = area.width - touch.x >= touch.x;
  return {
    left: placeRight
      ? Math.min(area.width - LOUPE_SIZE, touch.x + LOUPE_LIFT)
      : Math.max(0, touch.x - LOUPE_SIZE - LOUPE_LIFT),
    top: Math.max(0, Math.min(area.height - LOUPE_SIZE, touch.y - LOUPE_SIZE / 2)),
  };
}

export default function PickScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { saveSwatch, publish } = useStore();
  // Set when arriving from the FAB's menu, which already picked a photo
  // itself — skips straight past the chooser below instead of asking again.
  const { photoUri, photoWidth, photoHeight } =
    useLocalSearchParams<{ photoUri?: string; photoWidth?: string; photoHeight?: string }>();

  const [photo, setPhoto] = useState<Photo | null>(null);
  const [sampler, setSampler] = useState<Sampler | null>(null);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  // Only one color can be claimed per photo — each release replaces this.
  const [swatch, setSwatch] = useState<Swatch | null>(null);
  const [editing, setEditing] = useState<Swatch | null>(null);
  // True only for the naming sheet that pops up right after a fresh claim —
  // tells SwatchEditor to start blank and require a name, instead of the
  // pre-filled behavior used when re-opening it later to rename.
  const [namingFreshClaim, setNamingFreshClaim] = useState(false);
  const [caption, setCaption] = useState('');
  const [saved, setSaved] = useState(false);
  const [posting, setPosting] = useState(false);

  const [probe, setProbe] = useState<Probe | null>(null);
  // The release handler needs the newest probe, and setState hasn't flushed yet.
  const probeRef = useRef<Probe | null>(null);
  // Where the current claim was picked from — carried into the post so its
  // marker can be rendered on the feed too, not just here.
  const [pickPoint, setPickPoint] = useState<NormPoint | null>(null);

  const [area, setArea] = useState({ width: 0, height: 0 });

  /** Photo drawn at its true aspect inside the available area, so taps map 1:1. */
  const fitted = useMemo(() => {
    if (!sampler || !area.width || !area.height) return null;
    let width = area.width;
    let height = width / sampler.aspect;
    if (height > area.height) {
      height = area.height;
      width = height * sampler.aspect;
    }
    return { width, height };
  }, [sampler, area]);

  /* ---------------------------------------------------------------- */

  /** Loads a photo from wherever it came from — the chooser below, or the FAB's own picker. */
  const loadPhoto = async (uri: string, width: number, height: number) => {
    setPhoto({ uri, width, height });
    setSampler(null);
    setProbe(null);
    probeRef.current = null;
    setFailure(null);
    setSwatch(null); // a new photo means the old claim no longer applies
    setPickPoint(null);
    setSaved(false);
    setLoading(true);

    try {
      setSampler(await loadSampler(uri, width, height));
    } catch (err) {
      // Surfaced in Metro/device logs — the on-screen message stays generic,
      // but this is what to check first when that message shows up.
      console.error('[ColorClaim] Failed to load sampler for', uri, err);
      setFailure("Couldn't read that image. Try a different photo.");
    } finally {
      setLoading(false);
    }
  };

  const choosePhoto = async (source: 'camera' | 'library') => {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        source === 'camera' ? 'Camera access needed' : 'Photo access needed',
        'Enable it for ColorClaim in Settings to pick colors from a photo.'
      );
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 1, exif: false })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    await loadPhoto(asset.uri, asset.width, asset.height);
  };

  // A photo already picked by the FAB's menu arrives as params — load it
  // once on mount instead of showing the chooser and asking again.
  useEffect(() => {
    if (photoUri) loadPhoto(photoUri, Number(photoWidth), Number(photoHeight));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trackTouch = (event: GestureResponderEvent) => {
    if (!sampler || !fitted) return;
    const { locationX, locationY } = event.nativeEvent;

    const next: Probe = {
      x: Math.max(0, Math.min(fitted.width, locationX)),
      y: Math.max(0, Math.min(fitted.height, locationY)),
      rgb: sampler.sampleAt(clamp01(locationX / fitted.width), clamp01(locationY / fitted.height)),
    };

    probeRef.current = next;
    setProbe(next);
  };

  const commitTouch = () => {
    const current = probeRef.current;
    probeRef.current = null;
    setProbe(null);
    if (!current) return;

    // Only one claim per photo — every release replaces it, so you can keep
    // re-picking spots until you land on the one you want.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const claimed: Swatch = {
      id: newId(),
      // Fallback only, used if the naming sheet gets dismissed without
      // typing anything — never shown pre-filled in the sheet itself.
      name: suggestName(current.rgb),
      hex: rgbToHex(current.rgb),
      createdAt: Date.now(),
      artworkCount: 0, // brand new — nothing's tagged it yet
    };
    setSwatch(claimed);
    if (fitted) {
      setPickPoint({ u: clamp01(current.x / fitted.width), v: clamp01(current.y / fitted.height) });
    }
    setSaved(false);
    // Naming is the next required step, not an optional tweak on a name
    // nobody chose — open the sheet immediately, blank.
    setNamingFreshClaim(true);
    setEditing(claimed);
  };

  const onAreaLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setArea({ width, height });
  };

  const handleSave = async () => {
    if (!swatch) return;
    try {
      await saveSwatch(swatch);
      setSaved(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err) {
      console.error('[pick] Failed to save swatch', err);
      Alert.alert('Could not save', 'Something went wrong. Try again.');
    }
  };

  const handlePost = async () => {
    if (!swatch) return;
    setPosting(true);
    try {
      await publish({
        photoUri: photo?.uri,
        photoAspect: sampler?.aspect,
        pickPoint: pickPoint ?? undefined,
        swatch,
        caption,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    } catch {
      setPosting(false);
      Alert.alert('Could not post', 'Something went wrong saving that post. Try again.');
    }
  };

  /* ---------------------------------------------------------------- */

  const live = probe?.rgb;
  const accent = swatch?.hex;

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

        <Text style={styles.topTitle}>{photo ? 'Press to claim' : 'New claim'}</Text>

        {photo ? (
          <Pressable
            onPress={() => choosePhoto('library')}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Change photo">
            <Ionicons name="images-outline" size={22} color={T.textDim} />
          </Pressable>
        ) : (
          <View style={{ width: 26 }} />
        )}
      </View>

      {!photo ? (
        <View style={styles.chooser}>
          <View style={styles.chooserArt}>
            {['#E2574C', '#E8B04B', '#3F8F6F', '#2F6DB0'].map((hex) => (
              <View key={hex} style={[styles.chooserSwatch, { backgroundColor: hex }]} />
            ))}
          </View>
          <Text style={styles.chooserTitle}>Pull a color out of a photo</Text>
          <Text style={styles.chooserBody}>
            Take a picture or pick one from your library, then press anywhere on it.
          </Text>

          <View style={styles.chooserActions}>
            <Button label="Take a photo" onPress={() => choosePhoto('camera')} />
            <Button label="Choose from library" onPress={() => choosePhoto('library')} variant="ghost" />
          </View>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={insets.top + 8}>
          <View style={styles.stage} onLayout={onAreaLayout}>
            {loading && (
              <View style={styles.stageCenter}>
                <ActivityIndicator color={T.text} />
                <Text style={styles.stageNote}>Reading pixels…</Text>
              </View>
            )}

            {failure && (
              <View style={styles.stageCenter}>
                <Text style={styles.stageError}>{failure}</Text>
              </View>
            )}

            {fitted && !loading && !failure && (
              <View
                style={[styles.photoWrap, fitted]}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderGrant={trackTouch}
                onResponderMove={trackTouch}
                onResponderRelease={commitTouch}
                onResponderTerminate={commitTouch}>
                <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="fill" />

                {probe && (
                  <>
                    <View pointerEvents="none" style={[styles.loupe, loupePosition(probe, fitted)]}>
                      <Image
                        source={{ uri: photo.uri }}
                        contentFit="fill"
                        style={{
                          position: 'absolute',
                          width: fitted.width * LOUPE_ZOOM,
                          height: fitted.height * LOUPE_ZOOM,
                          left: -(probe.x * LOUPE_ZOOM - LOUPE_SIZE / 2),
                          top: -(probe.y * LOUPE_ZOOM - LOUPE_SIZE / 2),
                        }}
                      />
                      <View style={styles.reticle} />
                    </View>

                    <View
                      pointerEvents="none"
                      style={[
                        styles.pin,
                        { left: probe.x - 11, top: probe.y - 11, backgroundColor: rgbToHex(probe.rgb) },
                      ]}
                    />
                  </>
                )}

                {/* Left behind once you lift your finger, so the claim stays anchored to its spot. */}
                {!probe && swatch && pickPoint && (
                  <Pressable
                    onPress={() => {
                      setNamingFreshClaim(false);
                      setEditing(swatch);
                    }}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={`Claimed from this spot: ${swatch.name}. Tap to rename.`}
                    style={[
                      styles.marker,
                      {
                        left: pickPoint.u * fitted.width - MARKER_SIZE / 2,
                        top: pickPoint.v * fitted.height - MARKER_SIZE / 2,
                      },
                    ]}>
                    <View style={styles.markerRing}>
                      <View style={[styles.markerDot, { backgroundColor: swatch.hex }]} />
                    </View>
                  </Pressable>
                )}
              </View>
            )}
          </View>

          <View style={styles.panel}>
            <Pressable
              disabled={!swatch || !!probe}
              onPress={() => {
                if (!swatch) return;
                setNamingFreshClaim(false);
                setEditing(swatch);
              }}
              style={styles.readout}>
              {live ? (
                <>
                  <View style={[styles.readoutDot, { backgroundColor: rgbToHex(live) }]} />
                  <View style={styles.flex}>
                    <Text style={styles.readoutHex}>{rgbToHex(live)}</Text>
                    <Text style={styles.readoutName}>
                      {suggestName(live)} · {describe(live)}
                    </Text>
                  </View>
                </>
              ) : swatch ? (
                <>
                  <View style={[styles.readoutDot, { backgroundColor: swatch.hex }]} />
                  <View style={styles.flex}>
                    <Text style={styles.readoutHex}>{swatch.hex}</Text>
                    <Text style={styles.readoutName}>{swatch.name} · tap to rename</Text>
                  </View>
                  <Ionicons name="pencil" size={16} color={T.textFaint} />
                </>
              ) : (
                <Text style={styles.readoutHint}>
                  Press and drag on the photo, then lift to claim its color.
                </Text>
              )}
            </Pressable>

            {swatch && (
              <TextInput
                value={caption}
                onChangeText={setCaption}
                placeholder="Say something about this color…"
                placeholderTextColor={T.textFaint}
                style={styles.caption}
                maxLength={140}
              />
            )}

            <View style={[styles.actions, { paddingBottom: insets.bottom + 12 }]}>
              <Button
                label={saved ? 'Saved ✓' : 'Save to profile'}
                onPress={handleSave}
                variant="ghost"
                disabled={!swatch || saved}
                style={styles.flex}
              />
              <Button
                label="Post to home"
                onPress={handlePost}
                variant={accent ? 'tinted' : 'primary'}
                tint={accent}
                busy={posting}
                disabled={!swatch}
                style={styles.flex}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      )}

      <SwatchEditor
        swatch={editing}
        startBlank={namingFreshClaim}
        onClose={() => {
          setEditing(null);
          setNamingFreshClaim(false);
        }}
        onSave={(name) => setSwatch((s) => (s && s.id === editing?.id ? { ...s, name } : s))}
        onDelete={() => {
          setSwatch((s) => (s && s.id === editing?.id ? null : s));
          setPickPoint(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  flex: { flex: 1 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 52,
  },
  topTitle: { color: T.text, fontSize: 16, fontWeight: '700' },

  chooser: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  chooserArt: { flexDirection: 'row', gap: 8, marginBottom: 28 },
  chooserSwatch: { width: 42, height: 62, borderRadius: radius.sm },
  chooserTitle: { color: T.text, fontSize: 21, fontWeight: '800', textAlign: 'center' },
  chooserBody: {
    color: T.textFaint,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
  },
  chooserActions: { alignSelf: 'stretch', gap: 12, marginTop: 32 },

  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 12 },
  stageCenter: { alignItems: 'center', gap: 10 },
  stageNote: { color: T.textFaint, fontSize: 13 },
  stageError: { color: T.danger, fontSize: 14, textAlign: 'center' },

  photoWrap: {
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: T.surfaceHi,
  },
  loupe: {
    position: 'absolute',
    width: LOUPE_SIZE,
    height: LOUPE_SIZE,
    borderRadius: LOUPE_SIZE / 2,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
    backgroundColor: T.surfaceHi,
  },
  reticle: {
    position: 'absolute',
    left: LOUPE_SIZE / 2 - 9,
    top: LOUPE_SIZE / 2 - 9,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.95)',
  },
  pin: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  marker: {
    position: 'absolute',
    width: MARKER_SIZE,
    height: MARKER_SIZE,
  },
  markerRing: {
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    borderRadius: MARKER_SIZE / 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },
  markerDot: {
    width: MARKER_SIZE - 9,
    height: MARKER_SIZE - 9,
    borderRadius: (MARKER_SIZE - 9) / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.15)',
  },

  panel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.border,
    backgroundColor: T.surface,
  },
  readout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    minHeight: 58,
  },
  readoutDot: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  readoutHex: { color: T.text, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  readoutName: { color: T.textFaint, fontSize: 12, marginTop: 1 },
  readoutHint: { color: T.textFaint, fontSize: 13, lineHeight: 18, flex: 1 },

  caption: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: T.surfaceHi,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    color: T.text,
    fontSize: 15,
    paddingHorizontal: 14,
    height: 46,
  },
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 14 },
});
