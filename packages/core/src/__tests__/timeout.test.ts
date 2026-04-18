import { describe, expect, it } from "vitest";
import { anySignal, isTimeoutAbort, timeoutSignal } from "../timeout.js";

describe("timeoutSignal", () => {
	it("aborts after the given delay", async () => {
		const signal = timeoutSignal(20);
		await new Promise((r) => setTimeout(r, 40));
		expect(signal.aborted).toBe(true);
	});

	it("reason is a TimeoutError", async () => {
		const signal = timeoutSignal(10);
		await new Promise((r) => setTimeout(r, 30));
		expect(isTimeoutAbort(signal.reason)).toBe(true);
	});
});

describe("anySignal", () => {
	it("returns an unaborted signal when all inputs are undefined", () => {
		const signal = anySignal([undefined, undefined]);
		expect(signal.aborted).toBe(false);
	});

	it("propagates abort from any child signal", () => {
		const a = new AbortController();
		const b = new AbortController();
		const merged = anySignal([a.signal, b.signal]);
		expect(merged.aborted).toBe(false);
		b.abort(new Error("boom"));
		expect(merged.aborted).toBe(true);
	});

	it("returns immediately aborted signal if a child is already aborted", () => {
		const a = new AbortController();
		a.abort(new Error("pre-aborted"));
		const merged = anySignal([a.signal]);
		expect(merged.aborted).toBe(true);
	});
});

describe("isTimeoutAbort", () => {
	it("true for a TimeoutError", () => {
		const err = new Error("t");
		err.name = "TimeoutError";
		expect(isTimeoutAbort(err)).toBe(true);
	});

	it("false for a normal Error / non-Error", () => {
		expect(isTimeoutAbort(new Error("x"))).toBe(false);
		expect(isTimeoutAbort("nope")).toBe(false);
	});
});
