import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../../../design-system/components/ui/button';
import { Icon } from '../../../design-system/components/ui/icon';
import { Text } from '../../../design-system/components/ui/text';

/**
 * A sheet over the chat (the web research drawers): a header with the title
 * and a close button, scrolling content, and an optional pinned footer.
 * `fullScreen` covers the whole screen for longer workflows such as the
 * review; otherwise iOS shows a page sheet. `overlay` renders inside the
 * modal, so a second sheet can open on top of this one.
 */
export function DetailSheet({
  visible,
  title,
  closeLabel,
  onClose,
  fullScreen = false,
  footer,
  overlay,
  children,
}: {
  visible: boolean;
  title: string;
  closeLabel: string;
  onClose: () => void;
  fullScreen?: boolean;
  footer?: ReactNode;
  overlay?: ReactNode;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const topInset = fullScreen || Platform.OS === 'android' ? insets.top : 0;
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={fullScreen ? 'fullScreen' : 'pageSheet'}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        className="bg-background flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View
          className="border-border flex-row items-center justify-between gap-3 border-b py-2 pl-4 pr-2"
          style={{ paddingTop: topInset + 8 }}
        >
          <Text
            role="heading"
            numberOfLines={2}
            className="flex-1 text-lg font-semibold"
          >
            {title}
          </Text>
          <Button
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11"
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
            onPress={onClose}
          >
            <Icon as={X} className="text-foreground size-5" />
          </Button>
        </View>
        <ScrollView
          className="flex-1"
          contentContainerClassName="p-4 pb-8"
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
        {footer ? (
          <View
            className="border-border bg-background border-t px-4 pt-3"
            style={{ paddingBottom: Math.max(insets.bottom, 12) }}
          >
            {footer}
          </View>
        ) : null}
        {overlay}
      </KeyboardAvoidingView>
    </Modal>
  );
}
