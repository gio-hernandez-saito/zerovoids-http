# Composing Vendor Adapters

The defining feature of `@zerovoids/http`: a single client that *composes*
multiple ("vendor") APIs into one typed surface, with errors from every
vendor normalized to the same shape.

This guide builds a three-vendor client — GitHub, HackerNews, and an
internal API — and shows how the differences between them disappear at
the call site.

## The shape of a vendor

Each vendor is one `defineAdapter` call. The adapter owns the base URL,
any always-on headers, and an `errorMap` that takes the vendor's raw
error body and produces a `NormalizedError`.

```ts
import { createClient, createNormalizedError, defineAdapter, defineEndpoint, typedOutput } from "@zerovoids/http";

const github = defineAdapter({
  baseURL: "https://api.github.com",
  defaultHeaders: {
    accept: "application/vnd.github+json",
  },
  errorMap: (raw, ctx) => createNormalizedError({
    kind: "http",
    code: (raw as { message?: string } | null)?.message ?? `HTTP_${ctx.httpStatus}`,
    httpStatus: ctx.httpStatus,
    retryable: ctx.httpStatus >= 500 || ctx.httpStatus === 429,
    cause: raw,
    trace: ctx.trace,
  }),
  endpoints: {
    getRepo: defineEndpoint({
      method: "GET",
      path: "/repos/:owner/:repo",
      output: typedOutput<{ id: number; full_name: string; stargazers_count: number }>(),
    }),
  },
});
```

HackerNews has a different error shape:

```ts
const hn = defineAdapter({
  baseURL: "https://hacker-news.firebaseio.com/v0",
  // HN's errors are plain text; normalize through the default errorMap
  // (kind: 'http', code: `HTTP_<status>`, retryable on 5xx/429/408).
  endpoints: {
    getItem: defineEndpoint({
      method: "GET",
      path: "/item/:id.json",
      output: typedOutput<{ id: number; title: string; score: number } | null>(),
    }),
  },
});
```

And a domain API with its own envelope:

```ts
type DomainErr = { error: { code: string; message: string } };

const internal = defineAdapter({
  baseURL: process.env.INTERNAL_API!,
  errorMap: (raw, ctx) => createNormalizedError({
    kind: "domain",
    code: (raw as DomainErr | null)?.error?.code ?? `HTTP_${ctx.httpStatus}`,
    httpStatus: ctx.httpStatus,
    retryable: ctx.httpStatus >= 500,
    cause: raw,
    trace: ctx.trace,
  }),
  endpoints: {
    chargeCard: defineEndpoint({ method: "POST", path: "/charges" }),
  },
});
```

## Compose

```ts
export const api = createClient({
  adapters: { github, hn, internal },
  // Optional: one transport for all three. Swap to kyTransport()/axiosTransport()
  // here without touching a single adapter definition.
});
```

## Call sites are uniform

```ts
const repo  = await api.github.getRepo({ params: { owner: "octocat", repo: "hello-world" } });
const item  = await api.hn.getItem({ params: { id: 42 } });
const pay   = await api.internal.chargeCard({ body: { amount: 500 } });

for (const r of [repo, item, pay]) {
  if (r.error) {
    // Same shape — same helpers — same UI story.
    console.error(r.error.kind, r.error.code, r.error.httpStatus);
  }
}
```

The consumer never sees a `GithubError` or an `AxiosError`. Only
`NormalizedError`, discriminated by `.kind` and `.code`. See ADR 0001 for
the full rationale.

## Adding transports per-vendor (v1.1+)

Today transport is per-client, not per-adapter. If you need different
transports for different vendors, compose them with a dispatching
transport:

```ts
import type { Transport } from "@zerovoids/http";

function byHost(routes: Record<string, Transport>, fallback: Transport): Transport {
  return async (req) => {
    const host = new URL(req.url).host;
    return (routes[host] ?? fallback)(req);
  };
}
```

This pattern is expected to remain the norm — "one adapter, one
transport" would multiply the public API's complexity without unlocking
real use cases.

## See also

- [`reference/api.md`](../reference/api.md) — full signatures.
- [`guides/error-handling.md`](./error-handling.md) — exhaustive branching
  over `.kind`.
