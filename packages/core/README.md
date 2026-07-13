<div align="center">

# @zerovoids/http-core

**여러 API의 제각각인 에러를, 하나의 `NormalizedError`로.**

클라이언트를 갈아치우지 않고 — `fetch`·`ky`·`axios`·공식 SDK 위에 그대로 얹는 에러 정규화 레이어.

![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)
![types included](https://img.shields.io/badge/types-included-blue)
![module](https://img.shields.io/badge/module-ESM%20%2B%20CJS-f7df1e)
![license](https://img.shields.io/badge/license-MIT-green)

[왜](#왜) · [설치](#설치) · [사용](#지금-쓸-수-있는-것) · [표준 근거](#표준-근거) · [로드맵](#로드맵) · [설계 원칙](#설계-원칙)

</div>

---

> [!WARNING]
> **초기 단계(0.x)입니다.** 지금은 **에러 계약(`NormalizedError` + 타입 가드)** 을 제공합니다.
> 벤더 에러를 자동 변환하는 정규화 러너와 프리빌트 매퍼는 [로드맵](#로드맵)에 있습니다.
> API는 `1.0.0` 전까지 바뀔 수 있고, 아직 npm에 배포되지 않았습니다.

## 왜

여러 외부 API를 함께 쓰면, **성공 응답은 정규화하면서도 실패는 그냥 흘려보내는** 경우가 많습니다.
문제는 실패의 모양이 벤더마다 전부 다르다는 것입니다.

```jsonc
// Stripe
{ "error": { "type": "card_error", "code": "card_declined", "decline_code": "insufficient_funds" } }

// GitHub
{ "message": "Validation Failed", "errors": [{ "resource": "Issue", "field": "title", "code": "missing_field" }] }

// Slack — 에러인데 HTTP 200
{ "ok": false, "error": "invalid_auth" }

// RFC 9457을 따르는 API
{ "type": "https://ex.com/out-of-credit", "title": "Payment Required", "status": 403 }
```

여기에 `fetch`/`ky`/`axios`가 던지는 방식, `zod`/`valibot` 검증 에러까지 겹치면,
소비자 코드는 이런 분기로 뒤덮입니다:

```ts
if (err.response?.data?.errors?.[0]?.code === 'missing_field') { /* ... */ }
```

`@zerovoids/http-core`는 이 모든 실패를 **`kind`로 구분되는 하나의 타입**으로 접습니다.
어떤 벤더·트랜스포트·검증기에서 왔든, 소비자가 보는 에러의 모양은 항상 같습니다.

## 무엇을

이 라이브러리는 **HTTP 클라이언트가 아닙니다.** 쓰던 클라이언트를 그대로 두고,
그 위에 얇게 얹는 **정규화 레이어**입니다 — 고전적인 anti-corruption layer 패턴을,
안정적인 하나의 목표 타입으로 제품화한 것입니다.

```
raw 에러 (어떤 벤더/표준이든)  ──[ mapper ]──▶  NormalizedError
                                                ├─ kind      실패의 종류(라우팅 힌트)
                                                ├─ code      기계 판독 식별자(정체성)
                                                ├─ httpStatus / retryable / retryAfterMs
                                                ├─ problem   RFC 9457 body 원형 보존
                                                └─ cause     원본 에러 그대로 보존
```

## 언제 쓰나

| 상황 | 권장 |
|---|---|
| API 하나만, 에러 규격도 단순 | 네이티브 `fetch`, [`ky`](https://github.com/sindresorhus/ky), [`axios`](https://axios-http.com) |
| OpenAPI 스펙 보유 | [openapi-fetch](https://openapi-ts.dev/openapi-fetch/), [Orval](https://orval.dev), [Kubb](https://kubb.dev) |
| 전 레이어를 내가 소유 + full-stack TS | [tRPC](https://trpc.io), [oRPC](https://orpc.unnoq.com) |
| **여러 외부 벤더 혼용 + 에러 규격 제각각** | **`@zerovoids/http-core`** |
| **벤더 에러를 도메인 에러로 일관되게 다뤄야** | **`@zerovoids/http-core`** |

## 설치

```bash
pnpm add @zerovoids/http-core
```

- 런타임 의존성 **0개** · 코어 5KB 미만 · ESM + CJS · 타입 포함
- 브라우저 · Node 22+ · Edge · Worker 어디서든 실행

## 지금 쓸 수 있는 것

### raw 에러를 정규화

`normalizeError`는 어떤 raw 에러든 하나의 `NormalizedError`로 접습니다. 매퍼를 안 넘겨도
내장 fallback이 전송 계층 실패(abort · timeout · network)를, 상태를 알면 HTTP 에러를 분류합니다.
이미 정규화된 에러는 그대로 통과합니다.

```ts
import { normalizeError } from '@zerovoids/http-core'

try {
  const res = await fetch('https://api.example.com/users/1')
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw normalizeError(body, { context: { url: res.url, method: 'GET', httpStatus: res.status } })
  }
} catch (caught) {
  // fetch가 던진 network/timeout/cancel도 여기서 분류됩니다
  const error = normalizeError(caught)
  console.error(error.kind, error.code, error.retryable)
}
```

**벤더 규격은 매퍼 하나로.** 자체 API의 `{ ok: false, error }` 같은 형태도 매퍼를 직접 써서
바로 흡수할 수 있습니다.

```ts
import { NormalizedError, normalizeError, type Mapper } from '@zerovoids/http-core'

const myApi: Mapper = (raw) => {
  if (typeof raw === 'object' && raw !== null && 'error' in raw) {
    return new NormalizedError({ kind: 'domain', code: String(raw.error), cause: raw })
  }
  return null // 못 알아보면 다음 매퍼로 양보
}

const error = normalizeError(rawBody, { mappers: [myApi], context: { httpStatus: 400 } })
```

### 에러를 하나의 방식으로 분기

`kind`로 갈래를 잡고, 정밀한 판단은 `code`/`httpStatus`로. `assertNeverKind`가 모든 갈래를
다뤘는지 **컴파일 타임에** 강제합니다.

```ts
import {
  assertNeverKind,
  isNormalizedErrorKind,
  type NormalizedError,
} from '@zerovoids/http-core'

function toMessage(error: NormalizedError): string {
  switch (error.kind) {
    case 'network':
      return '네트워크에 연결할 수 없어요.'
    case 'timeout':
      return '요청이 시간 초과됐어요.'
    case 'canceled':
      return '요청이 취소됐어요.'
    case 'validation':
      return '입력값을 확인해 주세요.'
    case 'http':
      return error.httpStatus === 401 ? '로그인이 필요해요.' : '요청을 처리하지 못했어요.'
    case 'domain':
      return error.code === 'card_declined' ? '카드가 거절됐어요.' : '처리에 실패했어요.'
    default:
      return assertNeverKind(error.kind) // 새 kind가 생기면 여기서 컴파일 에러
  }
}

// 재시도 판단도 벤더와 무관하게 한 곳에서
function shouldRetry(error: NormalizedError): boolean {
  return error.retryable
}

if (isNormalizedErrorKind(someError, 'timeout')) {
  // someError는 여기서 { kind: 'timeout' }으로 좁혀집니다
}
```

### 정규화된 에러 만들기 (매퍼가 하는 일)

프리빌트 매퍼가 나오기 전에도, 벤더 에러를 직접 정규화할 수 있습니다.

```ts
import { NormalizedError } from '@zerovoids/http-core'

// 예: 429 응답을 정규화
throw new NormalizedError({
  kind: 'http',
  code: 'rate_limited',
  httpStatus: 429,
  retryable: true,
  retryAfterMs: 5000, // Retry-After에서 파싱
  cause: rawVendorError, // 원본은 항상 보존
})
```

### RFC 9457을 이미 말하는 벤더

응답이 `application/problem+json`이면, 그 body를 **손실 없이 그대로** 보존합니다.

```ts
const error = new NormalizedError({
  kind: 'domain',
  code: 'out_of_credit',
  httpStatus: 403,
  problem: {
    type: 'https://example.com/probs/out-of-credit',
    title: 'You do not have enough credit.',
    status: 403,
    detail: 'Your balance is 30, but the cost is 50.',
    instance: '/account/12345/msgs/abc',
    // RFC 9457 확장 멤버도 그대로 유지됩니다
    balance: 30,
  },
})

error.problem?.balance // 30
```

### 로깅 · SSR

`toJSON()`은 **항상 JSON-안전한** 평면 객체를 돌려줍니다. 순환 참조가 있는 벤더 에러가
`cause`에 담겨도 로깅 경로에서 터지지 않습니다.

```ts
logger.error(error.toJSON())
// { name: 'NormalizedError', kind, code, message, httpStatus, retryable, ... }
```

SSR로 직렬화됐다 복원된 에러도 타입 가드가 인식합니다.

```ts
import { isNormalizedError } from '@zerovoids/http-core'

const restored = JSON.parse(payload)
if (isNormalizedError(restored)) {
  // instanceof가 깨진 뒤에도 name 브랜드로 판별
}
```

## `NormalizedError`

```ts
declare class NormalizedError extends Error {
  kind: 'network' | 'timeout' | 'canceled' | 'http' | 'validation' | 'domain'
  code: string // 기계 판독 식별자 (예: card_declined, RATE_LIMITED)
  httpStatus?: number // kind가 'http'일 때 (RFC 9457 status)
  retryable: boolean // 재시도가 성공할 수 있는가 (기본 false)
  retryAfterMs?: number // Retry-After, ms로 정규화 (retryable일 때만 유효)
  cause?: unknown // 원본 벤더/트랜스포트 에러 (ES2022 Error.cause)
  problem?: ProblemDetails // RFC 9457 body 원형
  context?: { url?: string; method?: string; requestId?: string }
  toJSON(): NormalizedErrorJSON
}
```

### `kind` — 실패의 분류

`kind`는 **"대략 무엇이 실패했나"** 를 답하는 거친 라우팅 힌트입니다. 정밀한 정체성은 `code`.

| kind | 의미 |
|---|---|
| `network` | 응답 자체가 없음 — DNS/TLS 실패, 연결 거부, 오프라인 |
| `timeout` | 응답 전에 데드라인 초과 |
| `canceled` | 호출자가 중단(AbortSignal) |
| `http` | 2xx가 아닌 응답 (상태 구분은 `httpStatus`로) |
| `validation` | 응답이 스키마 검증에 실패 |
| `domain` | 벤더의 비즈니스 에러 (예: `card_declined`) |

앞의 셋(`network`/`timeout`/`canceled`)은 **응답이 오기 전** 실패라 어떤 HTTP-status 체계로도
표현할 수 없습니다 — `ky`가 `HTTPError`·`TimeoutError`·`AbortError`를 분리하는 이유와 같습니다.

## 표준 근거

`NormalizedError`의 모든 필드는 **발명이 아니라 published 표준에 대응**합니다.

| 필드 | 근거 |
|---|---|
| `httpStatus`, `problem` | [RFC 9457 — Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html) (`status`/`type`/`title`/`detail`/`instance`, RFC 7807 대체) |
| `code` | Google [`ErrorInfo.reason`](https://google.aip.dev/193) · Apollo `extensions.code` · JSON:API · Stripe `code` |
| `kind` | [gRPC 표준 상태코드](https://grpc.github.io/grpc/core/md_doc_statuscodes.html)(`google.rpc.Code`)의 거친 투영 |
| `retryable` | AWS SDK v3 / Smithy `$retryable` |
| `retryAfterMs` | [RFC 9110 §10.2.3 `Retry-After`](https://datatracker.ietf.org/doc/html/rfc9110#section-10.2.3) |
| `cause` | ES2022 / TC39 [`Error.cause`](https://github.com/tc39/proposal-error-cause) |
| `toJSON()` | JS 직렬화 관례 ([`serialize-error`](https://github.com/sindresorhus/serialize-error)) |

RFC 9457 `type`(URI)과 우리 `code`(토큰)는 의미가 달라 **의도적으로 구분**합니다 —
9457 body는 `problem`에 원형 보존하고, `code`는 벤더 공통의 기계 식별자로 둡니다.

## 로드맵

러너(`normalizeError`)와 직접 매퍼 작성은 위에서 이미 쓸 수 있습니다. 다음이 예정돼 있습니다:

- **프리빌트 벤더 매퍼** — `rfc9457` · `stripe` · `github` · `graphql` · `jsonApi` · `googleRpc` · `genericHttp`
- **`Retry-After` 파싱** — RFC 9110 헤더를 `retryAfterMs`로 정규화

```ts
// 예정: 프리빌트 매퍼로 여러 벤더를 한 번에
import { normalizeError, rfc9457Mapper, stripeMapper } from '@zerovoids/http-core'

const error = normalizeError(raw, {
  mappers: [stripeMapper, rfc9457Mapper, myCompanyMapper],
})
```

어떤 매퍼도 처리하지 못한 정보는 `cause`에 원형으로 남으므로, **아무것도 유실되지 않습니다.**

## 설계 원칙

- **레이어이지 클라이언트가 아니다.** `fetch`/`ky`/`axios`를 대체하지 않고 그 위에 얹힙니다.
- **에러 하나로 정규화, 성공 데이터는 앱의 몫.** 성공 응답의 목표 형식은 앱마다 다르므로
  라이브러리화하지 않습니다 (검증 훅만 제공 예정).
- **코어는 런타임 의존성 0개.** 어떤 표준 위에 앉되, 무거운 것을 끌고 오지 않습니다.
- **공개 표면 최소화.** 익힐 게 적을수록 좋습니다.

### 다루지 않는 것

| 영역 | 대안 |
|---|---|
| HTTP 요청 실행 | `fetch` · `ky` · `axios` · `ofetch` |
| 캐싱 · 쿼리 관리 | [TanStack Query](https://tanstack.com/query) · [SWR](https://swr.vercel.app) |
| 테스트 모킹 | [MSW](https://mswjs.io) |
| OpenAPI 코드 생성 | [Orval](https://orval.dev) · [Kubb](https://kubb.dev) |

## API

현재 공개 표면:

```ts
// 값
NormalizedError          // 클래스
normalizeError           // raw → NormalizedError 러너
isNormalizedError        // 타입 가드 (instanceof + SSR 브랜드)
isNormalizedErrorKind    // kind로 좁히기
assertNeverKind          // switch 소진 검사

// 타입
NormalizedErrorKind
NormalizedErrorInit
NormalizedErrorContext
NormalizedErrorJSON
ProblemDetails
Mapper
MapperContext
NormalizeOptions
```

## License

MIT © [zerovoids](https://github.com/zerovoids)
