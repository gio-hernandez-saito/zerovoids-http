import type { AxiosInstance, AxiosRequestConfig } from "axios";
import { describe, expect, it, vi } from "vitest";
import { axiosTransport } from "../index.js";

type Handler = (config: AxiosRequestConfig) => Promise<{
	status: number;
	data: unknown;
	headers?: Record<string, string>;
}>;

function fakeAxios(handler: Handler): AxiosInstance {
	const request = (config: AxiosRequestConfig) =>
		handler(config).then((r) => ({
			data: r.data,
			status: r.status,
			statusText: "",
			headers: r.headers ?? {},
			config,
		}));
	// biome-ignore lint/suspicious/noExplicitAny: test shim
	return { request } as any;
}

describe("axiosTransport — request mapping", () => {
	it("passes method / url / headers and returns mapped response", async () => {
		let received: AxiosRequestConfig | undefined;
		const ax = fakeAxios(async (cfg) => {
			received = cfg;
			const bytes = new TextEncoder().encode('{"ok":true}').buffer;
			return {
				status: 200,
				data: bytes,
				headers: { "content-type": "application/json" },
			};
		});
		const t = axiosTransport({ axios: ax });
		const res = await t({
			url: "https://x/g",
			method: "GET",
			headers: new Headers({ "x-k": "v" }),
		});
		expect(received?.method).toBe("GET");
		expect(received?.url).toBe("https://x/g");
		expect((received?.headers as Record<string, string>)?.["x-k"]).toBe("v");
		expect(received?.responseType).toBe("arraybuffer");
		expect(received?.validateStatus?.(500)).toBe(true);
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toBe("application/json");
		expect(res.body).toBeInstanceOf(ArrayBuffer);
	});

	it("forwards body unchanged (no axios transformRequest re-serialization)", async () => {
		let receivedData: unknown;
		const ax = fakeAxios(async (cfg) => {
			// Simulate axios applying user's transformRequest.
			const fns = cfg.transformRequest;
			let data: unknown = cfg.data;
			if (Array.isArray(fns)) {
				for (const fn of fns) {
					data = fn(data, (cfg.headers ?? {}) as never);
				}
			}
			receivedData = data;
			return { status: 204, data: null };
		});
		const t = axiosTransport({ axios: ax });
		const raw = '{"n":7}';
		await t({
			url: "https://x/p",
			method: "POST",
			headers: new Headers({ "content-type": "application/json" }),
			body: raw,
		});
		expect(receivedData).toBe(raw);
	});

	it("maps credentials → withCredentials", async () => {
		let include: unknown;
		let omit: unknown;
		const ax = fakeAxios(async (cfg) => {
			if (cfg.url?.endsWith("/i")) include = cfg.withCredentials;
			if (cfg.url?.endsWith("/o")) omit = cfg.withCredentials;
			return { status: 204, data: null };
		});
		const t = axiosTransport({ axios: ax });
		await t({
			url: "https://x/i",
			method: "GET",
			headers: new Headers(),
			credentials: "include",
		});
		await t({
			url: "https://x/o",
			method: "GET",
			headers: new Headers(),
			credentials: "omit",
		});
		expect(include).toBe(true);
		expect(omit).toBe(false);
	});

	it("wires progress callbacks through", async () => {
		const up = vi.fn();
		const down = vi.fn();
		let capturedUp: unknown;
		let capturedDown: unknown;
		const ax = fakeAxios(async (cfg) => {
			capturedUp = cfg.onUploadProgress;
			capturedDown = cfg.onDownloadProgress;
			return { status: 204, data: null };
		});
		const t = axiosTransport({
			axios: ax,
			onUploadProgress: up,
			onDownloadProgress: down,
		});
		await t({ url: "https://x/f", method: "POST", headers: new Headers() });
		expect(capturedUp).toBe(up);
		expect(capturedDown).toBe(down);
	});

	it("passes through http(s)Agent options", async () => {
		const fakeAgent = { id: "agent" };
		let seenHttp: unknown;
		let seenHttps: unknown;
		const ax = fakeAxios(async (cfg) => {
			seenHttp = (cfg as Record<string, unknown>).httpAgent;
			seenHttps = (cfg as Record<string, unknown>).httpsAgent;
			return { status: 204, data: null };
		});
		const t = axiosTransport({
			axios: ax,
			httpAgent: fakeAgent,
			httpsAgent: fakeAgent,
		});
		await t({ url: "https://x/g", method: "GET", headers: new Headers() });
		expect(seenHttp).toBe(fakeAgent);
		expect(seenHttps).toBe(fakeAgent);
	});
});

describe("axiosTransport — abort / cancel", () => {
	it("rethrows ERR_CANCELED as AbortError so pipeline classifies canceled", async () => {
		const ax = fakeAxios(async () => {
			const e = new Error("canceled") as Error & { code?: string };
			e.code = "ERR_CANCELED";
			throw e;
		});
		const t = axiosTransport({ axios: ax });
		await expect(
			t({ url: "https://x/g", method: "GET", headers: new Headers() }),
		).rejects.toMatchObject({ name: "AbortError" });
	});

	it("propagates signal to axios config", async () => {
		const ctrl = new AbortController();
		let seen: AbortSignal | undefined;
		const ax = fakeAxios(async (cfg) => {
			seen = cfg.signal as AbortSignal;
			return { status: 204, data: null };
		});
		const t = axiosTransport({ axios: ax });
		await t({
			url: "https://x/g",
			method: "GET",
			headers: new Headers(),
			signal: ctrl.signal,
		});
		expect(seen).toBe(ctrl.signal);
	});
});

describe("axiosTransport — response body mapping", () => {
	it("empty ArrayBuffer → null body", async () => {
		const ax = fakeAxios(async () => ({
			status: 200,
			data: new ArrayBuffer(0),
		}));
		const t = axiosTransport({ axios: ax });
		const res = await t({
			url: "https://x/g",
			method: "GET",
			headers: new Headers(),
		});
		expect(res.body).toBeNull();
	});

	it("string data passes through", async () => {
		const ax = fakeAxios(async () => ({ status: 200, data: "hello" }));
		const t = axiosTransport({ axios: ax });
		const res = await t({
			url: "https://x/g",
			method: "GET",
			headers: new Headers(),
		});
		expect(res.body).toBe("hello");
	});

	it("typed array data is normalized to ArrayBuffer", async () => {
		const view = new Uint8Array([1, 2, 3]);
		const ax = fakeAxios(async () => ({ status: 200, data: view }));
		const t = axiosTransport({ axios: ax });
		const res = await t({
			url: "https://x/g",
			method: "GET",
			headers: new Headers(),
		});
		expect(res.body).toBeInstanceOf(ArrayBuffer);
		expect((res.body as ArrayBuffer).byteLength).toBe(3);
	});
});
