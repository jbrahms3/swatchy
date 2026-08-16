import { Pressable, StyleSheet, Text, View } from 'react-native';

import { T, radius } from '@/lib/theme';
import type { Swatch } from '@/lib/store';

type Props = {
  swatch: Swatch;
  size?: number;
  onPress?: () => void;
  /** Renders the hex under the name. Off in dense grids. */
  showHex?: boolean;
};

export function SwatchChip({ swatch, size = 92, onPress, showHex = true }: Props) {
  const body = (
    <View style={{ width: size }}>
      <View style={[styles.tile, { height: size, backgroundColor: swatch.hex }]} />
      <Text style={styles.name} numberOfLines={1}>
        {swatch.name}
      </Text>
      {showHex && <Text style={styles.hex}>{swatch.hex}</Text>}
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${swatch.name}, ${swatch.hex}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: '100%',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  name: {
    color: T.text,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  hex: {
    color: T.textFaint,
    fontSize: 11,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
});
