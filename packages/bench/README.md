<div align="center">

# @zerovoids/http-bench

**Internal benchmark harness — not published**

[![internal](https://img.shields.io/badge/internal-not--published-lightgrey)](#)
[![license](https://img.shields.io/badge/license-MIT-blue)](https://github.com/gio-hernandez-saito/zerovoids-http/blob/main/LICENSE)

[Running](#-running) · [Interpretation](#-interpretation) · [메인 리포](../..)

</div>

---

## 소개

`docs/plan.md` §14 의 퍼포먼스 예산을 CI / 로컬에서 측정하는 내부 벤치.

> Cold call overhead p99 < 5ms

이 패키지는 해당 측정을 배포 패키지의 의존성 그래프를 건드리지 않고 분리하기 위해 존재합니다 (`private: true`).

## 🚀 Running

```sh
# Vitest bench (pretty table, compare runs)
pnpm --filter @zerovoids/http-bench bench

# Standalone p50/p99/p99.9 harness (parseable output for CI gates)
pnpm --filter @zerovoids/http-bench bench:cli
```

두 모드 모두 `src/fixtures.ts` 의 동일 fixture 를 사용: mock transport 로 `createClient(...).svc.getUser({ params: { id: 1 } })`. 실제 네트워크는 **의도적으로** 사용하지 않음 — wrapper 자체의 overhead 측정이 목적.

## 📊 Interpretation

관심 있는 delta 는 `pipeline - baseline`.

- 2023년 laptop 기준 **~100μs/call 이하** 면 p99 < 5ms 예산 안쪽
- 회귀 신호: wrapper path 에 **≥ 200μs** 추가되면 조사 대상

**현재 실측**: pipeline overhead **p99 2μs** (예산의 1/2500).

## 🔗 관련 링크

- [메인 README](../..) — 전체 생태계 소개
- [docs/plan.md §14](../../docs/plan.md) — Success Criteria

## License

MIT
