# ADR 0001 — `NormalizedError` is the sole error shape

- **Status**: Accepted
- **Date**: 2026-04-17
- **Authors**: core team

## Context

Every layer that can fail in an HTTP client has its own error vocabulary:
`fetch` throws `TypeError` on network, `axios` wraps 5xx in `AxiosError`, ky
throws `HTTPError`, schema libraries (zod / valibot / arktype) each produce
different issue structures, adapter-specific domain errors (Stripe decline,
GitHub rate-limit) surface as arbitrary JSON.

Consumers of a multi-adapter client therefore face a combinatorial typing
problem — every `catch` needs to branch on multiple error shapes, multiplied
by every transport / schema permutation. This erodes the library's core
promise of *"one surface for many vendors."*

## Decision

All error paths in `@zerovoids/http` resolve to exactly one shape:
`NormalizedError`. Both a class (for `instanceof`) and a factory
(`createNormalizedError()` for SSR / structured logging) are exposed. The
shape:

```ts
class NormalizedError extends Error {
  kind: 'network' | 'timeout' | 'http' | 'validation' | 'domain' | 'canceled';
  code: string;
  httpStatus?: number;
  retryable: boolean;
  retryAfterMs?: number;  // Retry-After auto-parsed (int seconds + HTTP-date)
  cause: unknown;         // original vendor error preserved for forensic access
  trace: { requestId; url; method; attempt };
  toJSON();               // SSR-safe serialization
}
```

Pipeline stages responsible for enforcing this contract:

- `fetchTransport` / `kyTransport` / `axiosTransport` — translate abort /
  cancel / DNS / TLS errors into `kind: 'network' | 'timeout' | 'canceled'`.
- Pipeline step 10 — invokes `adapter.errorMap` (or `defaultErrorMap`) for
  non-2xx responses, producing `kind: 'http' | 'domain'`.
- Pipeline step 11 — wraps schema-validator issues as `kind: 'validation'`.

## Consequences

**Positive**
- Consumers write one `catch` shape. Every `isAuth(e)`, `isRateLimited(e)`,
  `isRetryable(e)` helper works uniformly.
- Adding a new transport or schema library does not change the error surface.
- Error UI is composable — one React `<ErrorCard error={e}>` renders every
  failure mode.

**Negative / accepted trade-offs**
- An extra object allocation per failure. Measured irrelevant vs network
  time; not even visible in the Phase 4 bench results.
- Domain errors require the adapter to write an `errorMap`. This is *the*
  place where vendor normalization happens — we consider this visibility a
  feature, not a cost.

## Alternatives considered

- **Throw native errors, let consumers type-guard.** Rejected: pushes the
  vendor-discovery problem back onto every consumer, defeating the library.
- **Per-kind subclasses (`NetworkError`, `ValidationError`, …).** Rejected:
  multiplies surface, and `kind` as a discriminant already gives exhaustive
  narrowing via `exhaustiveGuard`.
- **Ad-hoc `{ data, error }` tuple without a type.** Rejected: loses the
  `instanceof`-checkable class, and SSR-deserialized errors would not round-trip.

## See also

- `packages/core/src/error/normalize.ts`
- `packages/core/src/error/helpers.ts`
- ADR 0002 — Public API surface (why `NormalizedError` is one of the four
  first-class exports).
