# Documentation

`@zerovoids/http` 공식 문서입니다. 향후 [VitePress](https://vitepress.dev/) 또는 [Starlight](https://starlight.astro.build/) 기반 사이트로 빌드됩니다.

## 지금 바로 읽기

### 개념

- [**Philosophy**](./philosophy.md) — 4대 원칙, 다루지 않는 영역, 기능 추가 판단 기준
- [**Architecture**](./architecture.md) — 3-layer 구조, Request 파이프라인, Transport 인터페이스

### 가이드

- [**Getting started**](./guides/getting-started.md) — 설치, 첫 Adapter, 호출, throw 모드
- [**Vendor adapters**](./guides/vendor-adapters.md) — 여러 외부 API 합성
- [**Error handling**](./guides/error-handling.md) — `NormalizedError` 브랜칭 · UI · 재시도
- [**Auth recipes**](./guides/auth-recipes.md) — bearerWithRefresh · xsrf · PKCE
- [**Testing**](./guides/testing.md) — `@zerovoids/http-mock`로 파이프라인 테스트
- [**Observability**](./guides/observability.md) — request tracing

### API Reference

- [**API**](./reference/api.md) — 4개 public 심볼 + 헬퍼 전체 목록
- [**NormalizedError**](./reference/normalized-error.md) — 에러 정규화 계약과 활용

### Architecture Decision Records

- [**ADRs**](./adrs/README.md) — 핵심 설계 결정 기록

## 앞으로 추가될 문서

| 제목 | 상태 |
|---|---|
| guides/migration.md — axios/Better Fetch/Zodios에서 마이그레이션 | v1.1 |

## 기여

오탈자 수정부터 새 가이드 작성까지 환영합니다. [`CONTRIBUTING.md`](../CONTRIBUTING.md)를 참고해주세요.
