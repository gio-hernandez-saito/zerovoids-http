# ADR 0003 — `bearerWithRefresh` is a transport wrapper, not a Plugin

- **Status**: Accepted
- **Date**: 2026-04-17
- **Authors**: core team

## Context

The Phase 3 requirement for `@zerovoids/http-auth` is "401 detected → refresh
→ retry the original request, deduplicated across concurrent callers"
(single-flight). The natural first instinct — and the shape the Phase-0
skeleton shipped with — was a `Plugin`:

```ts
export function bearerWithRefresh(options): Plugin {
  return {
    id: 'auth:bearer-with-refresh',
    init: async (url, req) => { /* attach bearer */ },
    hooks: {
      onResponse: async (ctx) => { /* if 401, trigger refresh */ },
    },
  };
}
```

But the Plugin API is deliberately read-only past `init`: `onResponse`
observes the response but cannot *replay* the transport call with a new
token. The only "retry" path is `retryStrategy.shouldRetry`, which is a
global flag, not a per-plugin hook, and re-runs `onRequest` rather than
re-running `init` — so a plugin cannot in general reshape the request for
the retry.

Working around this required either (a) abusing the retry strategy to carry
auth state, or (b) exposing a new Plugin lifecycle hook. Both leak auth
concerns into core.

## Decision

`bearerWithRefresh(options)` returns a **transport wrapper** — specifically
`{ wrap(inner: Transport): Transport; readonly inFlight }` — rather than a
`Plugin`. Composition:

```ts
const auth = bearerWithRefresh({ getToken, refresh });
createClient({
  adapters,
  transport: auth.wrap(fetchTransport()),  // ⟵ auth owns the inner retry
});
```

Inside the wrapper:

1. Read `getToken()`; inject `Authorization: Bearer <token>` on outgoing.
2. Await the inner transport call.
3. If `shouldRefresh(response)` (default: `status === 401`), read `getToken()`
   again. If it changed, another request already refreshed → just retry with
   the new token. Otherwise, call `refreshSingleFlight()` — the first caller
   runs the user's `refresh()`; concurrent callers share the same promise via
   a module-level `refreshPromise` with `finally` eviction.
4. Retry the original request **once** with the refreshed token. A second
   401 surfaces unchanged; no recursive refresh.

`xsrf` remains a `Plugin` — it only does `init`-time cookie→header copy and
fits the Plugin contract cleanly.

## Consequences

**Positive**
- Single-flight semantics live in one small module with clear ownership of
  the retry decision.
- The Plugin API stays minimal — no new hook for "replay with modified
  request" was required.
- Concurrent 401 storms collapse to a single refresh call (measured via
  `packages/auth/src/__tests__/bearer.test.ts` concurrent-401 scenario).

**Negative / accepted trade-offs**
- Two composition styles now coexist: `plugins: [xsrf()]` vs.
  `transport: auth.wrap(...)`. Users have to learn which piece is which.
  Documented in `website/guides/auth-recipes.md`.
- A hand-rolled transport (custom fetch wrapper) must remember to pass
  through `credentials` / `mode` / `signal` — the pipeline already does
  this, but a wrapped transport must too.

## Alternatives considered

- **Expose `shouldRefresh` + state via retry strategy.** Rejected: ties
  auth to the retry system, and the retry loop re-runs `onRequest` but not
  the full init pipeline — a refreshed token would never reach a header
  that `init` attached in a different plugin.
- **Add a `replay` method to `PluginContext`.** Rejected: one-off hook that
  leaks transport-layer concerns into the Plugin contract and complicates
  the Phase-1 pipeline guarantee of "fixed number of attempts."
- **Return both a `Plugin` and a `wrap()` from `bearerWithRefresh`.**
  Rejected: two ways to wire the same thing doubles the surface and
  invites subtle misconfiguration (e.g., both installed, two refreshes
  per 401).

## See also

- `packages/auth/src/bearer.ts`
- `packages/auth/THREAT_MODEL.md`
- ADR 0004 — Plugin hook isolation.
