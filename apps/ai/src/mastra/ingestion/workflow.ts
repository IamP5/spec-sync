import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

import {
  configurationDraftSchema,
  configurationExtractionInputSchema,
  draftSchema,
  extractConfigurationClaims,
  extractionInput,
  sourceSchema,
} from './extraction';
import {
  identifiedConfigurationSchema,
  identifyConfigurations,
  legendSchema,
  selectConfigurations,
} from './identification';
import { captureSourceCached } from './source';

export const VEHICLE_INGESTION_WORKFLOW_ID = 'vehicleIngestion';

const capturedSchema = extractionInput.extend({
  source: sourceSchema.extend({ pageCount: z.number().int().nonnegative() }),
});
const identifiedSchema = capturedSchema.extend({
  scopes: z.array(
    z.object({ name: z.string(), found: identifiedConfigurationSchema }),
  ),
  legend: legendSchema,
  warnings: z.array(z.string()),
});

const never = new AbortController().signal;

/** Downloads and transcribes the source; the cache lets a chat preview and the run share one capture. */
const captureStep = createStep({
  id: 'capture-source',
  description:
    'Download the manufacturer HTML page or PDF and produce the line-numbered evidence text',
  inputSchema: extractionInput,
  outputSchema: capturedSchema,
  execute: async ({ inputData, abortSignal }) => ({
    ...inputData,
    source: await captureSourceCached(
      inputData.request.sourceUrl,
      abortSignal ?? never,
    ),
  }),
});

/** Lists the configurations the document presents and matches them with the request. */
const identifyStep = createStep({
  id: 'identify-configurations',
  description:
    'Find every configuration in the source, its legend and identity evidence; match the requested names',
  inputSchema: capturedSchema,
  outputSchema: identifiedSchema,
  execute: async ({ inputData, abortSignal }) => {
    const identification = await identifyConfigurations(
      inputData.source.text,
      inputData.request,
      abortSignal ?? never,
    );
    const selection = selectConfigurations(
      inputData.request.configurations,
      identification.configurations,
    );
    const warnings = [...selection.warnings, ...identification.notes];
    if (identification.modelYearNote)
      warnings.push(
        `Model year stated by the source: ${identification.modelYearNote}`,
      );
    else
      warnings.push(
        'The source does not state a model year; confirm applicability before publishing.',
      );
    return {
      ...inputData,
      scopes: selection.scopes,
      legend: identification.legend,
      warnings,
    };
  },
});

/** Extracts and self-verifies the claims of one configuration. */
const extractStep = createStep({
  id: 'extract-configuration',
  description:
    'Extract evidenced claims for one configuration, verify them against the source and repair once',
  inputSchema: configurationExtractionInputSchema,
  outputSchema: configurationDraftSchema,
  execute: ({ inputData, abortSignal }) =>
    extractConfigurationClaims(inputData, abortSignal ?? never),
});

/** Joins the per-configuration drafts with the source and the coverage report. */
const assembleStep = createStep({
  id: 'assemble-draft',
  description: 'Assemble the reviewable draft',
  inputSchema: z.array(configurationDraftSchema),
  outputSchema: draftSchema,
  execute: async ({ inputData, getStepResult }) => {
    const identified = getStepResult(identifyStep);
    if (!identified) throw new Error('Identification result is missing.');
    const { pageCount: _pageCount, ...source } = identified.source;
    return draftSchema.parse({
      source,
      configurations: inputData,
      warnings: identified.warnings,
      ontologyRevision: identified.ontologyRevision,
      normalizationRevision: identified.normalizationRevision,
      readerRevision: source.parserVersion,
    });
  },
});

/**
 * One source, one or more configurations: capture the document, identify the
 * configurations it presents, extract the claims of each selected
 * configuration in parallel, and assemble the draft the API validates and
 * stores for review. The workflow is bounded and stateless between runs; the
 * API owns run status, review and publication.
 */
export const vehicleIngestionWorkflow = createWorkflow({
  id: VEHICLE_INGESTION_WORKFLOW_ID,
  description:
    'Reviewed vehicle specification import: capture a source document, identify its configurations and extract evidenced claims',
  inputSchema: extractionInput,
  outputSchema: draftSchema,
})
  .then(captureStep)
  .then(identifyStep)
  .map(async ({ inputData }) =>
    inputData.scopes.map((scope) => ({
      text: inputData.source.text,
      request: inputData.request,
      attributes: inputData.attributes,
      scope,
      legend: inputData.legend,
      terminology: inputData.terminology,
      attributeValues: inputData.attributeValues,
      readerRevision: inputData.source.parserVersion,
    })),
  )
  .foreach(extractStep, { concurrency: 2 })
  .then(assembleStep)
  .commit();
