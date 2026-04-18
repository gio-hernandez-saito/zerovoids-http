---
"@zerovoids/http": minor
"@zerovoids/http-react-query": minor
"@zerovoids/http-swr": minor
"@zerovoids/http-transport-ky": minor
"@zerovoids/http-transport-axios": minor
"@zerovoids/http-auth": minor
"@zerovoids/http-mock": minor
---

Initial scaffolding for the `@zerovoids/http` monorepo.

- Core public API surface: `createClient`, `defineAdapter`, `defineEndpoint`, `definePlugin`
- `NormalizedError` 타입 계약 확정 (`kind`, `code`, `retryable`, `retryAfterMs`, `cause`, `trace`)
- Type guards: `isNormalizedError`, `isKind`, `exhaustiveGuard`
- Default fetch transport + Retry-After 파싱
- 7개 패키지 뼈대 공개
