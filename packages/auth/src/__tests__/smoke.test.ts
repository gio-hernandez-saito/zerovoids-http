import { describe, expect, it } from "vitest";
import { bearerWithRefresh, memoryStorage, xsrf } from "../index.js";

describe("@zerovoids/http-auth — exports", () => {
	it("bearerWithRefresh returns a transport handle with wrap()", () => {
		const auth = bearerWithRefresh({
			getToken: () => null,
			refresh: async () => "new-token",
		});
		expect(typeof auth.wrap).toBe("function");
		expect(auth.inFlight).toBeNull();
	});

	it("xsrf returns a plugin", () => {
		const p = xsrf();
		expect(p.id).toBe("auth:xsrf");
	});

	it("memoryStorage round-trips", async () => {
		const s = memoryStorage("x");
		expect(await s.get()).toBe("x");
	});
});
