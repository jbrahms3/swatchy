import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { T, radius } from '@/lib/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
};

type Flow = 'claim' | 'artwork';

const FLOW_COPY: Record<Flow, { title: string; permissionSubject: string }> = {
  claim: { title: 'Claim a color', permissionSubject: 'pick colors from a photo' },
  artwork: { title: 'Submit artwork', permissionSubject: 'upload artwork' },
};

/**
 * What the corner FAB opens. Two steps in one sheet, not a full-screen
 * navigation each time: first which kind of thing to create, then — since
 * both flows start the same way — where the photo comes from. Whichever
 * photo comes back is handed straight to /pick or /artwork-upload as
 * params, so neither of those screens has to ask again.
 */
export function CreateMenu({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [flow, setFlow] = useState<Flow | null>(null);
  const [picking, setPicking] = useState(false);

  const close = () => {
    setFlow(null);
    setPicking(false);
    onClose();
  };

  const pickAndGo = async (source: 'camera' | 'library') => {
    if (!flow || picking) return;
    setPicking(true);
    try {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          source === 'camera' ? 'Camera access needed' : 'Photo access needed',
          `Enable it for ColorClaim in Settings to ${FLOW_COPY[flow].permissionSubject}.`
        );
        return;
      }

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ quality: 1, exif: false })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const target = flow;
      close();
      router.push({
        pathname: target === 'claim' ? '/pick' : '/artwork-upload',
        params: {
          photoUri: asset.uri,
          photoWidth: String(asset.width),
          photoHeight: String(asset.height),
        },
      });
    } finally {
      setPicking(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable
        style={styles.backdrop}
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.grabber} />

        {flow === null ? (
          <>
            <Text style={styles.title}>What do you want to do?</Text>

            <MenuOption
              icon="color-palette-outline"
              label="Claim a color"
              body="Pick a photo and pull a color out of it."
              onPress={() => setFlow('claim')}
            />
            <MenuOption
              icon="brush-outline"
              label="Submit artwork"
              body="Share a piece and get it tagged with colors people know."
              onPress={() => setFlow('artwork')}
            />

            <Pressable
              onPress={close}
              accessibilityRole="button"
              style={({ pressed }) => [styles.cancel, { opacity: pressed ? 0.6 : 1 }]}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.stepHead}>
              <Pressable
                onPress={() => setFlow(null)}
                hitSlop={10}
                disabled={picking}
                accessibilityRole="button"
                accessibilityLabel="Back">
                <Ionicons name="chevron-back" size={20} color={picking ? T.textFaint : T.textDim} />
              </Pressable>
              <Text style={styles.title}>{FLOW_COPY[flow].title}</Text>
              <View style={{ width: 20 }} />
            </View>

            <MenuOption
              icon="camera-outline"
              label="Take a photo"
              body="Use the camera right now."
              onPress={() => pickAndGo('camera')}
              disabled={picking}
            />
            <MenuOption
              icon="images-outline"
              label="Choose from library"
              body="Pick something you've already got."
              onPress={() => pickAndGo('library')}
              disabled={picking}
            />

            {picking ? (
              <ActivityIndicator color={T.textDim} style={styles.spinner} />
            ) : (
              <Pressable
                onPress={close}
                accessibilityRole="button"
                style={({ pressed }) => [styles.cancel, { opacity: pressed ? 0.6 : 1 }]}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    </Modal>
  );
}

function MenuOption({
  icon,
  label,
  body,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  body: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.option, { opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }]}>
      <View style={styles.optionIcon}>
        <Ionicons name={icon} size={22} color={T.text} />
      </View>
      <View style={styles.optionText}>
        <Text style={styles.optionLabel}>{label}</Text>
        <Text style={styles.optionBody}>{body}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={T.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: T.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: T.border,
    marginBottom: 14,
  },
  title: { color: T.text, fontSize: 17, fontWeight: '800', marginBottom: 14 },

  stepHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
  },

  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  optionIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: T.surfaceHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: { flex: 1 },
  optionLabel: { color: T.text, fontSize: 15, fontWeight: '700' },
  optionBody: { color: T.textFaint, fontSize: 12, marginTop: 2, lineHeight: 16 },

  cancel: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  cancelText: { color: T.textDim, fontSize: 15, fontWeight: '600' },
  spinner: { marginTop: 14, marginBottom: 4 },
});
