import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
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
import { useStore, type ArtworkColor } from '@/lib/store';
import { T, radius } from '@/lib/theme';

type Photo = { uri: string; width: number; height: number; aspect: number };

/**
 * Upload a piece of artwork and tag it with the colors — from your saved
 * palette or ones you've claimed via posts — that it actually uses.
 */
export default function ArtworkUploadScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, myPosts, publishArtwork } = useStore();

  const [photo, setPhoto] = useState<Photo | null>(null);
  const [selected, setSelected] = useState<ArtworkColor[]>([]);
  const [caption, setCaption] = useState('');
  const [posting, setPosting] = useState(false);

  // Everything the person has collected so far — saved swatches first, then
  // whatever they've claimed via posts, deduped so the same hex isn't offered twice.
  const collected = useMemo(() => {
    const all: ArtworkColor[] = [
      ...profile.saved.map((s) => ({ name: s.name, hex: s.hex })),
      ...myPosts.map((p) => ({ name: p.swatch.name, hex: p.swatch.hex })),
    ];
    const seen = new Set<string>();
    return all.filter((c) => {
      const key = c.hex.toUpperCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [profile.saved, myPosts]);

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
    setPhoto({
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
      aspect: asset.width && asset.height ? asset.width / asset.height : 1,
    });
  };

  const toggleColor = (color: ArtworkColor) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelected((current) => {
      const exists = current.some((c) => c.hex.toUpperCase() === color.hex.toUpperCase());
      return exists
        ? current.filter((c) => c.hex.toUpperCase() !== color.hex.toUpperCase())
        : [...current, color];
    });
  };

  const handleSubmit = async () => {
    if (!photo || selected.length === 0) return;
    setPosting(true);
    try {
      await publishArtwork({
        photoUri: photo.uri,
        photoAspect: photo.aspect,
        caption,
        colors: selected,
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
            {collected.slice(0, 4).map((c) => (
              <View key={c.hex} style={[styles.chooserSwatch, { backgroundColor: c.hex }]} />
            ))}
          </View>
          <Text style={styles.chooserTitle}>Show off what you made</Text>
          <Text style={styles.chooserBody}>
            Upload a photo of your artwork, then tag it with the colors from your collection
            that you used.
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
            <Text style={styles.panelLabel}>
              Colors used {selected.length > 0 ? `(${selected.length})` : ''}
            </Text>

            {collected.length === 0 ? (
              <Text style={styles.empty}>
                Save or claim a color first — then it'll show up here to tag your artwork with.
              </Text>
            ) : (
              <View style={styles.swatchWrap}>
                {collected.map((c) => (
                  <ColorToggle
                    key={c.hex}
                    color={c}
                    active={selected.some((s) => s.hex.toUpperCase() === c.hex.toUpperCase())}
                    onPress={() => toggleColor(c)}
                  />
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
              disabled={selected.length === 0}
              style={{ marginHorizontal: 16, marginTop: 14, marginBottom: insets.bottom + 12 }}
            />
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

function ColorToggle({
  color,
  active,
  onPress,
}: {
  color: ArtworkColor;
  active: boolean;
  onPress: () => void;
}) {
  const ink = readableOn(hexToRgb(color.hex));
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${color.name}, ${color.hex}${active ? ', selected' : ''}`}
      style={[styles.toggle, { backgroundColor: color.hex }, active && styles.toggleActive]}>
      {active && <Ionicons name="checkmark" size={16} color={ink} style={styles.toggleCheck} />}
      <Text style={[styles.toggleText, { color: ink }]} numberOfLines={1}>
        {color.name}
      </Text>
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
  panelLabel: {
    color: T.textFaint,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  empty: {
    color: T.textFaint,
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 16,
  },

  swatchWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: 'transparent',
    maxWidth: 160,
  },
  toggleActive: { borderColor: T.text },
  toggleCheck: { marginRight: 1 },
  toggleText: { fontSize: 13, fontWeight: '700' },

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
