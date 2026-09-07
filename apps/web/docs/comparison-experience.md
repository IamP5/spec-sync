# Conversational comparison experience

Decision: version E, selected on 2026-09-05. Analysts keep a wide specification matrix visible and open a dialog to explore multiple review passages. The explorations and verdict are archived on local branch `codex/comparison-e-prototype` (commit `14aeb6bdec0c4e63f04f166ac488056c076c3c90`). No implementation issue exists yet. Prototype routes, fixtures and the switcher are removed from the application.

Decision update, 2026-09-07: tool results attach to the conversation instead of sitting in card containers, which wasted the transcript. The catalog page renders as a strip of cards or a flush list behind a reader toggle (strip by default, list when the page is large), only a step of the page at a time; the comparison renders as an attribute list with the vehicles numbered once in a legend that stays pinned while scrolling. The four layout variants and the verdict are archived on local branch `prototype/chat-inline-results`; the variant switcher is removed from the application.

## Production behavior

- The empty-conversation home state offers a prominent vehicle-catalog action.
  It sends an explicit first turn in a new conversation, so the catalog result,
  follow-ups and comparisons remain in one stored thread.
- An unscoped successful `searchVehicleConfigurations` result renders as an
  interactive catalog attached to the reply: a caption with the counts, one
  hairline row with literal search, model-family chips and sorting, then the
  configurations as a horizontal card strip or a flush list. The reader can
  switch; pages larger than `LARGE_CATALOG_PAGE` open as the list. Only
  `CATALOG_PAGE_STEP` configurations render at first; "Show more" reveals the
  loaded page in steps and, once it is exhausted and the tool reported
  `hasMore`, "Load next N from the catalog" sends a new turn that asks for the
  same search from the next offset. Filters operate only on the loaded page;
  copy says "on this page" and never invents a global total. Card highlights
  are read in batches from the existing sourced comparison/specification
  endpoints. Unknown and conflicting values remain explicit, and unknown
  reference prices sort after known observations.
- Details reuse the production specification matrix in a right-side sheet.
  "Ask about this vehicle" closes the sheet, restores focus, and prepares an
  editable composer draft. A shortlist contains two to five exact configuration
  IDs; comparing it sends a new turn that feeds the existing validated
  comparison tool and renderer.
- Vehicle media and curated segment membership are still not modeled. Catalog
  cards therefore use deliberate placeholders, and the shortlist bar under the
  page compares only the user's explicit shortlist without inferring or
  labeling a market segment.
- CopilotKit adapters parse unchanged tool results and compose the public vehicle features.
  Catalog, comparison, and reviews own workflow state; their UI views are dumb. The comparison is an attribute list in the reply column: the vehicles are numbered once in a legend pinned to the top while the list scrolls, each attribute is one row with the values as numbered chips, and tapping a number (legend or chip) shows that vehicle's name next to every one of its values, which also serves touch screens. Rows that differ are marked; per-row disclosures preserve accepted observations, optional packages, unknowns, conflicts and provenance. Search and difference filters are local.
- Successful configuration and concept lookups are background work. Detailed tool activity remains available through the existing activity toggle. Failures remain visible.
- The dialog loads related reviews on demand from `/api/knowledge/related-reviews`, once per compared configuration, with a 15-second timeout and cancellation on destruction. No review count is claimed before retrieval. The API caps each result at 30 passages; a notice makes that bound explicit. There is no unimplemented pagination or completeness claim.
- A dialog-scoped vehicle feature and Signal Store delegate retrieval to a stateless client. Shared model observations are deduplicated by observation ID and retain their model scope. Partial service failures remain distinguishable from empty results.
- Vehicle, media and text filters preserve up to eight selections. Source context, review kind and optional video timestamps are available per passage. Model-scoped evidence never establishes trim applicability.
- “Levar ao chat” creates an editable draft containing configuration and evidence IDs. Existing composer text is preserved; sending remains an explicit user action through the existing chat coordinator. External search also prepares a draft. Neither interaction ingests or writes catalog data.
- Zard cards, table, buttons, badges, inputs, skeletons and dialog share the existing theme. Native select controls support keyboard and mobile selection. Zard handles Escape, focus trapping and focus restoration; selected-evidence actions then focus the composer. Motion is subtle and disabled with reduced-motion preferences.

The initial review corpus remains empty. Browser verification uses isolated HTTP fixtures to exercise populated review states; those fixtures are never written to the database or bundled into production. Old stored assistant prose is preserved; concise response instructions apply to new turns.
