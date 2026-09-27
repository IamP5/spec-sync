import type { ReactNode } from 'react';
import { Modal, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * A sheet that slides over the chat: a page sheet below the status bar on
 * iOS. Android ignores page sheets and draws the modal edge to edge, so
 * there the content keeps clear of the status and navigation bars itself.
 */
export function PageSheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        className="bg-background flex-1"
        style={
          Platform.OS === 'android'
            ? { paddingTop: insets.top, paddingBottom: insets.bottom }
            : undefined
        }
      >
        {children}
      </View>
    </Modal>
  );
}
