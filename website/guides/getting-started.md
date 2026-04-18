# Getting started

> 현재 v0 (pre-alpha). API가 깨질 수 있습니다.

## 설치

```bash
pnpm add @zerovoids/http
```

선택: 어댑터/트랜스포트

```bash
pnpm add @zerovoids/http-react-query @tanstack/react-query
pnpm add @zerovoids/http-transport-ky ky
```

## 최소 예제 (스키마 없이, 타입만)

```ts
import {
  createClient,
  defineAdapter,
  defineEndpoint,
  typedOutput,
} from "@zerovoids/http";

const github = defineAdapter({
  baseURL: "https://api.github.com",
  // errorMap 생략 → 기본(HTTP_<status>, 5xx·429·408 retryable) 적용
  endpoints: {
    getRepo: defineEndpoint({
      method: "GET",
      path: "/repos/:owner/:repo",
      output: typedOutput<{ id: number; full_name: string; stargazers_count: number }>(),
    }),
  },
});

export const api = createClient({ adapters: { github } });
```

## 호출

```ts
const { data, error } = await api.github.getRepo({
  params: { owner: "octocat", repo: "hello-world" },
  // ^ :owner, :repo 가 타입으로 자동 요구됩니다
});

if (error) {
  console.error(error.kind, error.code, error.httpStatus);
} else {
  console.log(data.full_name, data.stargazers_count);
}
```

## zod로 런타임 검증까지 (선택)

외부 API 응답을 신뢰할 수 없으면 zod로 바꿔치기하면 됩니다.

```ts
import { z } from "zod";

getRepo: defineEndpoint({
  method: "GET",
  path: "/repos/:owner/:repo",
  output: z.object({
    id: z.number(),
    full_name: z.string(),
    stargazers_count: z.number(),
  }),
}),
```

응답이 스키마와 맞지 않으면 `error.kind === "validation"` 로 도착합니다.

## 에러 처리 숏컷

```ts
import { isAuth, isRateLimited, isRetryable, isServerError } from "@zerovoids/http";

const { data, error } = await api.github.getRepo({ params });
if (isAuth(error)) redirectToLogin();
else if (isRateLimited(error)) setTimeout(retry, error?.retryAfterMs ?? 1000);
else if (isRetryable(error)) enqueueRetry();
else if (isServerError(error)) showBanner("서버 문제");
```

## throw 스타일 호출

Result 패턴 대신 try/catch를 원하면 `unwrap()` 헬퍼로 감싸세요.

```ts
import { unwrap } from "@zerovoids/http";

try {
  const repo = await unwrap(api.github.getRepo({ params: { owner, repo } }));
  console.log(repo.full_name);
} catch (e) {
  // e는 NormalizedError (instanceof 가능)
}
```

## per-call 옵션

```ts
const controller = new AbortController();

const result = await api.github.getRepo(
  { params: { owner, repo } },
  { signal: controller.signal, timeout: 5000, headers: { "x-trace": "42" } },
);
```

## 다음 단계

- [Vendor adapters 합성](./vendor-adapters.md) — 여러 외부 API 하나의 클라이언트로
- [Error handling](./error-handling.md) — `NormalizedError` 브랜칭 · UI 패턴
- [Auth recipes](./auth-recipes.md) — `bearerWithRefresh` · xsrf · PKCE
- [Testing](./testing.md) — `@zerovoids/http-mock` 로 파이프라인 테스트
- [Observability](./observability.md) — Sentry / OpenTelemetry 통합
- [NormalizedError 레퍼런스](../reference/normalized-error.md)
- [Architecture 개요](../architecture.md)
- [Philosophy · 다루지 않는 영역](../philosophy.md)
