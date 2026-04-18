# Architecture Decision Records (ADRs)

Durable records for the decisions that shape `@zerovoids/http`. Each ADR is
small, immutable once merged, and written in MADR-lite form:

- **Context** — what problem / constraint triggered the decision
- **Decision** — what we chose
- **Consequences** — what we now live with (positive and negative)
- **Alternatives considered** — the paths we deliberately did not take

New ADRs get the next sequential number. Superseding a decision means
*adding* a new ADR that references the old one; existing ADRs are never
silently rewritten.

| ID | Title | Status |
|---|---|---|
| [0001](./0001-normalized-error.md) | `NormalizedError` is the sole error shape | Accepted |
| [0002](./0002-public-api-surface.md) | Public API capped at four symbols | Accepted |
| [0003](./0003-bearer-transport-wrapper.md) | `bearerWithRefresh` is a transport wrapper, not a Plugin | Accepted |
| [0004](./0004-plugin-hook-isolation.md) | Plugin hooks run isolated; `init` failures propagate | Accepted |
