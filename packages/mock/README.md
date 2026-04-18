# @zerovoids/http-mock

Mock Transport for [@zerovoids/http](../core) — 테스트 / 로컬 개발 / Storybook 용.

## Install

```bash
pnpm add -D @zerovoids/http-mock
```

## Usage

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

## Route matcher

| 필드 | 타입 | 동작 |
|---|---|---|
| `method` | `HttpMethod` | 완전 일치 |
| `path` | `string \| RegExp` | 문자열은 `url.endsWith(path)`, RegExp는 `test(url)` |
| `response` | `MockResponseInit \| (req) => init` | 정적 or 함수 팩토리 |
| `delay` | `number` | 응답 전 ms 지연 |
| `body` | `(body) => boolean` | `false` 반환 시 route skip → fallthrough |
| `headers` | `Record<string, string \| RegExp>` | 전부 일치해야 매칭 |

여러 route 가 겹쳐도 `body`/`headers` matcher 로 fallthrough 되어 순서대로 평가됩니다.

## Call history

```ts
transport.calls;   // ReadonlyArray<{ url, method, headers, body }>
transport.reset(); // 히스토리 clear
```

테스트에서 `expect(transport.calls).toHaveLength(1)` 식으로 검증.

## `scenario()` — sequenced responses

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

## License

MIT
