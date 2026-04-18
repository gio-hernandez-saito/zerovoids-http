# Architecture

## 3-Layer Architecture

```
┌─────────────────────────────────────────────┐
│ [5] UI / Hook                               │ useUser(id), useCharges()
├─────────────────────────────────────────────┤
│ [4] State Adapter (optional)                │ @zerovoids/http-react-query
│     TanStack Query / SWR / Solid Query      │ @zerovoids/http-swr
├─────────────────────────────────────────────┤
│ [3] Client Surface (합성된 엔드포인트)       │ api.stripe.charges.create()
│     createClient({ adapters: {...} })       │ api.github.repos.get()
├─────────────────────────────────────────────┤
│ [2] Vendor Adapter (정규화 경계) ★           │ defineAdapter({
│     errorMap / auth / pagination / schema   │   errorMap, auth, endpoints })
├─────────────────────────────────────────────┤
│ [1] Transport (교체 가능)                    │ fetch (default)
│     fetch / ky / axios / mock               │ @zerovoids/http-transport-ky
└─────────────────────────────────────────────┘
```

**★ 우리의 차별점은 Layer 2 (Vendor Adapter)** — 기존 라이브러리들이 얇거나 없음.

## Request 파이프라인

```
client.stripe.charges.create({ amount })
  │
  ├─ [plugin.init] URL/options 재작성
  ├─ [schema.validate-input] 요청 body/params/query/headers
  ├─ [adapter.auth.before] 인증 헤더 첨부 (single-flight refresh 등)
  ├─ [plugin.onRequest] 로깅, trace id 주입
  │
  ├─ [transport] HTTP 실행 (fetch/ky/axios)
  │
  ├─ [retry loop] Retry-After / shouldRetry / exponential
  ├─ [plugin.onResponse] 메트릭, 훅
  ├─ [schema.validate-output] 응답 스키마
  ├─ [adapter.errorMap] 벤더 에러 → NormalizedError
  │
  └─ { data, error }  // 또는 throw (throw: true 모드)
```

## Vendor Adapter 합성

```ts
const stripe  = defineAdapter({ baseURL, errorMap: mapStripe,  endpoints: stripeEps });
const github  = defineAdapter({ baseURL, errorMap: mapGithub,  endpoints: githubEps });
const myApi   = defineAdapter({ baseURL, errorMap: mapOurs,    endpoints: oursEps });

const api = createClient({
  adapters: { stripe, github, myApi },
  transport: kyTransport(),        // 선택
  plugins: [telemetry(), idempotency()],
});

// 호출부는 어떤 벤더든 동일 DX
api.stripe.charges.create({ amount: 500 });
api.github.repos.get({ owner, repo });
api.myApi.users.list();

// 에러 shape은 모두 NormalizedError
const { data, error } = await api.stripe.charges.create({ amount: 500 });
if (error) {
  error.kind;        // 'http' | 'network' | ...
  error.code;        // 'card_declined' (stripe errorMap이 정규화)
  error.retryable;
}
```

## Plugin 모양

```ts
type Plugin = {
  id: string;
  name?: string;
  init?(url: string, options: RequestOptions): Promise<{ url; options }>;
  hooks?: {
    onRequest?(ctx): Promise<Context>;
    onResponse?(ctx): Promise<Context>;
    onError?(ctx): Promise<void>;
    onSuccess?(ctx): Promise<Context>;
  };
  getOptions?(): StandardSchema;  // 런타임 옵션 타입 확장
};
```

## Transport 인터페이스

```ts
type Transport = (req: TransportRequest) => Promise<TransportResponse>;

type TransportRequest = {
  url: string;
  method: string;
  headers: Headers;
  body?: BodyInit | null;
  signal?: AbortSignal;
  // transport 구현체가 이해하는 확장 필드
  extra?: Record<string, unknown>;
};

type TransportResponse = {
  status: number;
  headers: Headers;
  body: ArrayBuffer | ReadableStream | string | null;
};
```

기본 구현: `fetch()`. 교체: `@zerovoids/http-transport-ky`, `@zerovoids/http-transport-axios`, `@zerovoids/http-mock`.

## 왜 Monorepo인가

- `@zerovoids/http-react-query` 의 `peerDependencies` 는 core 에 영향 주면 안 됨 → **패키지 분리 필수**
- Transport 별 peer 도 같은 이유
- Core + Adapter 원자적 변경이 잦음 → changesets `fixed` 그룹으로 동기화
- 빌드 캐시 (Turborepo) 로 피드백 루프 짧게 유지
