import { Check, ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { Button } from '../../../../design-system/components/ui/button';
import { Icon } from '../../../../design-system/components/ui/icon';
import { Text } from '../../../../design-system/components/ui/text';
import { cn } from '../../../../design-system/lib/utils';
import type { ChatMode, ChatModeOption } from '../../data/chat-model';

/**
 * The answer mode (web `RunOptionsPicker`): Instant / Balanced / Deep,
 * cheapest first, with the estimated cost per message. Switching to a mode
 * the balance covers for fewer than twenty messages is confirmed first.
 */
export function ModePicker({
  modes,
  selected,
  disabled,
  costOf,
  needsConfirmation,
  messagesCovered,
  onChange,
}: {
  modes: ChatModeOption[];
  selected: ChatMode;
  disabled: boolean;
  costOf: (mode: ChatModeOption) => string;
  needsConfirmation: (mode: ChatModeOption) => boolean;
  messagesCovered: (mode: ChatModeOption) => number;
  onChange: (mode: ChatMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState<ChatModeOption>();
  if (modes.length < 2) return null;
  const current = modes.find((mode) => mode.id === selected) ?? modes[0];
  const index = modes.findIndex((mode) => mode.id === current?.id);

  function close() {
    setOpen(false);
    setConfirming(undefined);
  }

  function pick(mode: ChatModeOption) {
    if (mode.id === selected) return close();
    if (needsConfirmation(mode)) return setConfirming(mode);
    onChange(mode.id);
    close();
  }

  return (
    <>
      <Pressable
        role="button"
        accessibilityLabel={`Mode: ${current?.label ?? ''}`}
        disabled={disabled}
        onPress={() => setOpen(true)}
        className={cn(
          'border-border min-h-11 flex-row items-center gap-1.5 rounded-full border px-3',
          disabled && 'opacity-50',
        )}
      >
        <View className="flex-row gap-0.5">
          {modes.map((mode, dot) => (
            <View
              key={mode.id}
              className={cn(
                'size-1.5 rounded-full',
                dot <= index ? 'bg-foreground' : 'bg-border',
              )}
            />
          ))}
        </View>
        <Text className="text-sm font-medium">{current?.label}</Text>
        <Icon as={ChevronDown} className="text-muted-foreground size-3.5" />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <Pressable
          className="flex-1 justify-end bg-black/40"
          onPress={close}
          accessibilityLabel="Close mode picker"
          role="button"
        >
          <Pressable
            className="bg-popover border-border gap-3 rounded-t-2xl border p-4 pb-8"
            onPress={() => undefined}
          >
            {confirming ? (
              <View className="gap-3">
                <Text className="text-lg font-semibold">
                  Switch to {confirming.label}?
                </Text>
                <Text className="text-muted-foreground">
                  {[
                    costOf(confirming),
                    `Your credits cover about ${messagesCovered(confirming)} message${messagesCovered(confirming) === 1 ? '' : 's'} in this mode.`,
                  ]
                    .filter(Boolean)
                    .join('. ')}
                </Text>
                <View className="flex-row justify-end gap-2">
                  <Button
                    variant="outline"
                    className="min-h-11"
                    onPress={() => setConfirming(undefined)}
                    accessibilityLabel="Cancel"
                  >
                    <Text>Cancel</Text>
                  </Button>
                  <Button
                    className="min-h-11"
                    onPress={() => {
                      onChange(confirming.id);
                      close();
                    }}
                    accessibilityLabel={`Switch to ${confirming.label}`}
                  >
                    <Text>Switch</Text>
                  </Button>
                </View>
              </View>
            ) : (
              <View className="gap-1" role="radiogroup">
                <Text className="text-muted-foreground px-1 pb-1 text-xs font-medium uppercase">
                  Answer mode
                </Text>
                {modes.map((mode) => {
                  const active = mode.id === current?.id;
                  const detail = [costOf(mode), mode.description]
                    .filter(Boolean)
                    .join(' · ');
                  return (
                    <Pressable
                      key={mode.id}
                      role="radio"
                      accessibilityState={{ checked: active }}
                      accessibilityLabel={`${mode.label}. ${detail}`}
                      onPress={() => pick(mode)}
                      className={cn(
                        'min-h-14 flex-row items-center gap-3 rounded-lg px-3 py-2',
                        active ? 'bg-accent' : 'active:bg-accent',
                      )}
                    >
                      <View className="flex-1">
                        <View className="flex-row items-center gap-2">
                          <Text className="font-medium">{mode.label}</Text>
                          {mode.relativeCost && mode.relativeCost > 1 ? (
                            <Text className="text-muted-foreground text-xs">
                              {`${mode.relativeCost}×`}
                            </Text>
                          ) : null}
                        </View>
                        <Text className="text-muted-foreground text-sm">
                          {detail}
                        </Text>
                      </View>
                      {active ? (
                        <Icon as={Check} className="text-primary size-5" />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
