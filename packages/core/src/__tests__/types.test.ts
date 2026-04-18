import { expectTypeOf } from "expect-type";
import { describe, it } from "vitest";
import {
	type CallOptions,
	type Client,
	type ExtractPathParams,
	type NormalizedError,
	type Result,
	createClient,
	defineAdapter,
	defineEndpoint,
	typedOutput,
} from "../index.js";

describe("ExtractPathParams (type-level)", () => {
	it("extracts single :param", () => {
		expectTypeOf<ExtractPathParams<"/users/:id">>().toEqualTypeOf<{
			id: string | number;
		}>();
	});

	it("extracts multiple :params", () => {
		expectTypeOf<ExtractPathParams<"/repos/:owner/:repo">>().toEqualTypeOf<
			{ owner: string | number } & { repo: string | number }
		>();
	});

	it("returns empty record for paths without :params", () => {
		expectTypeOf<ExtractPathParams<"/users">>().toEqualTypeOf<
			Record<string, never>
		>();
	});
});

describe("Client inference", () => {
	it("call signature requires params derived from path", () => {
		const github = defineAdapter({
			baseURL: "https://api.github.com",
			endpoints: {
				getRepo: defineEndpoint({
					method: "GET",
					path: "/repos/:owner/:repo",
					output: typedOutput<{ id: number; full_name: string }>(),
				}),
			},
		});
		const api = createClient({ adapters: { github } });

		expectTypeOf(api.github.getRepo).parameter(0).toMatchTypeOf<{
			params: { owner: string | number; repo: string | number };
		}>();

		expectTypeOf(api.github.getRepo)
			.parameter(1)
			.toEqualTypeOf<CallOptions | undefined>();

		expectTypeOf(api.github.getRepo).returns.resolves.toEqualTypeOf<
			Result<{ id: number; full_name: string }>
		>();
	});

	it("endpoints without :params allow omitted input", () => {
		const svc = defineAdapter({
			baseURL: "https://x",
			endpoints: {
				list: defineEndpoint({
					method: "GET",
					path: "/items",
					output: typedOutput<Array<{ id: number }>>(),
				}),
			},
		});
		const api = createClient({ adapters: { svc } });

		// Must accept zero args
		expectTypeOf(api.svc.list).toBeCallableWith();
		expectTypeOf(api.svc.list).returns.resolves.toEqualTypeOf<
			Result<Array<{ id: number }>>
		>();
	});

	it("Result is discriminated by error null / NormalizedError", () => {
		expectTypeOf<Result<number>>().toEqualTypeOf<
			{ data: number; error: null } | { data: null; error: NormalizedError }
		>();
	});

	it("Client type is buildable from multiple adapters", () => {
		const a = defineAdapter({
			baseURL: "https://a",
			endpoints: { ping: defineEndpoint({ method: "GET", path: "/p" }) },
		});
		const b = defineAdapter({
			baseURL: "https://b",
			endpoints: { ping: defineEndpoint({ method: "GET", path: "/p" }) },
		});
		expectTypeOf<Client<{ a: typeof a; b: typeof b }>>().toHaveProperty("a");
		expectTypeOf<Client<{ a: typeof a; b: typeof b }>>().toHaveProperty("b");
	});
});
