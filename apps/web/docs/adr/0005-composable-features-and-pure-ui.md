# ADR-0005: Composable features, vehicle domain, and pure UI

- Status: accepted
- Date: 2026-09-06
- Amends: ADR-0001, ADR-0003, ADR-0004

## Context

Vehicle catalog and comparison cards and the reviews dialog combined rendering,
data loading, selection, overlay orchestration, and chat prompts inside chat UI.
The colocated-store exception made those dependencies pass architecture checks.
Moving reusable workflows downward would perpetuate that coupling.

The user requested strictly dumb UI and feature composition by other features or
pages. A review against Flights42's `ai-arc` branch confirmed the container/view
and locality patterns, while identifying strict UI and separate feature reuse as
deliberate departures from that reference's active rules.

## Decision

Create a vehicles domain for catalog, comparison, related reviews, and vehicle
contracts. Keep conversation history, preferences, AG-UI restoration, CopilotKit
registration, and prompts in chat. Chat consumes selected public vehicle APIs;
vehicles never imports chat.

Features export smart entry components through `index.ts`; routed components
can expose a lazy loader to preserve chunk splitting alongside eager entries.
Features and pages
compose these entries while stores and internal views remain private. Dependencies
between features must be acyclic. Keep dumb views inside their consuming feature
until another independent feature needs that view directly.

Separate public contract and feature APIs. The contract dependency closure can
contain models, schemas, and pure utilities; it cannot contain clients, stores,
coordinators, UI, or features. This lets the chat data client validate saved
comparison results without depending on a component API.

Remove all colocated-store and AI-folder access exceptions. UI receives data or
parent-owned form fields and emits events. It cannot construct forms or reach
application workflows through stores, clients, coordinators, injected actions,
or helper re-exports. Presentation state and technical UI dependencies remain
appropriate. Smart suffixes inside UI do not override its classification.

Vehicle workflows emit typed intentions. Chat adapters choose prompt wording and
draft/send behavior. Catalog state remains scoped to each rendered result and
review state to each dialog instance. Features without persistent/remote state
need not introduce a store. Root coordinators are reserved for application-wide
state such as the conversation and history.

## Consequences and enforcement

- Sheriff permits selected feature composition and distinct API layers. Entry
  barrels enforce public exports; architecture graph checks also reject private
  paths and cycles, including paths through domain APIs.
- tsarch retains the store/client separation and adds strict UI access checks.
  Compiler-based graph tests cover transitive dependencies and UI form ownership,
  with negative fixtures to exercise the restrictions.
- Catalog and review views can be tested without HTTP, chat, or dialog services.
  Feature tests exercise loading and isolated state; adapter tests exercise prompts
  and overlay completion. Stored conversation restoration remains covered.
- Thread mutations live in a detail store; a coordinator refreshes history after
  writes. Search stores own collection reads and filtering.
- This changes ownership and wiring, not server schemas or the user experience.
  Keep CopilotKit, the existing Zard design system, and standalone components.
