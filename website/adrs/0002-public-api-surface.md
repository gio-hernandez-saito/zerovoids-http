# ADR 0002 — Public API surface capped at four symbols

- **Status**: Accepted
- **Date**: 2026-04-17
- **Authors**: core team

## Context

Every API surface grows by default. Without a hard ceiling, review pressure
for "just one more export" eventually produces the exact kitchen-sink shape
we set out to replace. The library's positioning ("vendor-normalizing
multi-adapter HTTP client") only holds if the surface stays small enough
for a new user to model in their head in minutes.

## Decision

The public API is permanently capped at **four symbols**:

| Symbol | Purpose |
|---|---|
| `createClient(config)` | Compose adapters + transport + plugins into a typed client. |
| `defineAdapter(def)` | Declare a vendor's baseURL / errorMap / endpoints. |
| `defineEndpoint(def)` | Declare a single HTTP operation with schemas. |
| `definePlugin(def)` | Declare a cross-cutting concern (retry hooks, auth, observability). |

Everything else is either:
- a **type** (`NormalizedError`, `Transport`, `Plugin`, `CallOptions`, …) —
  needed at author time, but not a runtime surface that can grow;
- a **helper** (`unwrap`, `isAuth`, `exhaustiveGuard`, `fetchTransport`,
  `computeBackoffMs`, `parseLinkHeader`, …) — thin, stateless utilities
  attached to the four above.

Before adding anything to the public surface, the four-way filter from
`docs/plan.md §2` must pass:
1. Does it break the `NormalizedError` contract?
2. Can it be externalized as a plugin instead?
3. Does it require a new peer dependency? (If yes → separate adapter package.)
4. Does it eat the 5KB / 5ms budget?

## Consequences

**Positive**
- The mental model for any new adapter / endpoint stays identical across the
  ecosystem. A user who learns one vendor adapter has learned all of them.
- Type inference can aggressively specialize on the four shapes. No "which
  API subset does this project use" guessing.
- Version-1.0 API stability is realistic because the surface is finite.

**Negative / accepted trade-offs**
- Ergonomic sugar is pushed out to companion packages. `client.GET('/path')`
  DSL, for instance, cannot live in core — it would expand the surface to
  five.
- Power users occasionally need to drop down to `.raw()` or write a plugin
  for behavior that a larger API would expose as a first-class option. We
  accept this — the escape hatches are documented, and discoverable.

## Alternatives considered

- **Five symbols (add `client.GET/POST` shorthand).** Tabled as Phase 4
  open question; still rejected at time of writing because it adds a second
  authoring style with no new capabilities.
- **Surface grows organically.** Rejected on philosophy grounds — no budget
  means no budget.

## See also

- `docs/plan.md §2` (4대 철학)
- ADR 0001 — NormalizedError (why it lives outside the four).
