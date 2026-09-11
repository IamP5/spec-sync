/** Registration policy: discovery/evidence results are always user-facing. */
export const BACKGROUND_VEHICLE_TOOLS = [
  'listComparisonAttributes',
  'resolveComparisonConcepts',
] as const;

const background = new Set<string>(['skill', ...BACKGROUND_VEHICLE_TOOLS]);
export function isBackgroundTool(name: string): boolean {
  return background.has(name);
}
