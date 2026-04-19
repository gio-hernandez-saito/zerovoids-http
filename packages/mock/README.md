<div align="center">

# @zerovoids/http-mock

**Mock transport — for tests, local dev, and Storybook**

[![npm](https://img.shields.io/npm/v/@zerovoids/http-mock.svg)](https://www.npmjs.com/package/@zerovoids/http-mock)
[![npm downloads](https://img.shields.io/npm/dm/@zerovoids/http-mock.svg)](https://www.npmjs.com/package/@zerovoids/http-mock)
[![license](https://img.shields.io/npm/l/@zerovoids/http-mock.svg)](https://github.com/gio-hernandez-saito/zerovoids-http/blob/main/LICENSE)
[![types](https://img.shields.io/npm/types/@zerovoids/http-mock.svg)](https://www.npmjs.com/package/@zerovoids/http-mock)

[Install](#-install) · [Usage](#-usage) · [Matchers](#-route-matcher) · [Scenarios](#-scenario--sequenced-responses) · [메인 리포](../..)

</div>

---

## 소개

Mock Transport for [@zerovoids/http](../core). 테스트 · 로컬 개발 · Storybook 어디서든 **실제 네트워크 없이** 파이프라인 전체를 커버.

- 🎯 Routes — string / RegExp path, method, body / headers matcher
- ⏱ Delay — 지연 시뮬레이션
- 🔄 `scenario()` — sequenced responses (flaky API, eventual success)
- 📜 `calls[]` + `reset()` — 호출 히스토리 조회

## 📦 Install

```bash
pnpm add -D @zerovoids/http-mock
```

## 🚀 Usage

```ts
import { createClient } from "@zerovoids/http";
import { createMockTransport } from "@zerovoids/http-mock";

const transport = createMockTransport({
  routes: [
    {
      method: "GET",
      path: "/users/1",
      response: { status: 200, body: JSON.stringify({ id: 1 }) },
    },
  ],
  onUnmatched: "throw",  // "throw" | "404"
});

const api = createClient({ adapters, transport });
```

## 🎯 Route matcher

| 필드 | 타입 | 동작 |
|---|---|---|
| `method` | `HttpMethod` | 완전 일치 |
| `path` | `string \| RegExp` | string → `url.endsWith(path)`, RegExp → `test(url)` |
| `response` | `MockResponseInit \| (req) => init` | 정적 or 함수 팩토리 |
| `delay` | `number` | 응답 전 ms 지연 |
| `body` | `(body) => boolean` | `false` 반환 시 route skip → fallthrough |
| `headers` | `Record<string, string \| RegExp>` | 모두 일치해야 매칭 |

여러 route 가 겹쳐도 `body` / `headers` matcher 로 fallthrough — 순서대로 평가됩니다.

## 📜 Call history

```ts
transport.calls;   // ReadonlyArray<{ url, method, headers, body }>
transport.reset(); // 히스토리 clear
```

```ts
// 테스트 예
expect(transport.calls).toHaveLength(1);
expect(transport.calls[0].method).toBe("POST");
expect(transport.calls[0].body).toMatchObject({ email: "…" });
```

## 🔄 `scenario()` — sequenced responses

연속된 응답으로 flaky API 시뮬레이션:

```ts
import { createMockTransport, scenario } from "@zerovoids/http-mock";

const transport = createMockTransport({
  routes: [{
    method: "GET",
    path: "/flaky",
    response: scenario(
      [
        { status: 500 },
        { status: 500 },
        { status: 200, body: '{"ok":true}' },
      ],
      { onExhausted: "last" },   // "cycle" | "last" | "throw"
    ),
  }],
});
```

- `cycle` (기본) — 소진 시 처음으로 루프
- `last` — 마지막 응답 유지 (retry 수렴 테스트에 적합)
- `throw` — `kind: "network"` NormalizedError 로 표면화

## 🔗 관련 링크

- [메인 README](../..) — 전체 생태계 소개
- [Testing guide](../../website/guides/testing.md)

## License

MIT © [zerovoids](https://github.com/gio-hernandez-saito)
