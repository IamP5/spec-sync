import { Monitor, Moon, Sun } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { Icon } from '../../../design-system/components/ui/icon';
import { Input } from '../../../design-system/components/ui/input';
import { Label } from '../../../design-system/components/ui/label';
import { Switch } from '../../../design-system/components/ui/switch';
import { Text } from '../../../design-system/components/ui/text';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '../../../design-system/components/ui/toggle-group';
import { useUserPreferencesCoordinator } from '../api/preferences';
import { ThemeOptionPane } from './ui/theme-option-pane';

const THEMES = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const;

/**
 * The personal settings (web `UserPreferencesEdit`): greeting name,
 * appearance and whether thinking and tool activity show in the transcript.
 * The name is saved when the field is left; the rest applies immediately.
 */
export function UserPreferencesEdit() {
  const preferences = useUserPreferencesCoordinator();
  const [name, setName] = useState(preferences.displayName);

  function saveName() {
    const trimmed = name.trim();
    if (trimmed !== preferences.displayName) {
      preferences.update({ displayName: trimmed });
    }
    setName(trimmed);
  }

  return (
    <View className="gap-6">
      <View className="gap-2">
        <Label nativeID="display-name">Your name</Label>
        <Input
          value={name}
          onChangeText={setName}
          onBlur={saveName}
          onSubmitEditing={saveName}
          maxLength={preferences.maxDisplayNameLength}
          placeholder="How should the assistant address you?"
          accessibilityLabelledBy="display-name"
          accessibilityLabel="Your name"
          editable={preferences.signedIn}
          returnKeyType="done"
          className="min-h-11"
        />
        <Text className="text-muted-foreground text-xs">
          Used to greet you in chat. Your account name comes from Google. Stored
          only on this device.
        </Text>
      </View>

      <View className="gap-2">
        <Text className="text-sm font-medium">Appearance</Text>
        <ToggleGroup
          type="single"
          variant="outline"
          value={preferences.theme}
          onValueChange={(value) => {
            const theme = THEMES.find((option) => option.value === value);
            if (theme) preferences.setTheme(theme.value);
          }}
          disabled={!preferences.signedIn}
        >
          {THEMES.map((option, index) => (
            <ToggleGroupItem
              key={option.value}
              value={option.value}
              isFirst={index === 0}
              isLast={index === THEMES.length - 1}
              accessibilityLabel={`${option.label} appearance`}
              className="min-h-11 flex-1"
            >
              <ThemeOptionPane label={option.label}>
                <Icon as={option.icon} className="text-foreground size-4" />
              </ThemeOptionPane>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </View>

      <View className="flex-row items-center gap-4">
        <View className="flex-1 gap-1">
          <Label nativeID="show-activity">
            Show thinking and tool activity
          </Label>
          <Text className="text-muted-foreground text-xs">
            Thinking summaries and the input and output of every tool call
            appear as collapsible details in the transcript.
          </Text>
        </View>
        <Switch
          checked={preferences.showActivity}
          onCheckedChange={(showActivity) =>
            preferences.update({ showActivity })
          }
          disabled={!preferences.signedIn}
          accessibilityLabel="Show thinking and tool activity"
          accessibilityLabelledBy="show-activity"
        />
      </View>

      {preferences.error ? (
        <Text role="alert" className="text-destructive text-sm">
          {preferences.error}
        </Text>
      ) : null}
    </View>
  );
}
