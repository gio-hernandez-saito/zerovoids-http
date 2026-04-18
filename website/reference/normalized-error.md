# NormalizedError

라이브러리의 **모든** 에러 반환은 이 shape 을 만족합니다. 벤더/transport/validator 어떤 조합이어도.

## Type

```ts
type NormalizedError = {
  kind: "network" | "timeout" | "http" | "validation" | "domain" | "canceled";
  code: string;
  httpStatus?: number;
  retryable: boolean;
  retryAfterMs?: number;
  cause: unknown;
  trace: {
    requestId: string;
    url: string;
    method: string;
    attempt: number;
  };
};
```

## kind 별 의미

| kind | 발생 시점 | 예시 |
|---|---|---|
| `network` | 연결 실패, DNS, CORS | fetch rejects |
| `timeout` | `timeout` 옵션 초과 | AbortSignal.timeout |
| `http` | 4xx / 5xx 응답 | 401, 500 |
| `validation` | Schema validate 실패 | zod parse error |
| `domain` | Adapter가 정의한 도메인 규칙 | `CARD_DECLINED` |
| `canceled` | 소비자가 abort | `controller.abort()` |

## Type guards

```ts
import { isNormalizedError, isKind, exhaustiveGuard } from "@zerovoids/http";

if (isNormalizedError(error)) {
  if (isKind(error, "http")) error.httpStatus;    // narrowed
  if (isKind(error, "validation")) error.cause;
}

// 모든 kind 처리 여부를 컴파일 타임에 강제
function render(e: NormalizedError) {
  switch (e.kind) {
    case "network": return <NetworkError />;
    case "timeout": return <TimeoutError />;
    case "http": return <HttpError status={e.httpStatus} />;
    case "validation": return <ValidationError />;
    case "domain": return <DomainError code={e.code} />;
    case "canceled": return null;
    default: return exhaustiveGuard(e);  // 새 kind 추가 시 컴파일 에러
  }
}
```

## Adapter errorMap 작성

각 벤더 어댑터는 **반드시** errorMap을 제공해야 합니다.

```ts
const stripe = defineAdapter({
  // ...
  errorMap: (raw, ctx) => {
    // raw: 벤더 원본 응답 (JSON parsed)
    // ctx: { httpStatus, headers, requestId, url, method, attempt }

    if (ctx.httpStatus === 429) {
      return {
        kind: "http",
        code: "RATE_LIMITED",
        httpStatus: 429,
        retryable: true,
        retryAfterMs: Number(ctx.headers.get("retry-after") ?? 0) * 1000,
        cause: raw,
      };
    }

    if (raw?.error?.type === "card_error") {
      return {
        kind: "domain",
        code: raw.error.code,  // 'card_declined' 등
        httpStatus: ctx.httpStatus,
        retryable: false,
        cause: raw,
      };
    }

    return {
      kind: "http",
      code: raw?.error?.code ?? "UNKNOWN",
      httpStatus: ctx.httpStatus,
      retryable: ctx.httpStatus >= 500,
      cause: raw,
    };
  },
});
```

## Retry-After 자동 준수

`retryAfterMs`를 반환하면 라이브러리가 retry backoff를 **그 값으로 덮어씁니다**. 429/503 대응 자동화.

## `cause` 보존 원칙

원본 벤더 에러 객체는 `cause`에 **변형 없이** 보관됩니다. 디버깅 / 특수 케이스 접근이 필요할 때만 내려가세요. 일반 코드에서 `cause`를 branch하기 시작하면 정규화의 이점이 사라집니다.
