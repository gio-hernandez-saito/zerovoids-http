# `@zerovoids/http-auth` Threat Model

Scope: the helpers shipped by this package — `bearerWithRefresh`, `xsrf`,
`memoryStorage` / `localStorageStorage`, and the PKCE utilities.

This document is *not* a substitute for your app's own threat model. It
states what we attempt to prevent, what we rely on you to prevent, and
where the package cannot defend even in principle.

## Assumptions (what we rely on the environment to provide)

| # | Assumption | Rationale |
|---|---|---|
| A1 | TLS for every request going to the auth server and resource server. | Bearer tokens and cookies are confidential; this package does not encrypt payloads. |
| A2 | The auth server rotates refresh tokens and binds them to the client. | Token-binding is out of scope for an HTTP-client library. |
| A3 | `crypto.getRandomValues` + `crypto.subtle.digest` are trustworthy. | PKCE verifier entropy and S256 derivation depend on them. |
| A4 | The host page is the legitimate first party (no hostile iframes exfiltrating cookies). | We cannot detect DOM-level CSRF frame injection. |

## Threats considered — in scope

### T1. 401 storm leaks N refresh calls

**Attack surface.** An expired access token → every in-flight request
returns 401 → naive code triggers N parallel refreshes → refresh endpoint
rate-limits / charges extra.

**Mitigation.** `bearerWithRefresh.wrap` enforces **single-flight**: a
module-local `refreshPromise` serializes concurrent callers onto one
refresh. Eviction happens in `.finally()` so the next expiration triggers a
fresh refresh. Covered by
`packages/auth/src/__tests__/bearer.test.ts` scenario
"concurrent 401s share one refresh call" (3 parallel 401s → 1 refresh).

### T2. Race between caller A's refresh and caller B's in-flight request

**Attack surface.** Caller A hits 401, refreshes to token `T2`. Caller B
started with stale token `T1`, hits 401 during A's refresh. Naive code
either (a) triggers a second refresh, or (b) retries with stale `T1`.

**Mitigation.** Before triggering `refresh()`, the wrapper re-reads
`getToken()`. If the stored token changed between the pre-request read and
the post-401 re-read, the wrapper skips the refresh entirely and retries
with the new value. Covered by test
"skips refresh when token already rotated during flight (race)".

### T3. Refresh returning `null` loops forever

**Attack surface.** `refresh()` resolves with `null` (legit refresh-token
also expired). Naive code retries indefinitely, burning the server.

**Mitigation.** `null` → the original 401 is surfaced unchanged. Callers
see the 401 and route the user to the login flow. Test: "surfaces 401 when
refresh returns `null`."

### T4. Refreshed token itself 401s

**Attack surface.** A server revokes tokens asynchronously. The refresh
succeeds, the retried request still 401s.

**Mitigation.** The retry is fired **at most once per original request**.
A second 401 surfaces unchanged — no recursive refresh. Test: "does NOT
retry a second time if refreshed token also 401s."

### T5. XSRF double-submit bypass

**Attack surface.** A state-changing request is made *without* the
configured XSRF header; the server naively accepts because our plugin
didn't populate the header.

**Mitigation.** The `xsrf` plugin reads the cookie on **every** write verb
(POST/PUT/PATCH/DELETE by default) and writes the configured header, unless
the caller has already supplied one. `GET`/`HEAD` are skipped by design —
they should not mutate state, and headering them complicates cache keys.

### T6. `Authorization` header on unsafe redirects

**Attack surface.** A redirect to a third-party host would leak the Bearer
token if we followed redirects and kept the header.

**Mitigation.** This package does not follow redirects itself — it wraps a
`Transport`. The underlying `fetch` transport inherits browser redirect
behaviour (strip `Authorization` on cross-origin). Consumers using custom
transports on Node must verify their agent does the same; we document this
in `website/guides/auth-recipes.md`.

## Threats out of scope — documented non-mitigations

### OOS1. Access token at rest (localStorage)

`localStorageStorage` persists tokens in `window.localStorage`. Any XSS on
the page reads them. This is the industry-standard trade-off for SPAs; if
you cannot accept it, use `memoryStorage` + cookie-based sessions instead.
The library does not choose for you.

### OOS2. Refresh token sent by value

Some OAuth profiles ship the refresh token to the browser. Binding it to a
channel (DPoP, mTLS) is the auth-server's job; we can carry whatever you
give us, but we cannot prove it was used by the intended client.

### OOS3. Side-channel timing leaks

Single-flight serializes refresh, but callers that observe latency can in
principle detect whether their request was the "first 401 in a batch" vs.
"rode the coat-tails of someone else's refresh." We consider this
uninteresting — the same information is recoverable from server logs.

### OOS4. PKCE replay across devices

`createPkceChallenge()` is stateless. Persisting the `verifier` across the
authorize → callback hop is the consumer's responsibility. Writing it to
`sessionStorage` keyed by `state` is the standard recipe; we document it.
Nothing in this package prevents a consumer from persisting the verifier
globally and accidentally reusing it — that is a consumer bug.

## Review cadence

This threat model is versioned alongside the package. Any change to
`bearer.ts`, `xsrf.ts`, `pkce.ts`, or the storage adapters requires a
matching review of the relevant section. Breaking changes to any threat's
*mitigation* require a `major` bump.
