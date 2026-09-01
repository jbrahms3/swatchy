import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import { describe, hexToRgb, readableOn, rgbToHsl } from '@/lib/color';
import type { Swatch } from '@/lib/store';
import { T, radius } from '@/lib/theme';

type Props = {
  swatch: Swatch | null;
  onClose: () => void;
  onSave: (name: string) => void;
  onDelete?: () => void;
  /** True right after a fresh pick: starts the field blank instead of
   *  pre-filled with the suggested name, and won't let it through until
   *  something's actually typed — naming is the point, not a formality on
   *  a name nobody chose. */
  startBlank?: boolean;
};

/** Bottom sheet for naming a single color. Shared by the picker and the profile. */
export function SwatchEditor({ swatch, onClose, onSave, onDelete, startBlank }: Props) {
  const [name, setName] = useState('');

  // Reset the field each time a different swatch opens the sheet.
  useEffect(() => {
    if (swatch) setName(startBlank ? '' : swatch.name);
  }, [swatch, startBlank]);

  if (!swatch) return null;

  const rgb = hexToRgb(swatch.hex);
  const { h, s, l } = rgbToHsl(rgb);
  const ink = readableOn(rgb);
  const trimmed = name.trim();
  const canCommit = !startBlank || trimmed.length > 0;

  const commit = () => {
    if (!canCommit) return;
    onSave(trimmed || swatch.name);
    onClose();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Dismiss" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetWrap}>
        <View style={styles.sheet}>
          <View style={styles.grabber} />

          <View style={[styles.preview, { backgroundColor: swatch.hex }]}>
            <Text style={[styles.previewHex, { color: ink }]}>{swatch.hex}</Text>
            <Text style={[styles.previewMeta, { color: ink }]}>
              {describe(rgb)} · hsl({h}, {s}%, {l}%)
            </Text>
          </View>

          <Text style={styles.label}>Name this color</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={startBlank ? 'What do you call this?' : 'e.g. Fire Escape Rust'}
            placeholderTextColor={T.textFaint}
            style={styles.input}
            autoFocus
            selectTextOnFocus
            returnKeyType="done"
            onSubmitEditing={commit}
            maxLength={40}
          />

          <View style={styles.row}>
            {onDelete && (
              <Pressable
                onPress={() => {
                  onDelete();
                  onClose();
                }}
                accessibilityRole="button"
                style={({ pressed }) => [styles.delete, { opacity: pressed ? 0.6 : 1 }]}>
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            )}
            <Button
              label="Done"
              onPress={commit}
              tint={swatch.hex}
              variant="tinted"
              style={styles.done}
              disabled={!canCommit}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: T.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
    paddingBottom: 36,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
  },
  grabber: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: T.border,
    alignSelf: 'center',
    marginBottom: 18,
  },
  preview: {
    height: 96,
    borderRadius: radius.md,
    justifyContent: 'flex-end',
    padding: 14,
  },
  previewHex: { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  previewMeta: { fontSize: 12, opacity: 0.8, marginTop: 2 },

  label: { color: T.textDim, fontSize: 13, fontWeight: '600', marginTop: 20, marginBottom: 8 },
  input: {
    backgroundColor: T.surfaceHi,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    color: T.text,
    fontSize: 17,
    paddingHorizontal: 14,
    height: 50,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20 },
  delete: { paddingHorizontal: 18, height: 50, justifyContent: 'center' },
  deleteText: { color: T.danger, fontSize: 16, fontWeight: '600' },
  done: { flex: 1 },
});
