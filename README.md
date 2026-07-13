<div align="center">

# zerovoids-http

**여러 외부 API의 제각각인 에러를 하나의 `NormalizedError`로 통일하는 TypeScript 레이어.**

`@zerovoids/http-*` 패키지 가족의 모노레포.

</div>

---

> [!NOTE]
> **0.x 초기 단계입니다.** 공개 API는 `1.0.0` 전까지 바뀔 수 있습니다.

## 왜

여러 외부 API(결제·소셜·내부 서비스)를 함께 쓰면 응답도 에러 규격도 제각각입니다.
핵심 가치는 그 **에러를 소비자 측에서 하나의 형태로 정규화**하는 것 —
`fetch`/`ky`/`axios` 무엇 위에서든, 어떤 벤더든, `catch` 한 번의 모양으로.

이 라이브러리는 **HTTP 클라이언트가 아니라** 그 위에 얇게 얹는 에러 정규화 레이어입니다.

## 패키지

| 패키지 | 설명 |
|---|---|
| [`@zerovoids/http-core`](./packages/core) | 에러 정규화 코어 — `NormalizedError` 계약, `normalizeError` 러너, `rfc9457Mapper`, 타입 가드 |

`-core`는 가족의 base입니다. 벤더 매퍼·재시도 같은 확장은 실제 필요가 생길 때 형제 패키지로 자라납니다
([@babel/core 모델](https://www.npmjs.com/package/@babel/core)). 사용법은 **[코어 README](./packages/core#readme)** 를 참고하세요.

## 개발

```bash
pnpm install
pnpm build       # Turbo 증분 빌드 (tsdown, dual ESM/CJS + attw·publint)
pnpm test        # 전체 워크스페이스 테스트 (Vitest)
pnpm typecheck   # 타입 체크
pnpm lint        # Biome
```

## License

[MIT](./LICENSE) © zerovoids
