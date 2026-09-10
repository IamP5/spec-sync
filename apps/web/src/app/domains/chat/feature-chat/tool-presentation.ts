import type { AssistantMessage, Message } from '@ag-ui/client';

import { safeSourceUrl } from '../util/knowledge-display';

export interface ToolPresentation {
  message: AssistantMessage;
  notes: {
    id: string;
    text: string;
    sources?: { url: string; title: string }[];
    warnings?: string[];
  }[];
}

const internalTools = new Set([
  'skill',
  'listComparisonAttributes',
  'resolveComparisonConcepts',
]);
const researchTools = new Set([
  'researchVehicleSpecifications',
  'getVehicleResearch',
  'replayVehicleResearch',
  'reviewVehicleResearch',
]);

/** A display projection only: the agent and activity retain every call and result. */
export function toolPresentation(
  messages: Message[],
): Map<string, ToolPresentation> {
  const results = new Map(
    messages.flatMap((message) =>
      message.role === 'tool' ? [[message.toolCallId, message] as const] : [],
    ),
  );
  const latestReviews = new Map<string, string>();
  for (const message of messages) {
    if (message.role !== 'assistant') continue;
    for (const call of message.toolCalls ?? []) {
      const data = record(results.get(call.id)?.content);
      const key = data['workId'] ?? data['id'];
      if (
        call.function.name === 'reviewVehicleResearch' &&
        typeof key === 'string' &&
        !results.get(call.id)?.error
      )
        latestReviews.set(key, call.id);
    }
  }
  const views = new Map<string, ToolPresentation>();
  const previousResearch = new Set<string>();
  const displayedCalls = new Set<string>();
  let group: AssistantMessage[] = [];
  const finishGroup = () => {
    const mountedResearch = new Set<string>();
    const hasResearchStart = group.some((message) =>
      message.toolCalls?.some(
        (call) =>
          ['researchVehicleSpecifications', 'replayVehicleResearch'].includes(
            call.function.name,
          ) && typeof record(results.get(call.id)?.content)['id'] === 'string',
      ),
    );
    const emptyDiscoveries: {
      view: ToolPresentation;
      query: string;
      id: string;
      official: boolean;
      warnings: string[];
    }[] = [];
    for (const message of group) {
      const view: ToolPresentation = {
        message: { ...message, toolCalls: [] },
        notes: [],
      };
      views.set(message.id, view);
      for (const call of message.toolCalls ?? []) {
        if (displayedCalls.has(call.id)) continue;
        displayedCalls.add(call.id);
        const result = results.get(call.id);
        const data = record(result?.content);
        const args = record(call.function.arguments);
        const name = call.function.name;
        const failed =
          !!result?.error ||
          ['ERROR', 'UNAVAILABLE'].includes(String(data['status']));
        if (internalTools.has(name) && !failed) continue;
        if (
          result &&
          !failed &&
          name === 'searchVehicleConfigurations' &&
          Array.isArray(data['items']) &&
          !data['items'].length
        ) {
          view.notes.push({
            id: call.id,
            text: `No catalog configurations found for ${scope(args)}.`,
          });
          continue;
        }
        if (
          [
            'discoverVehicleContent',
            'discoverVehicleSpecificationSources',
          ].includes(name) &&
          result &&
          !failed &&
          data['status'] === 'EMPTY'
        ) {
          emptyDiscoveries.push({
            view,
            query: scope(args),
            id: call.id,
            official: name === 'discoverVehicleSpecificationSources',
            warnings: stringList(data['warnings']),
          });
          continue;
        }
        if (
          hasResearchStart &&
          name === 'discoverVehicleSpecificationSources' &&
          !failed &&
          Array.isArray(data['items']) &&
          data['items'].length
        ) {
          const sources = data['items'].flatMap((item: unknown) => {
            if (!item || typeof item !== 'object' || !('url' in item))
              return [];
            const url = safeSourceUrl(item.url);
            return url
              ? [
                  {
                    url,
                    title:
                      'title' in item && typeof item.title === 'string'
                        ? item.title
                        : url,
                  },
                ]
              : [];
          });
          if (sources.length) {
            view.notes.push({
              id: call.id,
              text: `Specification source candidates for ${scope(args)}`,
              sources,
              warnings: stringList(data['warnings']),
            });
            continue;
          }
        }
        if (researchTools.has(name) && typeof data['id'] === 'string') {
          const id = data['id'];
          const review = latestReviews.get(String(data['workId'] ?? id));
          if (review && review !== call.id) continue;
          if (mountedResearch.has(id)) continue;
          if (
            name === 'getVehicleResearch' &&
            hasResearchStart &&
            previousResearch.has(id)
          ) {
            view.notes.push({
              id: call.id,
              text: `Earlier research status: ${String(data['status'] ?? 'checked').toLowerCase()}. Another research result is available in this response.`,
            });
            continue;
          }
          mountedResearch.add(id);
        }
        view.message.toolCalls?.push(call);
      }
    }
    for (const official of [false, true]) {
      const empty = emptyDiscoveries.filter(
        (entry) => entry.official === official,
      );
      const first = empty[0];
      if (!first) continue;
      const queries = [...new Set(empty.map((entry) => entry.query))];
      first.view.notes.push({
        id: first.id,
        text: `No ${official ? 'specification sources' : 'external links'} found for ${queries.join('; ')} (${empty.length} ${empty.length === 1 ? 'search' : 'searches'}).`,
        ...(official
          ? { warnings: [...new Set(empty.flatMap((entry) => entry.warnings))] }
          : {}),
      });
    }
    for (const id of mountedResearch) previousResearch.add(id);
    group = [];
  };
  for (const message of messages) {
    if (message.role === 'user') finishGroup();
    else if (message.role === 'assistant') group.push(message);
  }
  finishGroup();
  return views;
}

function scope(args: Record<string, unknown>): string {
  const vehicle = [args['brand'], args['model']]
    .filter((value) => typeof value === 'string')
    .join(' ');
  return [
    args['q'] || args['vehicle'] || vehicle || 'this query',
    args['market'],
    args['modelYear'],
  ]
    .filter((value) => typeof value === 'string' || typeof value === 'number')
    .join(' · ');
}
function record(value: string | undefined): Record<string, unknown> {
  try {
    const result: unknown = JSON.parse(value ?? 'null');
    return result !== null &&
      typeof result === 'object' &&
      !Array.isArray(result)
      ? (result as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}
