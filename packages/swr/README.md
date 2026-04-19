<div align="center">

# @zerovoids/http-swr

**SWR adapter — auto-generated hooks, cache-key compatible with react-query**

[![npm](https://img.shields.io/npm/v/@zerovoids/http-swr.svg)](https://www.npmjs.com/package/@zerovoids/http-swr)
[![npm downloads](https://img.shields.io/npm/dm/@zerovoids/http-swr.svg)](https://www.npmjs.com/package/@zerovoids/http-swr)
[![license](https://img.shields.io/npm/l/@zerovoids/http-swr.svg)](https://github.com/gio-hernandez-saito/zerovoids-http/blob/main/LICENSE)
[![types](https://img.shields.io/npm/types/@zerovoids/http-swr.svg)](https://www.npmjs.com/package/@zerovoids/http-swr)

[Install](#-install) · [Quick start](#-quick-start) · [API](#-api) · [RQ 호환](#-react-query-와-키-호환) · [메인 리포](../..)

</div>

---

## 소개

`@zerovoids/http` 클라이언트 shape 을 그대로 미러링해 엔드포인트마다 SWR 훅을 자동 생성합니다. 캐시 키 알고리즘이 `@zerovoids/http-react-query` 와 호환되어, 한 프로젝트 안에서 RQ 와 SWR 을 혼용해도 동일 입력은 동일 키를 공유.

- 🔀 엔드포인트마다 `.useSWR` / `.useSWRInfinite` / `.key` 자동 부착
- 🧭 `canonicalize` + `swrKeyFor` — deterministic key (RQ 어댑터와 동일 알고리즘)
- 🎯 `NormalizedError` 가 SWR `error` 슬롯에 unwrap-throw 로 전파
- 🧪 renderHook 통합 테스트 (jsdom) 포함

## 📦 Install

```bash
pnpm add @zerovoids/http-swr @zerovoids/http swr
```

## 🚀 Quick start

```ts
import {
  createClient,
  defineAdapter,
  defineEndpoint,
  typedOutput,
} from "@zerovoids/http";
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

## 📚 API

| 프로퍼티 | 역할 |
|---|---|
| `useSWR(input, config?)` | 기본 훅. 에러는 `error` 슬롯 (`NormalizedError`) |
| `useSWRInfinite(getInput, config?)` | `getInput(pageIndex, previousPageData) => Input \| null` 로 페이지 제어 |
| `key(input?)` | `[adapter, endpoint, canonicalInput]` — prefetch / mutate 용 |

### 유틸

- `swrKeyFor(adapter, endpoint, input?)` — 수동 키 생성
- `canonicalize(value)` — 객체 key 결정적 정렬 (RQ 어댑터와 동일)
- `makeExecutor(fn)` — `Result` unwrap-throw 실행자

## 🔗 react-query 와 키 호환

`createQueryHooks` 와 **동일한** `[adapter, endpoint, canonicalInput]` shape + 같은 `canonicalize` — 같은 호출은 두 라이브러리에서 같은 cache key 를 산출합니다.

```ts
// 같은 key:
hooks.github.getRepo.key({ params: { owner: "vercel", repo: "next.js" } })
// ↔
queryKeyFor("github", "getRepo", { params: { owner: "vercel", repo: "next.js" } })
```

마이그레이션 / 혼용이 안전합니다.

## 🔗 관련 링크

- [메인 README](../..) — 전체 생태계 소개
- [examples/vite-swr](../../examples/vite-swr)
- [@zerovoids/http-react-query](../react-query) — 대응되는 TanStack Query 어댑터

## License

MIT © [zerovoids](https://github.com/gio-hernandez-saito)
