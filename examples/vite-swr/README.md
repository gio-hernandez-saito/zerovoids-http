# Example: Vite + SWR

`@zerovoids/http` + `@zerovoids/http-swr` 로 구성한 Vite SPA. GitHub repo 조회 폼을 통해 SWR 훅 사용법과 `NormalizedError` 브랜칭을 보여줍니다.

## Run

```bash
pnpm install
pnpm --filter example-vite-swr dev        # http://localhost:5173
pnpm --filter example-vite-swr build
pnpm --filter example-vite-swr preview
```

## 무엇을 보여주나

- `createSwrHooks(api)` 로 엔드포인트 마다 `.useSWR` / `.useSWRInfinite` / `.key` 자동 생성
- 훅 자체는 `useSWR` 의 `{ data, error, isLoading }` 그대로 — 에러만 `NormalizedError`
- `isRateLimited(error)` 등 헬퍼로 UI 분기
- `@zerovoids/http-react-query` 와 **동일한 canonicalize 알고리즘** 이라 두 어댑터 혼용 시에도 key 충돌 없음
