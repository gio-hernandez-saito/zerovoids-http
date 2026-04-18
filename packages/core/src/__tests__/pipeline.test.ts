import { describe, expect, it, vi } from "vitest";
import {
	type Transport,
	type TransportRequest,
	type TransportResponse,
	createClient,
	defineAdapter,
	defineEndpoint,
	definePlugin,
	isAuth,
	isClientError,
	isServerError,
	typedOutput,
	unwrap,
} from "../index.js";

function mockTransport(
	handler: (
		req: TransportRequest,
	) => TransportResponse | Promise<TransportResponse>,
): Transport {
	return async (req) => handler(req);
}

describe("pipeline — happy path", () => {
	it("GET 200 returns data", async () => {
		const transport = mockTransport((_req) => ({
			status: 200,
			headers: new Headers({ "content-type": "application/json" }),
			body: JSON.stringify({ id: 1, name: "ok" }),
		}));

		const svc = defineAdapter({
			baseURL: "https://x",
			endpoints: {
				get: defineEndpoint({
					method: "GET",
					path: "/users/:id",
					output: typedOutput<{ id: number; name: string }>(),
				}),
			},
		});
		const api = createClient({ adapters: { svc }, transport });

		const { data, error } = await api.svc.get({ params: { id: 1 } });
		expect(error).toBeNull();
		expect(data).toEqual({ id: 1, name: "ok" });
	});

	it("substitutes path params and encodes specials", async () => {
		const seen: string[] = [];
		const transport = mockTransport((req) => {
			seen.push(req.url);
			return {
				status: 200,
				headers: new Headers({ "content-type": "application/json" }),
				body: "null",
			};
		});
		const svc = defineAdapter({
			baseURL: "https://x",
			endpoints: {
				get: defineEndpoint({ method: "GET", path: "/repos/:owner/:repo" }),
			},
		});
		const api = createClient({ adapters: { svc }, transport });
		await api.svc.get({ params: { owner: "octo cat", repo: "hello" } });
		expect(seen[0]).toBe("https://x/repos/octo%20cat/hello");
	});

	it("serializes JSON body with content-type", async () => {
		const seen: Array<{ body: unknown; ct: string | null }> = [];
		const transport = mockTransport((req) => {
			seen.push({
				body: req.body,
				ct: (req.headers as Headers).get("content-type"),
			});
			return {
				status: 200,
				headers: new Headers({ "content-type": "application/json" }),
				body: '{"ok":true}',
			};
		});
		const svc = defineAdapter({
			baseURL: "https://x",
			endpoints: {
				create: defineEndpoint({
					method: "POST",
					path: "/users",
					body: typedOutput<{ name: string }>(),
				}),
			},
		});
		const api = createClient({ adapters: { svc }, transport });
		await api.svc.create({ body: { name: "alice" } });
		expect(seen[0]?.body).toBe('{"name":"alice"}');
		expect(seen[0]?.ct).toBe("application/json");
	});
});

describe("pipeline — errors", () => {
	it("404 → NormalizedError via defaultErrorMap", async () => {
		const transport = mockTransport(() => ({
			status: 404,
			headers: new Headers(),
			body: null,
		}));
		const svc = defineAdapter({
			baseURL: "https://x",
			endpoints: { get: defineEndpoint({ method: "GET", path: "/x" }) },
		});
		const api = createClient({ adapters: { svc }, transport });
		const { data, error } = await api.svc.get();
		expect(data).toBeNull();
		expect(error?.kind).toBe("http");
		expect(error?.code).toBe("HTTP_404");
		expect(error?.httpStatus).toBe(404);
		if (!error) throw new Error("expected error");
		expect(isClientError(error)).toBe(true);
	});

	it("custom errorMap maps to domain code", async () => {
		const transport = mockTransport(() => ({
			status: 402,
			headers: new Headers({ "content-type": "application/json" }),
			body: JSON.stringify({ error: { code: "CARD_DECLINED" } }),
		}));
		const stripe = defineAdapter({
			baseURL: "https://x",
			errorMap: (raw, ctx) => ({
				kind: "domain",
				code: (raw as { error?: { code?: string } })?.error?.code ?? "UNKNOWN",
				httpStatus: ctx.httpStatus,
				retryable: false,
				cause: raw,
				trace: ctx.trace,
			}),
			endpoints: { pay: defineEndpoint({ method: "POST", path: "/charges" }) },
		} as const);
		const api = createClient({ adapters: { stripe }, transport });
		const { error } = await api.stripe.pay();
		expect(error?.kind).toBe("domain");
		expect(error?.code).toBe("CARD_DECLINED");
	});

	it("401 is surfaced and isAuth() detects it", async () => {
		const transport = mockTransport(() => ({
			status: 401,
			headers: new Headers(),
			body: null,
		}));
		const svc = defineAdapter({
			baseURL: "https://x",
			endpoints: { me: defineEndpoint({ method: "GET", path: "/me" }) },
		});
		const api = createClient({ adapters: { svc }, transport });
		const { error } = await api.svc.me();
		if (!error) throw new Error("expected error");
		expect(isAuth(error)).toBe(true);
	});

	it("500 retryable marker + isServerError", async () => {
		const transport = mockTransport(() => ({
			status: 500,
			headers: new Headers(),
			body: null,
		}));
		const svc = defineAdapter({
			baseURL: "https://x",
			endpoints: { boom: defineEndpoint({ method: "GET", path: "/boom" }) },
		});
		const api = createClient({ adapters: { svc }, transport });
		const { error } = await api.svc.boom();
		if (!error) throw new Error("expected error");
		expect(isServerError(error)).toBe(true);
		expect(error.retryable).toBe(true);
	});

	it("network failure → kind: network", async () => {
		const transport: Transport = async () => {
			throw new Error("econnrefused");
		};
		const svc = defineAdapter({
			baseURL: "https://x",
			endpoints: { g: defineEndpoint({ method: "GET", path: "/g" }) },
		});
		const api = createClient({ adapters: { svc }, transport });
		const { error } = await api.svc.g();
		expect(error?.kind).toBe("network");
	});

	it("output schema mismatch → kind: validation", async () => {
		const transport = mockTransport(() => ({
			status: 200,
			headers: new Headers({ "content-type": "application/json" }),
			body: JSON.stringify({ wrong: true }),
		}));
		const svc = defineAdapter({
			baseURL: "https://x",
			endpoints: {
				get: defineEndpoint({
					method: "GET",
					path: "/x",
					output: {
						"~standard": {
							version: 1,
							vendor: "test",
							validate: () => ({
								issues: [{ message: "bad shape" }],
							}),
						},
					},
				}),
			},
		});
		const api = createClient({ adapters: { svc }, transport });
		const { error } = await api.svc.get();
		expect(error?.kind).toBe("validation");
		expect(error?.code).toBe("RESPONSE_INVALID");
	});
});

describe("pipeline — retry", () => {
	it("retries on 500 then succeeds", async () => {
		let calls = 0;
		const transport = mockTransport(() => {
			calls++;
			if (calls < 3) {
				return {
					status: 500,
					headers: new Headers(),
					body: null,
				};
			}
			return {
				status: 200,
				headers: new Headers({ "content-type": "application/json" }),
				body: JSON.stringify({ ok: true }),
			};
		});
		const svc = defineAdapter({
			baseURL: "https://x",
			endpoints: { g: defineEndpoint({ method: "GET", path: "/g" }) },
		});
		const api = createClient({
			adapters: { svc },
			transport,
			retry: { type: "linear", attempts: 3, delay: 1 },
		});
		const { data, error } = await api.svc.g();
		expect(error).toBeNull();
		expect(data).toEqual({ ok: true });
		expect(calls).toBe(3);
	});

	it("exhausts retries → returns last error", async () => {
		let calls = 0;
		const transport = mockTransport(() => {
			calls++;
			return { status: 503, headers: new Headers(), body: null };
		});
		const svc = defineAdapter({
			baseURL: "https://x",
			endpoints: { g: defineEndpoint({ method: "GET", path: "/g" }) },
		});
		const api = createClient({
			adapters: { svc },
			transport,
			retry: { type: "linear", attempts: 2, delay: 1 },
		});
		const { error } = await api.svc.g();
		expect(error?.httpStatus).toBe(503);
		expect(calls).toBe(2);
	});

	it("400 is not retried", async () => {
		let calls = 0;
		const transport = mockTransport(() => {
			calls++;
			return { status: 400, headers: new Headers(), body: null };
		});
		const svc = defineAdapter({
			baseURL: "https://x",
			endpoints: { g: defineEndpoint({ method: "GET", path: "/g" }) },
		});
		const api = createClient({
			adapters: { svc },
			transport,
			retry: { type: "linear", attempts: 3, delay: 1 },
		});
		await api.svc.g();
		expect(calls).toBe(1);
	});
});

describe("pipeline — signal / timeout", () => {
	it("user abort → kind: canceled", async () => {
		const ctrl = new AbortController();
		const transport: Transport = async (req) =>
			new Promise((_resolve, reject) => {
				req.signal?.addEventListener("abort", () => {
					const e = new Error("aborted");
					e.name = "AbortError";
					reject(e);
				});
			});
		const svc = defineAdapter({
			baseURL: "https://x",
			endpoints: { g: defineEndpoint({ method: "GET", path: "/g" }) },
		});
		const api = createClient({ adapters: { svc }, transport });
		setTimeout(() => ctrl.abort(), 10);
		const { error } = await api.svc.g(undefined, { signal: ctrl.signal });
		expect(error?.kind).toBe("canceled");
	});

	it("timeout → kind: timeout", async () => {
		const transport: Transport = async (req) =>
			new Promise((_resolve, reject) => {
				req.signal?.addEventListener("abort", () => {
					const e = new Error("timeout");
					e.name = "AbortError";
					reject(e);
				});
			});
		const svc = defineAdapter({
			baseURL: "https://x",
			endpoints: { g: defineEndpoint({ method: "GET", path: "/g" }) },
		});
		const api = createClient({ adapters: { svc }, transport });
		const { error } = await api.svc.g(undefined, { timeout: 5 });
		expect(error?.kind).toBe("timeout");
	});
});

describe("pipeline — plugins", () => {
	it("init rewrites URL", async () => {
		const seen: string[] = [];
		const transport = mockTransport((req) => {
			seen.push(req.url);
			return { status: 200, headers: new Headers(), body: null };
		});
		const rewrite = definePlugin({
			id: "rewrite",
			init: async (url, options) => ({
				url: url.replace("api.example.com", "localhost:3000"),
				options,
			}),
		});
		const svc = defineAdapter({
			baseURL: "https://api.example.com",
			endpoints: { g: defineEndpoint({ method: "GET", path: "/x" }) },
		});
		const api = createClient({
			adapters: { svc },
			transport,
			plugins: [rewrite],
		});
		await api.svc.g();
		expect(seen[0]).toBe("https://localhost:3000/x");
	});

	it("onRequest / onResponse / onSuccess invoked in order", async () => {
		const calls: string[] = [];
		const transport = mockTransport(() => ({
			status: 200,
			headers: new Headers(),
			body: null,
		}));
		const p = definePlugin({
			id: "trace",
			hooks: {
				onRequest: (ctx) => {
					calls.push("req");
					return ctx;
				},
				onResponse: (ctx) => {
					calls.push("res");
					return ctx;
				},
				onSuccess: (ctx) => {
					calls.push("ok");
					return ctx;
				},
			},
		});
		const svc = defineAdapter({
			baseURL: "https://x",
			endpoints: { g: defineEndpoint({ method: "GET", path: "/g" }) },
		});
		const api = createClient({ adapters: { svc }, transport, plugins: [p] });
		await api.svc.g();
		expect(calls).toEqual(["req", "res", "ok"]);
	});

	it("onError invoked for non-2xx", async () => {
		const onError = vi.fn();
		const transport = mockTransport(() => ({
			status: 500,
			headers: new Headers(),
			body: null,
		}));
		const p = definePlugin({ id: "err", hooks: { onError } });
		const svc = defineAdapter({
			baseURL: "https://x",
			endpoints: { g: defineEndpoint({ method: "GET", path: "/g" }) },
		});
		const api = createClient({ adapters: { svc }, transport, plugins: [p] });
		await api.svc.g();
		expect(onError).toHaveBeenCalledOnce();
	});

	it("duplicate plugin ids throw", () => {
		const svc = defineAdapter({
			baseURL: "https://x",
			endpoints: { g: defineEndpoint({ method: "GET", path: "/g" }) },
		});
		expect(() =>
			createClient({
				adapters: { svc },
				plugins: [definePlugin({ id: "dup" }), definePlugin({ id: "dup" })],
			}),
		).toThrow(/duplicate plugin id/);
	});

	it("hook errors are isolated and do not break pipeline", async () => {
		const transport = mockTransport(() => ({
			status: 200,
			headers: new Headers({ "content-type": "application/json" }),
			body: '"ok"',
		}));
		const bad = definePlugin({
			id: "bad",
			hooks: {
				onRequest: () => {
					throw new Error("boom");
				},
			},
		});
		const svc = defineAdapter({
			baseURL: "https://x",
			endpoints: { g: defineEndpoint({ method: "GET", path: "/g" }) },
		});
		const api = createClient({
			adapters: { svc },
			transport,
			plugins: [bad],
		});
		const { data, error } = await api.svc.g();
		expect(error).toBeNull();
		expect(data).toBe("ok");
	});
});

describe("pipeline — header merging + unwrap", () => {
	it("per-call headers override adapter defaults", async () => {
		let seenAuth: string | null = null;
		const transport = mockTransport((req) => {
			seenAuth = (req.headers as Headers).get("authorization");
			return { status: 200, headers: new Headers(), body: null };
		});
		const svc = defineAdapter({
			baseURL: "https://x",
			defaultHeaders: { authorization: "Bearer default" },
			endpoints: { g: defineEndpoint({ method: "GET", path: "/g" }) },
		});
		const api = createClient({ adapters: { svc }, transport });
		await api.svc.g(undefined, {
			headers: { authorization: "Bearer override" },
		});
		expect(seenAuth).toBe("Bearer override");
	});

	it("unwrap throws on error, returns data on success", async () => {
		const transport = mockTransport((req) =>
			req.url.endsWith("/ok")
				? {
						status: 200,
						headers: new Headers({ "content-type": "application/json" }),
						body: '{"n":7}',
					}
				: { status: 500, headers: new Headers(), body: null },
		);
		const svc = defineAdapter({
			baseURL: "https://x",
			endpoints: {
				ok: defineEndpoint({
					method: "GET",
					path: "/ok",
					output: typedOutput<{ n: number }>(),
				}),
				boom: defineEndpoint({ method: "GET", path: "/boom" }),
			},
		});
		const api = createClient({ adapters: { svc }, transport });
		await expect(unwrap(api.svc.ok())).resolves.toEqual({ n: 7 });
		await expect(unwrap(api.svc.boom())).rejects.toHaveProperty("kind", "http");
	});
});
