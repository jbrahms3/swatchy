import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PostCard } from '@/components/PostCard';
import type { Post } from '@/lib/store';
import { T } from '@/lib/theme';

type Props = {
  post: Post | null;
  onClose: () => void;
  /**
   * Renders without its own <Modal> — a plain overlay instead — for when
   * this is opened from inside a screen that's already a Modal (e.g.
   * ArtworkDetailModal). A second native Modal nested inside a first one
   * doesn't reliably show or take touches. Also turns off the PostCard's
   * own "tap the photo for the full-screen detail" behavior, since that
   * opens a third Modal (PhotoDetailModal) that would have the same
   * problem one level deeper.
   */
  embedded?: boolean;
};

/**
 * Full-card view of a single color: the same PostCard rendering used
 * anywhere else, in a bottom sheet. Opened from the Discover grid, and
 * (embedded) from tapping a color chip in an expanded artwork.
 */
export function ColorDetailSheet({ post, onClose, embedded }: Props) {
  if (!post) return null;

  const content = (
    <>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Dismiss" />

      <View style={styles.sheetWrap} pointerEvents="box-none">
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={styles.close}>
            <Ionicons name="close" size={20} color={T.textDim} />
          </Pressable>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            bounces={false}>
            <PostCard post={post} photoOpensDetail={!embedded} />
          </ScrollView>
        </View>
      </View>
    </>
  );

  if (embedded) return <View style={styles.embeddedRoot}>{content}</View>;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      {content}
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Only used when embedded: fills whatever screen this is dropped into,
  // above its content, the way the Modal case would fill the window.
  embeddedRoot: { ...StyleSheet.absoluteFillObject, zIndex: 10, elevation: 10 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '86%',
    backgroundColor: T.bg,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    overflow: 'hidden',
  },
  grabber: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: T.border,
    alignSelf: 'center',
    marginBottom: 8,
  },
  close: {
    position: 'absolute',
    top: 14,
    right: 16,
    zIndex: 1,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.surfaceHi,
  },
  content: { padding: 16, paddingBottom: 28 },
});
