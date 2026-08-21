import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { hexToRgb, readableOn, rgbToHex, type RGB } from '@/lib/color';
import { loadSampler, type Sampler } from '@/lib/sampler';
import { useStore } from '@/lib/store';
import { T, radius } from '@/lib/theme';

const LOUPE_SIZE = 118;
const LOUPE_ZOOM = 3.4;
/** How far above the fingertip the loupe floats, so the thumb doesn't cover it. */
const LOUPE_LIFT = 30;
const MARKER_SIZE = 22;

type Photo = { uri: string; width: number; height: number };
type Probe = { x: number; y: number; rgb: RGB };
type NormPoint = { u: number; v: number };

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Same placement rule as the main pick screen — see pick.tsx for the reasoning. */
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

/** Per-channel distance from the target — 0 is a perfect match, 765 is the max possible. */
function channelDiff(target: RGB, picked: RGB) {
  const r = Math.round(Math.abs(target.r - picked.r));
  const g = Math.round(Math.abs(target.g - picked.g));
  const b = Math.round(Math.abs(target.b - picked.b));
  return { r, g, b, total: r + g + b };
}

/**
 * Photo-taking flow for one slot in the weekly palette: find something the
 * target color, photograph it, tap to sample it, and submit — scored
 * against the target by the server the moment it lands.
 */
export default function WeeklyCaptureScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { slot: slotParam, hex: hexParam } = useLocalSearchParams<{ slot: string; hex: string }>();
  const { submitWeekly } = useStore();

  const slot = Number(slotParam);
  const targetHex = (hexParam ?? '#888888').toUpperCase();
  const targetRgb = useMemo(() => hexToRgb(targetHex), [targetHex]);
  const targetInk = readableOn(targetRgb);

  const [photo, setPhoto] = useState<Photo | null>(null);
  const [sampler, setSampler] = useState<Sampler | null>(null);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const [probe, setProbe] = useState<Probe | null>(null);
  const probeRef = useRef<Probe | null>(null);
  const [picked, setPicked] = useState<RGB | null>(null);
  const [pickPoint, setPickPoint] = useState<NormPoint | null>(null);

  const [area, setArea] = useState({ width: 0, height: 0 });
  const [submitting, setSubmitting] = useState(false);

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

  const choosePhoto = async (source: 'camera' | 'library') => {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        source === 'camera' ? 'Camera access needed' : 'Photo access needed',
        'Enable it for ColorClaim in Settings to photograph a match.'
      );
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 1, exif: false })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    setPhoto({ uri: asset.uri, width: asset.width, height: asset.height });
    setSampler(null);
    setProbe(null);
    probeRef.current = null;
    setFailure(null);
    setPicked(null);
    setPickPoint(null);
    setLoading(true);

    try {
      setSampler(await loadSampler(asset.uri, asset.width, asset.height));
    } catch (err) {
      console.error('[weekly-capture] Failed to load sampler for', asset.uri, err);
      setFailure("Couldn't read that image. Try a different photo.");
    } finally {
      setLoading(false);
    }
  };

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

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setPicked(current.rgb);
    if (fitted) {
      setPickPoint({ u: clamp01(current.x / fitted.width), v: clamp01(current.y / fitted.height) });
    }
  };

  const onAreaLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setArea({ width, height });
  };

  const liveRgb = probe?.rgb ?? picked ?? undefined;
  const diff = liveRgb ? channelDiff(targetRgb, liveRgb) : null;

  const handleSubmit = async () => {
    if (!photo || !picked) return;
    setSubmitting(true);
    try {
      await submitWeekly({
        slot,
        photoUri: photo.uri,
        photoAspect: sampler?.aspect,
        pickPoint: pickPoint ?? undefined,
        pickedHex: rgbToHex(picked),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    } catch (err) {
      console.error('[weekly-capture] Failed to submit', err);
      setSubmitting(false);
      Alert.alert('Could not submit', 'Something went wrong saving that photo. Try again.');
    }
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

        <Text style={styles.topTitle}>Match this color</Text>

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

      <View style={styles.targetStrip}>
        <View style={[styles.targetSwatch, { backgroundColor: targetHex }]}>
          <Text style={[styles.targetHex, { color: targetInk }]}>{targetHex}</Text>
        </View>
      </View>

      {!photo ? (
        <View style={styles.chooser}>
          <Text style={styles.chooserTitle}>Find something this color</Text>
          <Text style={styles.chooserBody}>
            Take a picture of an object that matches, then press it in the photo to sample it.
          </Text>

          <View style={styles.chooserActions}>
            <Button label="Take a photo" onPress={() => choosePhoto('camera')} />
            <Button label="Choose from library" onPress={() => choosePhoto('library')} variant="ghost" />
          </View>
        </View>
      ) : (
        <>
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

                {!probe && picked && pickPoint && (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.marker,
                      {
                        left: pickPoint.u * fitted.width - MARKER_SIZE / 2,
                        top: pickPoint.v * fitted.height - MARKER_SIZE / 2,
                      },
                    ]}>
                    <View style={styles.markerRing}>
                      <View style={[styles.markerDot, { backgroundColor: rgbToHex(picked) }]} />
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>

          <View style={styles.panel}>
            <View style={styles.compareRow}>
              <View style={styles.compareItem}>
                <View style={[styles.compareSwatch, { backgroundColor: targetHex }]} />
                <Text style={styles.compareLabel}>Target</Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color={T.textFaint} style={styles.compareArrow} />
              <View style={styles.compareItem}>
                <View
                  style={[
                    styles.compareSwatch,
                    liveRgb ? { backgroundColor: rgbToHex(liveRgb) } : styles.compareSwatchEmpty,
                  ]}
                />
                <Text style={styles.compareLabel}>{liveRgb ? rgbToHex(liveRgb) : 'Tap the photo'}</Text>
              </View>
            </View>

            <Text style={styles.diffText}>
              {diff ? `R ${diff.r}  ·  G ${diff.g}  ·  B ${diff.b}  ·  Score ${diff.total}` : ' '}
            </Text>

            <Button
              label="Submit"
              onPress={handleSubmit}
              disabled={!picked || !!probe}
              busy={submitting}
              style={{ ...styles.submit, marginBottom: insets.bottom + 12 }}
            />
          </View>
        </>
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

  targetStrip: { alignItems: 'center', paddingBottom: 12 },
  targetSwatch: {
    height: 44,
    minWidth: 120,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  targetHex: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },

  chooser: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
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
    width: MARKER_SIZE - 7,
    height: MARKER_SIZE - 7,
    borderRadius: (MARKER_SIZE - 7) / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.15)',
  },

  panel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.border,
    backgroundColor: T.surface,
    paddingTop: 16,
  },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 16,
  },
  compareArrow: { marginTop: 14 },
  compareItem: { alignItems: 'center', gap: 6, width: 96 },
  compareSwatch: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  compareSwatchEmpty: { backgroundColor: T.surfaceHi, borderStyle: 'dashed', borderColor: T.border },
  compareLabel: { color: T.textFaint, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },

  diffText: {
    color: T.textDim,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 14,
    fontVariant: ['tabular-nums'],
  },

  submit: { marginHorizontal: 16, marginTop: 14 },
});
