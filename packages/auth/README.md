# @zerovoids/http-auth

Auth recipes for [@zerovoids/http](../core). Zero peer dependency.

- `bearerWithRefresh` — single-flight token refresh (동시 401 일괄 처리, race 검출)
- `xsrf` — cookie → header 자동 동기화 (쓰기 동사만)
- `oauthPKCE` helpers — RFC 7636 S256
- `memoryStorage` / `localStorageStorage` — SSR 안전한 token storage abstraction

커버리지: **99% stmt / 98% branch / 100% func** (목표 90% 초과).

## Install

```bash
pnpm add @zerovoids/http-auth @zerovoids/http
```

## `bearerWithRefresh` — Transport wrapper

Plugin 이 아니라 **transport wrapper** 로 제공됩니다 — Plugin API는 "401 응답을 보고 refresh 후 같은 요청을 재시도" 를 표현할 수 없어서 (ADR [0003](../../website/adrs/0003-bearer-transport-wrapper.md)).

```ts
import { createClient, fetchTransport } from "@zerovoids/http";
import { bearerWithRefresh, localStorageStorage } from "@zerovoids/http-auth";

const auth = bearerWithRefresh({
  storage: localStorageStorage("access_token"),
  refresh: async () => {
    const r = await fetch("/auth/refresh", { method: "POST" });
    if (!r.ok) return null;                     // → 이후 401 throw
    const { token } = await r.json();
    return token;
  },
  shouldRefresh: (res) => res.status === 401,   // 기본값
});

const api = createClient({
  adapters,
  transport: auth.wrap(fetchTransport()),       // ← wrap
});
```

**Single-flight 보장**: 동시 401이 N건 발생해도 `refresh()` 는 **정확히 1회** 실행. 전부 같은 새 토큰을 받고 각자 재시도. 동일 토큰 기반 재시도가 또 401이 되면 (refresh 도중 레이스) 그 요청만 정상 401로 반환되어 무한 루프 차단.

`refresh()` 가 `null` 반환 또는 throw → 원본 401을 그대로 반환해 소비자가 로그아웃 처리.

**위협 모델**: [`THREAT_MODEL.md`](./THREAT_MODEL.md) — 6 in-scope (single-flight · race · refresh null/throw · XSRF bypass · cross-origin Authorization) + 4 out-of-scope.

## `xsrf` — Plugin

```ts
import { xsrf } from "@zerovoids/http-auth";

createClient({
  adapters,
  plugins: [xsrf({
    cookieName: "XSRF-TOKEN",     // default
    headerName: "X-XSRF-TOKEN",   // default
  })],
});
```

- 쓰기 동사 (POST/PUT/PATCH/DELETE) 에만 헤더 주입
- 소비자가 이미 해당 헤더를 넘겼다면 보존
- `defaultCookieReader` 는 `document.cookie` 를 파싱. SSR 에선 자동 no-op

## Token storage

```ts
import { memoryStorage, localStorageStorage } from "@zerovoids/http-auth";

memoryStorage();                     // 프로세스 내 메모리 (SSR 기본)
localStorageStorage("access_token"); // globalThis.localStorage 폴백 → memory
```

두 storage 모두 `{ get(), set(v), clear() }` shape — 커스텀 storage (sessionStorage, secure cookie 등) 도 같은 shape 으로 주입 가능.

## OAuth PKCE helpers (RFC 7636)

```ts
import { createPkceChallenge } from "@zerovoids/http-auth";

const { verifier, challenge, method } = await createPkceChallenge();
// method = "S256" (plain 미지원)
// verifier = 43~128자 base64url unreserved
// challenge = SHA-256(verifier) → base64url

// 인가 요청: code_challenge + code_challenge_method="S256"
// 토큰 교환: code_verifier
```

**런타임 요구**: `crypto.getRandomValues` + `crypto.subtle.digest` — Node 16+ / 브라우저 / Deno / Bun / Cloudflare Workers 모두 동작.

저수준 API: `generateVerifier()` / `deriveChallenge(verifier)`.

## License

MIT
