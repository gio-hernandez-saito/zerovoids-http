# Security Policy

## Supported Versions

v0.x는 pre-release로 보안 패치가 보장되지 않습니다. v1.0.0 이후부터 아래 정책이 적용됩니다.

| Version | Supported |
| ------- | --------- |
| 1.x     | ✅ (최신 minor만) |
| < 1.0   | ❌        |

## Reporting a Vulnerability

**공개 이슈 트래커에 올리지 말아주세요.**

다음 중 하나의 방법으로 비공개 보고:

1. GitHub [Private Vulnerability Reporting](https://github.com/gio-hernandez-saito/zerovoids-http/security/advisories/new)
2. 이메일: **gio.hernandez.saito@gmail.com** (제목에 `[SECURITY]` 포함)

보고에 포함되면 좋은 정보:

- 영향 받는 패키지 버전
- 재현 가능한 최소 예제
- 예상되는 공격 영향 범위
- 제안된 픽스 (있다면)

## Response Timeline

- 접수 확인: 48시간 이내
- 초기 평가 (유효성 + 심각도): 7일 이내
- 픽스 배포: 심각도에 따라 1~30일

## Scope

`@zerovoids/http-auth`의 auth recipe(bearerWithRefresh, oauthPKCE 등)는 보안 민감도가 가장 높아 가장 빠르게 대응합니다.

다음은 scope 밖입니다:

- 소비자 코드의 오사용 (예: peer dep 버전 불일치)
- 의존 라이브러리(`ky`, `axios`, `zod` 등) 내부 취약점 — 해당 프로젝트에 보고해주세요
