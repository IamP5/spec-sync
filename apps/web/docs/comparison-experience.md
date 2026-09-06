# Conversational comparison experience

Decision: version E, selected on 2026-09-05. Analysts keep a wide specification matrix visible and open a dialog to explore multiple review passages. The explorations and verdict are archived on local branch `codex/comparison-e-prototype` (commit `14aeb6bdec0c4e63f04f166ac488056c076c3c90`). No implementation issue exists yet. Prototype routes, fixtures and the switcher are removed from the application.

## Production behavior

- Existing CopilotKit tool renderers consume the catalog result unchanged. The matrix preserves accepted observations, optional packages, unknowns, conflicts and provenance. Search and difference filters are local; horizontal scrolling supports up to five configurations with pinned attribute and column headings.
- Successful configuration and concept lookups are background work. Detailed tool activity remains available through the existing activity toggle. Failures remain visible.
- The dialog loads related reviews on demand from `/api/knowledge/related-reviews`, once per compared configuration, with a 15-second timeout and cancellation on destruction. No review count is claimed before retrieval. The API caps each result at 30 passages; a notice makes that bound explicit. There is no unimplemented pagination or completeness claim.
- A dialog-scoped Signal Store delegates retrieval to a stateless client. Shared model observations are deduplicated by observation ID and retain their model scope. Partial service failures remain distinguishable from empty results.
- Vehicle, media and text filters preserve up to eight selections. Source context, review kind and optional video timestamps are available per passage. Model-scoped evidence never establishes trim applicability.
- “Levar ao chat” creates an editable draft containing configuration and evidence IDs. Existing composer text is preserved; sending remains an explicit user action through the existing chat coordinator. External search also prepares a draft. Neither interaction ingests or writes catalog data.
- Zard cards, table, buttons, badges, inputs, skeletons and dialog share the existing theme. Native select controls support keyboard and mobile selection. Zard handles Escape, focus trapping and focus restoration; selected-evidence actions then focus the composer. Motion is subtle and disabled with reduced-motion preferences.

The initial review corpus remains empty. Browser verification uses isolated HTTP fixtures to exercise populated review states; those fixtures are never written to the database or bundled into production. Old stored assistant prose is preserved; concise response instructions apply to new turns.
