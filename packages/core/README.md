<div align="center">

# @zerovoids/http

**Vendor-normalizing multi-adapter HTTP client — core engine**

[![npm](https://img.shields.io/npm/v/@zerovoids/http.svg)](https://www.npmjs.com/package/@zerovoids/http)
[![npm downloads](https://img.shields.io/npm/dm/@zerovoids/http.svg)](https://www.npmjs.com/package/@zerovoids/http)
[![license](https://img.shields.io/npm/l/@zerovoids/http.svg)](https://github.com/gio-hernandez-saito/zerovoids-http/blob/main/LICENSE)
[![types](https://img.shields.io/npm/types/@zerovoids/http.svg)](https://www.npmjs.com/package/@zerovoids/http)

[Install](#-install) · [Quick start](#-quick-start) · [Public API](#-public-api-4개) · [NormalizedError](#-normalizederror) · [Pipeline](#-pipeline) · [메인 리포](../..)

</div>

---

## 소개

여러 외부 API 를 **하나의 도메인 모델처럼 합성** 하는 타입 안전 HTTP 클라이언트의 코어. 벤더별 에러를 `NormalizedError` 하나로 정규화, transport·schema·state 를 모두 peer 로 분리, 공개 API 를 **네 개** 로 제한.

- ✨ **Zero peer dependency** — 어떤 runtime 에서도 즉시 실행
- 📦 **3.38 KB brotli** (budget 5 KB), pipeline overhead **p99 2μs**
- 📐 Standard Schema v1 — zod / valibot / arktype 자유 선택
- 🧩 Transport / Schema / State 3축 모두 peer 분리

## 📦 Install

```bash
pnpm add @zerovoids/http
```

## 🚀 Quick start

```ts
import {
  createClient,
  defineAdapter,
  defineEndpoint,
  typedOutput,
} from "@zerovoids/http";

const github = defineAdapter({
  baseURL: "https://api.github.com",
  endpoints: {
    getRepo: defineEndpoint({
      method: "GET",
      path: "/repos/:owner/:repo",
      output: typedOutput<{ full_name: string; stargazers_count: number }>(),
    }),
  },
});

const api = createClient({ adapters: { github } });

const { data, error } = await api.github.getRepo({
  params: { owner: "octocat", repo: "hello-world" },
});

if (error) {
  console.error(error.kind, error.code, error.httpStatus);
} else {
  console.log(`⭐ ${data.full_name}: ${data.stargazers_count}`);
}
```

## 🧩 Public API (4개)

공개 심볼은 정확히 네 개. 나머지는 타입 / 헬퍼.

| Symbol | 역할 |
|---|---|
| `createClient(config)` | 어댑터 합성 + transport/plugin 구성 |
| `defineAdapter(def)` | 벤더 정의 — baseURL · errorMap · endpoints · pagination |
| `defineEndpoint(def)` | 타입 안전 엔드포인트 (method · path · schemas) |
| `definePlugin(def)` | cross-cutting concerns (`init` / `onRequest` / `onResponse`) |

## 🎯 NormalizedError

모든 에러 반환은 **반드시** 이 shape — ADR [0001](../../website/adrs/0001-normalized-error.md) 참조.

```ts
class NormalizedError extends Error {
  kind: "network" | "timeout" | "http" | "validation" | "domain" | "canceled";
  code: string;
  httpStatus?: number;
  retryable: boolean;
  retryAfterMs?: number;   // Retry-After delta-seconds + HTTP-date 자동 파싱
  cause: unknown;           // 원본 벤더 에러 보존
  trace: { requestId; url; method; attempt };
  toJSON();                 // SSR / 구조화 로깅
}
```

### 헬퍼 10종

```ts
import {
  isNormalizedError, isKind, exhaustiveGuard,
  isAuth, isRetryable, isClientError, isServerError, isRateLimited,
  isNetwork, isTimeout, isCanceled, isValidation, isDomain,
} from "@zerovoids/http";

if (isRateLimited(error)) setTimeout(retry, error.retryAfterMs ?? 1000);
else if (isAuth(error)) redirectToLogin();
else if (isServerError(error)) showBanner("서버 장애");
```

## ⚙️ Pipeline

각 호출은 고정 순서로 처리됩니다.

```
init (plugin) → input schema validate → compose URL/headers/body
  → signal 합성 (timeout + caller) → retry loop
    → onRequest (plugin) → transport → decideRetry
  → decode (content-type aware, 204/304 빈 body 정상 처리)
  → onResponse (plugin) → errorMap or output schema validate → Result
```

- Plugin `init` 에러는 **propagate**, `onRequest`/`onResponse` 에러는 **격리** — ADR [0004](../../website/adrs/0004-plugin-hook-isolation.md)
- Plugin ID 중복은 `createClient` 시점 검사
- `AbortSignal.any([caller, timeout])` 으로 timeout vs canceled 구분
- Retry: exponential backoff + jitter + `Retry-After` (RFC 7231 HTTP-date), `shouldRetry`/`onRetry` 커스텀 훅
- Header layering case-insensitive 병합

## 📑 Pagination

`defineAdapter({ pagination })` 네 가지 전략.

- `cursor` — 토큰 기반 (next/prev)
- `offset` — `{ offset, limit }`
- `link-header` — RFC 5988 `Link: <url>; rel="next"` 자동 파싱
- `custom` — 소비자 제공 함수

## 🪄 Escape hatch — `.raw()`

엔드포인트마다 `.raw(input, options?)` 로 **decode/errorMap/output-validate 건너뛰고** `Result<TransportResponse>` 획득. `network` / `timeout` / `canceled` 만 `NormalizedError` 유지, `onResponse` 훅은 그대로 발화.

```ts
const { data: raw, error } = await api.github.getRepo.raw({ params });
// raw: { status, headers, body: ArrayBuffer | string | null }
```

## 🎛 Call options

```ts
api.github.getRepo({ params }, {
  signal,        // 호출별 AbortSignal
  timeout,       // ms — 내부에서 timeoutSignal 합성
  headers,       // 호출별 추가 헤더
  credentials,   // 'include' | 'same-origin' | 'omit'   (SSR 1급 필드)
  mode,          // 'cors' | 'no-cors' | 'same-origin'
  cache,         // RequestCache
});
```

`AdapterDefinition` / `TransportRequest` 에도 동일 필드 존재, `fetchTransport` / `axiosTransport` 가 각자 매핑.

## 🔗 관련 링크

- [메인 README](../..) — 전체 생태계 소개
- [Getting started](../../website/guides/getting-started.md)
- [Architecture](../../website/architecture.md)
- [API reference](../../website/reference/api.md)
- [NormalizedError reference](../../website/reference/normalized-error.md)
- [ADRs](../../website/adrs/)

## License

MIT © [zerovoids](https://github.com/gio-hernandez-saito)
