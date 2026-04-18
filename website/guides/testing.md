# Testing with `@zerovoids/http-mock`

The library ships its own mock transport. It is the same transport
surface every real network adapter implements — so tests exercise the
exact pipeline production uses, minus the socket.

## Basic route match

```ts
import { createClient, defineAdapter, defineEndpoint, typedOutput } from "@zerovoids/http";
import { createMockTransport } from "@zerovoids/http-mock";

const transport = createMockTransport({
  routes: [
    {
      method: "GET",
      path: "/users/:id",
      response: {
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        body: JSON.stringify({ id: 1, name: "Alice" }),
      },
    },
  ],
});

const api = createClient({ adapters: { svc }, transport });
```

Path matching is `url.endsWith(path)` for strings, `path.test(url)` for
`RegExp`. No params interpolation — the real URL the client composes is
what we match against.

## Dynamic responses

Pass a factory instead of a static object:

```ts
{
  method: "POST",
  path: "/echo",
  response: async (req) => ({
    status: 200,
    headers: new Headers({ "content-type": "application/json" }),
    body: JSON.stringify({ echoed: req.url, body: req.body }),
  }),
}
```

## Matchers

Routes can be further constrained:

```ts
{
  method: "POST",
  path: "/payments",
  // Only this route if Idempotency-Key is present
  headers: { "idempotency-key": /.+/ },
  // Only this route if body is a valid JSON payload
  body: (b) => typeof b === "string" && b.includes('"amount"'),
  response: { status: 201 },
},
{
  method: "POST",
  path: "/payments",
  // ... fallthrough for requests that didn't match above
  response: { status: 400 },
},
```

## Scenarios (flaky API simulation)

`scenario()` walks a sequence of responses, one per call — useful for
testing retry logic or circuit breakers:

```ts
import { createMockTransport, scenario } from "@zerovoids/http-mock";

const transport = createMockTransport({
  routes: [
    {
      method: "GET",
      path: "/flaky",
      response: scenario([
        { status: 500 },
        { status: 500 },
        { status: 200, body: '{"ok":true}' },
      ], { onExhausted: "last" }),
    },
  ],
});

const api = createClient({
  adapters: { svc },
  transport,
  retry: { type: "linear", attempts: 3, delay: 10 },
});

// Succeeds after two 500s — one call site, full retry loop exercised.
await api.svc.flaky();
```

`onExhausted` options: `"cycle"` (loop, default), `"last"` (sticky on the
final response), `"throw"` (surfaces as `NormalizedError { kind:
'network' }`).

## Inspecting calls

The returned transport carries a call history:

```ts
await api.svc.get({ params: { id: 1 } });
await api.svc.get({ params: { id: 2 } });

expect(transport.calls).toHaveLength(2);
expect(transport.calls[0].url).toContain("/users/1");
expect(transport.calls[1].headers["x-trace"]).toBe("42");

transport.reset();  // between tests
expect(transport.calls).toHaveLength(0);
```

## Why this over MSW?

MSW intercepts the `fetch` layer, which is excellent for full-stack
testing. The mock transport sits one layer higher — it tests the
*pipeline*: `init` plugins, retry loop, errorMap, schema validation.

Rule of thumb:

- **Test the pipeline** (validators, retries, error mapping) →
  `createMockTransport`.
- **Test the fetch layer** (header serialization, cookie jars, redirect
  semantics) → MSW.

They compose — use both in the same test suite when useful.

## See also

- [`guides/error-handling.md`](./error-handling.md) — assertions that pair
  well with mock responses.
