# @zerovoids/http

> Core of [zerovoids-http](https://github.com/gio-hernandez-saito/zerovoids-http).
> Zero peer dependency. 3.52 KB brotli (budget 5 KB).

Vendor-normalizing multi-adapter HTTP client — 외부 API 여러 개를 하나의 도메인 모델처럼 쓸 때 최적.

## Install

```bash
pnpm add @zerovoids/http
```

## Public API (4개)

- `createClient(config)` — 어댑터 합성, transport/plugin 구성
- `defineAdapter(def)` — 벤더 어댑터 정의 (baseURL, errorMap, endpoints, pagination)
- `defineEndpoint(def)` — 타입 안전 엔드포인트 정의 (method, path, body/query/headers/output 스키마)
- `definePlugin(def)` — cross-cutting concerns 플러그인 (`init`, `onRequest`, `onResponse`)

타입/헬퍼:

- `NormalizedError` class + `createNormalizedError`, `isNormalizedError`, `isKind`, `exhaustiveGuard`
- 에러 분류 헬퍼 10개: `isAuth` · `isRetryable` · `isClientError` · `isServerError` · `isRateLimited` · `isNetwork` · `isTimeout` · `isCanceled` · `isValidation` · `isDomain`
- `unwrap(result)` — `Result<T>` → `T` (에러 시 throw)
- `typedInput<T>()` / `typedOutput<T>()` — 스키마 없이 타입-only 엔드포인트
- `validateStandard` — Standard Schema v1 어댑터
- `fetchTransport` (기본 transport) / `dedupTransport` (in-flight GET/HEAD 공유)
- `idempotencyKey` 플러그인 (POST/PATCH 자동 UUID)
- `parseLinkHeader` (RFC 5988)
- `computeBackoffMs`, `maxAttempts`, `parseRetryAfter`
- URL/decode/id/timeout 유틸 — `composePath`, `serializeQuery`, `decodeBody`, `generateRequestId`, `timeoutSignal`, `anySignal`, `isTimeoutAbort`

## NormalizedError

```ts
class NormalizedError extends Error {
  kind: "network" | "timeout" | "http" | "validation" | "domain" | "canceled";
  code: string;
  httpStatus?: number;
  retryable: boolean;
  retryAfterMs?: number;   // Retry-After 헤더 자동 파싱 (delta-seconds + HTTP-date)
  cause: unknown;           // 원본 벤더 에러 보존
  trace: { requestId; url; method; attempt };
  toJSON();                 // SSR / 구조화 로깅
}
```

모든 에러 반환은 **반드시** 이 shape — ADR [0001](../../website/adrs/0001-normalized-error.md) 참조.

## Pipeline

각 호출은 고정된 순서로 처리됩니다:

```
init (plugin) → input schema validate → compose URL/headers/body
  → signal 합성(timeout + caller) → retry loop
    → onRequest (plugin) → transport → decideRetry
  → decode (content-type aware, 204/304 빈 body 정상 처리)
  → onResponse (plugin) → errorMap or output schema validate → Result
```

- Plugin `init` 에러는 **propagate**, `onRequest`/`onResponse` 에러는 **격리** — ADR [0004](../../website/adrs/0004-plugin-hook-isolation.md)
- Plugin ID 중복은 `createClient` 시점 검사
- `AbortSignal.any([caller, timeout])` 으로 timeout vs canceled 구분 (`timeout` kind 분리)
- Retry: exponential backoff + jitter + `Retry-After` HTTP-date, `shouldRetry`/`onRetry` 커스텀 훅
- Header layering case-insensitive 병합

## Pagination

`defineAdapter({ pagination })` 4 전략:

- `cursor` — `{ cursor: string }` 기반 (next/prev 토큰)
- `offset` — `{ offset, limit }`
- `link-header` — RFC 5988 `Link: <url>; rel="next"` 자동 파싱
- `custom` — 소비자 제공 함수

## Escape hatch: `.raw()`

엔드포인트마다 `.raw(input, options?)` 로 **decode/errorMap/output-validate 건너뛰고** `Result<TransportResponse>` 획득 가능. `network`/`timeout`/`canceled` 만 `NormalizedError` 유지, `onResponse` 훅은 그대로 발화.

## Call options

```ts
api.github.getRepo({ params }, {
  signal,          // 호출별 AbortSignal
  timeout,         // ms — 내부에서 timeoutSignal 합성
  headers,         // 호출별 추가 헤더
  credentials,     // 'include' | 'same-origin' | 'omit'  (SSR 1급 필드)
  mode,            // 'cors' | 'no-cors' | 'same-origin'
  cache,           // RequestCache
});
```

`AdapterDefinition` / `TransportRequest` 에도 동일 필드 존재, `fetchTransport` / `axiosTransport` 가 각자 매핑.

## Performance

- `@zerovoids/http-bench` 내부 벤치: **p99 pipeline overhead 2μs** (예산 5ms의 1/2500)
- Bundle budget: core 5 KB brotli. 현재 **3.52 KB** (peerless)

## Status

**v0 (pre-alpha)** — Phase 4 완료. v1.0.0 publish 대기.

## License

MIT
