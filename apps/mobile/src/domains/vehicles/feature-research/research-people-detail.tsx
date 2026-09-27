import { zodResolver } from '@hookform/resolvers/zod';
import { openBrowserAsync } from 'expo-web-browser';
import { useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';

import { Button } from '../../../design-system/components/ui/button';
import { Text } from '../../../design-system/components/ui/text';
import {
  researchContactUrlSchema,
  type ResearchSnapshot,
} from '../data/research-contracts';
import { useResearchInterestDetailStore } from './research-interest-detail-store';
import {
  ResearchPeopleList,
  type ResearchProfileDraft,
  ResearchProfileForm,
} from './ui/research-people-pane';

const profileSchema = z.object({
  name: z.string().trim().min(1).max(80),
  contactUrl: z
    .string()
    .max(500)
    .refine(
      (value) => researchContactUrlSchema.safeParse(value.trim()).success,
      {
        message: 'Use a complete HTTPS link.',
      },
    ),
  consent: z.boolean(),
});

/**
 * The people researching the same vehicle and the reader's own consented
 * profile (the people drawer of the web `VehicleResearchDetail`). It loads
 * only while shown; contact happens outside SpecSync.
 */
export function ResearchPeopleDetail({
  research,
}: {
  research: ResearchSnapshot;
}) {
  const store = useResearchInterestDetailStore(research.id);
  const mine = store.page?.mine;
  const form = useForm<ResearchProfileDraft>({
    resolver: zodResolver(profileSchema),
    mode: 'onChange',
    values: {
      name: mine?.name ?? '',
      contactUrl: mine?.contactUrl ?? '',
      consent: false,
    },
  });
  const draft = useWatch({ control: form.control }) as ResearchProfileDraft;
  const { errors, touchedFields, isValid } = form.formState;
  const canSubmit = isValid && draft.consent;

  const change = (next: ResearchProfileDraft) => {
    for (const field of ['name', 'contactUrl', 'consent'] as const)
      if (next[field] !== draft[field])
        form.setValue(field, next[field] as never, {
          shouldValidate: true,
          shouldDirty: true,
        });
  };
  const submit = () => {
    if (!canSubmit) return;
    store.submit({
      visible: true,
      name: draft.name.trim(),
      contactUrl: draft.contactUrl.trim(),
    });
  };
  const openContact = (url: string) => {
    if (researchContactUrlSchema.safeParse(url).success)
      void openBrowserAsync(url);
  };

  return (
    <View>
      <Text className="text-sm font-medium">
        {research.request.brand} {research.request.model} ·{' '}
        {research.request.modelYear}
      </Text>
      <Text className="text-muted-foreground mt-2 text-sm">
        See who else is researching this vehicle. Only people who chose to share
        appear here; contact happens outside SpecSync.
      </Text>
      {store.isLoading ? (
        <Text
          className="text-muted-foreground py-6 text-sm"
          accessibilityLiveRegion="polite"
        >
          Loading interested people…
        </Text>
      ) : store.loadFailed ? (
        <View className="mt-5">
          <Text role="alert" className="text-sm">
            The profiles could not be loaded.
          </Text>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 min-h-11 self-start"
            accessibilityRole="button"
            accessibilityLabel="Try again"
            onPress={store.reload}
          >
            <Text>Try again</Text>
          </Button>
        </View>
      ) : store.page ? (
        <>
          <ResearchPeopleList page={store.page} onOpenContact={openContact} />
          <ResearchProfileForm
            hasProfile={!!store.page.mine}
            draft={draft}
            nameError=""
            contactError={
              touchedFields.contactUrl ? (errors.contactUrl?.message ?? '') : ''
            }
            canSubmit={canSubmit}
            saving={store.savePending}
            saved={store.saved}
            error={store.error}
            onChange={change}
            onBlurContact={() =>
              form.setValue('contactUrl', draft.contactUrl, {
                shouldTouch: true,
                shouldValidate: true,
              })
            }
            onSubmit={submit}
            onRemove={() => store.submit({ visible: false })}
          />
        </>
      ) : null}
    </View>
  );
}
