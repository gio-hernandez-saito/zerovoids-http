# Example: Node CLI (no framework)

`@zerovoids/http` + `@zerovoids/http-transport-ky` on pure Node. 프레임워크 없이 CLI 스크립트에서 `NormalizedError` 브랜칭과 ky transport 교체를 보여줍니다.

## Run

```bash
pnpm install
pnpm --filter example-node-cli build
pnpm --filter example-node-cli start                     # vercel/next.js (기본)
pnpm --filter example-node-cli start facebook react      # 인자 전달
```

## 무엇을 보여주나

- `defineAdapter` + `defineEndpoint` 로 GitHub API 타입 안전 호출
- `kyTransport()` 로 기본 `fetch` 를 ky 로 교체 (한 줄)
- `isRateLimited` / `isServerError` / `isRetryable` 헬퍼 분기
- 에러는 반드시 `NormalizedError` — `error.toJSON()` 으로 구조화 로깅

## 예상 출력

```
vercel/next.js: ⭐ 127,043
The React Framework
```

rate-limit / 5xx 시:

```
rate-limited — retry after 60000ms
```
