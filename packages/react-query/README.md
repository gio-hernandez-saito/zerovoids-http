<div align="center">

# @zerovoids/http-react-query

**TanStack Query v5 adapter — auto-generated hooks per endpoint**

[![npm](https://img.shields.io/npm/v/@zerovoids/http-react-query.svg)](https://www.npmjs.com/package/@zerovoids/http-react-query)
[![npm downloads](https://img.shields.io/npm/dm/@zerovoids/http-react-query.svg)](https://www.npmjs.com/package/@zerovoids/http-react-query)
[![license](https://img.shields.io/npm/l/@zerovoids/http-react-query.svg)](https://github.com/gio-hernandez-saito/zerovoids-http/blob/main/LICENSE)
[![types](https://img.shields.io/npm/types/@zerovoids/http-react-query.svg)](https://www.npmjs.com/package/@zerovoids/http-react-query)

[Install](#-install) · [Quick start](#-quick-start) · [API](#-api) · [ErrorBoundary 패턴](#️-errorboundary-패턴-중요) · [SSR](#-ssr--nextjs-app-router) · [메인 리포](../..)

</div>

---

## 소개

`@zerovoids/http` 클라이언트의 shape 을 그대로 미러링해 엔드포인트마다 TanStack Query 훅을 자동 생성합니다. `NormalizedError` 는 TanStack Query 의 `error` 타입으로 그대로 전파.

- ⚛️ 엔드포인트마다 `.useQuery` / `.useSuspenseQuery` / `.useInfiniteQuery` / `.useSuspenseInfiniteQuery` / `.useMutation` / `.queryKey` 자동 부착
- 🔑 `queryKeyFor(adapter, endpoint, input)` — deterministic canonicalize (object key 정렬)
- ♻️ `invalidate(qc, key)` — adapter / endpoint / 전체 범위 지원
- 🎯 `optimistic(qc, queryKey, updater)` — snapshot / rollback / invalidate
- 🧪 renderHook 통합 테스트 (jsdom) 포함

## 📦 Install

```bash
pnpm add @zerovoids/http-react-query @zerovoids/http @tanstack/react-query react
```

## 🚀 Quick start

```ts
import {
  createClient,
  defineAdapter,
  defineEndpoint,
  typedOutput,
} from "@zerovoids/http";
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
  if (error) return <p>{error.kind}: {error.code}</p>;
  return <h1>{data.full_name}</h1>;
}
```

## 📚 API

각 엔드포인트마다 다음 프로퍼티가 자동 부착됩니다.

| 프로퍼티 | 역할 |
|---|---|
| `useQuery(input, options?)` | 기본 query hook. 에러는 `error` 필드로 반환 |
| `useSuspenseQuery(input, options?)` | Suspense 용 query hook. 에러 시 throw |
| `useInfiniteQuery(args, options?)` | `args.input(pageParam) => Input`, `getNextPageParam`, `initialPageParam` |
| `useSuspenseInfiniteQuery(args, options?)` | Suspense 버전 |
| `useMutation(options?)` | mutation hook. 에러 시 throw |
| `queryKey(input?)` | 해당 호출의 `[adapter, endpoint, canonicalInput]` |

### 유틸

- `queryKeyFor(adapter, endpoint, input?)` — 수동 key 생성 (prefetch / invalidate)
- `invalidate(queryClient, key)` — `[adapter]` / `[adapter, endpoint]` / `[adapter, endpoint, input]` 모두 지원
- `canonicalize(value)` — deterministic 객체 key 정렬 (swr 어댑터와 호환)
- `optimistic(qc, queryKey, updater)` — optimistic update + rollback 헬퍼
- `makeExecutor(fn)` — `Result` unwrap-throw 실행자 (커스텀 훅용)

## ⚠️ ErrorBoundary 패턴 (중요)

TanStack Query 기본 동작상 **`useQuery` 는 에러가 나도 throw 하지 않습니다**. ErrorBoundary 에 걸리게 하려면 명시적 선택이 필요.

| 훅 | 에러 처리 | ErrorBoundary 잡힘 |
|---|---|---|
| `useQuery(...)` | `{ data: null, error, isError: true }` | ❌ |
| `useQuery(..., { throwOnError: true })` | throw | ✅ |
| `useSuspenseQuery(...)` | 항상 throw | ✅ |
| `useSuspenseInfiniteQuery(...)` | 항상 throw | ✅ |
| `useMutation(...)` | 기본 `error` 필드, `throwOnError: true` 옵션 지원 | 옵션 |

### 중앙 에러 UI 패턴 (권장)

```tsx
// app/providers.tsx
const client = new QueryClient({
  defaultOptions: {
    queries: { throwOnError: true },
    mutations: { throwOnError: true },
  },
});
```

```tsx
import { isNormalizedError, exhaustiveGuard } from "@zerovoids/http";

<ErrorBoundary fallback={({ error }) =>
  isNormalizedError(error)
    ? <ApiErrorUI kind={error.kind} code={error.code} />
    : <GenericError />
}>
  <YourTree />
</ErrorBoundary>
```

## 🎯 Mutation invalidation

```tsx
import { invalidate } from "@zerovoids/http-react-query";

const create = hooks.github.createIssue.useMutation({
  onSuccess: () => invalidate(queryClient, ["github", "listIssues"]),
});
```

## 🎬 Optimistic update

```tsx
import { optimistic } from "@zerovoids/http-react-query";

const toggle = hooks.github.toggleStar.useMutation({
  onMutate: (input) =>
    optimistic(queryClient, ["github", "getRepo", input], (prev) =>
      prev ? { ...prev, starred: !prev.starred } : prev,
    ),
});
```

자동으로 snapshot → optimistic → (에러 시) rollback → (성공 시) invalidate 흐름.

## 🌐 SSR / Next.js App Router

`queryKeyFor` 를 서버/클라이언트가 공유하면 `HydrationBoundary` 로 프리페치 결과를 무손실 전달할 수 있습니다.

```tsx
// app/page.tsx (RSC)
import { queryKeyFor } from "@zerovoids/http-react-query";

const qc = new QueryClient();
await qc.prefetchQuery({
  queryKey: queryKeyFor("github", "getRepo", { params: { owner, repo } }),
  queryFn: () => unwrap(api.github.getRepo({ params: { owner, repo } })),
});
```

[`examples/nextjs-react-query`](../../examples/nextjs-react-query) 참고.

## 🔗 관련 링크

- [메인 README](../..) — 전체 생태계 소개
- [Getting started](../../website/guides/getting-started.md)
- [examples/nextjs-react-query](../../examples/nextjs-react-query)

## License

MIT © [zerovoids](https://github.com/gio-hernandez-saito)
