import {
	createClient,
	defineAdapter,
	defineEndpoint,
	typedOutput,
} from "@zerovoids/http";
import { describe, expect, it, vi } from "vitest";
import {
	canonicalize,
	createSwrHooks,
	makeExecutor,
	swrKeyFor,
} from "../index.js";

describe("canonicalize", () => {
	it("sorts object keys deterministically", () => {
		const a = canonicalize({ b: 2, a: 1 });
		const b = canonicalize({ a: 1, b: 2 });
		expect(JSON.stringify(a)).toBe(JSON.stringify(b));
	});

	it("recurses into nested objects and preserves array order", () => {
		const v = canonicalize({ z: [{ b: 2, a: 1 }], a: { y: 1, x: 2 } });
		expect(JSON.stringify(v)).toBe(
			JSON.stringify({ a: { x: 2, y: 1 }, z: [{ a: 1, b: 2 }] }),
		);
	});

	it("passes primitives through", () => {
		expect(canonicalize(5)).toBe(5);
		expect(canonicalize("x")).toBe("x");
		expect(canonicalize(null)).toBeNull();
	});
});

describe("swrKeyFor", () => {
	it("two segments for no input", () => {
		expect(swrKeyFor("gh", "repos")).toEqual(["gh", "repos"]);
	});

	it("three segments with canonical input", () => {
		const k1 = swrKeyFor("gh", "repos", { b: 2, a: 1 });
		const k2 = swrKeyFor("gh", "repos", { a: 1, b: 2 });
		expect(k1).toEqual(k2);
	});

	it("matches react-query queryKeyFor shape (string tuple)", () => {
		expect(swrKeyFor("a", "b", { n: 1 })).toEqual(["a", "b", { n: 1 }]);
	});
});

describe("makeExecutor", () => {
	it("returns data on success branch", async () => {
		const fn = vi.fn(async (_: unknown) => ({ data: { ok: 1 }, error: null }));
		const exec = makeExecutor(fn);
		await expect(exec({ q: 1 })).resolves.toEqual({ ok: 1 });
		expect(fn).toHaveBeenCalledWith({ q: 1 });
	});

	it("throws NormalizedError on error branch", async () => {
		const err = { kind: "http", code: "HTTP_500" };
		const fn = vi.fn(async () => ({ data: null, error: err }));
		const exec = makeExecutor(fn);
		await expect(exec()).rejects.toBe(err);
	});
});

describe("createSwrHooks", () => {
	const transport = async () => ({
		status: 200,
		headers: new Headers({ "content-type": "application/json" }),
		body: JSON.stringify({ id: 1 }),
	});

	it("mirrors client shape with hook methods on every endpoint", () => {
		const svc = defineAdapter({
			baseURL: "https://x",
			endpoints: {
				get: defineEndpoint({
					method: "GET",
					path: "/x",
					output: typedOutput<{ id: number }>(),
				}),
				create: defineEndpoint({ method: "POST", path: "/x" }),
			},
		});
		const api = createClient({ adapters: { svc }, transport });
		const hooks = createSwrHooks(api);

		expect(typeof hooks.svc.get.useSWR).toBe("function");
		expect(typeof hooks.svc.get.useSWRInfinite).toBe("function");
		expect(typeof hooks.svc.get.key).toBe("function");
		expect(typeof hooks.svc.create.useSWR).toBe("function");
		expect(hooks.svc.get.key({ params: { id: 1 } })).toEqual([
			"svc",
			"get",
			{ params: { id: 1 } },
		]);
	});

	it("keys are shared with react-query adapter (cross-lib cache compatibility)", () => {
		const svc = defineAdapter({
			baseURL: "https://x",
			endpoints: { g: defineEndpoint({ method: "GET", path: "/g" }) },
		});
		const api = createClient({ adapters: { svc }, transport });
		const hooks = createSwrHooks(api);
		expect(hooks.svc.g.key({ q: { x: 1 } })).toEqual([
			"svc",
			"g",
			{ q: { x: 1 } },
		]);
	});
});
