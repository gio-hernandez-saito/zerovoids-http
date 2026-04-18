# @zerovoids/http-bench

Internal benchmark harness. **Not published to npm.**

## Why it exists

`docs/plan.md` §14 commits to a Phase 4 performance budget:

> Cold call overhead p99 < 5ms (fetch vs 우리 래퍼 벤치)

This package isolates that measurement so it can run in CI without touching
the published packages' dependency graphs.

## Running

```sh
# Vitest bench (pretty table, compare runs)
pnpm --filter @zerovoids/http-bench bench

# Standalone p50/p99/p99.9 harness (parseable output for CI gates)
pnpm --filter @zerovoids/http-bench bench:cli
```

Both modes exercise the same fixtures from `src/fixtures.ts`: a mock transport
fronted by `createClient(...).svc.getUser({ params: { id: 1 } })`. Real
network is deliberately *not* involved — the goal is measuring the
wrapper's own overhead, not upstream latency.

## Interpretation

The relevant delta is `pipeline - baseline`. Anything under ~100μs per call
on a 2023-era laptop is well inside the p99 < 5ms commitment; regressions
worth investigating are ones that add ≥ 200μs to the wrapper path.
