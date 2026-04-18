import { describe, expect, it } from "vitest";
import { kyTransport } from "../index.js";

describe("@zerovoids/http-transport-ky", () => {
	it("returns a transport function", () => {
		const t = kyTransport();
		expect(typeof t).toBe("function");
	});
});
