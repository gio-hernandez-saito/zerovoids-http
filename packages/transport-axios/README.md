<div align="center">

# @zerovoids/http-transport-axios

**axios-based transport — for upload/download progress events**

[![npm](https://img.shields.io/npm/v/@zerovoids/http-transport-axios.svg)](https://www.npmjs.com/package/@zerovoids/http-transport-axios)
[![npm downloads](https://img.shields.io/npm/dm/@zerovoids/http-transport-axios.svg)](https://www.npmjs.com/package/@zerovoids/http-transport-axios)
[![license](https://img.shields.io/npm/l/@zerovoids/http-transport-axios.svg)](https://github.com/gio-hernandez-saito/zerovoids-http/blob/main/LICENSE)
[![types](https://img.shields.io/npm/types/@zerovoids/http-transport-axios.svg)](https://www.npmjs.com/package/@zerovoids/http-transport-axios)

[Install](#-install) · [Usage](#-usage) · [Options](#️-options) · [소유권 규칙](#️-소유권-규칙-중요) · [메인 리포](../..)

</div>

---

## 소개

[axios](https://github.com/axios/axios) 기반 Transport — [@zerovoids/http](../core) 의 기본 `fetchTransport` 대체용.

### 언제 선택하나

`axios` 를 고를 **유일한** 이유는 **업로드/다운로드 진행률**. `fetch` / `ky` 는 XHR `progress` 이벤트를 노출하지 못합니다. 그 외엔 `fetchTransport` 로 충분 — 번들 크기/Node 호환성 모두 이점이 없습니다.

## 📦 Install

```bash
pnpm add @zerovoids/http-transport-axios @zerovoids/http axios
```

## 🚀 Usage

```ts
import { createClient } from "@zerovoids/http";
import { axiosTransport } from "@zerovoids/http-transport-axios";

const api = createClient({
  adapters,
  transport: axiosTransport({
    onUploadProgress: (e) => console.log(`upload: ${e.loaded}/${e.total}`),
    onDownloadProgress: (e) => console.log(`download: ${e.loaded}/${e.total}`),
  }),
});
```

## ⚙️ Options

| 옵션 | 설명 |
|---|---|
| `axios` | 사전 구성된 `AxiosInstance` (e.g. `axios.create({ baseURL })`) — 생략 시 글로벌 axios |
| `onUploadProgress` | XHR 업로드 진행률. **axios 전용** |
| `onDownloadProgress` | XHR 다운로드 진행률. **axios 전용** |
| `httpAgent` | Node-only. `http.Agent` passthrough |
| `httpsAgent` | Node-only. `https.Agent` passthrough |

`credentials: 'include' | 'omit'` 은 `withCredentials` 로 자동 매핑됩니다.

## ⚠️ 소유권 규칙 (중요)

`axiosTransport` 는 다음을 강제합니다 — 모두 core 파이프라인 소유권 존중을 위함:

- `responseType: 'arraybuffer'` — core `decodeBody` 가 content-type 기반 디코딩
- `validateStatus: () => true` — 4xx/5xx 는 core `errorMap` 담당
- `timeout: 0` — timeout 은 core `timeoutSignal` 담당
- `transformRequest: [identity]` — body 는 core 가 이미 serialize 완료
- `axios.isCancel` / `ERR_CANCELED` → `AbortError` 변환 (core 의 `canceled` / `timeout` 분류 호환)

**`axios.interceptors` 는 사용하지 마세요.** Plugin API (`init` / `onRequest` / `onResponse`) 를 쓰면 됩니다.

## 🔗 관련 링크

- [메인 README](../..) — 전체 생태계 소개
- [@zerovoids/http-transport-ky](../transport-ky) — ky 기반 대안 (progress 이벤트 불필요할 때)

## License

MIT © [zerovoids](https://github.com/gio-hernandez-saito)
