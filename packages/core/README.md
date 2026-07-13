<div align="center">

# @zerovoids/http-core

**여러 API의 제각각인 에러를, 하나의 `NormalizedError`로.**

클라이언트를 갈아치우지 않고 — `fetch`·`ky`·`axios`·공식 SDK 위에 그대로 얹는 에러 정규화 레이어.

![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)
![types included](https://img.shields.io/badge/types-included-blue)
![module](https://img.shields.io/badge/module-ESM%20%2B%20CJS-f7df1e)
![license](https://img.shields.io/badge/license-MIT-green)

[왜](#왜) · [설치](#설치) · [빠른 시작](#빠른-시작) · [예시](#더-많은-예시) · [표준 근거](#표준-근거) · [API](#api)

</div>

---

> [!NOTE]
> **0.x 초기 단계입니다.** `normalizeError` 러너, 내장 fallback, `rfc9457Mapper`(표준), `stripeMapper`·
> `graphqlMapper`(벤더), `Retry-After` 파싱을 지금 바로 쓸 수 있습니다. 공개 API는 `1.0.0` 전까지 바뀔 수 있습니다.

## 왜

여러 외부 API를 함께 쓰면, **성공 응답은 정규화하면서도 실패는 그냥 흘려보내는** 경우가 많습니다.
문제는 실패의 모양이 벤더마다 전부 다르다는 것입니다.

```jsonc
// Stripe
{ "error": { "type": "card_error", "code": "card_declined" } }

// GitHub
{ "message": "Validation Failed", "errors": [{ "field": "title", "code": "missing_field" }] }

// Slack — 에러인데 HTTP 200
{ "ok": false, "error": "invalid_auth" }

// RFC 9457을 따르는 API
{ "type": "https://ex.com/out-of-credit", "title": "Payment Required", "status": 403 }
```

여기에 `fetch`/`ky`/`axios`가 던지는 방식, `zod`/`valibot` 검증 에러까지 겹치면
소비자 코드는 `err.response?.data?.errors?.[0]?.code === 'missing_field'` 같은 분기로 뒤덮입니다.

`@zerovoids/http-core`는 이 모든 실패를 **`kind`로 구분되는 하나의 타입**으로 접습니다.
어떤 벤더·트랜스포트·검증기에서 왔든, 소비자가 보는 에러의 모양은 항상 같습니다.

```
raw 에러 (어떤 벤더/표준이든)  ──[ mappers ]──▶  NormalizedError
                                                 ├─ kind        실패의 종류 (라우팅 힌트)
                                                 ├─ code        기계 판독 식별자 (정체성)
                                                 ├─ httpStatus / retryable / retryAfterMs
                                                 ├─ problem     RFC 9457 body 원형 보존
                                                 └─ cause       원본 에러 그대로 보존
```

이 라이브러리는 **HTTP 클라이언트가 아닙니다.** 쓰던 클라이언트를 그대로 두고 그 위에 얇게 얹는,
고전적인 anti-corruption layer를 안정적인 하나의 목표 타입으로 제품화한 것입니다.

## 언제 쓰나

| 상황 | 권장 |
|---|---|
| API 하나만, 에러 규격도 단순 | 네이티브 `fetch`, [`ky`](https://github.com/sindresorhus/ky), [`axios`](https://axios-http.com) |
| OpenAPI 스펙 보유 | [openapi-fetch](https://openapi-ts.dev/openapi-fetch/), [Orval](https://orval.dev) |
| 전 레이어를 내가 소유 + full-stack TS | [tRPC](https://trpc.io), [oRPC](https://orpc.unnoq.com) |
| **여러 외부 벤더 혼용 + 에러 규격 제각각** | **`@zerovoids/http-core`** |
| **벤더 에러를 도메인 에러로 일관되게 다뤄야** | **`@zerovoids/http-core`** |

## 설치

```bash
pnpm add @zerovoids/http-core
```

- 런타임 의존성 **0개** · tree-shakeable · ESM + CJS · 타입 포함
- 브라우저 · Node 22+ · Edge · Worker 어디서든 실행

## 빠른 시작

한 번의 `normalizeError`로 **RFC 9457 body든, 자체 규격이든, 상태코드뿐이든, 응답 전 실패(network/timeout/abort)든**
전부 하나의 타입으로 접습니다. 매퍼는 순서대로 시도되고, 아무도 못 잡으면 내장 fallback이 전송 계층 실패와 HTTP 에러를 분류합니다.

```ts
import { NormalizedError, normalizeError, rfc9457Mapper, stripeMapper, type Mapper } from '@zerovoids/http-core'

// 자체 API 규격: { ok: false, error: 'invalid_auth' } — 매퍼 하나로 흡수
const myApi: Mapper = (raw) => {
  if (raw && typeof raw === 'object' && (raw as { ok?: unknown }).ok === false) {
    return new NormalizedError({ kind: 'domain', code: String((raw as { error: unknown }).error), cause: raw })
  }
  return null // 못 알아보면 다음 매퍼로 양보
}

async function getUser(id: string): Promise<User> {
  let res: Response
  try {
    res = await fetch(`https://api.example.com/users/${id}`)
  } catch (caught) {
    // 응답 자체가 없는 실패(network/timeout/abort)는 fallback이 분류합니다
    throw normalizeError(caught, { context: { url: `/users/${id}`, method: 'GET' } })
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw normalizeError(body, {
      mappers: [stripeMapper, rfc9457Mapper, myApi], // 프리빌트(Stripe) → 표준(RFC 9457) → 자체 규격
      context: { url: res.url, method: 'GET', httpStatus: res.status, headers: res.headers },
    })
  }
  return res.json()
}
```

소비 측은 벤더가 몇 개든 **항상 같은 모양**을 봅니다.

```ts
try {
  await getUser('42')
} catch (error) {
  if (error instanceof NormalizedError) {
    console.error(error.kind, error.code, error.httpStatus, error.retryable)
  }
}
```

## 더 많은 예시

### `kind`로 분기하기

`kind`로 갈래를 잡고, 정밀한 판단은 `code`/`httpStatus`로. `assertNeverKind`가 모든 갈래를 다뤘는지
**컴파일 타임에** 강제합니다 — 나중에 `kind`가 추가되면 여기서 컴파일 에러가 납니다.

```ts
import { assertNeverKind, type NormalizedError } from '@zerovoids/http-core'

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
      return assertNeverKind(error.kind)
  }
}
```

### 재시도 판단

`retryable`은 벤더와 무관하게 **일시적 실패의 부류**를 알려주는 힌트입니다. 서버가 `Retry-After`를 주면
`retryAfterMs`(밀리초)로 정규화됩니다. 실제 재시도 정책(횟수·백오프·멱등성)은 앱의 몫입니다.

```ts
const error = normalizeError(body, { context: { httpStatus: 503, headers: res.headers } })

if (error.retryable) {
  const waitMs = error.retryAfterMs ?? 1000
  // ... waitMs 만큼 기다렸다 재시도
}
```

> `retryable`은 "재시도해도 안전하다"는 판정이 아니라 "일시적 부류"라는 힌트입니다. 실제 안전 여부는
> 메서드 멱등성([RFC 9110 §9.2.2](https://www.rfc-editor.org/rfc/rfc9110#section-9.2.2))에도 달려 있습니다.

### 직접 `NormalizedError` 만들기 (매퍼가 하는 일)

매퍼는 결국 raw 에러를 받아 `NormalizedError`를 돌려주는 함수입니다. `application/problem+json` body는
`problem`에 **손실 없이 원형 보존**됩니다 (확장 멤버 포함).

```ts
import { NormalizedError } from '@zerovoids/http-core'

throw new NormalizedError({
  kind: 'http',
  code: 'out_of_credit',
  httpStatus: 403,
  retryable: false,
  cause: rawVendorError, // 원본은 항상 보존
  problem: {
    type: 'https://example.com/probs/out-of-credit',
    title: 'You do not have enough credit.',
    status: 403,
    balance: 30, // RFC 9457 확장 멤버도 그대로 유지
  },
})
```

### 로깅 · SSR

`toJSON()`은 **항상 JSON-안전한** 평면 객체를 돌려줍니다. 순환 참조·`bigint` 같은 값이 `cause`에 담겨도
로깅 경로에서 터지지 않습니다. SSR로 직렬화됐다 복원된 에러도 타입 가드가 인식합니다.

```ts
import { isNormalizedError } from '@zerovoids/http-core'

logger.error(error.toJSON())

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
  retryable: boolean // 일시적 실패의 부류인가 (기본 false)
  retryAfterMs?: number // Retry-After, ms로 정규화 (retryable일 때만 유효)
  cause?: unknown // 원본 벤더/트랜스포트 에러 (ES2022 Error.cause)
  problem?: ProblemDetails // RFC 9457 body 원형
  context?: { url?: string; method?: string; requestId?: string }
  toJSON(): NormalizedErrorJSON
}
```

`kind`는 **"대략 무엇이 실패했나"** 를 답하는 거친 라우팅 힌트입니다. 정밀한 정체성은 `code`.

| kind | 의미 |
|---|---|
| `network` | 응답 자체가 없음 — DNS/TLS 실패, 연결 거부, 오프라인 |
| `timeout` | 응답 전에 데드라인 초과 |
| `canceled` | 호출자가 중단 (AbortSignal) |
| `http` | 2xx가 아닌 응답 (상태 구분은 `httpStatus`로) |
| `validation` | 응답이 스키마 검증에 실패 |
| `domain` | 벤더의 비즈니스 에러 (예: `card_declined`) |

앞의 셋(`network`/`timeout`/`canceled`)은 **응답이 오기 전** 실패라 어떤 HTTP-status 체계로도 표현할 수 없습니다 —
`ky`가 `HTTPError`·`TimeoutError`·`AbortError`를 분리하는 이유와 같습니다.

## 표준 근거

`NormalizedError`의 모든 필드는 **발명이 아니라 published 표준에 대응**합니다.

| 필드 | 근거 |
|---|---|
| `httpStatus`, `problem` | [RFC 9457 — Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html) (RFC 7807 대체) |
| `code` | Google [`ErrorInfo.reason`](https://google.aip.dev/193) · Apollo `extensions.code` · JSON:API · Stripe `code` |
| `kind` | [gRPC 표준 상태코드](https://grpc.github.io/grpc/core/md_doc_statuscodes.html) (`google.rpc.Code`)의 거친 투영 |
| `retryable` | AWS SDK v3 / Smithy `$retryable` |
| `retryAfterMs` | [RFC 9110 §10.2.3 `Retry-After`](https://www.rfc-editor.org/rfc/rfc9110#section-10.2.3) |
| `cause` | ES2022 / TC39 [`Error.cause`](https://github.com/tc39/proposal-error-cause) |
| `toJSON()` | JS 직렬화 관례 ([`serialize-error`](https://github.com/sindresorhus/serialize-error)) |

RFC 9457 `type`(URI)과 우리 `code`(토큰)는 의미가 달라 **의도적으로 구분**합니다 — 9457 body는 `problem`에
원형 보존하고, `code`는 벤더 공통의 기계 식별자로 둡니다. `rfc9457Mapper`는 `code`를 `type` URI의 마지막
경로 세그먼트에서 뽑고, 없으면 `http_<status>`로 채웁니다.

## 설계 원칙

- **레이어이지 클라이언트가 아니다.** `fetch`/`ky`/`axios`를 대체하지 않고 그 위에 얹힙니다.
- **에러 하나로 정규화, 성공 데이터는 앱의 몫.** 성공 응답의 목표 형식은 앱마다 다르므로 라이브러리화하지 않습니다.
- **코어는 런타임 의존성 0개.** 표준 위에 앉되, 무거운 것을 끌고 오지 않습니다.
- **공개 표면 최소화.** 익힐 게 적을수록 좋습니다.

## 로드맵

지금 쓸 수 있는 것: `normalizeError` 러너 + 내장 fallback(전송 실패·제네릭 HTTP), `rfc9457Mapper`(표준),
`stripeMapper`·`graphqlMapper`(벤더), `Retry-After` 파싱, `NormalizedError` 계약과 타입 가드. 다음이 예정돼 있습니다:

- **프리빌트 벤더 매퍼 추가** — `github` 등. 실제 필요가 생길 때 같은 틀로 추가됩니다.

어떤 매퍼도 처리하지 못한 정보는 `cause`에 원형으로 남으므로, **아무것도 유실되지 않습니다.**

## API

```ts
import {
  NormalizedError, // 클래스
  normalizeError, // raw → NormalizedError 러너
  rfc9457Mapper, // application/problem+json 매퍼 (표준)
  stripeMapper, // Stripe 에러 매퍼 (벤더)
  graphqlMapper, // GraphQL 에러 매퍼 (벤더)
  parseRetryAfter, // Retry-After → ms
  isNormalizedError, // 타입 가드 (instanceof + SSR 브랜드)
  isNormalizedErrorKind, // kind로 좁히기
  assertNeverKind, // switch 소진 검사
} from '@zerovoids/http-core'

import type {
  Mapper,
  MapperContext,
  NormalizeOptions,
  NormalizedErrorContext,
  NormalizedErrorInit,
  NormalizedErrorJSON,
  NormalizedErrorKind,
  ProblemDetails,
} from '@zerovoids/http-core'
```

## License

[MIT](./LICENSE) © zerovoids
