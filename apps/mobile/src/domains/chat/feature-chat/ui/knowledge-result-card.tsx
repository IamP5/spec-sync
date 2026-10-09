import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Card } from '../../../../design-system/components/ui/card';
import { Icon } from '../../../../design-system/components/ui/icon';
import { Text } from '../../../../design-system/components/ui/text';
import {
  type KnowledgeItem,
  knowledgeItemLabel,
  knowledgeItemLink,
  type KnowledgeView,
  sourceTypeLabel,
  yearHint,
} from '../../data/knowledge-result';
import { displayValue } from '../../util/knowledge-display';

/**
 * A knowledge tool result (web `KnowledgeResultCard`): one quiet line when
 * there is nothing to lay out, otherwise a card with one entry per item.
 * Links go to `onOpenLink`; the host opens them.
 */
export function KnowledgeResultCard({
  view,
  onOpenLink,
}: {
  view: KnowledgeView;
  onOpenLink: (url: string) => void;
}) {
  if (view.kind === 'hidden') return null;
  if (view.kind === 'quiet')
    return (
      <View accessibilityLiveRegion="polite" className="gap-2">
        <Text className="text-muted-foreground text-sm">
          <Text className="text-foreground text-sm font-medium">
            {view.title}
          </Text>
          {' · '}
          {view.line}
        </Text>
        {view.warnings.map((warning) => (
          <Text key={warning} className="text-muted-foreground text-sm">
            {warning}
          </Text>
        ))}
      </View>
    );
  return (
    <Card className="gap-2 rounded-xl p-4 shadow-none">
      <Text className="text-sm font-semibold">{view.title}</Text>
      {view.message ? (
        <Text className="text-muted-foreground text-sm">{view.message}</Text>
      ) : null}
      {view.specificationDiscovery ? (
        <>
          <Text className="text-muted-foreground text-xs">
            Source candidates only. Applicability to the requested vehicle and
            model year has not been verified.
          </Text>
          {view.warnings.length ? (
            <View
              accessibilityLabel="Source discovery warnings"
              className="gap-1"
            >
              {view.warnings.map((warning) => (
                <Text key={warning} className="text-muted-foreground text-sm">
                  • {warning}
                </Text>
              ))}
            </View>
          ) : null}
        </>
      ) : null}
      <View className="gap-4">
        {view.items.map((item, index) => (
          <KnowledgeEntry
            // Items carry no stable id; their order is the result's order.
            key={index}
            item={item}
            specificationDiscovery={view.specificationDiscovery}
            onOpenLink={onOpenLink}
          />
        ))}
      </View>
    </Card>
  );
}

function KnowledgeEntry({
  item,
  specificationDiscovery,
  onOpenLink,
}: {
  item: KnowledgeItem;
  specificationDiscovery: boolean;
  onOpenLink: (url: string) => void;
}) {
  const [contextOpen, setContextOpen] = useState(false);
  const href = knowledgeItemLink(item);
  const label = knowledgeItemLabel(item);
  const year = specificationDiscovery ? yearHint(item) : undefined;
  const format = displayValue;
  return (
    <View className="border-border gap-1 border-l-2 pl-3">
      {specificationDiscovery && item['sourceType'] ? (
        <Text className="text-muted-foreground text-xs">
          {sourceTypeLabel(item['sourceType'])}
        </Text>
      ) : null}
      {href ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`${label} (opens the browser)`}
          className="min-h-11 justify-center"
          onPress={() => onOpenLink(href)}
        >
          <Text className="text-sm font-medium underline">{label}</Text>
        </Pressable>
      ) : (
        <Text className="text-sm font-semibold">{label}</Text>
      )}
      {item['verification'] ? (
        <Line>Discovered link · content not verified or ingested</Line>
      ) : null}
      {item['documentType'] ? (
        <Line>
          {item['documentType'] === 'PDF'
            ? 'Brochure PDF · not yet read'
            : 'Web page · not yet read'}
        </Line>
      ) : null}
      {specificationDiscovery ? (
        <>
          {item['availability'] === 'OVERSIZE' ? (
            <Line muted>
              Document exceeds the current reading limit; another source may be
              used.
            </Line>
          ) : item['availability'] === 'UNREACHABLE' ? (
            <Line muted>
              Source could not be reached; another source may be used.
            </Line>
          ) : null}
          {year === undefined ? null : (
            <Line muted>
              Year mentioned in the title or URL: {year}. Model-year
              applicability is unverified.
            </Line>
          )}
          {item['modelMatch'] === false ? (
            <Line muted>Model match is not confirmed by the link text.</Line>
          ) : null}
        </>
      ) : null}
      {item['excerpt'] ? (
        <View className="border-border my-1 border-l-2 pl-2">
          <Text className="text-sm leading-6">{format(item['excerpt'])}</Text>
        </View>
      ) : null}
      {!specificationDiscovery && item['market'] ? (
        <Line>
          {format(item['market'])} · {format(item['modelYear'])} ·{' '}
          {format(item['identityStatus'])}
        </Line>
      ) : null}
      {item['author'] || item['publishedOn'] ? (
        <Line>
          {format(item['author'])} · {format(item['publishedOn'])}
        </Line>
      ) : null}
      {item['scope'] ? (
        <Line>
          Scope: {format(item['scope'])} · {format(item['kind'])} ·{' '}
          {format(item['sentiment'])}
        </Line>
      ) : null}
      {item['locator'] ? <Line>{format(item['locator'])}</Line> : null}
      {item['conditions'] ? (
        <Line>Conditions: {format(item['conditions'])}</Line>
      ) : null}
      {!specificationDiscovery && item['availability'] ? (
        <Text className="text-sm">{format(item['availability'])}</Text>
      ) : null}
      {item['packages'] ? (
        <Line>Packages: {format(item['packages'])}</Line>
      ) : null}
      {item['context'] ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Passage context"
            accessibilityState={{ expanded: contextOpen }}
            className="min-h-11 flex-row items-center gap-1 self-start"
            onPress={() => setContextOpen(!contextOpen)}
          >
            <Icon
              as={contextOpen ? ChevronDown : ChevronRight}
              className="text-foreground size-4"
            />
            <Text className="text-sm underline">Passage context</Text>
          </Pressable>
          {contextOpen ? (
            <Text className="text-sm leading-6">{format(item['context'])}</Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function Line({
  muted = false,
  children,
}: {
  muted?: boolean;
  children: ReactNode;
}) {
  return (
    <Text className={muted ? 'text-muted-foreground text-xs' : 'text-xs'}>
      {children}
    </Text>
  );
}
