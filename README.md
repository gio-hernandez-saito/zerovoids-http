<div align="center">

# @zerovoids/http

**Vendor-normalizing HTTP layer for TypeScript**

_여러 외부 API의 제각각인 에러를 하나의 `NormalizedError`로 통일한다._

</div>

---

> ⚠️ **Work in progress.** 초기 스캐폴드 단계입니다. 공개 API는 아직 확정되지 않았습니다.

## 왜

여러 외부 API(결제·소셜·내부 서비스)를 함께 쓰면 응답도 에러 규격도 제각각입니다.
이 라이브러리의 핵심 가치는 그 **에러를 소비자 측에서 하나의 형태로 정규화**하는 것 —
`fetch`/`ky`/`axios` 무엇 위에서든, 어떤 벤더든, `catch` 한 번의 모양으로.

## 개발

```bash
pnpm install
pnpm build       # Turbo 증분 빌드
pnpm test        # 전체 워크스페이스 테스트
pnpm typecheck   # 타입 체크
pnpm lint        # Biome
```

## License

MIT © [zerovoids](https://github.com/zerovoids)
