import { FileText, Play } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { z } from 'zod';

import { Badge } from '../../../../design-system/components/ui/badge';
import { Button } from '../../../../design-system/components/ui/button';
import { Checkbox } from '../../../../design-system/components/ui/checkbox';
import { Icon } from '../../../../design-system/components/ui/icon';
import { Text } from '../../../../design-system/components/ui/text';
import { cn } from '../../../../design-system/lib/utils';
import { sourcePreviewSchema } from '../../../vehicles/api/contracts';
import { parseResult } from '../../util/parse-result';
import type { ToolAdapterProps } from './chat-tool-registry';
import { vehicleIngestionPrompt } from './vehicle-prompts';

const argsSchema = z.object({
  sourceUrl: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  modelYear: z.coerce.number().optional(),
});
/** Tool failures and Mastra input-validation errors both carry a message. */
const sourceFailureSchema = z.union([
  z.object({ status: z.literal('ERROR'), message: z.string() }),
  z.object({ error: z.literal(true), message: z.string() }),
]);

/**
 * Renders the configurations one official source presents (server tool
 * `previewVehicleSource`, web `ChatVehicleSourceOverview`) and lets the
 * curator tick the ones to import; the choice goes back to the agent as a
 * prompt, which then starts the run.
 */
export function ChatVehicleSourceOverview({ call, actions }: ToolAdapterProps) {
  const preview = parseResult(call.result, sourcePreviewSchema);
  const failure = parseResult(call.result, sourceFailureSchema);
  const args = parseResult(call.args, argsSchema);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const toggle = (name: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  const send = (configurations: string[]) => {
    if (!preview) return;
    actions.send(
      vehicleIngestionPrompt({
        sourceUrl: preview.source.url,
        brand: args?.brand ?? '',
        model: args?.model ?? '',
        modelYear: args?.modelYear ?? 0,
        configurations,
      }),
    );
  };

  if (!preview)
    return (
      <View className="border-border bg-card rounded-xl border p-4">
        {failure ? (
          <>
            <Text className="text-sm font-semibold">
              Source could not be read
            </Text>
            <Text
              className="text-muted-foreground mt-1 text-sm"
              accessibilityLiveRegion="polite"
            >
              {failure.message}
            </Text>
          </>
        ) : (
          <View
            className="flex-row items-center gap-2"
            accessibilityLiveRegion="polite"
          >
            {call.status === 'complete' ? null : (
              <ActivityIndicator
                size="small"
                accessibilityLabel="Reading the source"
              />
            )}
            <Text className="flex-1 text-sm">
              {call.status === 'complete'
                ? 'No valid preview returned.'
                : 'Reading the source and listing its configurations…'}
            </Text>
          </View>
        )}
      </View>
    );

  const count = preview.configurations.length;
  return (
    <View className="border-border bg-card rounded-xl border p-4">
      <View className="flex-row flex-wrap items-start justify-between gap-2">
        <View className="flex-1">
          <View className="flex-row items-center gap-1">
            <Icon as={FileText} className="size-4" />
            <Text className="text-sm font-semibold">
              Configurations in the source
            </Text>
          </View>
          <Text className="text-muted-foreground mt-1 text-sm">
            {preview.source.title}
            {preview.source.pageCount
              ? ` · ${preview.source.pageCount} pages`
              : ''}
          </Text>
        </View>
        <Badge variant="secondary">
          <Text>{count} found</Text>
        </Badge>
      </View>
      {preview.modelYearNote ? (
        <Text className="text-muted-foreground mt-2 text-xs">
          {preview.modelYearNote}
        </Text>
      ) : null}
      {count ? (
        <>
          <View className="mt-3 gap-2" accessibilityLabel="Configurations">
            {preview.configurations.map((configuration) => {
              const checked = selected.has(configuration.name);
              return (
                <Pressable
                  key={configuration.name}
                  accessibilityRole="checkbox"
                  accessibilityLabel={configuration.name}
                  accessibilityState={{ checked }}
                  onPress={() => toggle(configuration.name)}
                  className={cn(
                    'min-h-11 flex-row items-start gap-3 rounded-lg border p-2',
                    checked ? 'border-primary' : 'border-border',
                  )}
                >
                  <View
                    pointerEvents="none"
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    className="pt-0.5"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggle(configuration.name)}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm">
                      <Text className="text-sm font-medium">
                        {configuration.name}
                      </Text>
                      {configuration.powertrain ? (
                        <Text className="text-muted-foreground text-sm">
                          {' '}
                          · {configuration.powertrain}
                        </Text>
                      ) : null}
                    </Text>
                    <Text className="text-muted-foreground mt-0.5 text-xs">
                      {configuration.locator}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          {preview.legend.length ? (
            <Text className="text-muted-foreground mt-3 text-xs">
              Legend:{' '}
              {preview.legend
                .map((entry) => `${entry.symbol} = ${entry.meaning}`)
                .join('; ')}
            </Text>
          ) : null}
          {preview.notes.map((note, index) => (
            <Text key={index} className="text-muted-foreground mt-1 text-xs">
              • {note}
            </Text>
          ))}
          <View className="mt-3 flex-row flex-wrap items-center gap-2">
            <Button
              size="sm"
              className="min-h-11"
              accessibilityRole="button"
              accessibilityLabel={`Import ${selected.size} selected`}
              disabled={!selected.size || !actions.canSend}
              onPress={() => send([...selected])}
            >
              <Icon as={Play} className="size-4" />
              <Text>Import {selected.size} selected</Text>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="min-h-11"
              accessibilityRole="button"
              accessibilityLabel={`Import all (${count})`}
              disabled={!actions.canSend}
              onPress={() => send([])}
            >
              <Text>Import all ({count})</Text>
            </Button>
          </View>
        </>
      ) : (
        <Text className="text-muted-foreground mt-3 text-sm">
          {preview.message}
        </Text>
      )}
    </View>
  );
}
