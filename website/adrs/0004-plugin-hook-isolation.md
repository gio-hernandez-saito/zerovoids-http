# ADR 0004 — Plugin hooks run isolated; `init` failures propagate

- **Status**: Accepted
- **Date**: 2026-04-17
- **Authors**: core team

## Context

The pipeline runs a user-defined list of plugins. `init` rewrites the URL /
request shape once; `onRequest` / `onResponse` / `onSuccess` / `onError`
hooks fire during the retry loop. A single misbehaving plugin could
therefore:

- kill every request by throwing in `init` (blocking behaviour intended),
- kill every request by throwing in a hook (unintended: observability
  plugins like logging and tracing throw in corner cases — a flaky log
  sink should not take down the app's data layer).

We needed a rule that makes sense both for authors of *required* plugins
(like auth) and for authors of *observational* plugins (like OTel), without
a per-plugin config knob.

## Decision

Two distinct error-handling regimes, applied consistently across the pipeline:

1. **`init` errors propagate.** If any plugin's `init()` throws, the
   pipeline aborts before sending the request, returning
   `NormalizedError { kind: 'network', code: 'PLUGIN_INIT_FAILED' }`.
   Rationale: `init` is the only place where plugins *mutate* the request
   (rewrite URL, add headers). A silent failure here leaves the request in
   an indeterminate state — the consumer's Idempotency-Key might not have
   been attached, the bearer token might be missing. Propagating is the
   safe default.

2. **`onRequest` / `onResponse` / `onSuccess` / `onError` errors are
   isolated.** Thrown errors are caught and swallowed per plugin. The
   pipeline continues. Rationale: these hooks observe the request/response
   — they do not gate delivery. A logger crashing because the sink is down
   must not cascade into an application outage.

Additionally, plugin IDs are checked for uniqueness at `createClient` time
— a duplicate throws synchronously, preventing two competing auth plugins
from silently both trying to attach bearers.

## Consequences

**Positive**
- Required-path plugins (auth header injection, idempotency key) fail
  loudly; their failure is observable as a `NormalizedError`.
- Observational plugins (OTel, Sentry, custom logging) can be dropped in
  without first hardening their error paths.
- Plugin authors do not need a per-plugin "is this required?" config.

**Negative / accepted trade-offs**
- A hook author who *needs* failures to surface has to re-throw by design:
  the pipeline will swallow it. They can emit via a side channel instead
  (e.g., attach the failure to `ctx.request.extra` and surface later). This
  is documented in the Plugin reference.
- `onError` hook errors are *also* isolated. This means an error-reporting
  plugin that itself errors will drop the original error report. Again,
  documented; acceptable since the alternative (propagation) would let a
  flaky reporter mask real failures.

## Alternatives considered

- **Propagate all plugin errors uniformly.** Rejected: makes observability
  plugins dangerous, and was the dominant failure mode in prototypes.
- **Per-plugin `critical: boolean` flag.** Rejected: surface bloat, and
  gets it wrong when auth is accidentally marked non-critical.
- **Catch and annotate — surface hook errors as a side-NormalizedError.**
  Tabled for v1.1 — would require a "multiple errors" shape that ADR 0001
  doesn't cover today.

## See also

- `packages/core/src/pipeline.ts` — `safeHook` / `safeErrorHook` helpers
- `packages/core/src/client.ts` — duplicate-ID detection
- ADR 0003 — why bearer refresh lives at the transport layer, not as a
  Plugin.
