# Research completion polling and the intermittent 503

Date: 2026-09-12. Scope: the chat page's poll of
`POST /ai/chat/threads/<id>/research-updates` (`apps/web` `ConversationDetailStore`,
`apps/ai` `threads/research-updates.ts` and `threads/routes.ts`) and the 503 a
browser test observed on it.

## What was observed

A browser test on 2026-09-12 ran a research from the chat and watched the
network: the poll kept firing every 8 s after every research of the thread
had reached REVIEW and its completion message had been delivered, and 4 of
about 68 polls answered 503. The browser retried silently, so nothing was
visible in the UI. The raw log (URLs, response bodies) was not kept; only
that summary survives.

## Polling stop (implemented)

The route now answers `{ ...thread summary, messages, pending }`:

- `pending` is true while a research the thread references is not announced
  yet and is QUEUED or PROCESSING, or its status could not be read this time
  (any research service failure but a 404, or a failed memory write), so a
  later poll can still announce it.
- `pending` is false once every referenced research is announced or can never
  be announced (CANCELLED, FAILED, REJECTED, or unknown to the research
  service), and for a thread that references no research.

`ConversationDetailStore` keeps `_researchPending`: true from the start of
every run, thread switch and reopen; false after a poll says nothing is left
or when the transcript holds no research tool call. The 8 s interval effect
depends on it, so it ends with the last answer. Reopening a thread polls once
immediately, which delivers a completion that arrived while the thread was
closed. A failed poll leaves the flag alone, so transient failures are still
retried. A service that does not send the flag is polled as before (the web
parser defaults `pending` to true).

## Where a 503 can and cannot come from

| Component                                                                             | Behaviour on failure                                                                                                                                                                                                                                                         | 503?          |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `research-updates.ts`                                                                 | Every `readResearch` failure and every failed `saveMessages` is caught per research; the poll answers 200 with what it has.                                                                                                                                                  | No            |
| `threads/routes.ts`                                                                   | A throw before the poll (memory read of the thread) reaches Mastra's error handler (`@mastra/deployer` 1.64 `errorHandler`): an `HTTPException` keeps its status, anything else is 500.                                                                                      | No            |
| `research/client.ts`                                                                  | Network errors, the 15 s deadline and a missing `SPECSYNC_RESEARCH_SERVICE_KEY` become `ResearchServiceError(503)`; a non-2xx keeps the API's status.                                                                                                                        | Internal only |
| `research/routes.ts`, `review-routes.ts`, `interests-route.ts` (`/ai/chat/research…`) | A `ResearchServiceError` other than 404/409/422 is answered as 503 `Research service unavailable`.                                                                                                                                                                           | **Yes**       |
| `apps/gateway`                                                                        | Upstream fetch failure and unexpected redirects are 502; a handler error is 500.                                                                                                                                                                                             | No            |
| `mastra dev`                                                                          | Rebuilds restart the server child (SIGINT, SIGKILL after 5 s, fresh start). Requests in the gap fail at the gateway as 502. The local child had been restarted 55 min before this investigation while the CLI was 2 h 40 old, so restarts do happen in the shared dev stack. | No            |
| Hono `proxy` helper, Vite dev-server proxy                                            | Propagate or 500.                                                                                                                                                                                                                                                            | No            |
| Spring API `GlobalExceptionHandler`                                                   | 422, 402, 404, 409.                                                                                                                                                                                                                                                          | No            |

So no code path of the local stack answers 503 to the research-updates POST,
before or after this change.

## What could not be settled

The 503 was not reproduced: the local app needs a Google sign-in this session
cannot perform, and the test's raw network log was not retained. Two
candidates remain, both outside the local code paths above:

1. The test ran against the deployed environment, where Cloud Run answers 503
   itself when no instance can take a request; the AI instance is busy while
   the shared research worker runs an extraction.
2. The status was read from a neighbouring request. The research card on the
   same page reads `/ai/chat/research/<id>`, which does answer 503 whenever
   the AI service cannot reach the Spring API within 15 s.

Next time it shows up, keep the response body: `{"error":"Research service
unavailable"}` is the AI research route, `{"error":"Service unavailable"}`
with 502 is the gateway, and a non-JSON `Service Unavailable` is Cloud Run.
With the poll now stopping after the last announcement, the request no longer
runs indefinitely, which is what made the failures visible in the first place.
