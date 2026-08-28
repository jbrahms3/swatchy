import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { T, radius } from '@/lib/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onClaimColor: () => void;
  onSubmitArtwork: () => void;
};

/**
 * What the corner FAB opens: a bottom sheet asking which kind of thing to
 * create, since it now covers two different flows instead of jumping
 * straight into one.
 */
export function CreateMenu({ visible, onClose, onClaimColor, onSubmitArtwork }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.grabber} />
        <Text style={styles.title}>What do you want to do?</Text>

        <MenuOption
          icon="color-palette-outline"
          label="Claim a color"
          body="Pick a photo and pull a color out of it."
          onPress={onClaimColor}
        />
        <MenuOption
          icon="brush-outline"
          label="Submit artwork"
          body="Share a piece and get it tagged with colors people know."
          onPress={onSubmitArtwork}
        />

        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          style={({ pressed }) => [styles.cancel, { opacity: pressed ? 0.6 : 1 }]}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function MenuOption({
  icon,
  label,
  body,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  body: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.option, { opacity: pressed ? 0.7 : 1 }]}>
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
});
