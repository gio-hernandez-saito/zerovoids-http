import { describe, expect, it } from "vitest";
import {
	NormalizedError,
	computeBackoffMs,
	createNormalizedError,
	defineAdapter,
	defineEndpoint,
	definePlugin,
	exhaustiveGuard,
	isKind,
	isNormalizedError,
	maxAttempts,
	parseRetryAfter,
	typedOutput,
	unwrap,
} from "../index.js";

describe("public API surface", () => {
	it("exports 4 define* helpers + createClient + unwrap", async () => {
		const { createClient } = await import("../index.js");
		expect(typeof createClient).toBe("function");
		expect(typeof defineAdapter).toBe("function");
		expect(typeof defineEndpoint).toBe("function");
		expect(typeof definePlugin).toBe("function");
		expect(typeof unwrap).toBe("function");
	});
});

describe("NormalizedError (class + factory)", () => {
	const base = {
		kind: "http" as const,
		code: "NOT_FOUND",
		httpStatus: 404,
		retryable: false,
		cause: null,
		trace: { requestId: "r1", url: "/users/1", method: "GET", attempt: 1 },
	};

	it("createNormalizedError returns a NormalizedError instance", () => {
		const err = createNormalizedError(base);
		expect(err).toBeInstanceOf(NormalizedError);
		expect(err).toBeInstanceOf(Error);
	});

	it("message includes kind, code, method, url", () => {
		const err = createNormalizedError(base);
		expect(err.message).toBe("[http:NOT_FOUND] GET /users/1");
	});

	it("cause is preserved via Error(cause)", () => {
		const raw = { whatever: true };
		const err = createNormalizedError({ ...base, cause: raw });
		expect(err.cause).toBe(raw);
	});

	it("toJSON omits cause and includes metadata", () => {
		const err = createNormalizedError(base);
		const json = err.toJSON();
		expect(json).toMatchObject({
			name: "NormalizedError",
			kind: "http",
			code: "NOT_FOUND",
			httpStatus: 404,
			retryable: false,
		});
		expect("cause" in json).toBe(false);
	});

	it("isNormalizedError via instanceof", () => {
		const err = createNormalizedError(base);
		expect(isNormalizedError(err)).toBe(true);
	});

	it("isNormalizedError via structural fallback (plain object)", () => {
		const plain = {
			kind: "http",
			code: "X",
			retryable: false,
			trace: { requestId: "", url: "", method: "", attempt: 1 },
		};
		expect(isNormalizedError(plain)).toBe(true);
	});

	it("isNormalizedError rejects junk", () => {
		expect(isNormalizedError(null)).toBe(false);
		expect(isNormalizedError({})).toBe(false);
		expect(isNormalizedError("err")).toBe(false);
	});

	it("isKind narrows by kind", () => {
		const err = createNormalizedError({ ...base, kind: "timeout" });
		expect(isKind(err, "timeout")).toBe(true);
		expect(isKind(err, "http")).toBe(false);
	});

	it("exhaustiveGuard throws", () => {
		expect(() => exhaustiveGuard("unknown" as never)).toThrow();
	});
});

describe("retry backoff + Retry-After", () => {
	it("Retry-After numeric (seconds)", () => {
		expect(parseRetryAfter("3")).toBe(3000);
		expect(parseRetryAfter("0")).toBe(0);
	});

	it("Retry-After HTTP-date", () => {
		const future = new Date(Date.now() + 10000).toUTCString();
		const ms = parseRetryAfter(future);
		expect(ms).toBeGreaterThan(5000);
		expect(ms).toBeLessThanOrEqual(10000);
	});

	it("Retry-After invalid / empty returns undefined", () => {
		expect(parseRetryAfter(null)).toBeUndefined();
		expect(parseRetryAfter("")).toBeUndefined();
		expect(parseRetryAfter("not a date")).toBeUndefined();
	});

	it("exponential backoff applies jitter (range check)", () => {
		const ms = computeBackoffMs(
			{ type: "exponential", attempts: 5, baseDelay: 100, maxDelay: 500 },
			4,
			null,
		);
		expect(ms).toBeGreaterThanOrEqual(250);
		expect(ms).toBeLessThanOrEqual(500);
	});

	it("maxAttempts reads number or object form", () => {
		expect(maxAttempts(3)).toBe(3);
		expect(maxAttempts({ type: "linear", attempts: 5, delay: 100 })).toBe(5);
	});

	it("Retry-After takes precedence over strategy backoff", () => {
		const headers = new Headers({ "retry-after": "3" });
		const ms = computeBackoffMs(
			{ type: "exponential", attempts: 3, baseDelay: 100, maxDelay: 1000 },
			1,
			{ status: 429, headers, body: null },
		);
		expect(ms).toBe(3000);
	});
});

describe("defineAdapter / defineEndpoint", () => {
	it("adapter without errorMap is valid", () => {
		const ad = defineAdapter({
			baseURL: "https://x",
			endpoints: {
				ep: defineEndpoint({
					method: "GET",
					path: "/y",
					output: typedOutput<{ ok: boolean }>(),
				}),
			},
		});
		expect(ad.baseURL).toBe("https://x");
		expect(ad.errorMap).toBeUndefined();
	});

	it("endpoint body + path params coexist", () => {
		const ep = defineEndpoint({
			method: "PUT",
			path: "/users/:id",
			body: typedOutput<{ name: string }>(),
			output: typedOutput<{ id: number }>(),
		});
		expect(ep.method).toBe("PUT");
		expect(ep.path).toBe("/users/:id");
	});
});

describe("unwrap helper", () => {
	it("returns data on success", async () => {
		const ok: Promise<
			{ data: number; error: null } | { data: null; error: NormalizedError }
		> = Promise.resolve({ data: 42, error: null });
		await expect(unwrap(ok)).resolves.toBe(42);
	});

	it("throws NormalizedError on failure", async () => {
		const err = createNormalizedError({
			kind: "http",
			code: "X",
			retryable: false,
			cause: null,
			trace: { requestId: "r", url: "/", method: "GET", attempt: 1 },
		});
		const fail: Promise<
			{ data: number; error: null } | { data: null; error: NormalizedError }
		> = Promise.resolve({ data: null, error: err });
		await expect(unwrap(fail)).rejects.toBe(err);
	});
});
