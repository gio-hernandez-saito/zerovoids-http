# @zerovoids/http-swr

SWR adapter for [@zerovoids/http](../core).

클라이언트 shape 을 그대로 미러링해 엔드포인트마다 `.useSWR`/`.useSWRInfinite`/`.key` 훅을 자동 생성합니다. 캐시 키 알고리즘이 `@zerovoids/http-react-query` 와 호환되므로 한 프로젝트 안에서 RQ와 SWR을 혼용해도 동일 입력은 동일 키를 공유합니다.

## Install

```bash
pnpm add @zerovoids/http-swr @zerovoids/http swr
```

## Quick start

```ts
import { createClient, defineAdapter, defineEndpoint, typedOutput } from "@zerovoids/http";
import { createSwrHooks } from "@zerovoids/http-swr";

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
export const hooks = createSwrHooks(api);
```

```tsx
function RepoView({ owner, repo }: { owner: string; repo: string }) {
  const { data, error, isLoading } = hooks.github.getRepo.useSWR({
    params: { owner, repo },
  });
  if (isLoading) return <p>Loading…</p>;
  if (error) return <p>{error.kind}: {error.code}</p>;  // NormalizedError
  return <h1>{data.full_name}</h1>;
}
```

## API

| 프로퍼티 | 역할 |
|---|---|
| `useSWR(input, config?)` | 기본 훅. 에러는 `error` 슬롯으로 전달 (`NormalizedError`) |
| `useSWRInfinite(getInput, config?)` | `getInput(pageIndex, previousPageData) => Input \| null` 로 페이지 제어 |
| `key(input?)` | `[adapter, endpoint, canonicalInput]` — prefetch / mutate 용 |

유틸:

- `swrKeyFor(adapter, endpoint, input?)` — 수동 키 생성
- `canonicalize(value)` — 객체 key 결정적 정렬 (RQ 어댑터와 동일 알고리즘)
- `makeExecutor(fn)` — `Result` unwrap-throw 실행자

## RQ와 키 호환

`createQueryHooks` 와 동일한 `[adapter, endpoint, canonicalInput]` shape + 같은 `canonicalize` — 같은 호출은 두 라이브러리에서 같은 cache key를 산출합니다. 마이그레이션 / 혼용이 안전.

## License

MIT
