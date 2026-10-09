import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '../../../../design-system/components/ui/icon';
import { Text } from '../../../../design-system/components/ui/text';
import { cn } from '../../../../design-system/lib/utils';
import type { VehicleConfiguration } from '../../data/vehicle-contracts';
import {
  cellSummary,
  type ComparisonRow,
  hasDetails,
} from '../comparison-presentation';
import { nameToggleLabel } from './vehicle-comparison-legend';
import { VehicleComparisonSources } from './vehicle-comparison-sources';

/**
 * One attribute of the comparison (web comparison row): its label, the
 * values as numbered chips, and a disclosure with the sources and
 * observations of every vehicle.
 */
export function VehicleComparisonRow({
  row,
  configurations,
  numbered,
  differs,
  named,
  questionsEnabled,
  onToggleName,
  onReviews,
  onOpenLink,
}: {
  row: ComparisonRow;
  configurations: VehicleConfiguration[];
  numbered: boolean;
  differs: boolean;
  named: ReadonlySet<string>;
  questionsEnabled: boolean;
  onToggleName: (configurationId: string) => void;
  onReviews: (row: ComparisonRow, configurationId?: string) => void;
  onOpenLink: (url: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View className="py-2" accessibilityLabel={row.attribute.label}>
      <View className="flex-row items-center gap-2">
        <Text className="shrink text-sm font-medium">
          {row.attribute.label}
          {row.attribute.unit ? (
            <Text className="text-muted-foreground text-xs font-normal">
              {' '}
              ({row.attribute.unit})
            </Text>
          ) : null}
        </Text>
        {numbered && differs ? (
          <Text className="text-muted-foreground text-xs tracking-wide uppercase">
            differs
          </Text>
        ) : null}
        {questionsEnabled ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`See reviews about ${row.attribute.label}`}
            className="ml-auto min-h-11 justify-center pl-2"
            onPress={() => onReviews(row)}
          >
            <Text className="text-muted-foreground text-xs underline">
              Reviews ↗
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View className="mt-1 flex-row flex-wrap gap-1.5">
        {configurations.map((configuration, index) => {
          const summary = cellSummary(row, configuration.id);
          const isNamed = named.has(configuration.id);
          const vehicle = `${configuration.model} ${configuration.name}`;
          return (
            <View
              key={configuration.id}
              className="bg-muted/70 max-w-full flex-row items-center gap-1.5 rounded-lg py-1 pr-2.5 pl-1.5"
              accessibilityLabel={`${vehicle}: ${summary.tone === 'muted' ? 'not reported' : summary.text}`}
            >
              {numbered ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={nameToggleLabel(configuration)}
                  accessibilityState={{ selected: isNamed }}
                  hitSlop={12}
                  className="bg-foreground/80 h-5 min-w-5 flex-row items-center gap-1 rounded-full px-1.5"
                  onPress={() => onToggleName(configuration.id)}
                >
                  <Text className="text-background text-xs font-semibold">
                    {index + 1}
                  </Text>
                  {isNamed ? (
                    <Text
                      numberOfLines={1}
                      className="text-background text-xs font-medium"
                    >
                      {vehicle}
                    </Text>
                  ) : null}
                </Pressable>
              ) : null}
              <Text
                numberOfLines={1}
                className={cn(
                  'shrink text-sm tabular-nums',
                  summary.tone === 'value' && 'font-medium',
                  summary.tone === 'muted' && 'text-muted-foreground',
                  summary.tone === 'warning' && 'text-warning',
                )}
              >
                {summary.text}
              </Text>
            </View>
          );
        })}
      </View>
      {hasDetails(row) ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sources and observations"
            accessibilityState={{ expanded: open }}
            className="min-h-11 flex-row items-center gap-1 self-start"
            onPress={() => setOpen(!open)}
          >
            <Icon
              as={open ? ChevronDown : ChevronRight}
              className="text-muted-foreground size-4"
            />
            <Text className="text-muted-foreground text-xs">
              Sources and observations
            </Text>
          </Pressable>
          {open ? (
            <VehicleComparisonSources
              row={row}
              configurations={configurations}
              numbered={numbered}
              questionsEnabled={questionsEnabled}
              onReviews={onReviews}
              onOpenLink={onOpenLink}
            />
          ) : null}
        </>
      ) : null}
    </View>
  );
}
