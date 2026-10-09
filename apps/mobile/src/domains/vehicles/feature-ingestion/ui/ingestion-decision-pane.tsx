import {
  Check,
  ChevronDown,
  CircleAlert,
  FileText,
  GitFork,
} from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Badge } from '../../../../design-system/components/ui/badge';
import { Button } from '../../../../design-system/components/ui/button';
import { Icon } from '../../../../design-system/components/ui/icon';
import { Text } from '../../../../design-system/components/ui/text';
import { cn } from '../../../../design-system/lib/utils';
import { type ClaimRow, decisionStatusLabel } from '../ingestion-presentation';
import type { DecisionStatus, ReviewDecision } from '../review-decisions';

function explanation(decision: ReviewDecision, status: DecisionStatus): string {
  switch (decision.kind) {
    case 'auto':
      return status === 'selected'
        ? 'One evidenced candidate that adds to or changes the catalog. It is pre-approved; leave it selected or set it aside.'
        : 'One evidenced candidate that adds to or changes the catalog. It stays out of this publication until you select it again.';
    case 'conflict':
      return 'The source supports more than one value. Choose the candidate whose conditions apply to this configuration; the others stay outside the catalog.';
    case 'unverified':
      return 'The cited lines do not confirm the proposed value, so nothing here can be published. Check the evidence and acknowledge it to move on.';
    case 'same':
      return 'The catalog already holds this value. There is nothing to publish.';
    case 'published':
      return 'Published from this research. Changing it takes a new import.';
  }
}

function Candidate({
  row,
  chosen,
  choosable,
  onChoose,
}: {
  row: ClaimRow;
  chosen: boolean;
  choosable: boolean;
  onChoose: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const value = row.proposed || row.raw;
  return (
    <View
      className={cn(
        'rounded-lg border p-3',
        chosen ? 'border-primary' : 'border-border',
      )}
    >
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="text-sm font-medium">{value}</Text>
          <Text className="text-muted-foreground text-xs">
            As printed: {row.raw}
            {row.qualifiers ? ` · ${row.qualifiers}` : ''}
          </Text>
          {row.change === 'invalid' ? (
            <Text className="text-destructive mt-1 text-xs">
              {row.claim.issues.join('; ')}
            </Text>
          ) : null}
        </View>
        {choosable ? (
          <Button
            size="sm"
            variant={chosen ? 'secondary' : 'outline'}
            className="min-h-11"
            accessibilityRole="button"
            accessibilityLabel={`Select ${value}`}
            accessibilityState={{ selected: chosen }}
            onPress={onChoose}
          >
            {chosen ? <Icon as={Check} className="size-4" /> : null}
            <Text>{chosen ? 'Selected' : 'Select'}</Text>
          </Button>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Lines ${row.claim.lineStart}–${row.claim.lineEnd}`}
        accessibilityState={{ expanded }}
        className="min-h-11 flex-row items-center gap-1"
        onPress={() => setExpanded(!expanded)}
      >
        <Icon
          as={ChevronDown}
          className={cn('size-4', expanded ? 'rotate-180' : '')}
        />
        <Text className="text-xs underline">
          Lines {row.claim.lineStart}–{row.claim.lineEnd}
        </Text>
      </Pressable>
      {row.locator ? (
        <Text className="text-muted-foreground text-xs">{row.locator}</Text>
      ) : null}
      {expanded ? (
        <Text className="bg-muted mt-2 rounded-lg p-2 text-xs">
          {row.claim.excerpt}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * One decision of the guided review (web `IngestionDecisionPane`): the
 * attribute, the accepted catalog value beside the proposal, and every
 * candidate with the lines the source printed it on. Choices belong to the
 * owner and are reported as intentions.
 */
export function IngestionDecisionPane({
  decision,
  configuration,
  status,
  selectedIndex,
  reviewing,
  onChoose,
  onClear,
  onDefer,
  onEvidence,
}: {
  decision: ReviewDecision;
  configuration: string;
  status: DecisionStatus;
  /** Claim index the reviewer selected for this attribute, when any. */
  selectedIndex: number | undefined;
  /** Whether the reviewer may still change this decision. */
  reviewing: boolean;
  onChoose: (index: number) => void;
  onClear: () => void;
  onDefer: () => void;
  onEvidence: () => void;
}) {
  const chosen =
    decision.published ??
    decision.candidates.find((row) => row.index === selectedIndex);
  const open = decision.kind !== 'published' && decision.kind !== 'same';
  const editable = open && reviewing;
  const deferLabel =
    decision.kind === 'unverified'
      ? status === 'deferred'
        ? 'Acknowledged'
        : 'Acknowledge and keep pending'
      : status === 'deferred'
        ? 'Decided later'
        : 'Decide later';
  const badgeVariant =
    status === 'published'
      ? 'outline'
      : status === 'selected'
        ? 'default'
        : status === 'pending' && decision.kind !== 'auto'
          ? 'destructive'
          : 'secondary';
  const badgeIcon =
    decision.kind === 'conflict'
      ? GitFork
      : decision.kind === 'unverified'
        ? CircleAlert
        : status === 'selected' || status === 'published'
          ? Check
          : undefined;
  return (
    <View className="border-border rounded-xl border p-4">
      <View className="flex-row flex-wrap items-start justify-between gap-2">
        <View className="flex-1">
          <Text role="heading" className="text-base font-semibold">
            {decision.label}
          </Text>
          <Text className="text-muted-foreground mt-0.5 text-xs">
            {configuration}
          </Text>
        </View>
        <Badge variant={badgeVariant}>
          {badgeIcon ? <Icon as={badgeIcon} className="size-3" /> : null}
          <Text>{decisionStatusLabel(decision.kind, status)}</Text>
        </Badge>
      </View>
      <View className="mt-3 flex-row gap-2">
        <View className="bg-muted flex-1 rounded-lg p-3">
          <Text className="text-muted-foreground text-xs">Current catalog</Text>
          <Text className="mt-1 text-sm font-medium">
            {decision.current || 'Not in catalog'}
          </Text>
        </View>
        <View className="border-border flex-1 rounded-lg border p-3">
          <Text className="text-muted-foreground text-xs">Proposed</Text>
          <Text className="mt-1 text-sm font-medium">
            {chosen?.proposed || chosen?.raw || '—'}
          </Text>
        </View>
      </View>
      <Text
        className={cn(
          'mt-3 text-sm',
          decision.kind === 'unverified'
            ? 'text-warning'
            : 'text-muted-foreground',
        )}
      >
        {explanation(decision, status)}
      </Text>
      <View className="mt-3 gap-2" accessibilityLabel="Candidates">
        {decision.rows.map((row) => (
          <Candidate
            key={row.index}
            row={row}
            chosen={chosen?.index === row.index}
            choosable={editable ? row.change !== 'invalid' : false}
            onChoose={() => onChoose(row.index)}
          />
        ))}
      </View>
      <View className="mt-3 flex-row flex-wrap gap-2">
        {editable && status === 'selected' ? (
          <Button
            variant="ghost"
            size="sm"
            className="min-h-11"
            accessibilityRole="button"
            accessibilityLabel="Remove from publication"
            onPress={onClear}
          >
            <Text>Remove from publication</Text>
          </Button>
        ) : null}
        {editable && status !== 'deferred' ? (
          <Button
            variant="ghost"
            size="sm"
            className="min-h-11"
            accessibilityRole="button"
            accessibilityLabel={deferLabel}
            onPress={onDefer}
          >
            <Text>{deferLabel}</Text>
          </Button>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          className="min-h-11"
          accessibilityRole="button"
          accessibilityLabel="Open the evidence"
          onPress={onEvidence}
        >
          <Icon as={FileText} className="size-4" />
          <Text>Open the evidence</Text>
        </Button>
      </View>
    </View>
  );
}
