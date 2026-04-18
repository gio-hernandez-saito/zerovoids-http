# Example: Next.js + React Query

`@zerovoids/http` + `@zerovoids/http-react-query` 조합 데모 (App Router).

## 구성

- **서버 프리페치**: `app/page.tsx` — RSC 안에서 `QueryClient.prefetchQuery`로 GitHub API 호출. cache key는 `queryKeyFor("github", "getRepo", input)`.
- **클라이언트 하이드레이션**: `HydrationBoundary`로 프리페치 결과 전달 → `app/RepoCard.tsx`가 `hooks.github.getRepo.useQuery`로 구독. 같은 key이므로 서버 결과 즉시 재사용.
- **에러 모델 통일**: `errorMap`이 GitHub 에러 메시지를 `NormalizedError.code`에 매핑. UI는 `isNormalizedError` + `toJSON()`로 직렬화 가능한 shape 확인.

## 실행

```bash
pnpm install
pnpm --filter example-nextjs-react-query dev
# http://localhost:3000
```

빌드 스모크:

```bash
pnpm --filter example-nextjs-react-query build
```

## 강조점

| 항목 | 파일 |
|---|---|
| 어댑터 정의 + `errorMap` | `src/client.ts` |
| `createQueryHooks(client)` 결과 사용 | `src/client.ts` · `app/RepoCard.tsx` |
| 서버 프리페치 + 하이드레이션 | `app/page.tsx` |
| SSR-safe `QueryClient` 인스턴스화 | `app/providers.tsx` |

## 설명 포인트 (문서 후보)

- 서버/클라이언트가 **동일한 `queryKeyFor`** 를 공유해야 하이드레이션이 캐시 히트가 됨.
- `NormalizedError`는 `toJSON()`이 있어 RSC→client 직렬화 안전. 커스텀 class/프로토타입 경유 문제 없음.
- 향후 Phase 3에서 `bearerWithRefresh` 플러그인이 이 예제에 그대로 얹힘.
