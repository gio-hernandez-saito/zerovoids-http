import { describe, expect, it } from "vitest";
import {
	type Transport,
	createClient,
	defineAdapter,
	defineEndpoint,
	idempotencyKey,
	typedOutput,
} from "../index.js";

function seen(): {
	transport: Transport;
	last: () => Headers | undefined;
} {
	let last: Headers | undefined;
	const transport: Transport = async (req) => {
		last = req.headers as Headers;
		return { status: 200, headers: new Headers(), body: null };
	};
	return { transport, last: () => last };
}

describe("idempotencyKey plugin", () => {
	it("injects Idempotency-Key on POST", async () => {
		const { transport, last } = seen();
		const svc = defineAdapter({
			baseURL: "https://x",
			endpoints: {
				create: defineEndpoint({
					method: "POST",
					path: "/p",
					body: typedOutput<{ n: number }>(),
				}),
			},
		});
		const api = createClient({
			adapters: { svc },
			transport,
			plugins: [idempotencyKey()],
		});
		await api.svc.create({ body: { n: 1 } });
		const key = last()?.get("idempotency-key");
		expect(key).toBeTruthy();
		expect(key).toMatch(/.+/);
	});

	it("does not overwrite caller-supplied header", async () => {
		const { transport, last } = seen();
		const svc = defineAdapter({
			baseURL: "https://x",
			endpoints: {
				create: defineEndpoint({
					method: "POST",
					path: "/p",
					body: typedOutput<{ n: number }>(),
				}),
			},
		});
		const api = createClient({
			adapters: { svc },
			transport,
			plugins: [idempotencyKey()],
		});
		await api.svc.create(
			{ body: { n: 1 } },
			{ headers: { "idempotency-key": "user-supplied" } },
		);
		expect(last()?.get("idempotency-key")).toBe("user-supplied");
	});

	it("skips GET requests", async () => {
		const { transport, last } = seen();
		const svc = defineAdapter({
			baseURL: "https://x",
			endpoints: { get: defineEndpoint({ method: "GET", path: "/g" }) },
		});
		const api = createClient({
			adapters: { svc },
			transport,
			plugins: [idempotencyKey()],
		});
		await api.svc.get();
		expect(last()?.has("idempotency-key")).toBe(false);
	});

	it("honors custom methods + header name + generator", async () => {
		const { transport, last } = seen();
		const svc = defineAdapter({
			baseURL: "https://x",
			endpoints: { del: defineEndpoint({ method: "DELETE", path: "/d" }) },
		});
		const api = createClient({
			adapters: { svc },
			transport,
			plugins: [
				idempotencyKey({
					methods: ["DELETE"],
					header: "X-Request-Id",
					generate: () => "fixed-abc",
				}),
			],
		});
		await api.svc.del();
		expect(last()?.get("x-request-id")).toBe("fixed-abc");
	});
});

describe("SSR credentials / mode / cache", () => {
	it("adapter defaults are passed to transport", async () => {
		let seen: {
			credentials?: RequestCredentials;
			mode?: RequestMode;
			cache?: RequestCache;
		} = {};
		const transport: Transport = async (req) => {
			seen = {
				credentials: req.credentials,
				mode: req.mode,
				cache: req.cache,
			};
			return { status: 200, headers: new Headers(), body: null };
		};
		const svc = defineAdapter({
			baseURL: "https://x",
			credentials: "include",
			mode: "cors",
			cache: "no-store",
			endpoints: { g: defineEndpoint({ method: "GET", path: "/g" }) },
		});
		const api = createClient({ adapters: { svc }, transport });
		await api.svc.g();
		expect(seen).toEqual({
			credentials: "include",
			mode: "cors",
			cache: "no-store",
		});
	});

	it("per-call options override adapter defaults", async () => {
		let seen: RequestCredentials | undefined;
		const transport: Transport = async (req) => {
			seen = req.credentials;
			return { status: 200, headers: new Headers(), body: null };
		};
		const svc = defineAdapter({
			baseURL: "https://x",
			credentials: "same-origin",
			endpoints: { g: defineEndpoint({ method: "GET", path: "/g" }) },
		});
		const api = createClient({ adapters: { svc }, transport });
		await api.svc.g(undefined, { credentials: "omit" });
		expect(seen).toBe("omit");
	});
});
