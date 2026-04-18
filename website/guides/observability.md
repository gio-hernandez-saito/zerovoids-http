# Observability & Error Reporting

`@zerovoids/http` 는 관측성 도구(Sentry, OpenTelemetry, GA 등) 통합을 **core 에 내장하지 않습니다**. 대신 `NormalizedError` 계약과 `definePlugin` 훅이 이들 도구와 자연스럽게 맞물리도록 설계되어 있습니다. 이 문서는 권장 통합 패턴을 정리합니다.

---

## 왜 내장하지 않는가

- **4대 철학 1번**: core 는 peer dependency 가 없어야 합니다. Sentry/OTel SDK 를 core 에 번들링할 수 없습니다.
- **SDK 교체 비용**: Sentry SDK 의 메이저 버전 (v7 → v8) 같은 breaking change 가 core 를 흔들어서는 안 됩니다.
- **앱 정책 다양성**: 어떤 에러를 올릴지, 어떻게 그룹핑할지는 팀마다 다릅니다.

대신 `NormalizedError` 가 다음 특성을 갖도록 설계되어 있어 통합이 쉽습니다.

| 설계 결정 | 혜택 |
|---|---|
| `class extends Error` + prototype 유지 | `Sentry.captureException` 에 그대로 전달, ErrorBoundary catch |
| `code` — 안정적 기계 키 | Sentry fingerprint, GA event_name, i18n 키로 공용 |
| `kind × httpStatus × trace` 직교 축 | 관측 도구의 태그/차원 매핑 단순 |
| `toJSON()` 명시 구현 | SSR hydration, 구조화 로깅, breadcrumb 친화 |
| `Error.cause` 체인 | 원본 벤더 에러가 Sentry / Node stack trace 에 함께 표시 |
| `definePlugin.onError` + 훅 격리 | 관측 로직 실패가 요청 실패로 전파되지 않음 |

---

## Sentry 통합 레시피

가장 일반적인 통합 대상. 패키지로 제공하지는 않지만 20~30 줄로 안전한 통합이 가능합니다. (향후 `@zerovoids/http-sentry` 로 승격 검토.)

### 권장 플러그인

```ts
import * as Sentry from "@sentry/browser";
import { definePlugin, isNormalizedError } from "@zerovoids/http";

export type SentryPluginOptions = {
  /** 상수 태그 — 모든 이벤트에 공통 부착 */
  tags?: Record<string, string>;
  /** 4xx 클라이언트 에러도 올릴지. 기본 false (소음 방지) */
  captureClientErrors?: boolean;
  /** 요청별 breadcrumb 자동 기록. 기본 true */
  breadcrumbs?: boolean;
};

export function sentryPlugin(options: SentryPluginOptions = {}) {
  const { tags = {}, captureClientErrors = false, breadcrumbs = true } = options;

  return definePlugin({
    id: "sentry",
    hooks: {
      onRequest: breadcrumbs
        ? ({ request, attempt }) => {
            Sentry.addBreadcrumb({
              category: "http.zerovoids",
              message: `${request.method} ${request.url}`,
              data: { attempt },
              level: "info",
            });
          }
        : undefined,

      onError: ({ error }) => {
        if (!isNormalizedError(error)) return;

        const status = error.httpStatus ?? 0;
        if (!captureClientErrors && status >= 400 && status < 500) return;

        Sentry.captureException(error, {
          // kind + code 로 그룹핑 — 기본 stack-trace 그룹핑이 HTTP 에러를
          // 전부 한 그룹으로 뭉치는 함정을 피합니다.
          fingerprint: [error.kind, error.code],
          tags: {
            ...tags,
            "http.kind": error.kind,
            "http.code": error.code,
            "http.status": String(error.httpStatus ?? ""),
            "http.method": error.trace.method,
          },
          contexts: {
            api: {
              requestId: error.trace.requestId,
              url: error.trace.url,
              attempt: error.trace.attempt,
              retryable: error.retryable,
              retryAfterMs: error.retryAfterMs,
            },
          },
        });
      },
    },
  });
}
```

### 사용

```ts
const api = createClient({
  adapters: { github, stripe, internal },
  plugins: [
    sentryPlugin({
      tags: { service: "web", release: process.env.RELEASE! },
    }),
  ],
});
```

### `cause` 직렬화 주의

`NormalizedError.cause` 는 원본 벤더 에러를 **있는 그대로** 보존합니다. 대개는 Sentry SDK 가 잘 처리하지만, 다음 상황에서는 `beforeSend` 로 정제하는 편이 안전합니다.

- `cause` 가 `Response` 객체 — 내부 `ReadableStream` 은 직렬화 불가
- `cause` 가 `AxiosError` — `config.transport`, `config.httpAgent` 등 거대 객체 포함
- `cause` 가 Node TLS / socket 에러 — 순환 참조 가능

```ts
Sentry.init({
  beforeSend(event, hint) {
    const e = hint.originalException;
    if (isNormalizedError(e) && e.cause) {
      (e as { cause: unknown }).cause = String(e.cause).slice(0, 500);
    }
    return event;
  },
});
```

참고: 라이브러리가 제공하는 `NormalizedError.toJSON()` 은 이미 `cause` 를 **제외** 하므로 구조화 로깅/SSR hydration 경로는 자동으로 안전합니다. 위 주의는 Sentry 가 Error 객체를 내부 직렬화하는 별도 경로에 해당합니다.

---

## Google Analytics (GA4) 레시피

로직이 단순해 패키지화할 가치가 낮습니다. 짧은 훅으로 충분합니다.

```ts
import { definePlugin, isNormalizedError } from "@zerovoids/http";

declare const gtag: (command: string, action: string, params: Record<string, unknown>) => void;

export const ga4ErrorPlugin = definePlugin({
  id: "ga4-error",
  hooks: {
    onError: ({ error }) => {
      if (!isNormalizedError(error)) return;
      gtag("event", "api_error", {
        error_kind: error.kind,
        error_code: error.code,
        http_status: error.httpStatus,
        endpoint: error.trace.url,
      });
    },
  },
});
```

GA4 커스텀 파라미터 제약 (이름 40자, 이벤트당 25개) 을 고려해 꼭 필요한 차원만 올리는 것을 권장합니다.

---

## OpenTelemetry

OTel 은 표준 프로토콜이고 다양한 백엔드(Jaeger, Tempo, Honeycomb) 가 같은 데이터를 소비할 수 있어 **공식 패키지로 제공될 예정** 입니다.

- **패키지**: `@zerovoids/http-otel` (v1.1 예정, `docs/plan.md` §4 / §10.3 참고)
- **peer**: `@opentelemetry/api`
- **동작**: `onRequest` → span 시작, `onResponse` / `onError` → span 종료 + status 기록, `trace.requestId` 를 span attribute 로 유지

그 전까지는 직접 span 을 만드는 얇은 플러그인으로 대체 가능합니다.

```ts
import { trace, SpanStatusCode } from "@opentelemetry/api";
import { definePlugin, isNormalizedError } from "@zerovoids/http";

const tracer = trace.getTracer("@zerovoids/http");

export const otelPlugin = definePlugin({
  id: "otel",
  hooks: {
    onRequest: ({ request, attempt }) => {
      // 컨텍스트 저장은 요청별 WeakMap 필요 — 공식 패키지에서 제공 예정
      tracer.startSpan(`HTTP ${request.method}`, {
        attributes: {
          "http.method": request.method,
          "http.url": request.url,
          "http.attempt": attempt,
        },
      });
    },
    onError: ({ error }) => {
      if (!isNormalizedError(error)) return;
      const span = trace.getActiveSpan();
      span?.setStatus({ code: SpanStatusCode.ERROR, message: error.code });
      span?.setAttribute("error.kind", error.kind);
      span?.end();
    },
  },
});
```

---

## React ErrorBoundary 와의 상호작용

TanStack Query 기본 동작상 **`useQuery` 는 에러가 나도 throw 하지 않습니다**. ErrorBoundary 에 걸리게 하려면 명시적 선택이 필요합니다.

| 훅 | ErrorBoundary 잡힘 |
|---|---|
| `useQuery(...)` | ❌ (기본) |
| `useQuery(..., { throwOnError: true })` | ✅ |
| `useSuspenseQuery(...)` | ✅ (항상 throw) |
| `useSuspenseInfiniteQuery(...)` | ✅ (항상 throw) |

전역으로 켜고 싶다면:

```ts
const client = new QueryClient({
  defaultOptions: {
    queries: { throwOnError: true },
    mutations: { throwOnError: true },
  },
});
```

자세한 내용은 [`@zerovoids/http-react-query` README](../../packages/react-query/README.md) 참고.

---

## 사내 로거 / 커스텀 통합

회사마다 로깅 파이프라인이 다르므로 (Datadog, ELK, Splunk, 사내 수집기 등) 패키지화하지 않습니다. 동일한 패턴으로 10~20 줄 플러그인이면 충분합니다.

```ts
export const auditLogPlugin = definePlugin({
  id: "audit-log",
  hooks: {
    onError: async ({ error }) => {
      if (!isNormalizedError(error)) return;
      await fetch("/internal/log", {
        method: "POST",
        body: JSON.stringify(error.toJSON()),
      });
    },
  },
});
```

---

## 요약

| 도구 | 통합 방식 | 난이도 |
|---|---|---|
| Sentry | 레시피 (패키지화 검토 중) | 쉬움 |
| GA4 | 레시피 | 매우 쉬움 |
| OpenTelemetry | `@zerovoids/http-otel` (v1.1 예정) | 쉬움 |
| 사내 로거 | 레시피 | 매우 쉬움 |
| ErrorBoundary | `useSuspenseQuery` 또는 `throwOnError: true` | 명시 필요 |

핵심: **core 는 에러 계약 + 훅만 제공, 관측 정책은 앱이 선택**. 필요한 통합을 10줄 안에 작성할 수 있도록 `NormalizedError` shape 가 의도적으로 관측 친화적으로 설계됨.
