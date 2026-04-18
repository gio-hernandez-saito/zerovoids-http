# Changelog

이 파일은 리포지토리 전체 레벨의 메타 변경사항만 기록합니다.
각 패키지의 릴리즈 노트는 해당 패키지의 `CHANGELOG.md`를 확인하세요.

변경 기록은 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) 형식을 따르며,
이 프로젝트는 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)을 준수합니다.

## [Unreleased]

### Added
- **Ecosystem major bump (2026-04-19)** — React 19 / Zod 4 / ky 2 / Next 16 / Vite 8 / size-limit 12 / jsdom 29 / @vitejs/plugin-react 6 전부 업데이트. 소스 변경 없이 카탈로그 bump 만으로 통과 (peer-only 설계 검증). Core 번들 3.52 → **3.38 KB brotli**. 211 tests green.
- **Pre-publish 마무리 (2026-04-19)** — ADR을 `docs/adrs/` → `website/adrs/` 이동 (공개 문서화), `examples/node-cli` / `examples/vite-swr` 실구현, react-query/swr renderHook 통합 테스트 (`@testing-library/react` + jsdom), 패키지 README 8종 전체 현행화, `.omc/` gitignore 추가, `.changeset/initial-pipeline-publish.md` 로 **0.1.0 minor bump** 엔트리. **총 211 tests** (Phase 4 207 → +4).
- 모노레포 초기 스캐폴딩: pnpm workspace + Turborepo + Changesets + Biome + Vitest
- 7개 패키지 뼈대 (`@zerovoids/http`, `-react-query`, `-swr`, `-transport-ky`, `-transport-axios`, `-auth`, `-mock`)
- CI / Release / Changeset-check / Examples-smoke 워크플로우
- Codecov 구성 (패키지별 flag, auth 90% / core 85% / 나머지 80% 타깃)
- **Phase 1** — core 파이프라인 (`pipeline.ts`), DX 필수 8개, `transport-ky` 선행 실구현, `examples/multi-vendor`. 88 tests.
- **Phase 2** — core `.raw()` 탈출구, `@zerovoids/http-react-query` 실구현 (`createQueryHooks` + `queryKeyFor` + `invalidate`), `examples/nextjs-react-query` (App Router + RSC `prefetchQuery` + `HydrationBoundary`). 100 tests, core 4.98 KB gzip.
- **Phase 3** — 보안·확장 일괄:
  - core: `dedupTransport`, `idempotencyKey` plugin, `credentials`/`mode`/`cache` 1급 필드 (pipeline → fetchTransport)
  - `@zerovoids/http-auth` 실구현: `bearerWithRefresh` transport wrapper (single-flight + race 검출), `xsrf` plugin, `memoryStorage`/`localStorageStorage`. 커버리지 99% stmt / 98% branch / 100% func.
  - `@zerovoids/http-transport-axios` 실구현: AxiosRequestConfig 매핑, upload/download progress (axios 독점), `ERR_CANCELED`→AbortError
  - `@zerovoids/http-swr` 실구현: `createSwrHooks`, RQ와 캐시 키 호환 (`canonicalize`/`swrKeyFor`)
  - `@zerovoids/http-mock` 확장: `delay`, 함수 response 팩토리, `calls[]` 히스토리 + `reset()`, body/headers matcher
  - **총 178 tests** (Phase 2 대비 +78), 7 패키지 type-check + biome 0 errors, core **3.41 KB brotli**
- **Phase 4** — v1 안정화 (배포 전 단계):
  - core: `pagination` 선언 (cursor/offset/link-header/custom) + `parseLinkHeader`
  - react-query: `optimistic(qc, queryKey, updater)` — snapshot / rollback / invalidate 헬퍼
  - mock: `scenario()` — sequence of responses with `cycle`/`last`/`throw` exhaustion modes
  - auth: OAuth PKCE helpers (`createPkceChallenge`/`generateVerifier`/`deriveChallenge`) — RFC 7636 S256
  - **타입 추론 버그 수정** — `InferBody`/`InferQuery`/`InferHeaders`/`InferOutput`가 optional field 패턴을 매칭 못해 `unknown`으로 widen되던 문제, `examples/nextjs-react-query` 타입 에러 복구
  - 내부 벤치 패키지 `@zerovoids/http-bench` (private, not published) — **p99 overhead 2μs** (예산 5ms의 1/2500)
  - `size-limit` 전 패키지 적용: core 3.52 KB / auth 1.04 KB / react-query 651 B / swr 654 B / transport-ky 516 B / transport-axios 949 B / mock 617 B (모두 brotli, peer-excluded)
  - ADR 4종 (`docs/adrs/`) + `packages/auth/THREAT_MODEL.md`
  - website 확장: `vendor-adapters`, `error-handling`, `auth-recipes`, `testing`, `reference/api`
  - **총 207 tests** (Phase 3 대비 +29), 7 패키지 type-check + biome 0 errors

[Unreleased]: https://github.com/gio-hernandez-saito/zerovoids-http/compare/HEAD...HEAD
