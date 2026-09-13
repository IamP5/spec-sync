import comparison from "../../public/data/comparison-verified-v7.json";

// This reviewed video dataset enriches the original capture with primary sources.
// It does not replace the live application catalog or rewrite the API snapshot.
export type ComparisonCell = {
  readonly v: string;
  readonly known: boolean;
  readonly note?: string;
};

export type ComparisonRow = {
  readonly code: string;
  readonly label: string;
  readonly cells: readonly ComparisonCell[];
  readonly note?: string;
};

const sourceFor = (id: string) => {
  const source = comparison.sources.find((candidate) => candidate.id === id);
  if (!source) throw new Error(`Missing reviewed comparison source: ${id}`);
  return source;
};

export const comparisonVehicles = comparison.vehicles;
export const comparisonRows: readonly ComparisonRow[] = comparison.rows;
const cells = comparisonRows.flatMap((row) => row.cells);
export const comparisonSummary = `3 veículos · Brasil · ${cells.filter((cell) => cell.known).length} de ${cells.length} valores confirmados`;
export const comparisonFootnote = comparison.footnote;

export const comparisonEvidence = comparison.evidence.map((entry) => {
  const source = sourceFor(entry.sourceId);
  return {
    ...entry,
    url: source.url,
    domain: new URL(source.url).hostname.replace(/^www\./, ""),
  };
});

const ford = sourceFor("ford-2026");
export const fordComparisonSource = {
  title: "Ranger Raptor · versão brasileira 2026",
  excerpt: "Motor 3.0 V6 biturbo · 397 cv · 583 Nm",
  capturedLabel: "Consultado em 13/09/2026 · Ford Brasil · configuração AOD6",
  url: ford.url,
};
