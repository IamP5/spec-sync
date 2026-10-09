import { ExternalLink } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Badge } from '../../../../design-system/components/ui/badge';
import { Button } from '../../../../design-system/components/ui/button';
import { Icon } from '../../../../design-system/components/ui/icon';
import { Text } from '../../../../design-system/components/ui/text';
import {
  researchIsActive,
  type ResearchSnapshot,
} from '../../data/research-contracts';
import {
  plural,
  researchCanReplay,
  researchEvidenceConfigurations,
  type ResearchEvidenceFocus,
  researchRequested,
  researchSharingLabel,
  researchStatus,
} from '../../data/research-presentation';
import { Disclosure } from './disclosure';
import { ResearchEvidenceConfiguration } from './research-evidence-configuration';

/**
 * The research evidence (web `ResearchResultPane`): status, the preserved
 * source and its revision, every configuration's claims with their cited
 * lines, and the request's own actions as intentions.
 */
export function ResearchEvidencePane({
  research,
  focus,
  busy,
  replaying,
  updating,
  error,
  onOpenSource,
  onCancel,
  onRefresh,
  onReplay,
}: {
  research: ResearchSnapshot;
  focus: ResearchEvidenceFocus | null;
  busy: boolean;
  replaying: boolean;
  updating: boolean;
  error: string;
  onOpenSource: (url: string) => void;
  onCancel: () => void;
  onRefresh: () => void;
  onReplay: () => void;
}) {
  const active = researchIsActive(research);
  const retrying =
    active &&
    (research.attempts > 1 ||
      (research.status === 'QUEUED' && research.attempts > 0));
  const terminalError =
    research.status === 'FAILED' || research.status === 'REJECTED'
      ? research.error
      : null;
  const configurations = researchEvidenceConfigurations(research, focus);
  const source = research.source;
  const count = research.configurations.length;
  return (
    <View accessibilityLabel="Research evidence">
      <View className="flex-row flex-wrap items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="text-sm font-semibold">
            {research.request.brand} {research.request.model} ·{' '}
            {research.request.modelYear} · BR
          </Text>
          <Text
            className="text-muted-foreground mt-1 text-sm"
            accessibilityLiveRegion="polite"
          >
            {researchStatus(research)}
          </Text>
        </View>
        <Badge variant="secondary">
          <Text>{researchSharingLabel(research.disposition)}</Text>
        </Badge>
      </View>
      {active ? (
        <Text className="text-muted-foreground mt-2 text-sm">
          {retrying
            ? 'Research retries automatically and reuses completed work. '
            : ''}
          Progress updates automatically. You can leave this chat and reopen the
          research later.
        </Text>
      ) : null}
      {research.requestStatus === 'CANCELLED' ? (
        <Text className="mt-2 text-sm">
          You stopped following this request. Shared research can continue for
          other users.
        </Text>
      ) : null}
      {research.replayedFromWorkId ? (
        <Text className="text-muted-foreground mt-2 text-xs">
          New interpretation of the saved source. The original research is
          preserved; this request is also available in your research history.
        </Text>
      ) : null}
      {count ? (
        <Text className="bg-muted mt-3 rounded-lg p-2 text-xs">
          {research.status === 'PUBLISHED'
            ? 'A reviewed catalog update was published. The source findings below may include claims outside the published selection.'
            : 'Unreviewed source findings. These specifications have not been accepted into the catalog.'}{' '}
          Reliability has not been calibrated; inspect the evidence and issues.
        </Text>
      ) : null}
      {terminalError ? (
        <Text role="alert" className="text-destructive mt-3 text-sm">
          {terminalError}
        </Text>
      ) : null}
      {error ? (
        <Text role="alert" className="text-destructive mt-3 text-sm">
          {error}
        </Text>
      ) : null}
      {research.warnings.length ? (
        <View className="mt-2">
          <Disclosure
            summary={plural(
              research.warnings.length,
              'one warning about the source',
              '{n} warnings about the source',
            )}
            summaryClassName="font-medium"
            initiallyOpen={!focus}
          >
            <View accessibilityLabel="Research warnings">
              {research.warnings.map((warning, index) => (
                <Text
                  key={index}
                  className="text-muted-foreground mt-1 text-sm"
                >
                  • {warning}
                </Text>
              ))}
            </View>
          </Disclosure>
        </View>
      ) : null}
      {source ? (
        <View className="mt-3">
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`${source.title || source.url}, opens in the browser`}
            className="min-h-11 flex-row items-center gap-1"
            onPress={() => onOpenSource(source.url)}
          >
            <Text className="flex-1 text-sm underline">
              {source.title || source.url}
            </Text>
            <Icon as={ExternalLink} className="text-muted-foreground size-4" />
          </Pressable>
          <Disclosure
            summary="Source revision"
            summaryClassName="text-muted-foreground"
          >
            <View className="gap-1">
              <Text className="text-muted-foreground text-xs">
                Original SHA-256
              </Text>
              <Text className="text-xs">{source.originalSha256}</Text>
              <Text className="text-muted-foreground text-xs">
                Transcript SHA-256
              </Text>
              <Text className="text-xs">{source.textSha256}</Text>
              <Text className="text-muted-foreground text-xs">Reader</Text>
              <Text className="text-xs">{source.parserVersion}</Text>
              {research.ontologyRevision === undefined ? null : (
                <>
                  <Text className="text-muted-foreground text-xs">
                    Catalog vocabulary revision
                  </Text>
                  <Text className="text-xs">{research.ontologyRevision}</Text>
                </>
              )}
              {research.normalizationRevision ? (
                <>
                  <Text className="text-muted-foreground text-xs">
                    Value normalization
                  </Text>
                  <Text className="text-xs">
                    {research.normalizationRevision}
                  </Text>
                </>
              ) : null}
            </View>
          </Disclosure>
        </View>
      ) : null}
      {count ? (
        <>
          <Text role="heading" className="mt-4 text-sm font-medium">
            {focus
              ? 'Selected specification evidence'
              : `${count} configurations from the source`}
          </Text>
          <View className="mt-2 gap-2">
            {configurations.map((configuration) => (
              <ResearchEvidenceConfiguration
                key={configuration.name}
                configuration={configuration}
                requested={researchRequested(research, configuration.name)}
                focused={!!focus}
              />
            ))}
          </View>
        </>
      ) : null}
      <View className="mt-4 flex-row flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="min-h-11"
          accessibilityRole="button"
          accessibilityLabel="Refresh research"
          disabled={updating || busy || replaying}
          onPress={onRefresh}
        >
          <Text>Refresh research</Text>
        </Button>
        {researchCanReplay(research) ? (
          <Button
            variant="outline"
            size="sm"
            className="min-h-11"
            accessibilityRole="button"
            accessibilityLabel="Reinterpret saved source"
            disabled={updating || busy || replaying}
            onPress={onReplay}
          >
            <Text>
              {replaying
                ? 'Starting new interpretation…'
                : 'Reinterpret saved source'}
            </Text>
          </Button>
        ) : null}
        {research.requestStatus === 'ACTIVE' ? (
          <Button
            variant="ghost"
            size="sm"
            className="min-h-11"
            accessibilityRole="button"
            accessibilityLabel="Stop following"
            disabled={busy || replaying}
            onPress={onCancel}
          >
            <Text>{busy ? 'Stopping follow…' : 'Stop following'}</Text>
          </Button>
        ) : null}
      </View>
    </View>
  );
}
