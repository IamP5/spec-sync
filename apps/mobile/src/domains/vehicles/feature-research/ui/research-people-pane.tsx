import { ExternalLink } from 'lucide-react-native';
import { View } from 'react-native';

import { Button } from '../../../../design-system/components/ui/button';
import { Icon } from '../../../../design-system/components/ui/icon';
import { Input } from '../../../../design-system/components/ui/input';
import { Text } from '../../../../design-system/components/ui/text';
import type { ResearchPeople } from '../../data/research-contracts';
import { CheckRow } from '../../ui/check-row';

/** The reader's profile draft; the smart owner validates it. */
export interface ResearchProfileDraft {
  name: string;
  contactUrl: string;
  consent: boolean;
}

/** The people who shared a profile on a research, and the reader's own profile form. */
export function ResearchPeopleList({
  page,
  onOpenContact,
}: {
  page: ResearchPeople;
  onOpenContact: (url: string) => void;
}) {
  return (
    <View className="mt-4">
      {page.people.length ? (
        page.people.map((person, index) => (
          <View
            key={index}
            className="border-border flex-row items-center justify-between gap-3 border-b py-3"
          >
            <View className="flex-1">
              <Text numberOfLines={1} className="text-sm font-semibold">
                {person.name}
                {person.isYou ? (
                  <Text className="text-muted-foreground font-normal">
                    {' '}
                    · you
                  </Text>
                ) : null}
              </Text>
              <Text className="text-muted-foreground text-xs">
                Profile shared voluntarily
              </Text>
            </View>
            <Button
              variant="outline"
              size="sm"
              className="min-h-11"
              accessibilityRole="link"
              accessibilityLabel={`Open ${person.name}'s contact in the browser`}
              onPress={() => onOpenContact(person.contactUrl)}
            >
              <Text>Open contact</Text>
              <Icon as={ExternalLink} className="size-4" />
            </Button>
          </View>
        ))
      ) : (
        <Text className="text-muted-foreground py-4 text-sm">
          Nobody has shared a profile on this research yet. You could be the
          first.
        </Text>
      )}
      {page.hasMore ? (
        <Text className="text-muted-foreground mt-2 text-xs">
          Showing the first 100 shared profiles.
        </Text>
      ) : null}
    </View>
  );
}

export function ResearchProfileForm({
  hasProfile,
  draft,
  nameError,
  contactError,
  canSubmit,
  saving,
  saved,
  error,
  onChange,
  onBlurContact,
  onSubmit,
  onRemove,
}: {
  hasProfile: boolean;
  draft: ResearchProfileDraft;
  nameError: string;
  contactError: string;
  canSubmit: boolean;
  saving: boolean;
  saved: boolean;
  error: string;
  onChange: (draft: ResearchProfileDraft) => void;
  onBlurContact: () => void;
  onSubmit: () => void;
  onRemove: () => void;
}) {
  return (
    <View className="border-border mt-6 border-t pt-5">
      <Text role="heading" className="text-base font-semibold">
        {hasProfile ? 'Your profile on this research' : 'Join the conversation'}
      </Text>
      <Text className="text-muted-foreground mt-1 text-xs">
        Your name and link are visible to other people with access to the same
        research, including new interpretations of the source. You can remove
        them here at any time.
      </Text>
      <Text className="mt-4 text-sm font-medium">Display name</Text>
      <Input
        className="mt-1 min-h-11"
        accessibilityLabel="Display name"
        autoComplete="nickname"
        maxLength={80}
        value={draft.name}
        onChangeText={(name) => onChange({ ...draft, name })}
      />
      {nameError ? (
        <Text className="text-destructive mt-1 text-xs">{nameError}</Text>
      ) : null}
      <Text className="mt-4 text-sm font-medium">External contact link</Text>
      <Input
        className="mt-1 min-h-11"
        accessibilityLabel="External contact link"
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="https://…"
        maxLength={500}
        value={draft.contactUrl}
        onChangeText={(contactUrl) => onChange({ ...draft, contactUrl })}
        onBlur={onBlurContact}
      />
      <Text className="text-muted-foreground mt-1 text-xs">
        Use a public profile or contact link you are happy to share.
      </Text>
      {contactError ? (
        <Text className="text-destructive mt-1 text-xs">{contactError}</Text>
      ) : null}
      <View className="mt-4">
        <CheckRow
          checked={draft.consent}
          bordered={false}
          accessibilityLabel="I want to share this name and link with the people on this research."
          onChange={(consent) => onChange({ ...draft, consent })}
        >
          <Text className="text-sm">
            I want to share this name and link with the people on this research.
          </Text>
        </CheckRow>
      </View>
      {error ? (
        <Text role="alert" className="text-destructive mt-3 text-sm">
          {error}
        </Text>
      ) : null}
      {saved ? (
        <Text className="mt-3 text-sm" accessibilityLiveRegion="polite">
          {hasProfile ? 'Profile shared.' : 'Your profile was removed.'}
        </Text>
      ) : null}
      <View className="mt-4 flex-row flex-wrap gap-2">
        <Button
          className="min-h-11"
          accessibilityRole="button"
          accessibilityLabel={hasProfile ? 'Save profile' : 'Share my profile'}
          disabled={!canSubmit || saving}
          onPress={onSubmit}
        >
          <Text>
            {saving
              ? 'Saving…'
              : hasProfile
                ? 'Save profile'
                : 'Share my profile'}
          </Text>
        </Button>
        {hasProfile ? (
          <Button
            variant="outline"
            className="min-h-11"
            accessibilityRole="button"
            accessibilityLabel="Remove my profile"
            disabled={saving}
            onPress={onRemove}
          >
            <Text>Remove my profile</Text>
          </Button>
        ) : null}
      </View>
    </View>
  );
}
