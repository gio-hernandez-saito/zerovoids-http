<div align="center">

# @zerovoids/http

**여러 API를 하나처럼 쓰게 해주는 타입 안전 HTTP 클라이언트**

[![CI](https://github.com/gio-hernandez-saito/zerovoids-http/actions/workflows/ci.yml/badge.svg)](https://github.com/gio-hernandez-saito/zerovoids-http/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/gio-hernandez-saito/zerovoids-http/branch/main/graph/badge.svg)](https://codecov.io/gh/gio-hernandez-saito/zerovoids-http)
[![npm](https://img.shields.io/npm/v/@zerovoids/http.svg)](https://www.npmjs.com/package/@zerovoids/http)
[![license](https://img.shields.io/npm/l/@zerovoids/http.svg)](./LICENSE)

[소개](#소개) · [빠른 시작](#빠른-시작) · [패키지](#패키지) · [특징](#특징) · [문서](./website)

</div>

---

## 소개

여러 외부 API(결제, 소셜, 내부 서비스 등)를 함께 사용하다 보면 응답 형식도, 에러 규격도 제각각입니다.
`@zerovoids/http`는 이런 API들을 **하나의 도메인 모델**처럼 쓸 수 있게 해주는 타입 안전 클라이언트입니다.

- ✨ 벤더별 에러를 **일관된 `NormalizedError`** 하나로 정규화
- 🔌 `fetch` / `ky` / `axios` 중 원하는 Transport 선택
- 📐 `zod` / `valibot` / `arktype` — Standard Schema라면 무엇이든 사용
- 🧩 TanStack Query, SWR 등과 자연스럽게 연결
- 🪶 코어는 외부 의존성 0개, 번들 5KB 이하

## 언제 쓰면 좋은지 / 쓰지 말아야 할지

이 라이브러리는 **여러 외부 API를 섞어 쓸 때** 가치를 발휘합니다. 단순한 경우엔 더 간단한 대안이 있어요.

| 상황 | 권장 |
|---|---|
| API 하나만 호출 | [`ky`](https://github.com/sindresorhus/ky), [`axios`](https://axios-http.com/), 혹은 네이티브 `fetch` |
| OpenAPI 스펙 보유 | [Orval](https://orval.dev), [openapi-fetch](https://openapi-ts.dev/openapi-fetch/) |
| 백엔드 완전 소유 + 전 레이어 TypeScript | [ts-rest](https://ts-rest.com), [tRPC](https://trpc.io) |
| **여러 외부 벤더 혼용 + 에러 규격 제각각** | **`@zerovoids/http`** |
| **벤더 에러를 도메인 에러로 일관되게 변환해야** | **`@zerovoids/http`** |
| Transport (fetch/ky/axios) 선택 교체가 필요 | **`@zerovoids/http`** |

## 빠른 시작

```bash
pnpm add @zerovoids/http
```

```ts
import { createClient, defineAdapter, defineEndpoint } from "@zerovoids/http";
import { z } from "zod";

// 1. 어댑터 정의 — 베이스 URL과 에러 매핑을 한 곳에
const github = defineAdapter({
  baseURL: "https://api.github.com",

  errorMap: (raw, ctx) => ({
    kind: "http",
    code: typeof raw?.message === "string" ? raw.message : "UNKNOWN",
    httpStatus: ctx.httpStatus,
    retryable: ctx.httpStatus >= 500 || ctx.httpStatus === 429,
    cause: raw,
    trace: ctx.trace,
  }),

  endpoints: {
    getRepo: defineEndpoint({
      method: "GET",
      path: "/repos/:owner/:repo",
      output: z.object({
        id: z.number(),
        full_name: z.string(),
        stargazers_count: z.number(),
      }),
    }),
  },
});

// 2. 클라이언트 생성 — 여러 어댑터를 한 번에 합성
const api = createClient({ adapters: { github } });

// 3. 호출 — 항상 { data, error } 형태로 반환
const { data, error } = await api.github.getRepo({
  params: { owner: "octocat", repo: "hello-world" },
});

if (error) {
  // 어떤 벤더/Transport에서 와도 error 형태는 동일합니다
  console.error(error.kind, error.code, error.httpStatus);
} else {
  console.log(`⭐ ${data.full_name}: ${data.stargazers_count}`);
}
```

더 자세한 예제는 [Getting started 가이드](./website/guides/getting-started.md)를 참고하세요.

## 패키지

모노레포로 관리되며, 필요한 어댑터만 선택적으로 설치할 수 있습니다.

| 패키지 | 설명 |
|---|---|
| [`@zerovoids/http`](./packages/core) | 코어. 클라이언트, 어댑터, 플러그인, 에러 정규화 |
| [`@zerovoids/http-react-query`](./packages/react-query) | TanStack Query 연결 |
| [`@zerovoids/http-swr`](./packages/swr) | SWR 연결 |
| [`@zerovoids/http-transport-ky`](./packages/transport-ky) | Transport를 `ky`로 교체 |
| [`@zerovoids/http-transport-axios`](./packages/transport-axios) | Transport를 `axios`로 교체 |
| [`@zerovoids/http-auth`](./packages/auth) | 인증 헬퍼 (Bearer + refresh, XSRF 등) |
| [`@zerovoids/http-mock`](./packages/mock) | 테스트용 Mock Transport |

## 특징

### 일관된 에러 처리

벤더별로 다른 에러 응답을 프로젝트 전체에서 **단일 형태**로 처리합니다.

```ts
type NormalizedError = {
  kind: "network" | "timeout" | "http" | "validation" | "domain" | "canceled";
  code: string;
  httpStatus?: number;
  retryable: boolean;
  retryAfterMs?: number;   // Retry-After 헤더 자동 파싱
  cause: unknown;           // 원본 에러는 보존
  trace: { requestId; url; method; attempt };
};
```

타입 가드(`isNormalizedError`, `isKind`, `exhaustiveGuard`)를 사용해 안전하게 분기하세요.
자세한 활용법은 [NormalizedError 레퍼런스](./website/reference/normalized-error.md)에서 확인할 수 있습니다.

Sentry · OpenTelemetry · GA 등 관측 도구와의 통합 패턴은 [Observability 가이드](./website/guides/observability.md)에 정리되어 있습니다 — 플러그인 훅 한 번으로 붙일 수 있도록 `NormalizedError` 가 설계되어 있습니다.

### Transport · Schema · State 자유 선택

환경(브라우저/Node/Edge)과 팀 선호에 따라 내부 구현을 자유롭게 교체할 수 있습니다.

```ts
import { createClient } from "@zerovoids/http";
import { kyTransport } from "@zerovoids/http-transport-ky";

const api = createClient({
  adapters: { github },
  transport: kyTransport(),   // 기본값은 fetch
});
```

### 여러 API를 하나로 합성

어댑터를 여러 개 등록하면 한 클라이언트에서 모두 호출할 수 있습니다.

```ts
const api = createClient({
  adapters: { stripe, github, internal },
});

await api.stripe.charges.create({ amount: 500 });
await api.github.repos.get({ owner, repo });
await api.internal.users.list();
```

어떤 어댑터에서 반환된 에러든 같은 `NormalizedError` 형태라, 에러 처리 로직을 한 번만 작성하면 됩니다.

### 최소한의 공개 API

익혀야 할 함수는 네 개뿐입니다.

```ts
createClient   // 클라이언트 생성
defineAdapter  // 어댑터 정의
defineEndpoint // 엔드포인트 정의
definePlugin   // 플러그인 정의
```

## 설치

```bash
# 기본 설치
pnpm add @zerovoids/http

# React Query 연동
pnpm add @zerovoids/http-react-query @tanstack/react-query

# Transport 교체
pnpm add @zerovoids/http-transport-ky ky

# 인증 헬퍼
pnpm add @zerovoids/http-auth
```

> **참고**: `0.x` 단계에서는 API가 깨질 수 있습니다. `1.0.0` 이후부터 Semantic Versioning 을 엄격히 준수합니다.

## 다루지 않는 영역

범위를 분명히 하기 위해 아래 영역은 의도적으로 다루지 않습니다. 이미 훌륭한 도구들이 있거나, 별도 패키지로 분리하는 편이 더 나은 경우입니다.

| 영역 | 권장 대안 |
|---|---|
| 서버 프레임워크 바인딩 (Express/Nest/Fastify) | 필요 시 타입 공유만 제공 예정 |
| 캐싱 · 쿼리 관리 | [TanStack Query](https://tanstack.com/query), [SWR](https://swr.vercel.app) |
| 오프라인 큐 · 백그라운드 동기화 | [RxDB](https://rxdb.info/), [Replicache](https://replicache.dev/) |
| WebSocket · 실시간 통신 | 별도 패키지로 검토 중 |
| OpenAPI 기반 코드 생성 | [Orval](https://orval.dev), [Kubb](https://kubb.dev), [openapi-typescript](https://openapi-ts.dev) |

## 프로젝트 구조

```
zerovoids-http/
├── packages/     # npm에 배포되는 7개 패키지
├── examples/     # 실전 예제
├── website/      # 공식 문서 (사용자용, 공개)
├── .changeset/   # 버전 · 체인지로그 관리
└── .github/      # CI · 릴리즈 · 이슈 템플릿
```

## 개발

```bash
pnpm install
pnpm build           # Turbo 캐시 기반 증분 빌드
pnpm test            # 전체 워크스페이스 테스트
pnpm test:coverage   # 커버리지 리포트
pnpm type-check      # 타입 체크
pnpm check           # Biome lint + format
pnpm changeset       # 변경 기록 작성
```

기여하고 싶으시다면 [Contributing 가이드](./CONTRIBUTING.md)를 먼저 읽어주세요.

## License

MIT © [zerovoids](https://github.com/zerovoids)
