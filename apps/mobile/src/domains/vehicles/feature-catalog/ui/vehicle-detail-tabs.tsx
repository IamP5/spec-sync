import {
  Check,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  CircleHelp,
  Info,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { Badge } from '../../../../design-system/components/ui/badge';
import { Button } from '../../../../design-system/components/ui/button';
import { Icon } from '../../../../design-system/components/ui/icon';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../../../design-system/components/ui/tabs';
import { Text } from '../../../../design-system/components/ui/text';
import { cn } from '../../../../design-system/lib/utils';
import type {
  Comparison,
  VehicleConfiguration,
  VehicleImageMetadata,
} from '../../data/vehicle-contracts';
import { LinkButton } from '../../ui/link-button';
import { safeSourceUrl } from '../../util/vehicle-display';
import {
  detailEvidence,
  type DetailFact,
  factByCode,
  sourceCountLabel,
  splitReportedFacts,
} from '../vehicle-detail-presentation';

type DetailTab = 'overview' | 'specifications' | 'evidence';

const STATUS_ICON: Record<
  DetailFact['status'],
  { icon: LucideIcon; label: string; className: string }
> = {
  known: {
    icon: Check,
    label: 'Accepted observation',
    className: 'text-success',
  },
  conflicting: {
    icon: CircleAlert,
    label: 'Conflicting observations',
    className: 'text-warning',
  },
  'not-reported': {
    icon: CircleHelp,
    label: 'Not reported',
    className: 'text-muted-foreground',
  },
};

export function VehicleDetailTabs({
  vehicle,
  facts,
  comparison,
  image,
  onOpenLink,
}: {
  vehicle: VehicleConfiguration;
  facts: DetailFact[];
  comparison?: Comparison;
  image?: VehicleImageMetadata | null;
  onOpenLink: (url: string) => void;
}) {
  const [tab, setTab] = useState<DetailTab>('overview');
  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value as DetailTab)}
      className="gap-4"
    >
      <TabsList className="h-11 w-full">
        <TabTrigger value="overview" label="Overview" />
        <TabTrigger value="specifications" label="Specifications" />
        <TabTrigger value="evidence" label="Evidence" />
      </TabsList>
      <TabsContent value="overview">
        <OverviewTab vehicle={vehicle} facts={facts} />
      </TabsContent>
      <TabsContent value="specifications">
        {/* Keyed by vehicle: the unavailable list collapses for another one. */}
        <SpecificationsTab key={vehicle.id} facts={facts} />
      </TabsContent>
      <TabsContent value="evidence">
        <EvidenceTab
          vehicle={vehicle}
          comparison={comparison}
          image={image}
          onOpenLink={onOpenLink}
        />
      </TabsContent>
    </Tabs>
  );
}

function TabTrigger({ value, label }: { value: DetailTab; label: string }) {
  return (
    <TabsTrigger
      value={value}
      accessibilityLabel={label}
      className="h-full flex-1"
    >
      <Text>{label}</Text>
    </TabsTrigger>
  );
}

function OverviewTab({
  vehicle,
  facts,
}: {
  vehicle: VehicleConfiguration;
  facts: DetailFact[];
}) {
  const known = facts.filter(({ status }) => status === 'known').length;
  return (
    <View className="gap-3">
      <View className="flex-row gap-3">
        <FactTile label="Power" fact={factByCode(facts, 'power_max')} />
        <FactTile label="Torque" fact={factByCode(facts, 'torque_max')} />
      </View>
      <FactTile label="Drivetrain" fact={factByCode(facts, 'drivetrain')} />
      <View className="border-border bg-card flex-row items-start gap-3 rounded-xl border p-4">
        <Icon as={Info} className="text-info mt-0.5 size-4" />
        <View className="flex-1">
          <Text className="text-sm font-medium">Catalog confidence</Text>
          <Text className="text-muted-foreground mt-1 text-sm leading-6">
            {known} of {facts.length} shown attributes have accepted
            observations. {facts.length - known} need clearer evidence or were
            not reported in the curated subset.
          </Text>
        </View>
      </View>
      {vehicle.identityNote ? (
        <View className="border-warning/30 bg-warning/5 rounded-xl border p-4">
          <Text className="text-xs font-medium tracking-wide uppercase">
            Identity note
          </Text>
          <Text className="text-muted-foreground mt-1 text-sm leading-6">
            {vehicle.identityNote}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function FactTile({ label, fact }: { label: string; fact: DetailFact }) {
  return (
    <View className="border-border bg-muted/25 flex-1 rounded-xl border p-3">
      <Text className="text-muted-foreground text-xs">{label}</Text>
      <Text
        className={cn(
          'mt-1 text-lg font-semibold',
          fact.status === 'conflicting' && 'text-warning',
          fact.status === 'not-reported' && 'text-muted-foreground',
        )}
      >
        {fact.value}
      </Text>
    </View>
  );
}

function SpecificationsTab({ facts }: { facts: DetailFact[] }) {
  const [showUnreported, setShowUnreported] = useState(false);
  if (!facts.length)
    return (
      <Text className="text-muted-foreground py-8 text-center text-sm">
        No attributes were returned for this configuration.
      </Text>
    );
  const { reported, unreported } = splitReportedFacts(facts);
  const visible = showUnreported ? [...reported, ...unreported] : reported;
  return (
    <View>
      {visible.length ? (
        visible.map((fact, index) => (
          <FactRow key={fact.code} fact={fact} first={index === 0} />
        ))
      ) : (
        <Text className="text-muted-foreground py-8 text-center text-sm">
          No specifications are reported for this configuration yet.
        </Text>
      )}
      {unreported.length ? (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 min-h-11 w-full"
          accessibilityLabel={
            showUnreported
              ? 'Hide unavailable specifications'
              : `Show unavailable specifications (${unreported.length})`
          }
          accessibilityState={{ expanded: showUnreported }}
          onPress={() => setShowUnreported(!showUnreported)}
        >
          <Icon
            as={showUnreported ? ChevronUp : ChevronDown}
            className="text-muted-foreground size-4"
          />
          <Text className="text-muted-foreground">
            {showUnreported
              ? 'Hide unavailable specifications'
              : `Show unavailable specifications (${unreported.length})`}
          </Text>
        </Button>
      ) : null}
    </View>
  );
}

function FactRow({ fact, first }: { fact: DetailFact; first: boolean }) {
  const status = STATUS_ICON[fact.status];
  return (
    <View className={cn('gap-1 py-3', !first && 'border-border border-t')}>
      <Text className="text-muted-foreground text-sm">{fact.label}</Text>
      <View className="flex-row items-center gap-1.5">
        <View accessible accessibilityLabel={status.label}>
          <Icon as={status.icon} className={cn('size-4', status.className)} />
        </View>
        <Text className="flex-1 text-sm font-medium">{fact.value}</Text>
      </View>
      {fact.note ? (
        <Text className="text-muted-foreground text-xs leading-5">
          {fact.note}
        </Text>
      ) : null}
      {fact.evidenceCount > 0 ? (
        <Text className="text-info text-xs">
          {sourceCountLabel(fact.evidenceCount)}
        </Text>
      ) : null}
    </View>
  );
}

function EvidenceTab({
  vehicle,
  comparison,
  image,
  onOpenLink,
}: {
  vehicle: VehicleConfiguration;
  comparison?: Comparison;
  image?: VehicleImageMetadata | null;
  onOpenLink: (url: string) => void;
}) {
  const evidence = detailEvidence(comparison, vehicle.id);
  return (
    <View className="gap-4">
      <View className="border-warning/30 bg-warning/5 flex-row items-start gap-3 rounded-xl border p-4">
        <Icon as={CircleAlert} className="text-warning mt-0.5 size-4" />
        <View className="flex-1">
          <Text className="text-sm font-medium">
            Curated notes, not OEM verification
          </Text>
          <Text className="text-muted-foreground mt-1 text-sm leading-6">
            Exact excerpts, accepted assertions, gaps, and conflicts remain
            visible instead of being flattened into a single claim.
          </Text>
        </View>
      </View>
      {evidence.length ? (
        evidence.map((item) => (
          <View key={item.id} className="border-border rounded-xl border p-4">
            <View className="flex-row flex-wrap items-start justify-between gap-2">
              <View className="min-w-0 flex-1">
                <Text className="text-sm font-medium">{item.title}</Text>
                <Text className="text-muted-foreground text-xs">
                  {item.locator} · captured {item.capturedOn}
                </Text>
              </View>
              <Badge variant="secondary">
                <Text>{item.provenance}</Text>
              </Badge>
            </View>
            <View className="border-info/50 mt-3 border-l-2 pl-3">
              <Text className="text-muted-foreground text-sm leading-6">
                {item.excerpt}
              </Text>
            </View>
            <View className="mt-1 flex-row flex-wrap gap-x-3">
              {item.upstreamUrls.map((url, index) => {
                const href = safeSourceUrl(url);
                return href ? (
                  <LinkButton
                    key={url}
                    label={`Source ${index + 1}`}
                    onPress={() => onOpenLink(href)}
                  />
                ) : null;
              })}
            </View>
          </View>
        ))
      ) : (
        <View className="border-border rounded-xl border border-dashed p-4">
          <Text className="text-sm font-medium">
            No evidence excerpts returned
          </Text>
          <Text className="text-muted-foreground mt-1 text-sm">
            Treat unreported facts as unknown, not as absent equipment.
          </Text>
        </View>
      )}
      {image ? (
        <View className="border-border rounded-xl border p-4">
          <Text className="text-sm font-medium">Vehicle photo</Text>
          <Text className="text-muted-foreground mt-1 text-sm">
            {image.matchScope === 'ILLUSTRATIVE'
              ? 'Illustrative manufacturer image; exact configuration appearance is not verified.'
              : 'Image of this vehicle configuration.'}
          </Text>
          {safeSourceUrl(image.sourcePageUrl) ? (
            <LinkButton
              label="Photo source"
              onPress={() => onOpenLink(image.sourcePageUrl)}
            />
          ) : null}
        </View>
      ) : (
        <View className="border-border rounded-xl border p-4">
          <Text className="text-sm font-medium">
            Vehicle photos unavailable
          </Text>
          <Text className="text-muted-foreground mt-1 text-sm">
            Photos are not available for this configuration yet.
          </Text>
        </View>
      )}
    </View>
  );
}
