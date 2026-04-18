import { describe, expect, it } from "vitest";
import {
	isAuth,
	isCanceled,
	isClientError,
	isDomain,
	isNetwork,
	isRateLimited,
	isRetryable,
	isServerError,
	isTimeout,
	isValidation,
} from "../error/helpers.js";
import { createNormalizedError } from "../error/normalize.js";

const mk = (over: Partial<Parameters<typeof createNormalizedError>[0]> = {}) =>
	createNormalizedError({
		kind: "http",
		code: "X",
		retryable: false,
		cause: null,
		trace: { requestId: "r", url: "/", method: "GET", attempt: 1 },
		...over,
	});

describe("error helpers", () => {
	it("isRetryable", () => {
		expect(isRetryable(mk({ retryable: true }))).toBe(true);
		expect(isRetryable(mk({ retryable: false }))).toBe(false);
	});

	it("isAuth — 401 / 403 only", () => {
		expect(isAuth(mk({ httpStatus: 401 }))).toBe(true);
		expect(isAuth(mk({ httpStatus: 403 }))).toBe(true);
		expect(isAuth(mk({ httpStatus: 404 }))).toBe(false);
	});

	it("isClientError — 4xx", () => {
		expect(isClientError(mk({ kind: "http", httpStatus: 404 }))).toBe(true);
		expect(isClientError(mk({ kind: "http", httpStatus: 500 }))).toBe(false);
		expect(isClientError(mk({ kind: "network", httpStatus: 0 }))).toBe(false);
	});

	it("isServerError — 5xx", () => {
		expect(isServerError(mk({ kind: "http", httpStatus: 500 }))).toBe(true);
		expect(isServerError(mk({ kind: "http", httpStatus: 503 }))).toBe(true);
		expect(isServerError(mk({ kind: "http", httpStatus: 404 }))).toBe(false);
	});

	it("isRateLimited — 429", () => {
		expect(isRateLimited(mk({ httpStatus: 429 }))).toBe(true);
		expect(isRateLimited(mk({ httpStatus: 500 }))).toBe(false);
	});

	it("isNetwork / isTimeout / isCanceled / isValidation / isDomain", () => {
		expect(isNetwork(mk({ kind: "network" }))).toBe(true);
		expect(isTimeout(mk({ kind: "timeout" }))).toBe(true);
		expect(isCanceled(mk({ kind: "canceled" }))).toBe(true);
		expect(isValidation(mk({ kind: "validation" }))).toBe(true);
		expect(isDomain(mk({ kind: "domain" }))).toBe(true);
		expect(isNetwork(mk({ kind: "http" }))).toBe(false);
	});
});
