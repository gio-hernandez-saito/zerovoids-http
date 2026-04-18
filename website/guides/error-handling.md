# Error handling

Every failure path in `@zerovoids/http` resolves to a single shape:
`NormalizedError`. This guide shows how to branch on it exhaustively,
render it in UI, and propagate it across a render tree.

## The six kinds

| `kind` | When | Is `retryable`? |
|---|---|---|
| `network` | DNS, TLS, unreachable host, transport threw | false by default |
| `timeout` | `options.timeout` elapsed or `AbortSignal.timeout()` fired | false (caller owns retry policy) |
| `canceled` | Consumer aborted the `AbortController` | false |
| `http` | Non-2xx response, unmapped | true for 5xx / 429 / 408 (via `defaultErrorMap`) |
| `domain` | Non-2xx response, vendor-mapped to a business code | false by default (mapper decides) |
| `validation` | Schema rejected request or response body | false |

## Branching

The `is*` helpers cover the common cases:

```ts
import {
  isAuth, isCanceled, isClientError, isDomain, isNetwork,
  isRateLimited, isRetryable, isServerError, isTimeout, isValidation,
} from "@zerovoids/http";

const { data, error } = await api.github.getRepo({ params });
if (!error) { /* happy */ return; }

if      (isAuth(error))        redirectToLogin();
else if (isRateLimited(error)) retryAfter(error.retryAfterMs ?? 1000);
else if (isTimeout(error))     showBanner("느려요, 다시 시도할게요");
else if (isCanceled(error))    /* user-initiated, ignore */;
else if (isRetryable(error))   enqueueRetry();
else if (isValidation(error))  report("API contract drift");
else                           showBanner("알 수 없는 오류");
```

For exhaustive type-safety, `exhaustiveGuard`:

```ts
import { exhaustiveGuard } from "@zerovoids/http";

switch (error.kind) {
  case "network":    return /* ... */;
  case "timeout":    return /* ... */;
  case "canceled":   return null;
  case "http":       return /* ... */;
  case "domain":     return /* ... */;
  case "validation": return /* ... */;
  default: exhaustiveGuard(error.kind);  // compile error if you forget one
}
```

## Rendering

`NormalizedError.toJSON()` is SSR-safe and strips the non-serializable
`cause` chain:

```tsx
<pre style={{ color: "crimson" }}>
  {JSON.stringify(error.toJSON(), null, 2)}
</pre>
```

The `cause` is still reachable at runtime (`error.cause`) for forensic
logging; only the serialized view omits it.

## Error boundaries (React Query / SWR)

Both adapters throw `NormalizedError` from the executor — it lands in the
`error` slot of the hook return. Pair with a React error boundary if you
use `useSuspenseQuery`:

```tsx
<ErrorBoundary fallback={({ error }) => <ErrorCard error={error} />}>
  <Suspense fallback={<Loading />}>
    <RepoCard owner="octocat" repo="hello-world" />
  </Suspense>
</ErrorBoundary>
```

Because every layer (transport, validator, adapter errorMap) produces the
same shape, one `ErrorCard` handles every failure.

## Retry semantics

`retryable` is metadata — it tells *you* (or a retry strategy) that the
request is safe to replay. The library's own retry loop (`retry:` option
on `createClient`) honours it automatically. For custom back-off:

```ts
import { computeBackoffMs } from "@zerovoids/http";

while (attempt < max) {
  const { data, error } = await api.svc.boom();
  if (!error) return data;
  if (!error.retryable) throw error;
  await sleep(
    error.retryAfterMs ?? computeBackoffMs(
      { type: "exponential", attempts: max, baseDelay: 250, maxDelay: 5_000 },
      attempt,
      null,
    ),
  );
  attempt++;
}
```

`Retry-After` HTTP-date form is parsed automatically into `retryAfterMs`.

## See also

- [ADR 0001](../../docs/adrs/0001-normalized-error.md) — why there is
  exactly one error shape.
- [`reference/normalized-error.md`](../reference/normalized-error.md) —
  class vs factory, field-by-field semantics.
