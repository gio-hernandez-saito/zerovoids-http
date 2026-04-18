import type {
	Transport,
	TransportRequest,
	TransportResponse,
} from "@zerovoids/http";
import axios, {
	type AxiosError,
	type AxiosInstance,
	type AxiosProgressEvent,
	type AxiosRequestConfig,
} from "axios";

export type AxiosTransportOptions = {
	/**
	 * Pre-configured axios instance. Use `axios.create({ ... })` to set
	 * baseURL / defaults / agents. Avoid `interceptors` — they conflict with
	 * the `@zerovoids/http` Plugin pipeline.
	 */
	axios?: AxiosInstance;
	/**
	 * Upload progress (XHR-backed). **axios-exclusive feature** — the `fetch`
	 * and `ky` transports cannot surface this event.
	 */
	onUploadProgress?: (e: AxiosProgressEvent) => void;
	/**
	 * Download progress (XHR-backed). Same caveats as `onUploadProgress`.
	 */
	onDownloadProgress?: (e: AxiosProgressEvent) => void;
	/** Node-only: custom `http.Agent`. Passed through to axios. */
	httpAgent?: unknown;
	/** Node-only: custom `https.Agent`. Passed through to axios. */
	httpsAgent?: unknown;
};

function headersToObject(h: Headers): Record<string, string> {
	const out: Record<string, string> = {};
	h.forEach((v, k) => {
		out[k] = v;
	});
	return out;
}

function axiosHeadersToFetch(raw: unknown): Headers {
	const out = new Headers();
	if (!raw || typeof raw !== "object") return out;
	for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
		if (typeof v === "string") out.set(k, v);
		else if (typeof v === "number" || typeof v === "boolean")
			out.set(k, String(v));
		else if (Array.isArray(v)) out.set(k, v.map(String).join(", "));
	}
	return out;
}

function normalizeBody(data: unknown): TransportResponse["body"] {
	if (data == null) return null;
	if (typeof data === "string") return data.length === 0 ? null : data;
	if (data instanceof ArrayBuffer) return data.byteLength === 0 ? null : data;
	if (ArrayBuffer.isView(data)) {
		const view = data as ArrayBufferView;
		if (view.byteLength === 0) return null;
		const copy = new ArrayBuffer(view.byteLength);
		new Uint8Array(copy).set(
			new Uint8Array(view.buffer, view.byteOffset, view.byteLength),
		);
		return copy;
	}
	// Structured object (axios auto-parsed JSON in an older config, or Buffer on Node).
	try {
		return JSON.stringify(data);
	} catch {
		return null;
	}
}

/**
 * Transport implementation backed by [axios](https://github.com/axios/axios).
 *
 * Primary reason to pick this over `fetchTransport` / `kyTransport`:
 * **`onUploadProgress` / `onDownloadProgress`** — `fetch`/`ky` cannot surface
 * XHR progress events. Everything else (retry / timeout / headers / abort /
 * body decoding) is still owned by the core pipeline, so axios interceptors
 * are **not** used and should be avoided by consumers.
 */
export function axiosTransport(options: AxiosTransportOptions = {}): Transport {
	const client: AxiosInstance = options.axios ?? axios.create();

	return async (req: TransportRequest): Promise<TransportResponse> => {
		const config: AxiosRequestConfig = {
			url: req.url,
			method: req.method,
			headers: headersToObject(req.headers),
			responseType: "arraybuffer",
			// Core pipeline owns errorMap; we must not throw on HTTP errors.
			validateStatus: () => true,
			// Core pipeline owns timeout via AbortSignal; disable axios' own timer.
			timeout: 0,
			// Pass body as-is. Core already serialized JSON; Buffer / FormData /
			// string / URLSearchParams all flow through.
			transformRequest: [(data) => data],
		};
		if (req.body != null) config.data = req.body;
		if (req.signal) config.signal = req.signal;
		if (req.credentials === "include") config.withCredentials = true;
		if (req.credentials === "omit") config.withCredentials = false;
		if (options.onUploadProgress)
			config.onUploadProgress = options.onUploadProgress;
		if (options.onDownloadProgress)
			config.onDownloadProgress = options.onDownloadProgress;
		if (options.httpAgent !== undefined)
			(config as Record<string, unknown>).httpAgent = options.httpAgent;
		if (options.httpsAgent !== undefined)
			(config as Record<string, unknown>).httpsAgent = options.httpsAgent;

		try {
			const res = await client.request(config);
			return {
				status: res.status,
				headers: axiosHeadersToFetch(res.headers),
				body: normalizeBody(res.data),
			};
		} catch (e) {
			const err = e as AxiosError;
			// Translate axios' cancel errors into DOM-style AbortError so the
			// core pipeline classifies them as canceled / timeout correctly.
			if (axios.isCancel(e) || err.code === "ERR_CANCELED") {
				const ae = new Error(err.message ?? "aborted");
				ae.name = "AbortError";
				throw ae;
			}
			throw e;
		}
	};
}
