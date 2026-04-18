import { describe, expect, it } from "vitest";
import { axiosTransport } from "../index.js";

describe("@zerovoids/http-transport-axios", () => {
	it("returns a transport function", () => {
		const t = axiosTransport();
		expect(typeof t).toBe("function");
	});
});
