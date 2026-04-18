import { QueryClient } from "@tanstack/react-query";
import {
	createClient,
	defineAdapter,
	defineEndpoint,
	typedOutput,
} from "@zerovoids/http";
import { describe, expect, it, vi } from "vitest";
import {
	canonicalize,
	createQueryHooks,
	invalidate,
	makeExecutor,
	queryKeyFor,
} from "../index.js";

describe("canonicalize", () => {
	it("sorts object keys deterministically", () => {
		const a = canonicalize({ b: 2, a: 1 });
		const b = canonicalize({ a: 1, b: 2 });
		expect(JSON.stringify(a)).toBe(JSON.stringify(b));
	});

	it("recurses into nested objects and preserves array order", () => {
		const v = canonicalize({
			z: [{ b: 2, a: 1 }],
			a: { y: 1, x: 2 },
		});
		expect(JSON.stringify(v)).toBe(
			JSON.stringify({ a: { x: 2, y: 1 }, z: [{ a: 1, b: 2 }] }),
		);
	});
});

describe("queryKeyFor", () => {
	it("two segments for no input", () => {
		expect(queryKeyFor("gh", "getRepo")).toEqual(["gh", "getRepo"]);
	});

	it("three segments with canonical input", () => {
		const k1 = queryKeyFor("gh", "getRepo", { b: 2, a: 1 });
		const k2 = queryKeyFor("gh", "getRepo", { a: 1, b: 2 });
		expect(k1).toEqual(k2);
	});
});

describe("invalidate", () => {
	it("delegates to queryClient.invalidateQueries with the key", async () => {
		const qc = new QueryClient();
		const spy = vi.spyOn(qc, "invalidateQueries");
		await invalidate(qc, ["gh", "getRepo"] as const);
		expect(spy).toHaveBeenCalledWith({ queryKey: ["gh", "getRepo"] });
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

describe("createQueryHooks", () => {
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
		const hooks = createQueryHooks(api);

		expect(typeof hooks.svc.get.useQuery).toBe("function");
		expect(typeof hooks.svc.get.useSuspenseQuery).toBe("function");
		expect(typeof hooks.svc.get.useInfiniteQuery).toBe("function");
		expect(typeof hooks.svc.get.useSuspenseInfiniteQuery).toBe("function");
		expect(typeof hooks.svc.get.useMutation).toBe("function");
		expect(typeof hooks.svc.get.queryKey).toBe("function");
		expect(typeof hooks.svc.create.useMutation).toBe("function");
		expect(typeof hooks.svc.create.useSuspenseQuery).toBe("function");
		expect(hooks.svc.get.queryKey({ params: { id: 1 } })).toEqual([
			"svc",
			"get",
			{ params: { id: 1 } },
		]);
	});
});
