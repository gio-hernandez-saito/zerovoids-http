import { describe, expect, it } from "vitest";
import { generateRequestId } from "../id.js";

describe("generateRequestId", () => {
	it("returns a non-empty string", () => {
		const id = generateRequestId();
		expect(typeof id).toBe("string");
		expect(id.length).toBeGreaterThan(0);
	});

	it("returns unique values on repeated calls", () => {
		const set = new Set<string>();
		for (let i = 0; i < 1000; i++) set.add(generateRequestId());
		expect(set.size).toBe(1000);
	});
});
