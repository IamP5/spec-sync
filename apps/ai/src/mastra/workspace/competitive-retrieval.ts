import { z } from 'zod';

import { catalogRequest, withToolFailure } from '../catalog/api-client';
import { searchCatalog } from '../catalog/catalog-search';
import {
  attributeSchema,
  type Comparison,
  comparisonSchema,
} from '../catalog/contracts';
import { retrieveReviewEvidence } from '../catalog/knowledge-results';
import { readResearch } from '../research/client';
import { summarizeResearch } from '../research/contracts';
import { compileCompetitiveWorkspace, sameJson } from './competitive-compiler';
import {
  type analystNeedsInputSchema,
  type CompetitiveAction,
  type CompetitivePanel,
  type CompetitivePlan,
  competitivePlanSchema,
  type CompetitiveWorkspaceOutput,
  type ResolvedCompetitivePanel,
  type targetScenarioSchema,
} from './competitive-contracts';
import {
  authoritativeConfigurations,
  rejectCompetitiveAction,
} from './competitive-history';

const attributesResult = z.object({ items: z.array(attributeSchema) });
type Failure = { status: 'ERROR'; message: string; retryable: boolean };
type NeedsInput = z.infer<typeof analystNeedsInputSchema>;
export interface CompetitiveRetrievalContext {
  uid: string;
  surfaceId: string;
  baseRevision: number;
  actionId?: string;
  action?: CompetitiveAction;
  previous?: CompetitiveWorkspaceOutput;
  signal?: AbortSignal;
}
const missing = (
  message: string,
  fields: NeedsInput['fields'],
): NeedsInput => ({ status: 'NEEDS_INPUT', message, fields });

/** Fetches authoritative data once per intent; comparison-derived panels share the same response. */
export async function retrieveCompetitiveWorkspace(
  input: CompetitivePlan,
  context: CompetitiveRetrievalContext,
) {
  const plan = competitivePlanSchema.parse(input);
  const { signal } = context;
  signal?.throwIfAborted();
  const targetedAction =
    context.action?.action !== 'applyBrief' &&
    context.previous &&
    sameJson(plan.context, context.previous.snapshot.plan.context)
      ? context.action
      : undefined;
  const targetedPanelId =
    targetedAction?.action === 'investigateGap'
      ? plan.panels.find(
          (panel) =>
            panel.type === 'evidence' &&
            panel.configurationId === targetedAction.values.configurationId &&
            panel.attributeCode === targetedAction.values.attributeCode,
        )?.id
      : targetedAction?.componentId;
  const preservedPanel = (panel: CompetitivePanel) =>
    targetedAction && panel.id !== targetedPanelId
      ? context.previous?.snapshot.panels.find(
          (old) => old.id === panel.id && sameJson(old.args, panel),
        )
      : undefined;
  const definitions =
    targetedAction && context.previous?.snapshot.availableAttributes.length
      ? { items: context.previous.snapshot.availableAttributes }
      : await withToolFailure(() =>
          catalogRequest(
            '/api/comparison-attributes',
            {},
            attributesResult,
            signal,
          ),
        );
  signal?.throwIfAborted();
  const allAttributes = 'items' in definitions ? definitions.items : [];
  const requested = new Set([
    ...plan.context.attributes,
    ...plan.panels.flatMap((panel) =>
      panel.type === 'scenario' ? [panel.attributeCode] : [],
    ),
  ]);
  const availableAttributes = [
    ...allAttributes.filter((item) => requested.has(item.code)),
    ...allAttributes.filter((item) => !requested.has(item.code)),
  ].slice(0, 50);
  const pending = new Map<string, Promise<Comparison | Failure | NeedsInput>>();
  if (targetedAction && targetedAction.action !== 'retryPanel') {
    const previousComparison = context.previous?.snapshot.panels
      .flatMap((panel) =>
        panel.type === 'comparison' && 'configurations' in panel.result
          ? [panel.result]
          : panel.type === 'gaps' && panel.result.status === 'OK'
            ? [panel.result.comparison]
            : [],
      )
      .find((result) =>
        [...requested].every((code) =>
          result.rows.some((row) => row.attribute.code === code),
        ),
      );
    if (previousComparison)
      pending.set('comparison', Promise.resolve(previousComparison));
  }
  const reviewRequests = new Map<
    string,
    Promise<Awaited<ReturnType<typeof retrieveReviewEvidence>> | Failure>
  >();
  const researchRequests = new Map<
    string,
    Promise<Awaited<ReturnType<typeof summarizeResearch>> | Failure>
  >();
  const comparison = (): Promise<Comparison | Failure | NeedsInput> => {
    let result = pending.get('comparison');
    if (result) return result;
    result = (async () => {
      if (!('items' in definitions)) return definitions;
      if (plan.context.selectedConfigurationIds.length < 2)
        return missing(
          'Select two to five resolved configurations for the competitive analysis.',
          ['configurations'],
        );
      if (!requested.size || requested.size > 12)
        return missing('Choose one to twelve relevant supported attributes.', [
          'attributes',
        ]);
      if (
        [...requested].some(
          (code) => !allAttributes.some((item) => item.code === code),
        )
      )
        return missing(
          'The requested attribute is not supported by the current catalog.',
          ['attributes'],
        );
      const response = await withToolFailure(() =>
        catalogRequest(
          '/api/comparisons',
          {
            configurationIds: plan.context.selectedConfigurationIds,
            attributes: [...requested],
          },
          comparisonSchema,
          signal,
        ),
      );
      signal?.throwIfAborted();
      if ('status' in response) return response;
      if (
        response.rows.length > 12 ||
        response.rows.some(
          (row) =>
            !requested.has(row.attribute.code) ||
            row.cells.length > 5 ||
            row.cells.some(
              (cell) =>
                !plan.context.selectedConfigurationIds.includes(
                  cell.configurationId,
                ),
            ),
        )
      )
        return {
          status: 'ERROR',
          message:
            'The catalog response exceeded the requested comparison scope.',
          retryable: false,
        };
      const scope = plan.context;
      if (
        response.configurations.length !==
          scope.selectedConfigurationIds.length ||
        response.configurations.some(
          (item) =>
            !scope.selectedConfigurationIds.includes(item.id) ||
            (scope.market && item.market !== scope.market) ||
            (scope.modelYear && item.modelYear !== scope.modelYear),
        )
      )
        return missing(
          'The returned configurations do not match the selected market/year. Resolve the selection before comparing.',
          ['configurations'],
        );
      return response;
    })();
    pending.set('comparison', result);
    return result;
  };
  // Selection performs at most five requests internally. Finish it before the
  // remaining panels, whose distinct requests are also bounded by five.
  const selection = plan.panels.find((panel) => panel.type === 'selection');
  const catalog =
    selection?.type === 'selection' && !preservedPanel(selection)
      ? await searchCatalog(
          {
            searches: selection.searches.map((search) => ({
              ...search,
              ...(plan.context.market ? { market: plan.context.market } : {}),
              ...(plan.context.modelYear
                ? { modelYear: plan.context.modelYear }
                : {}),
            })),
          },
          signal,
        )
      : undefined;
  signal?.throwIfAborted();
  const panels = await Promise.all(
    plan.panels.map(async (panel): Promise<ResolvedCompetitivePanel> => {
      const preserved = preservedPanel(panel);
      if (preserved) return preserved;
      const common = { id: panel.id, title: panel.title, args: panel };
      switch (panel.type) {
        case 'selection': {
          if (!catalog) throw new Error('Selection catalog was not resolved.');
          return {
            ...common,
            type: panel.type,
            result:
              'items' in catalog
                ? {
                    ...catalog,
                    items: catalog.items.slice(0, 40),
                    ...(!('items' in definitions)
                      ? {
                          status: 'PARTIAL' as const,
                          notices: [
                            ...catalog.notices,
                            `Attribute definitions: ${definitions.message}`,
                          ],
                        }
                      : {}),
                  }
                : catalog,
          };
        }
        case 'comparison':
          return { ...common, type: panel.type, result: await comparison() };
        case 'gaps': {
          const result = await comparison();
          return {
            ...common,
            type: panel.type,
            result:
              'status' in result
                ? result
                : {
                    status: 'OK',
                    comparison: result,
                    items: result.rows
                      .flatMap((row) =>
                        row.cells.flatMap((cell) =>
                          cell.knowledgeStatus === 'KNOWN'
                            ? []
                            : [
                                {
                                  configurationId: cell.configurationId,
                                  attributeCode: row.attribute.code,
                                  knowledgeStatus: cell.knowledgeStatus,
                                  reason: cell.reason,
                                  observationCount: cell.observations.length,
                                },
                              ],
                        ),
                      )
                      .slice(0, 60),
                  },
          };
        }
        case 'scenario': {
          if (panel.targetValue === undefined)
            return {
              ...common,
              type: panel.type,
              result: missing(
                'Enter an explicit analyst target in the attribute’s catalog unit. The target is an assumption.',
                ['targetValue'],
              ),
            };
          const result = await comparison();
          return {
            ...common,
            type: panel.type,
            result:
              'status' in result
                ? result
                : calculateTargetScenario(result, panel),
          };
        }
        case 'evidence': {
          if (
            !plan.context.selectedConfigurationIds.includes(
              panel.configurationId,
            )
          )
            return {
              ...common,
              type: panel.type,
              result: missing(
                'Select this configuration in the analyst brief before investigating its review evidence.',
                ['configurations'],
              ),
            };
          const args = {
            configurationId: panel.configurationId,
            q: panel.q,
            attributeCode: panel.attributeCode,
            limit: panel.limit,
          };
          const key = JSON.stringify(args);
          let result = reviewRequests.get(key);
          if (!result) {
            result = withToolFailure(async () => {
              const evidence = await retrieveReviewEvidence(args, signal);
              return {
                ...evidence,
                items: evidence.items.slice(0, panel.limit),
              };
            });
            reviewRequests.set(key, result);
          }
          return { ...common, type: panel.type, result: await result };
        }
        case 'research': {
          let result = researchRequests.get(panel.requestId);
          if (!result) {
            result = withToolFailure(async () =>
              summarizeResearch(
                await readResearch(context.uid, panel.requestId, signal),
              ),
            );
            researchRequests.set(panel.requestId, result);
          }
          return { ...common, type: panel.type, result: await result };
        }
      }
    }),
  );
  signal?.throwIfAborted();
  const output = compileCompetitiveWorkspace(
    plan,
    panels,
    availableAttributes,
    context,
  );
  if (
    output.status !== 'ERROR' &&
    plan.context.baselineConfigurationId &&
    authoritativeConfigurations(output)
      .find((item) => item.id === plan.context.baselineConfigurationId)
      ?.brand.trim()
      .toLowerCase() !== 'ford'
  )
    rejectCompetitiveAction(
      'INVALID_ACTION',
      'Resolve the selected Ford baseline through a selection or comparison panel before using it.',
      context.surfaceId,
    );
  return output;
}

/** Only the selected accepted numeric observation participates; no unit conversion or winner inference. */
export function calculateTargetScenario(
  comparison: Comparison,
  panel: Extract<CompetitivePanel, { type: 'scenario' }>,
): z.infer<typeof targetScenarioSchema> | NeedsInput {
  const row = comparison.rows.find(
    (row) => row.attribute.code === panel.attributeCode,
  );
  if (
    !row ||
    row.attribute.valueType !== 'NUMBER' ||
    panel.targetValue === undefined
  )
    return missing(
      'Select a supported numeric attribute and provide its target in the existing unit.',
      ['attributes', 'targetValue'],
    );
  const targetValue = panel.targetValue;
  return {
    status: 'OK',
    assumption: 'USER_DEFINED_TARGET',
    attribute: row.attribute,
    targetValue,
    items: row.cells.map((cell) => {
      const observation =
        cell.knowledgeStatus === 'KNOWN'
          ? cell.observations.find(
              (item) =>
                item.id === cell.selectedObservationId &&
                item.reviewStatus === 'ACCEPTED',
            )
          : undefined;
      const numeric =
        typeof observation?.value === 'number' &&
        Number.isFinite(observation.value)
          ? observation.value
          : null;
      const delta = numeric === null ? null : numeric - targetValue;
      return {
        configurationId: cell.configurationId,
        knowledgeStatus: cell.knowledgeStatus,
        observationId: numeric === null ? null : (observation?.id ?? null),
        value: numeric,
        delta: delta !== null && Number.isFinite(delta) ? delta : null,
        qualifiers: observation?.qualifiers ?? {},
        evidence: observation?.evidence ?? [],
        reason:
          numeric === null
            ? (cell.reason ??
              'No single accepted numeric observation is available.')
            : cell.reason,
      };
    }),
  };
}
