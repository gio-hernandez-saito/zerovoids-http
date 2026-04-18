---
"@zerovoids/http": minor
"@zerovoids/http-react-query": minor
"@zerovoids/http-swr": minor
"@zerovoids/http-transport-ky": minor
"@zerovoids/http-transport-axios": minor
"@zerovoids/http-auth": minor
"@zerovoids/http-mock": minor
---

**0.1.0 — Initial public release** (fixed group).

전체 Phase 0~4 deliverable 일괄 배포:

### `@zerovoids/http` (core)
- Public API 4개 (`createClient` / `defineAdapter` / `defineEndpoint` / `definePlugin`) + `unwrap`
- 고정 순서 pipeline: init → validate → compose → retry → decode → errorMap
- `NormalizedError` 단일 shape (6 kinds) + 10 helpers (`isAuth` / `isRetryable` / `isRateLimited` 등)
- `.raw()` escape hatch — Result<TransportResponse>
- `dedupTransport` (in-flight GET/HEAD 공유), `idempotencyKey` plugin (POST/PATCH 자동)
- `pagination` 선언 4 전략 (cursor / offset / link-header / custom) + `parseLinkHeader` (RFC 5988)
- SSR 1급 필드: `credentials` / `mode` / `cache`
- Retry: exponential + jitter + `Retry-After` (delta-seconds + HTTP-date)
- `typedInput<T>()` / `typedOutput<T>()` 타입-only 헬퍼, `validateStandard` Standard Schema 어댑터
- **번들 3.52 KB brotli** (예산 5 KB), **pipeline overhead p99 2μs**

### `@zerovoids/http-react-query`
- `createQueryHooks(api)` — 엔드포인트마다 `.useQuery` / `.useSuspenseQuery` / `.useInfiniteQuery` / `.useSuspenseInfiniteQuery` / `.useMutation` / `.queryKey`
- `queryKeyFor(adapter, endpoint, input)` — deterministic canonicalize
- `invalidate(qc, key)` — `[adapter]` / `[adapter, endpoint]` / 전체 지원
- `optimistic(qc, queryKey, updater)` — snapshot / optimistic / rollback / invalidate
- renderHook 통합 테스트 (jsdom)

### `@zerovoids/http-swr`
- `createSwrHooks(api)` — `.useSWR` / `.useSWRInfinite` / `.key`
- `canonicalize` / `swrKeyFor` — **react-query 어댑터와 캐시 키 호환**
- `NormalizedError` SWR `error` 슬롯에 unwrap-throw 전파
- renderHook 통합 테스트 (jsdom)

### `@zerovoids/http-transport-ky`
- `kyTransport()` — ky 매핑. retry/timeout/throwHttpErrors 비활성화로 core 파이프라인 소유권 존중

### `@zerovoids/http-transport-axios`
- `axiosTransport()` — `responseType: 'arraybuffer'`, `validateStatus: () => true`, `timeout: 0`, `transformRequest: [identity]`
- `onUploadProgress` / `onDownloadProgress` — **axios 전용** (XHR-backed)
- `credentials` → `withCredentials`, `httpAgent` / `httpsAgent` passthrough
- `ERR_CANCELED` → `AbortError` 변환

### `@zerovoids/http-auth`
- `bearerWithRefresh` transport wrapper — single-flight token refresh, race 검출
- `xsrf` plugin — cookie → header 쓰기 동사만
- `memoryStorage` / `localStorageStorage` — SSR 안전
- `createPkceChallenge` / `generateVerifier` / `deriveChallenge` — RFC 7636 S256
- 커버리지 **99% stmt / 98% branch / 100% func**
- `THREAT_MODEL.md` — 6 in-scope / 4 out-of-scope

### `@zerovoids/http-mock`
- `createMockTransport({ routes, onUnmatched })` — string/RegExp path, body/headers matcher
- `delay`, 함수 response 팩토리, `calls[]` 히스토리 + `reset()`
- `scenario(responses, { onExhausted })` — cycle / last / throw

### 문서 / ADR
- ADR 4종 (`website/adrs/` — 공개)
- `website/guides/` 6종: getting-started, vendor-adapters, error-handling, auth-recipes, testing, observability
- `website/reference/` : api, normalized-error
- size-limit 전 패키지 적용 (brotli, peer-excluded)

### 예제
- `examples/multi-vendor` (Node + ky + 3 vendor)
- `examples/nextjs-react-query` (App Router + RSC prefetchQuery)
- `examples/node-cli` (pure Node CLI)
- `examples/vite-swr` (Vite SPA + SWR)

### 테스트
- **211 tests** green (core 113 / auth 37 / mock 16 / react-query 15 / swr 12 / transport-axios 11 / transport-ky 7)
- 7 패키지 type-check + biome 0 errors
- 모든 size gate 통과
