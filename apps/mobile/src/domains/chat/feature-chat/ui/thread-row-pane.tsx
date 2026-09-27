import { Check, Pencil, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '../../../../design-system/components/ui/button';
import { Icon } from '../../../../design-system/components/ui/icon';
import { Input } from '../../../../design-system/components/ui/input';
import { Text } from '../../../../design-system/components/ui/text';
import { cn } from '../../../../design-system/lib/utils';
import { MAX_TITLE_LENGTH } from '../../data/thread';

/**
 * One conversation in the chat list: tap to open, rename in place, delete.
 * The rename field commits on submit and cancels with the close button.
 */
export function ThreadRowPane({
  title,
  active,
  renaming,
  disabled,
  onOpen,
  onStartRename,
  onRename,
  onCancelRename,
  onDelete,
}: {
  title: string;
  active: boolean;
  renaming: boolean;
  disabled: boolean;
  onOpen: () => void;
  onStartRename: () => void;
  onRename: (title: string) => void;
  onCancelRename: () => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(title);

  if (renaming) {
    return (
      <View className="flex-row items-center gap-1 px-1 py-1">
        <Input
          value={draft}
          onChangeText={setDraft}
          autoFocus
          maxLength={MAX_TITLE_LENGTH}
          onSubmitEditing={() => onRename(draft)}
          accessibilityLabel="Conversation title"
          returnKeyType="done"
          className="min-h-11 flex-1"
        />
        <Button
          variant="ghost"
          size="icon"
          className="size-11"
          onPress={() => onRename(draft)}
          accessibilityLabel="Save title"
        >
          <Icon as={Check} className="text-foreground size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-11"
          onPress={() => {
            setDraft(title);
            onCancelRename();
          }}
          accessibilityLabel="Cancel renaming"
        >
          <Icon as={X} className="text-foreground size-4" />
        </Button>
      </View>
    );
  }

  return (
    <View
      className={cn('flex-row items-center rounded-lg', active && 'bg-accent')}
    >
      <Pressable
        role="link"
        accessibilityLabel={title}
        accessibilityState={{ selected: active }}
        onPress={onOpen}
        onLongPress={onStartRename}
        className="active:bg-accent min-h-11 flex-1 justify-center rounded-lg px-3 py-2"
      >
        <Text numberOfLines={1} className={cn(active && 'font-medium')}>
          {title}
        </Text>
      </Pressable>
      <Button
        variant="ghost"
        size="icon"
        className="size-11"
        onPress={() => {
          setDraft(title);
          onStartRename();
        }}
        disabled={disabled}
        accessibilityLabel={`Rename ${title}`}
      >
        <Icon as={Pencil} className="text-muted-foreground size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-11"
        onPress={onDelete}
        disabled={disabled}
        accessibilityLabel={`Delete ${title}`}
      >
        <Icon as={Trash2} className="text-muted-foreground size-4" />
      </Button>
    </View>
  );
}
