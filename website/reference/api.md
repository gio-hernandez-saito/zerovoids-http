# API Reference

The public surface is four symbols plus supporting types. This page is
the normative listing — anything not documented here is not considered
public API, even if exported.

## `createClient(config)`

Compose adapters, a transport, and plugins into a typed client.

```ts
createClient<const TAdapters extends Record<string, AdapterDefinition>>(
  config: {
    adapters: TAdapters;
    transport?: Transport;          // default: fetchTransport()
    plugins?: ReadonlyArray<Plugin>;
    retry?: RetryStrategy;          // default: 1 (single attempt)
    timeout?: number;               // ms, applied to every call
  }
): Client<TAdapters>
```

Returns a client whose shape mirrors `adapters`:

```ts
api.<adapterKey>.<endpointKey>(input, options?) → Promise<Result<Output>>
api.<adapterKey>.<endpointKey>.raw(input, options?) → Promise<Result<TransportResponse>>
```

The `.raw()` escape hatch skips decoding, `errorMap`, and output
validation. Network / timeout / canceled errors still surface as
`NormalizedError`.

Plugin IDs must be unique — duplicates throw synchronously.

## `defineAdapter(def)`

Declare a vendor.

```ts
defineAdapter<const TEndpoints extends Record<string, EndpointDefinition>>(
  def: {
    baseURL: string;
    endpoints: TEndpoints;
    errorMap?: ErrorMap;
    defaultHeaders?: Record<string, string>;
    credentials?: RequestCredentials;      // SSR: "include" | "same-origin" | "omit"
    mode?: RequestMode;
    cache?: RequestCache;
    pagination?: PaginationStrategy;       // declarative; consumers build next-page inputs
  }
): AdapterDefinition<TEndpoints>
```

`errorMap` is invoked for non-2xx responses. If omitted, `defaultErrorMap`
applies — `kind: "http"`, `code: "HTTP_<status>"`, `retryable` for
5xx/429/408, `Retry-After` parsed.

## `defineEndpoint(def)`

Declare one operation.

```ts
defineEndpoint<const Path extends string, Body, Output, Query>(
  def: {
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
    path: Path;
    body?: StandardSchemaV1<Body>;
    query?: StandardSchemaV1<Query>;
    headers?: StandardSchemaV1;
    output?: StandardSchemaV1<unknown, Output>;
  }
): EndpointDefinition<Path, Body, Output, Query>
```

Path params are auto-extracted — `/repos/:owner/:repo` produces
`{ owner: string | number; repo: string | number }` as the required
`params` shape on the call site.

Schemas accept any Standard Schema v1 validator (zod, valibot, arktype,
…) or the `typedOutput<T>()` / `typedInput<T>()` type-only helpers for
zero-runtime validation.

## `definePlugin(def)`

Declare a cross-cutting concern.

```ts
definePlugin(p: {
  id: string;                    // unique per client
  name?: string;
  init?: (url, req) => Promise<{ url, options: req }>;
  hooks?: {
    onRequest?:  (ctx) => ctx | Promise<ctx>;
    onResponse?: (ctx) => ctx | Promise<ctx>;
    onSuccess?:  (ctx) => ctx | Promise<ctx>;
    onError?:    (ctx & { error }) => void | Promise<void>;
  };
}): Plugin
```

Errors in `init` propagate and abort the request (safe default — init
mutates state). Errors in hooks are isolated and do not interrupt the
pipeline. See [ADR 0004](../adrs/0004-plugin-hook-isolation.md).

## Supporting helpers

### Errors
- `NormalizedError` — class + factory (`createNormalizedError`)
- `isNormalizedError(e)` — type-safe instanceof
- `isAuth`, `isClientError`, `isServerError`, `isRateLimited`,
  `isNetwork`, `isTimeout`, `isCanceled`, `isValidation`, `isDomain`,
  `isRetryable` — kind/status shortcuts
- `exhaustiveGuard(value)` — compile-time completeness for `switch`
  statements over `error.kind`

### Pipeline primitives
- `fetchTransport(fetchImpl?)` — default transport
- `dedupTransport(inner, { methods?, key? })` — in-flight GET/HEAD dedup
- `idempotencyKey({ methods?, header?, generate? })` — auto-inject
  `Idempotency-Key` on write verbs
- `unwrap(p)` — throw-on-error adaptor
- `computeBackoffMs`, `maxAttempts`, `parseRetryAfter`

### Schema
- `typedInput<T>()`, `typedOutput<T>()` — zero-runtime validators
- `validateStandard(schema, value)` — programmatic Standard Schema call

### Pagination
- `parseLinkHeader(value, rel?)` — RFC 5988 parser
- `PaginationStrategy` type: `"cursor" | "offset" | "link-header" | "custom"`

### URL
- `composePath(base, path, params?, query?)`
- `serializeQuery(q)`

### Low-level
- `generateRequestId()`
- `timeoutSignal(ms)`, `anySignal([...signals])`, `isTimeoutAbort(err)`
- `decodeBody(body, contentType, status)` — pipeline's decode step

## Call options (per-request)

```ts
{
  signal?: AbortSignal;
  timeout?: number;
  headers?: Record<string, string>;
  credentials?: RequestCredentials;
  mode?: RequestMode;
  cache?: RequestCache;
}
```

Per-call options override adapter defaults, which override client-level
defaults.

## See also

- [`guides/vendor-adapters.md`](../guides/vendor-adapters.md) — composing
  multiple adapters.
- [`reference/normalized-error.md`](./normalized-error.md) — error shape
  in depth.
