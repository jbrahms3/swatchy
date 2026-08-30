import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { hexToRgb, readableOn } from '@/lib/color';
import { matchCatalogColorsFromUri } from '@/lib/colorExtract';
import { useStore, type ArtworkColor } from '@/lib/store';
import { T, radius } from '@/lib/theme';

type Photo = { uri: string; width: number; height: number; aspect: number };

/**
 * Upload a piece of artwork. The colors it's tagged with aren't picked by
 * hand — as soon as a photo is chosen, it's matched against the catalog of
 * colors people have already saved or claimed (see matchCatalogColors()),
 * and whichever of those actually show up in the photo get posted. A
 * matched chip can still be removed if it's obviously wrong.
 */
export default function ArtworkUploadScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loadColorCatalog, publishArtwork } = useStore();
  // Set when arriving from the FAB's menu, which already picked a photo
  // itself — skips straight past the chooser below instead of asking again.
  const { photoUri, photoWidth, photoHeight } =
    useLocalSearchParams<{ photoUri?: string; photoWidth?: string; photoHeight?: string }>();

  const [photo, setPhoto] = useState<Photo | null>(null);
  const [colors, setColors] = useState<ArtworkColor[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState(false);
  const [caption, setCaption] = useState('');
  const [posting, setPosting] = useState(false);

  const detect = async (target: Photo) => {
    setDetecting(true);
    setDetectError(false);
    try {
      const catalog = await loadColorCatalog();
      const found = await matchCatalogColorsFromUri(target.uri, catalog, target.width, target.height);
      setColors(found);
    } catch (err) {
      console.error('[artwork-upload] Failed to detect colors', err);
      setColors([]);
      setDetectError(true);
    } finally {
      setDetecting(false);
    }
  };

  useEffect(() => {
    if (photo) detect(photo).catch(() => {});
    // detect() is stable enough for this — re-running it is keyed off the photo, not identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo?.uri]);

  /** Loads a photo from wherever it came from — the chooser below, or the FAB's own picker. */
  const loadPhoto = (uri: string, width: number, height: number) => {
    setPhoto({ uri, width, height, aspect: width && height ? width / height : 1 });
  };

  const choosePhoto = async (source: 'camera' | 'library') => {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        source === 'camera' ? 'Camera access needed' : 'Photo access needed',
        'Enable it for ColorClaim in Settings to upload artwork.'
      );
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 1, exif: false })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    loadPhoto(asset.uri, asset.width, asset.height);
  };

  // A photo already picked by the FAB's menu arrives as params — load it
  // once on mount instead of showing the chooser and asking again.
  useEffect(() => {
    if (photoUri) loadPhoto(photoUri, Number(photoWidth), Number(photoHeight));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removeColor = (hex: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setColors((current) => current.filter((c) => c.hex.toUpperCase() !== hex.toUpperCase()));
  };

  const handleSubmit = async () => {
    if (!photo || colors.length === 0) return;
    setPosting(true);
    try {
      await publishArtwork({
        photoUri: photo.uri,
        photoAspect: photo.aspect,
        caption,
        colors,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    } catch (err) {
      console.error('[artwork-upload] Failed to publish', err);
      setPosting(false);
      Alert.alert('Could not upload', 'Something went wrong saving that artwork. Try again.');
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

        <Text style={styles.topTitle}>Upload artwork</Text>

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
            {['#F2B441', '#E8654E', '#5CA4A9', '#8A6FD1'].map((hex) => (
              <View key={hex} style={[styles.chooserSwatch, { backgroundColor: hex }]} />
            ))}
          </View>
          <Text style={styles.chooserTitle}>Show off what you made</Text>
          <Text style={styles.chooserBody}>
            Upload a photo of your artwork — it gets tagged automatically with any colors from
            the community palette that show up in it.
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
          <View style={styles.stage}>
            <View style={[styles.photoWrap, { aspectRatio: photo.aspect }]}>
              <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            </View>
          </View>

          <View style={styles.panel}>
            <View style={styles.panelHead}>
              <Text style={styles.panelLabel}>
                Matched colors {colors.length > 0 ? `(${colors.length})` : ''}
              </Text>
              {detecting && <ActivityIndicator size="small" color={T.textDim} />}
            </View>

            {detecting ? (
              <Text style={styles.empty}>Checking against the community palette…</Text>
            ) : detectError ? (
              <>
                <Text style={styles.empty}>Couldn't read colors from that photo.</Text>
                <Pressable
                  onPress={() => photo && detect(photo)}
                  accessibilityRole="button"
                  accessibilityLabel="Retry color detection"
                  style={({ pressed }) => [styles.retry, { opacity: pressed ? 0.6 : 1 }]}>
                  <Ionicons name="refresh" size={14} color={T.textDim} />
                  <Text style={styles.retryText}>Try again</Text>
                </Pressable>
              </>
            ) : colors.length === 0 ? (
              <Text style={styles.empty}>
                None of the community's existing colors showed up in that photo.
              </Text>
            ) : (
              <View style={styles.swatchWrap}>
                {colors.map((c) => (
                  <ColorChip key={c.hex} color={c} onRemove={() => removeColor(c.hex)} />
                ))}
              </View>
            )}

            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="Say something about this piece…"
              placeholderTextColor={T.textFaint}
              style={styles.caption}
              maxLength={140}
            />

            <Button
              label="Upload artwork"
              onPress={handleSubmit}
              busy={posting}
              disabled={colors.length === 0 || detecting}
              style={{ marginHorizontal: 16, marginTop: 14, marginBottom: insets.bottom + 12 }}
            />
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

function ColorChip({ color, onRemove }: { color: ArtworkColor; onRemove: () => void }) {
  const ink = readableOn(hexToRgb(color.hex));
  return (
    <Pressable
      onPress={onRemove}
      accessibilityRole="button"
      accessibilityLabel={`${color.name}, ${color.hex}. Tap to remove.`}
      style={[styles.chip, { backgroundColor: color.hex }]}>
      <Text style={[styles.chipText, { color: ink }]} numberOfLines={1}>
        {color.name}
      </Text>
      <Ionicons name="close" size={13} color={ink} />
    </Pressable>
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
  chooserArt: { flexDirection: 'row', gap: 8, marginBottom: 28, minHeight: 62 },
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
  photoWrap: {
    width: '100%',
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: T.surfaceHi,
  },

  panel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.border,
    backgroundColor: T.surface,
    paddingTop: 14,
  },
  panelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  panelLabel: {
    color: T.textFaint,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  empty: {
    color: T.textFaint,
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 16,
  },
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  retryText: { color: T.textDim, fontSize: 13, fontWeight: '600' },

  swatchWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
    maxWidth: 160,
  },
  chipText: { fontSize: 13, fontWeight: '700' },

  caption: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: T.surfaceHi,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    color: T.text,
    fontSize: 15,
    paddingHorizontal: 14,
    height: 46,
  },
});
