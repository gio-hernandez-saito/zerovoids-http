# Philosophy

## 한 문장

**Vendor-normalizing multi-adapter HTTP client with transport abstraction.**
외부 API 여러 개를 하나의 도메인 모델처럼 쓸 때 최적.

## 4대 원칙 (깨지면 라이브러리 정체성 소실)

### 1. Core는 영원히 zero peer dependency

`@zerovoids/http` 코어 패키지는 런타임 의존성 0개를 영구 유지합니다.
Standard Schema조차 타입-only import. 어떤 Node / 브라우저 / Worker / Edge 런타임에서도 즉시 실행.

### 2. NormalizedError 는 단 하나의 반환 에러 타입

Transport(fetch/ky/axios/mock), Adapter(Stripe/GitHub/Slack/내부), Validator(zod/valibot/arktype) 어느 조합을 써도,
소비자가 보는 에러 shape은 **항상** 동일합니다.

```ts
type NormalizedError = {
  kind: "network" | "timeout" | "http" | "validation" | "domain" | "canceled";
  code: string;
  httpStatus?: number;
  retryable: boolean;
  retryAfterMs?: number;
  cause: unknown;       // 원본 벤더 에러 보존
  trace: { requestId: string; url: string; method: string; attempt: number };
};
```

"벤더 에러 shape이 새서 소비자 코드에 `if (err.response?.data?.errors[0]?.code === ...)` 가 생기기 시작하면" 우리 라이브러리의 존재 이유가 사라집니다.

### 3. Transport / Schema / State 3축 모두 peerDependency

- **Transport** (ky/axios/undici 등): 어댑터 패키지로 분리
- **Schema** (zod/valibot/arktype): Standard Schema 인터페이스로 중립
- **State** (React Query/SWR/Solid Query): 어댑터 패키지로 분리

직접 번들 금지. 소비자가 이미 쓰는 버전을 재사용.

### 4. Public API 표면 최소화

공개 함수는 **4개**만:

- `createClient(config)`
- `defineAdapter(config)`
- `defineEndpoint(config)`
- `definePlugin(config)`

나머지는 타입/헬퍼. 이 규모를 넘지 않는 게 유지보수와 학습 곡선의 핵심.

## 안 하는 것 (Non-goals)

아래는 의도적으로 스코프 밖입니다. 해당 방향 PR은 받지 않습니다:

| Non-goal | 대안 |
|---|---|
| Server bindings (Express/Nest/Fastify) | 타입-only contract export만 제공 예정 |
| 자체 캐시/쿼리 레이어 | TanStack Query / SWR 어댑터 사용 |
| Offline queue / background sync | RxDB, Replicache 등 전용 도구 |
| WebSocket / 실시간 | 별도 패키지 후보 (`@zerovoids/ws` 미정) |
| OpenAPI 코드 생성 파이프라인 | Orval / Kubb / openapi-typescript |
| Effect system / request 체이닝 DSL | 소비자 조립 영역 |

## 판단 기준 — 기능 추가 전 자문

새 기능을 core에 넣기 전에:

1. **"NormalizedError 계약을 깨는가?"** 깨면 재설계 or major bump.
2. **"플러그인으로 외주화 가능한가?"** yes면 core 밖.
3. **"peerDependency를 새로 요구하는가?"** yes면 어댑터 패키지로 분리.
4. **"p99 5ms / core 5KB 예산을 깎는가?"** yes면 벤치마크 후 거절될 수 있음.

이 네 질문을 통과하지 못하면 기능은 추가되지 않습니다.
