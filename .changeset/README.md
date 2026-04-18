# Changesets

이 폴더에는 **아직 릴리즈되지 않은 변경사항**이 Markdown 파일로 저장됩니다.

## 사용법

변경을 기록하려면:

```bash
pnpm changeset
```

인터랙티브 프롬프트가:

1. 영향 받는 패키지를 선택 (space로 토글)
2. bump 종류를 선택 (major / minor / patch)
3. 변경 요약 작성

생성된 `.md` 파일을 PR에 함께 커밋하세요.

## Fixed 그룹 정책

현재 7개 퍼블리시 패키지가 `fixed` 그룹으로 묶여 있습니다:

- `@zerovoids/http`
- `@zerovoids/http-react-query`
- `@zerovoids/http-swr`
- `@zerovoids/http-transport-ky`
- `@zerovoids/http-transport-axios`
- `@zerovoids/http-auth`
- `@zerovoids/http-mock`

=> 하나가 minor bump되면 전부 동일 minor로 올라갑니다. 사용자가 버전 조합을 고민할 필요 없음.

v1.5 이후, 어댑터만 고치는 patch가 잦아지면 `linked`로 완화 검토.

## 자세한 내용

- [Changesets 공식 문서](https://github.com/changesets/changesets)
- [프로젝트 기여 가이드](../CONTRIBUTING.md)
