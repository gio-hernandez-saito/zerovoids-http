<div align="center">

# @zerovoids/http-auth

**Auth recipes — bearer refresh · XSRF · OAuth PKCE**

[![npm](https://img.shields.io/npm/v/@zerovoids/http-auth.svg)](https://www.npmjs.com/package/@zerovoids/http-auth)
[![npm downloads](https://img.shields.io/npm/dm/@zerovoids/http-auth.svg)](https://www.npmjs.com/package/@zerovoids/http-auth)
[![license](https://img.shields.io/npm/l/@zerovoids/http-auth.svg)](https://github.com/gio-hernandez-saito/zerovoids-http/blob/main/LICENSE)
[![types](https://img.shields.io/npm/types/@zerovoids/http-auth.svg)](https://www.npmjs.com/package/@zerovoids/http-auth)

[Install](#-install) · [bearerWithRefresh](#-bearerwithrefresh) · [xsrf](#-xsrf) · [Token storage](#-token-storage) · [PKCE](#-oauth-pkce) · [메인 리포](../..)

</div>

---

## 소개

`@zerovoids/http` 를 위한 인증 유틸. Zero peer dependency, **커버리지 99%**, 보안 민감 시나리오에 대응하도록 설계.

- 🔄 **`bearerWithRefresh`** — single-flight token refresh (동시 401 일괄 처리 + race 검출)
- 🛡 **`xsrf`** — cookie → header 자동 동기화 (쓰기 동사만)
- 🔑 **`oauthPKCE`** — RFC 7636 S256 challenge/verifier
- 💾 **`memoryStorage` / `localStorageStorage`** — SSR 안전 token abstraction
- 📋 [위협 모델 문서](./THREAT_MODEL.md) — 6 in-scope / 4 out-of-scope

## 📦 Install

```bash
pnpm add @zerovoids/http-auth @zerovoids/http
```

## 🔄 bearerWithRefresh

Plugin 이 아니라 **transport wrapper** 로 제공됩니다 — Plugin API 는 "401 응답을 보고 refresh 후 같은 요청을 재시도" 를 표현할 수 없어서 (ADR [0003](../../website/adrs/0003-bearer-transport-wrapper.md)).

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

### Single-flight 보장

동시 401 이 N건 발생해도 `refresh()` 는 **정확히 1회** 실행. 전부 같은 새 토큰을 받고 각자 재시도. 동일 토큰 기반 재시도가 또 401 이면 (refresh 도중 race) 그 요청만 정상 401 로 반환되어 무한 루프 차단.

`refresh()` 가 `null` 반환 또는 throw → 원본 401 을 그대로 반환해 소비자가 로그아웃 처리.

## 🛡 xsrf

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

## 💾 Token storage

```ts
import { memoryStorage, localStorageStorage } from "@zerovoids/http-auth";

memoryStorage();                      // 프로세스 내 메모리 (SSR 기본)
localStorageStorage("access_token");  // globalThis.localStorage 폴백 → memory
```

두 storage 모두 `{ get(), set(v), clear() }` shape — 커스텀 storage (sessionStorage, secure cookie 등) 도 같은 shape 으로 주입 가능.

## 🔑 OAuth PKCE

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

## 📊 커버리지 & 품질

```
stmt  99.09%
branch  98%
func   100%
```

targeted coverage 90% 목표 초과 달성. 28 tests (bearer 12 / xsrf 8 / storage 5 / smoke 3) + PKCE 9 = **37 tests**.

## 🔗 관련 링크

- [메인 README](../..) — 전체 생태계 소개
- [Auth recipes guide](../../website/guides/auth-recipes.md)
- [THREAT_MODEL](./THREAT_MODEL.md) — 위협 모델
- [ADR 0003 — bearer transport wrapper](../../website/adrs/0003-bearer-transport-wrapper.md)

## License

MIT © [zerovoids](https://github.com/gio-hernandez-saito)
