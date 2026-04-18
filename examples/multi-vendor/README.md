# Multi-Vendor Adapter Composition

`@zerovoids/http` 의 **핵심 가치 증명 예제**: 서로 다른 외부 API 3개를 하나의 클라이언트 surface로 합성하고, 각 벤더 에러를 `NormalizedError` 하나로 정규화.

## 이 예제가 보여주는 것

1. **여러 벤더 합성** — `createClient({ adapters: { github, hn, placeholder } })` 한 줄로 묶음
2. **에러 정규화** — GitHub의 `{ message }` 바디, JSONPlaceholder의 빈 바디 모두 같은 `NormalizedError` 로
3. **Transport 교체** — `fetch` (default) ↔ `ky` 한 줄 변경
4. **타입 추론 완전성** — `:owner/:repo` → `params: { owner, repo }` 자동 요구
5. **에러 헬퍼 숏컷** — `isClientError`, `isRetryable`

## 사용한 API

| Vendor | 특이점 |
|---|---|
| [GitHub REST](https://docs.github.com/en/rest) | 에러 응답 본문 `{ message, documentation_url }` → 커스텀 `errorMap` 으로 `message` 추출 |
| [HackerNews Firebase](https://github.com/HackerNews/API) | 에러 본문 없음 → 기본 `errorMap` 사용 |
| [JSONPlaceholder](https://jsonplaceholder.typicode.com/) | 안정적인 더미 API → 기본 `errorMap` 사용 |

모두 **API key 불필요, 공개 엔드포인트**.

## 실행

```bash
# 먼저 워크스페이스 전체 빌드 (core + transport-ky 필요)
pnpm -r build

# 예제 실행
pnpm --filter example-multi-vendor start
```

예상 출력:

```
=== demo: happy path (3 vendors) ===

github.getRepo       → ⭐ 13742  sindresorhus/ky
hn.getItem(42173930) → Some trending story
placeholder.getTodo(1) →   delectus aut autem

=== demo: error normalisation (same shape across vendors) ===

github 404:
  kind=http  code="Not Found"  status=404
  isClientError=true  retryable=false
jsonplaceholder 404:
  kind=http  code=HTTP_404  status=404
  isClientError=true

=== demo: transport swap (fetch → ky, one line) ===

via ky transport: ⭐ 13742  sindresorhus/ky

✓ multi-vendor demo complete
```

## 핵심 코드 위치

- [`src/adapters.ts`](./src/adapters.ts) — 세 벤더 어댑터 정의
- [`src/index.ts`](./src/index.ts) — 합성 + 데모 실행
