export const meta = {
  name: 'catalog-gap-audit',
  description:
    'Sweep official sources per catalog model, find missing specs, verify them, and propose ontology additions',
  whenToUse:
    'Refreshing the vehicle catalog against official Brazilian manufacturer pages and technical sheets',
  phases: [
    { title: 'Export', detail: 'dump catalog + ontology to JSON' },
    {
      title: 'Discover',
      detail: 'official page + ficha técnica per model',
      model: 'opus',
    },
    { title: 'Capture', detail: 'text + hash per source', model: 'sonnet' },
    {
      title: 'Analyze',
      detail: 'fills, conflicts, concepts per model',
      model: 'opus',
    },
    {
      title: 'Verify',
      detail: 'deterministic checks + refutation',
      model: 'opus',
    },
    {
      title: 'Ontology',
      detail: 'cluster concepts into proposals',
      model: 'opus',
    },
    {
      title: 'Critique',
      detail: 'duplicate + definition lenses',
      model: 'opus',
    },
    {
      title: 'Synthesize',
      detail: 'report, snippets, completeness critic',
      model: 'opus',
    },
  ],
};

// ---- inputs -------------------------------------------------------------
if (!args || !args.stamp)
  throw new Error(
    'args.stamp (ISO timestamp) is required: scripts cannot read the clock',
  );
const stamp = args.stamp;
const outDir =
  args.outDir ?? `tools/catalog/gap-audit/out/${stamp.replace(/[:]/g, '-')}`;
const only =
  Array.isArray(args.models) && args.models.length ? args.models : null;
const maxSources = args.maxSourcesPerModel ?? 6;
const README = 'tools/catalog/gap-audit/README.md';
const CAPTURE = 'tools/catalog/gap-audit/CAPTURE.md';

// ---- schemas ------------------------------------------------------------
const INDEX = {
  type: 'object',
  properties: {
    attributeCount: { type: 'number' },
    models: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          slug: { type: 'string' },
          brand: { type: 'string' },
          model: { type: 'string' },
          dataset: { type: 'string' },
          configurationCount: { type: 'number' },
          knownSourceCount: { type: 'number' },
          notReportedCells: { type: 'number' },
          file: { type: 'string' },
        },
        required: [
          'slug',
          'brand',
          'model',
          'dataset',
          'configurationCount',
          'file',
        ],
      },
    },
  },
  required: ['attributeCount', 'models'],
};
const SOURCES = {
  type: 'object',
  properties: {
    sources: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          url: { type: 'string' },
          kind: { type: 'string', enum: ['page', 'pdf'] },
          title: { type: 'string' },
          known: { type: 'boolean' },
          coversConfigurations: { type: 'array', items: { type: 'string' } },
          why: { type: 'string' },
        },
        required: ['key', 'url', 'kind', 'title', 'known'],
      },
    },
    dropped: { type: 'array', items: { type: 'string' } },
    notes: { type: 'array', items: { type: 'string' } },
  },
  required: ['sources'],
};
const CAPTURES = {
  type: 'object',
  properties: {
    captures: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          url: { type: 'string' },
          kind: { type: 'string' },
          method: { type: 'string' },
          sha256: { type: 'string' },
          bytes: { type: 'number' },
          textChars: { type: 'number' },
          matchesKnownHash: { type: 'boolean' },
        },
        required: [
          'key',
          'url',
          'kind',
          'sha256',
          'textChars',
          'matchesKnownHash',
        ],
      },
    },
    failures: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          url: { type: 'string' },
          error: { type: 'string' },
        },
        required: ['key', 'error'],
      },
    },
  },
  required: ['captures', 'failures'],
};
const COUNTS = {
  type: 'object',
  properties: {
    file: { type: 'string' },
    fills: { type: 'number' },
    conflicts: { type: 'number' },
    concepts: { type: 'number' },
    notes: { type: 'array', items: { type: 'string' } },
  },
  required: ['file', 'fills', 'conflicts', 'concepts'],
};
const VERIFIED = {
  type: 'object',
  properties: {
    file: { type: 'string' },
    fills: {
      type: 'object',
      properties: {
        total: { type: 'number' },
        deterministicOk: { type: 'number' },
        accepted: { type: 'number' },
      },
      required: ['total', 'deterministicOk', 'accepted'],
    },
    conflicts: {
      type: 'object',
      properties: {
        total: { type: 'number' },
        deterministicOk: { type: 'number' },
        accepted: { type: 'number' },
      },
      required: ['total', 'deterministicOk', 'accepted'],
    },
    concepts: {
      type: 'object',
      properties: {
        total: { type: 'number' },
        deterministicOk: { type: 'number' },
        accepted: { type: 'number' },
      },
      required: ['total', 'deterministicOk', 'accepted'],
    },
    sourceDrift: { type: 'boolean' },
    notes: { type: 'array', items: { type: 'string' } },
  },
  required: ['file', 'fills', 'conflicts', 'concepts', 'sourceDrift'],
};
const PROPOSALS = {
  type: 'object',
  properties: {
    file: { type: 'string' },
    proposals: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          label: { type: 'string' },
          description: { type: 'string' },
          valueType: {
            type: 'string',
            enum: ['NUMBER', 'TEXT', 'LIST', 'AVAILABILITY'],
          },
          unit: { type: ['string', 'null'] },
          aliases: { type: 'array', items: { type: 'string' } },
          supportingModels: { type: 'array', items: { type: 'string' } },
          evidenceCount: { type: 'number' },
          nearestExisting: { type: 'string' },
        },
        required: [
          'code',
          'label',
          'description',
          'valueType',
          'aliases',
          'supportingModels',
          'evidenceCount',
        ],
      },
    },
  },
  required: ['file', 'proposals'],
};
const VERDICT = {
  type: 'object',
  properties: {
    disposition: { type: 'string', enum: ['accept', 'revise', 'reject'] },
    reason: { type: 'string' },
    fix: { type: 'string' },
  },
  required: ['disposition', 'reason'],
};
const REPORT = {
  type: 'object',
  properties: { reportPath: { type: 'string' }, summary: { type: 'string' } },
  required: ['reportPath', 'summary'],
};

// A null result means the subagent died (transport error) or was skipped; one
// retry keeps a flaky connection from turning into a false rejection.
const call = async (prompt, opts) => {
  const first = await agent(prompt, opts);
  if (first !== null) return first;
  log(`retrying ${opts.label ?? 'agent'} after an empty result`);
  return agent(`${prompt}\n(Second attempt: the first run returned nothing.)`, {
    ...opts,
    label: `${opts.label ?? 'agent'} (retry)`,
  });
};

// ---- 1. export ----------------------------------------------------------
phase('Export');
const index = await agent(
  `Run exactly this command from the workspace root and return its JSON stdout as the structured output (do not summarise, do not edit files):
node tools/catalog/gap-audit/export-catalog.mjs ${outDir}${only ? ` --models "${only.join(',')}"` : ''}
If it fails, return {"attributeCount":0,"models":[]} and put the error text in a note.`,
  {
    label: 'export catalog',
    phase: 'Export',
    model: 'haiku',
    effort: 'low',
    schema: INDEX,
  },
);
const models = index?.models ?? [];
if (!models.length)
  throw new Error(
    'Export produced no models; check that the Compose PostgreSQL is up and seeded',
  );
log(
  `Export: ${models.length} models, ${index.attributeCount} attributes → ${outDir}`,
);

// ---- 2..5 per-model pipeline ------------------------------------------
const perModel = await pipeline(
  models,
  // Discover
  (m) =>
    call(
      `You are auditing the catalog entry for ${m.brand} ${m.model} (Brazil). Read ${m.file} (configurations and knownSources with their URLs and sha256) and ${README} (section "Files and contracts").
Task: list the official ${m.brand} Brasil sources that report specifications for the CURRENT versions of this model: the version/comparison page(s) that list trims and prices, and the ficha técnica PDF(s). Start from knownSources (mark known=true). Then check with WebFetch or curl -I whether each is still reachable and look for a newer official technical sheet or version page on the manufacturer's Brazilian domain (search with WebSearch if needed). Only manufacturer-owned domains and their official CDNs count; no dealers, no press aggregators, no reviews.
Return at most ${maxSources} sources, keys as lowercase snake_case (e.g. territory_pdf). If you drop candidates, list them in "dropped" with the reason. Write the same JSON you return to ${outDir}/sources/${m.slug}.json (create the directory) so the audit trail survives the run. Do not capture content in this stage.`,
      {
        label: `discover ${m.slug}`,
        phase: 'Discover',
        model: 'opus',
        effort: 'medium',
        schema: SOURCES,
      },
    ),
  // Capture
  (sources, m) =>
    call(
      `Capture these official sources for ${m.brand} ${m.model} following ${CAPTURE} exactly. Slug: ${m.slug}. Output directory: ${outDir}. Capture timestamp to record: ${stamp}.
Sources: ${JSON.stringify(sources?.sources ?? [])}
Known hashes (from ${m.file} → knownSources[].sha256) tell you whether a source changed: set matchesKnownHash accordingly (false when the URL was not known). Write <key>.txt and <key>.meta.json per source under ${outDir}/captures/${m.slug}/, and the JSON you return to ${outDir}/captures/${m.slug}/_capture.json. Use your own Browser pane tab and close it. Report every failure; never fabricate text.`,
      {
        label: `capture ${m.slug}`,
        phase: 'Capture',
        model: 'sonnet',
        effort: 'medium',
        schema: CAPTURES,
      },
    ),
  // Analyze
  (captures, m) =>
    call(
      `Gap analysis for ${m.brand} ${m.model}. Inputs: ${m.file} (configurations with their accepted cells: status KNOWN/NOT_REPORTED/CONFLICTING, value, rawValue), ${outDir}/ontology.json (attribute definitions, aliases, controlled vocabulary), and the captured source text in ${outDir}/captures/${m.slug}/*.txt with hashes in *.meta.json. Captures reported by the previous stage: ${JSON.stringify(captures?.captures ?? [])}; failures: ${JSON.stringify(captures?.failures ?? [])}.
Read ${README} section "Files and contracts" for the exact JSON contract, then write ${outDir}/findings/${m.slug}.json with:
- fills: values the source reports for cells that are NOT KNOWN in the catalog, per configuration. Match the configuration by trim name and model year; when a table has one column per trim, name the column in "locator". Numbers as numbers in the attribute's unit (convert only trivially, e.g. 1.497 → 1497 cm³; never estimate). LIST attributes with a controlled vocabulary (fuel_type) must use its codes.
- conflicts: KNOWN cells whose source value differs (catalogValue must be copied exactly from the model file).
- concepts: facts the source reports that map to NO existing attribute, alias or label (check ontology.json first). One concept per distinct meaning, with a suggested code/label/valueType/unit and an example value; list the configurations it applies to.
Every item needs "excerpt": a verbatim substring (≥ 8 chars) of the capture text and "captureKey". Preserve manufacturer terminology in rawValue ("<label>: <value>"). Do not infer absent equipment from silence. Do not read other models. Return the counts and the file path.`,
      {
        label: `analyze ${m.slug}`,
        phase: 'Analyze',
        model: 'opus',
        effort: 'high',
        schema: COUNTS,
      },
    ),
  // Verify
  (counts, m) =>
    call(
      `Verify the gap findings for ${m.brand} ${m.model}. First run:
node tools/catalog/gap-audit/verify-findings.mjs ${outDir} ${m.slug}
It writes ${outDir}/verified/${m.slug}.json with per-item "checks". Items with a failed check are rejected as-is: do not repair them.
Then act as a skeptic on every item that passed the script. For each, open the capture text around the excerpt and try to REFUTE it through these lenses: (1) wrong column: the value belongs to another trim/year than configurationId; (2) wrong meaning: the source label is a different concept than the attribute's description (e.g. torque in kgf·m vs Nm, width with vs without mirrors, luggage vs bed volume, braked vs unbraked towing); (3) wrong unit or magnitude; (4) for concepts: the fact is already expressible with an existing attribute or vocabulary value. Default to refuted=true when uncertain.
Update ${outDir}/verified/${m.slug}.json: add to each item "verdict": {"accepted": boolean, "reason": string}. Set sourceDrift=true if any capture has matchesKnownHash=false for a known URL. Return the counts.`,
      {
        label: `verify ${m.slug}`,
        phase: 'Verify',
        model: 'opus',
        effort: 'medium',
        schema: VERIFIED,
      },
    ),
);

const done = perModel
  .map((r, i) => ({ model: models[i], result: r }))
  .filter((x) => x.result);
const failed = models.filter((_, i) => !perModel[i]);
if (failed.length)
  log(
    `Skipped (stage error or user skip): ${failed.map((m) => m.slug).join(', ')}`,
  );
const totals = done.reduce(
  (t, { result }) => ({
    fills: t.fills + (result.fills?.accepted ?? 0),
    conflicts: t.conflicts + (result.conflicts?.accepted ?? 0),
    concepts: t.concepts + (result.concepts?.accepted ?? 0),
    drift: t.drift + (result.sourceDrift ? 1 : 0),
  }),
  { fills: 0, conflicts: 0, concepts: 0, drift: 0 },
);
log(
  `Verified: ${done.length}/${models.length} models · fills ${totals.fills} · conflicts ${totals.conflicts} · concepts ${totals.concepts} · models with source drift ${totals.drift}`,
);

// ---- 6. ontology clustering (needs every model's concepts) --------------
phase('Ontology');
let proposals = { file: `${outDir}/ontology-proposals.json`, proposals: [] };
if (totals.concepts > 0) {
  proposals =
    (await call(
      `Cluster the accepted concepts from all models into ontology proposals. Read every ${outDir}/verified/*.json ("concepts" items whose verdict.accepted is true) and ${outDir}/ontology.json.
Rules (from docs/research/ontology-evolution-design.md and the manifests): one proposal per distinct meaning across brands; a proposal must not be expressible with an existing attribute, alias or controlled value; different meanings stay separate (bed volume ≠ luggage volume, braked ≠ unbraked towing); code ^[a-z][a-z0-9_]*$, label in pt-BR, description in English, unit only for NUMBER, aliases in pt-BR and English that a user would type. For each proposal keep the supporting evidence (slug, captureKey, excerpt, example value) and name the nearest existing attribute and why it does not fit.
Write ${outDir}/ontology-proposals.json as {"proposals":[...]} with those fields and return the summary list.`,
      {
        label: 'cluster concepts',
        phase: 'Ontology',
        model: 'opus',
        effort: 'high',
        schema: PROPOSALS,
      },
    )) ?? proposals;
}
log(`Ontology: ${proposals.proposals.length} candidate attributes`);

// ---- 7. critique (two lenses per proposal) -----------------------------
const judged = await pipeline(
  proposals.proposals,
  (p) =>
    call(
      `Ontology critique, lens = DUPLICATE. Proposal: ${JSON.stringify(p)}. Read ${outDir}/ontology.json (attributes, aliases, vocabulary, manufacturer terms, open proposals) and the proposal's evidence in ${outDir}/ontology-proposals.json.
Disposition: "reject" if the concept is already covered by an existing attribute (possibly with a new alias or vocabulary value instead of a new definition), if it merges two meanings, or if a single manufacturer's marketing term is being promoted to a generic concept without a generic meaning; "revise" if the concept is new but code, label or aliases must change to avoid a collision (state the replacement in "fix"); "accept" otherwise. Default to "reject" when uncertain; put the better mapping in "fix".`,
      {
        label: `critique:duplicate ${p.code}`,
        phase: 'Critique',
        model: 'opus',
        effort: 'high',
        schema: VERDICT,
      },
    ),
  (dup, p) =>
    dup && dup.disposition !== 'reject'
      ? call(
          `Ontology critique, lens = DEFINITION. Proposal: ${JSON.stringify(p)}. Open each evidence excerpt in ${outDir}/captures/<slug>/<captureKey>.txt.
Disposition: "reject" if fewer than one verbatim evidence excerpt actually contains the fact or the concept has no stable meaning across manufacturers; "revise" if the concept holds but the value type, unit, label, description or aliases must change (the dimension is ambiguous, the label would be confused with an existing label, the description does not say what the number/list means): put the full corrected attribute(...) definition in "fix"; "accept" if the definition fits every evidence example as written. Default to "reject" when uncertain.`,
          {
            label: `critique:definition ${p.code}`,
            phase: 'Critique',
            model: 'opus',
            effort: 'medium',
            schema: VERDICT,
          },
        ).then((def) => ({ proposal: p, duplicate: dup, definition: def }))
      : { proposal: p, duplicate: dup, definition: null },
);
const ok = (v) => v && v.disposition !== 'reject';
const accepted = judged
  .filter(Boolean)
  .filter((j) => ok(j.duplicate) && ok(j.definition));
const revised = accepted.filter(
  (j) =>
    j.duplicate.disposition === 'revise' ||
    j.definition.disposition === 'revise',
);
const rejected = judged.filter(Boolean).filter((j) => !accepted.includes(j));
const unjudged = judged
  .filter(Boolean)
  .filter((j) => !j.duplicate || (ok(j.duplicate) && !j.definition));
if (unjudged.length)
  log(
    `Critique: no verdict for ${unjudged.map((j) => j.proposal.code).join(', ')} (treated as rejected)`,
  );
log(
  `Critique: ${accepted.length} proposals accepted (${revised.length} with a revised definition), ${rejected.length} rejected`,
);

// ---- 8. synthesis + completeness critic -------------------------------
phase('Synthesize');
const report = await call(
  `Write the gap-audit report at ${outDir}/report.md in pt-BR for the team that maintains the catalog. Inputs: ${outDir}/models.json, every ${outDir}/verified/*.json, ${outDir}/ontology-proposals.json, and these critique verdicts (disposition accept/revise/reject per lens; a proposal is accepted when neither lens rejects, and "revise" means apply the "fix" text): ${JSON.stringify(judged.filter(Boolean).map((j) => ({ code: j.proposal.code, duplicate: j.duplicate, definition: j.definition })))}. Models skipped by the workflow: ${JSON.stringify(failed.map((m) => m.slug))}.
Sections: (1) Resumo com contagens (modelos, fontes capturadas, drift de fonte, fills/conflitos/conceitos aceitos e rejeitados); (2) por modelo: fontes e hashes, fills aceitos em tabela (configuração, atributo, valor, excerto), conflitos, itens rejeitados com o motivo; (3) propostas de ontologia aceitas, cada uma com o snippet \`attribute(...)\` pronto para o manifest correspondente (tools/catalog/ford-brasil-2026/manifest.mjs para Ford, tools/catalog/competitors-brasil-2026/manifest.mjs para os demais) e as linhas de alias no formato de apps/api/src/main/resources/db/migration/V18__raptor_terminology.sql; (4) propostas rejeitadas e o mapeamento sugerido; (5) snippets de specs por configuração para os fills aceitos (formato specs(...) do manifest, valores e rawValue preservados); (6) como aplicar (bump da versão do dataset, import, nx run ai:data-project). Only content that exists in the files; never invent values. Return the path and a 5-line summary.`,
  {
    label: 'write report',
    phase: 'Synthesize',
    model: 'opus',
    effort: 'high',
    schema: REPORT,
  },
);
const critic = await call(
  `Completeness critic. Read ${report?.reportPath ?? `${outDir}/report.md`}, ${outDir}/models.json and the "failures"/"dropped" notes in ${outDir}/verified/*.json. Answer only: what did this run NOT cover? Models with no capture, sources that failed or were dropped, image-only PDF pages, configurations with zero fills although their source has a specifications table, concepts rejected only for lack of evidence. Append your findings as a final section "## Pendências" to the report file (keep everything else intact) and return the same path plus a 3-line summary.`,
  {
    label: 'completeness critic',
    phase: 'Synthesize',
    model: 'sonnet',
    effort: 'medium',
    schema: REPORT,
  },
);
return {
  outDir,
  reportPath: critic?.reportPath ?? report?.reportPath ?? `${outDir}/report.md`,
  models: { swept: done.length, skipped: failed.map((m) => m.slug) },
  totals,
  proposals: {
    accepted: accepted.map((j) => j.proposal.code),
    revised: revised.map((j) => j.proposal.code),
    rejected: rejected.map((j) => j.proposal.code),
  },
  summary: report?.summary,
};
