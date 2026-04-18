# @zerovoids/http-react-query

TanStack Query v5 adapter for [@zerovoids/http](../core).

클라이언트의 shape 을 그대로 미러링해 엔드포인트마다 hook 을 자동 생성합니다. `NormalizedError` 는 TanStack Query 의 `error` 타입으로 그대로 전파됩니다.

## Install

```bash
pnpm add @zerovoids/http-react-query @zerovoids/http @tanstack/react-query react
```

## Quick start

```ts
import { createClient, defineAdapter, defineEndpoint, typedOutput } from "@zerovoids/http";
import { createQueryHooks } from "@zerovoids/http-react-query";

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

export const api = createClient({ adapters: { github } });
export const hooks = createQueryHooks(api);
```

```tsx
function RepoView({ owner, repo }: { owner: string; repo: string }) {
  const { data, error, isLoading } = hooks.github.getRepo.useQuery({
    params: { owner, repo },
  });
  if (isLoading) return <p>Loading…</p>;
  if (error) return <p>{error.message}</p>;
  return <h1>{data.full_name}</h1>;
}
```

## API

각 엔드포인트마다 다음 프로퍼티가 자동 부착됩니다.

| 프로퍼티 | 역할 |
|---|---|
| `useQuery(input, options?)` | 기본 query hook. 에러는 `error` 필드로 반환 |
| `useSuspenseQuery(input, options?)` | Suspense 용 query hook. 에러 시 throw |
| `useInfiniteQuery(args, options?)` | `args.input(pageParam) => Input`, `getNextPageParam`, `initialPageParam` 소비자 제어 |
| `useSuspenseInfiniteQuery(args, options?)` | Suspense 버전 |
| `useMutation(options?)` | mutation hook. 에러 시 throw |
| `queryKey(input?)` | 해당 호출에 대응하는 `[adapter, endpoint, canonicalInput]` |

그 외 유틸:

- `queryKeyFor(adapter, endpoint, input?)` — 수동으로 key 생성 (prefetch, invalidate)
- `invalidate(queryClient, key)` — `[adapter]`, `[adapter, endpoint]`, `[adapter, endpoint, input]` 세 shape 지원
- `canonicalize(value)` — deterministic 객체 key 정렬 (내부용이지만 export 됨)
- `makeExecutor(fn)` — `Result` 를 unwrap 해 throw 로 변환하는 실행자 (테스트/커스텀 훅용)

## ErrorBoundary 로 에러를 catch 하려면 (중요)

TanStack Query 기본 동작상 **`useQuery` 는 에러가 나도 throw 하지 않습니다**. ErrorBoundary 에 걸리게 하려면 명시적 선택이 필요합니다.

| 훅 | 에러 처리 | ErrorBoundary 잡힘 |
|---|---|---|
| `useQuery(...)` | `{ data: null, error, isError: true }` 반환 | ❌ |
| `useQuery(..., { throwOnError: true })` | throw | ✅ |
| `useSuspenseQuery(...)` | 항상 throw | ✅ |
| `useSuspenseInfiniteQuery(...)` | 항상 throw | ✅ |
| `useMutation(...)` (mutate 호출 시) | 기본적으로 `error` 필드, `throwOnError: true` 옵션 지원 | 옵션 |

### 중앙 에러 UI 패턴 (권장)

```tsx
// app/providers.tsx
const client = new QueryClient({
  defaultOptions: {
    queries: { throwOnError: true },   // 전역 on
    mutations: { throwOnError: true },
  },
});
```

```tsx
<ErrorBoundary fallback={({ error }) =>
  isNormalizedError(error)
    ? <ApiErrorUI kind={error.kind} code={error.code} />
    : <GenericError />
}>
  <YourTree />
</ErrorBoundary>
```

- `NormalizedError extends Error` 이므로 `ErrorBoundary` 가 그대로 catch
- `isNormalizedError` 는 SSR → hydrate 경유한 경우도 구조적 검사로 안전
- `error.kind` switch 로 세부 분기 (`exhaustiveGuard` 로 누락 방지)

### 인라인 에러 UI 패턴

에러를 화면별로 세밀하게 다루고 싶다면 `useQuery` 기본 동작 그대로 씁니다.

```tsx
const { data, error } = hooks.github.getRepo.useQuery({ params });
if (error && isRateLimited(error)) return <RateLimitBanner />;
if (error) return <ErrorCard error={error} />;
```

## Mutation invalidation

```tsx
const create = hooks.github.createIssue.useMutation({
  onSuccess: () => invalidate(queryClient, ["github", "listIssues"]),
});
```

## SSR / Next.js App Router

`queryKeyFor` 를 서버/클라이언트가 공유하면 `HydrationBoundary` 로 프리페치 결과를 무손실 전달할 수 있습니다. [`examples/nextjs-react-query`](../../examples/nextjs-react-query) 참고.

## License

MIT
