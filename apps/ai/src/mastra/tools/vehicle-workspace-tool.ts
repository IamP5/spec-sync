import { createTool } from '@mastra/core/tools';

import {
  vehicleWorkspaceInputSchema,
  vehicleWorkspaceOutputSchema,
} from '../workspace/contracts';
import { retrieveVehicleWorkspace } from '../workspace/retrieval';

export const renderVehicleWorkspace = createTool({
  id: 'renderVehicleWorkspace',
  description:
    'Build a vehicle workspace or dashboard with 1–4 catalog, comparison, specification or review panels. Supply retrieval intent and resolved UUIDs only; the server fetches authoritative results and compiles the UI. Comparison and specification panels require 1–12 relevant supported attribute codes; use listComparisonAttributes to choose them. Use for combined investigations, not to decorate already retrieved results. Simple questions use the ordinary vehicle tools. Partial retrieval failures remain visible beside successful panels.',
  inputSchema: vehicleWorkspaceInputSchema,
  outputSchema: vehicleWorkspaceOutputSchema,
  execute: (input, context) =>
    retrieveVehicleWorkspace(input, context?.abortSignal),
});
