import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { readableOn, hexToRgb } from '@/lib/color';
import { T, radius } from '@/lib/theme';

type Props = {
  label: string;
  onPress: () => void;
  /** `tinted` paints the button in `tint` and picks readable text for it. */
  variant?: 'primary' | 'tinted' | 'ghost';
  tint?: string;
  disabled?: boolean;
  busy?: boolean;
  style?: ViewStyle;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  tint,
  disabled,
  busy,
  style,
}: Props) {
  const inactive = disabled || busy;

  let background: string = T.text;
  let foreground: string = T.bg;

  if (variant === 'ghost') {
    background = 'transparent';
    foreground = T.text;
  } else if (variant === 'tinted' && tint) {
    background = tint;
    foreground = readableOn(hexToRgb(tint));
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive }}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: background, opacity: inactive ? 0.4 : pressed ? 0.75 : 1 },
        variant === 'ghost' && styles.ghost,
        style,
      ]}>
      {busy ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <Text style={[styles.label, { color: foreground }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  ghost: {
    borderWidth: 1,
    borderColor: T.border,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
