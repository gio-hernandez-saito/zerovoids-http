# @zerovoids/http-transport-ky

[ky](https://github.com/sindresorhus/ky) 기반 Transport — [@zerovoids/http](../core) 의 기본 `fetchTransport` 대체용.

## Install

```bash
pnpm add @zerovoids/http-transport-ky @zerovoids/http ky
```

## Usage

```ts
import { createClient } from "@zerovoids/http";
import { kyTransport } from "@zerovoids/http-transport-ky";

const api = createClient({
  adapters,
  transport: kyTransport(),
});
```

커스텀 ky 인스턴스 주입:

```ts
import ky from "ky";

const k = ky.create({ fetch: customFetch /* 공용 cookie jar 등 */ });
createClient({ adapters, transport: kyTransport({ ky: k }) });
```

## 소유권 규칙

`kyTransport` 는 다음을 **내부적으로 비활성화** 합니다 — 모두 core 파이프라인 소유:

- `retry: 0` — retry / backoff / jitter / Retry-After 는 core `RetryStrategy` 가 처리
- `timeout: false` — timeout 은 core `timeoutSignal` + `AbortSignal.any` 조합 담당
- `throwHttpErrors: false` — 4xx/5xx 는 core `errorMap` → `NormalizedError` 로 변환

따라서 `ky.hooks` 도 **사용하지 마세요**. Plugin API (`init`/`onRequest`/`onResponse`) 를 쓰면 됩니다.

## prefixUrl / searchParams

URL 합성 (`composePath` + `serializeQuery`) 은 core가 모두 담당합니다. ky의 `prefixUrl` / `searchParams` 를 중복 설정하면 충돌이 납니다 — `adapters[*].baseURL` 한 곳에만 지정하세요.

## License

MIT
