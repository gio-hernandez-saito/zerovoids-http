# Contributing to zerovoids-http

기여 감사합니다. 작은 PR부터 대형 아키텍처 제안까지 환영합니다.
시작하기 전 [프로젝트 철학](./README.md#philosophy)과 [Non-goals](./README.md#non-goals)을 꼭 확인해주세요.

## 개발 환경

- Node.js >= 20
- pnpm >= 10

```bash
git clone https://github.com/gio-hernandez-saito/zerovoids-http.git
cd zerovoids-http
pnpm install
```

## 자주 쓰는 명령

| 명령 | 설명 |
|---|---|
| `pnpm build` | Turbo로 영향받은 패키지만 빌드 |
| `pnpm dev` | 변경 감지하며 watch 빌드 |
| `pnpm test` | 전체 워크스페이스 테스트 |
| `pnpm test:coverage` | 커버리지 리포트 생성 |
| `pnpm type-check` | TS 전체 체크 |
| `pnpm check` | Biome lint + format 적용 |
| `pnpm ci:check` | CI와 동일한 lint 검사 |
| `pnpm size` | 번들 크기 검증 (size-limit) |
| `pnpm --filter @zerovoids/http test` | 특정 패키지만 테스트 |

## 브랜치 / 커밋 / PR

- `main`은 항상 릴리즈 가능 상태를 유지
- 기능 브랜치: `feat/<short-desc>`, 버그: `fix/<short-desc>`, 문서: `docs/<short-desc>`
- 커밋 메시지는 [Conventional Commits](https://www.conventionalcommits.org/) 스타일 권장
- PR 하나에 하나의 논리적 변경만. 대형 리팩터는 분리

## Changeset 필수

사용자가 느낄 수 있는 변경(API·behavior·deps)은 **반드시 changeset**을 포함해야 합니다.
CI에서 자동 검사되어 changeset 없으면 머지 불가.

```bash
pnpm changeset        # 인터랙티브로 작성
```

- `patch`: 내부 수정, 버그 픽스, 문서
- `minor`: 새 기능, 새 공개 API
- `major`: 깨지는 변경

초기(v0.x)에는 전 패키지가 `fixed` 그룹으로 같은 버전으로 bump됩니다.

## 테스트 가이드

- **Unit**: `src/**/*.test.ts` (Vitest)
- **Integration**: `src/__tests__/` (같은 패키지 내 여러 모듈 조합)
- **Type tests**: `type-tests/**/*.test-d.ts` (expect-type)
- 커버리지 목표:
  - `@zerovoids/http-auth`: 90% (보안 민감)
  - `@zerovoids/http` (core): 85%
  - 나머지: 80%

## 공개 API 변경 규칙

1. `public API surface` 는 4개만 (`createClient`, `defineAdapter`, `definePlugin`, `defineEndpoint`). 확장 시 코어 팀 승인.
2. 새 기능 추가 시 자문: **"이건 플러그인으로 외주화 가능한가?"** yes면 core 밖으로.
3. **NormalizedError 계약을 깨는가?** 깨면 재설계 또는 major bump.
4. `peerDependencies` 신설은 신중히. 어댑터 패키지 분리로 해결 가능하면 그쪽 선택.

## 스킵 리스트 존중

[Non-goals](./README.md#non-goals)에 박제된 항목은 PR로 받지 않습니다.
예외적 논의가 필요하면 먼저 이슈를 열어주세요.

## 릴리즈 프로세스

커밋터만 해당:

1. `pnpm changeset` → 변경 기록
2. main에 머지 → Changesets bot이 release PR 자동 생성
3. Release PR 머지 → `release.yml` 이 `pnpm publish -r` 자동 수행

## 보안 이슈

공개 이슈 대신 [SECURITY.md](./SECURITY.md)의 절차를 따라주세요.

## 행동 강령

[Code of Conduct](./CODE_OF_CONDUCT.md)에 동의하는 것으로 간주됩니다.
