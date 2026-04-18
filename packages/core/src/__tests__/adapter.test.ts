import { describe, expect, it } from "vitest";
import { defaultErrorMap, defineAdapter } from "../adapter.js";
import { defineEndpoint } from "../endpoint.js";
import { NormalizedError } from "../error/normalize.js";

const trace = { requestId: "r", url: "/x", method: "GET", attempt: 1 };

describe("defineAdapter", () => {
	it("allows errorMap to be omitted", () => {
		const ad = defineAdapter({
			baseURL: "https://x",
			endpoints: { ep: defineEndpoint({ method: "GET", path: "/y" }) },
		});
		expect(ad.errorMap).toBeUndefined();
	});
});

describe("defaultErrorMap", () => {
	it("maps status to HTTP_<status> code", () => {
		const err = defaultErrorMap(
			{ msg: "not found" },
			{ httpStatus: 404, headers: new Headers(), trace },
		);
		expect(err).toBeInstanceOf(NormalizedError);
		expect(err.kind).toBe("http");
		expect(err.code).toBe("HTTP_404");
		expect(err.httpStatus).toBe(404);
		expect(err.retryable).toBe(false);
	});

	it("marks 5xx / 429 / 408 retryable", () => {
		const mk = (status: number) =>
			defaultErrorMap(null, {
				httpStatus: status,
				headers: new Headers(),
				trace,
			});
		expect(mk(500).retryable).toBe(true);
		expect(mk(503).retryable).toBe(true);
		expect(mk(429).retryable).toBe(true);
		expect(mk(408).retryable).toBe(true);
		expect(mk(400).retryable).toBe(false);
		expect(mk(404).retryable).toBe(false);
	});

	it("parses Retry-After header", () => {
		const err = defaultErrorMap(null, {
			httpStatus: 429,
			headers: new Headers({ "retry-after": "5" }),
			trace,
		});
		expect(err.retryAfterMs).toBe(5000);
	});

	it("preserves raw cause", () => {
		const raw = { vendor: "stripe", weird: "shape" };
		const err = defaultErrorMap(raw, {
			httpStatus: 500,
			headers: new Headers(),
			trace,
		});
		expect(err.cause).toBe(raw);
	});
});
