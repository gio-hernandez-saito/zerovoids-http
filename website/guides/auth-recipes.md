# Auth recipes

Patterns for wiring `@zerovoids/http-auth` to real apps. For the security
assumptions and threat model, see
[`packages/auth/THREAT_MODEL.md`](https://github.com/gio-hernandez-saito/zerovoids-http/blob/main/packages/auth/THREAT_MODEL.md).

## Bearer + single-flight refresh

`bearerWithRefresh` is a **transport wrapper** (not a plugin — see
[ADR 0003](../../docs/adrs/0003-bearer-transport-wrapper.md)). It reads
your access token on every request, detects 401, and coordinates a
single refresh across concurrent callers.

```ts
import {
  bearerWithRefresh,
  localStorageStorage,
} from "@zerovoids/http-auth";
import { createClient, fetchTransport } from "@zerovoids/http";

const tokens = localStorageStorage("access-token");

const auth = bearerWithRefresh({
  getToken: () => tokens.get(),
  refresh: async () => {
    const r = await fetch("/auth/refresh", { method: "POST", credentials: "include" });
    if (!r.ok) return null;  // null → surface the original 401, route to login
    const { access_token } = await r.json();
    await tokens.set(access_token);
    return access_token;
  },
});

export const api = createClient({
  adapters,
  transport: auth.wrap(fetchTransport()),
});
```

**What this gives you for free**:
- 50 concurrent 401s → **1** refresh call (`refreshPromise` + `finally`
  eviction).
- Race-safe: if another caller refreshed while you were mid-flight, the
  wrapper skips your refresh and retries with the rotated token.
- One retry only: a refreshed token that still 401s surfaces unchanged.
  No recursive refresh loops.

## XSRF cookie ↔ header

Purely a plugin — it only mutates the request at `init` time:

```ts
import { xsrf } from "@zerovoids/http-auth";

createClient({
  adapters,
  plugins: [xsrf()],
  // default: reads `XSRF-TOKEN` cookie → writes `X-XSRF-TOKEN` header
  // on POST/PUT/PATCH/DELETE only.
});
```

Laravel / Rails / Django conventions:

```ts
// Laravel
xsrf({ cookieName: "XSRF-TOKEN", headerName: "X-XSRF-TOKEN" })
// Django
xsrf({ cookieName: "csrftoken", headerName: "X-CSRFToken" })
// Rails
xsrf({ cookieName: "CSRF-TOKEN", headerName: "X-CSRF-Token" })
```

In SSR (no `document`), the plugin silently skips — no error. Inject
your own `readCookie` if you need to emit the header from Node.

## Storage choices

| Storage | Use when | Trade-off |
|---|---|---|
| `memoryStorage()` | SSR request scope, tests | lost on reload |
| `localStorageStorage(key)` | SPA, long-lived session | XSS → token theft |
| Custom (implement `TokenStorage`) | Cookie-based, electron, RN | you own the implementation |

## PKCE (OAuth Authorization Code)

`createPkceChallenge()` is stateless — generate once per authorize flow,
persist the `verifier` keyed by `state`, discard after token exchange:

```ts
import { createPkceChallenge } from "@zerovoids/http-auth";

// Before redirect:
const { verifier, challenge } = await createPkceChallenge();
const state = crypto.randomUUID();
sessionStorage.setItem(`pkce:${state}`, verifier);

const authorize = new URL("https://auth.example/authorize");
authorize.searchParams.set("response_type", "code");
authorize.searchParams.set("client_id", CLIENT_ID);
authorize.searchParams.set("redirect_uri", REDIRECT_URI);
authorize.searchParams.set("scope", "openid profile");
authorize.searchParams.set("state", state);
authorize.searchParams.set("code_challenge", challenge);
authorize.searchParams.set("code_challenge_method", "S256");
window.location.href = authorize.toString();
```

After callback:

```ts
const params = new URLSearchParams(window.location.search);
const state = params.get("state")!;
const code  = params.get("code")!;
const verifier = sessionStorage.getItem(`pkce:${state}`)!;
sessionStorage.removeItem(`pkce:${state}`);

const r = await fetch("https://auth.example/token", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    code,
    code_verifier: verifier,
  }),
});
```

The library only provides verifier/challenge generation (RFC 7636
§4.1–4.2). State management, token exchange, and the authorize URL are
application-specific and deliberately not wrapped.

## Combining

All three (bearer + xsrf + PKCE-issued tokens) compose naturally:

```ts
createClient({
  adapters,
  transport: bearerWithRefresh({ getToken, refresh }).wrap(fetchTransport()),
  plugins: [xsrf()],
});
```

## See also

- [ADR 0003](../../docs/adrs/0003-bearer-transport-wrapper.md) — why the
  bearer helper is a transport wrapper, not a plugin.
- [`packages/auth/THREAT_MODEL.md`](https://github.com/gio-hernandez-saito/zerovoids-http/blob/main/packages/auth/THREAT_MODEL.md) — 6 in-scope threats + 4 non-goals.
