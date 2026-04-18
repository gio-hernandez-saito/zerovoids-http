import { describe, expect, it } from "vitest";
import { createMockTransport, scenario } from "../index.js";

describe("scenario()", () => {
	it("walks the sequence once per call", async () => {
		const t = createMockTransport({
			routes: [
				{
					method: "GET",
					path: "/s",
					response: scenario([
						{ status: 500 },
						{ status: 500 },
						{ status: 200, body: '{"ok":true}' },
					]),
				},
			],
		});
		const a = await t({ url: "/s", method: "GET", headers: new Headers() });
		const b = await t({ url: "/s", method: "GET", headers: new Headers() });
		const c = await t({ url: "/s", method: "GET", headers: new Headers() });
		expect([a.status, b.status, c.status]).toEqual([500, 500, 200]);
	});

	it("cycles by default", async () => {
		const r = scenario([{ status: 200 }, { status: 201 }]);
		const req = { url: "/", method: "GET" as const, headers: new Headers() };
		expect((await r(req)).status).toBe(200);
		expect((await r(req)).status).toBe(201);
		expect((await r(req)).status).toBe(200);
		expect((await r(req)).status).toBe(201);
	});

	it("`onExhausted: 'last'` repeats the tail", async () => {
		const r = scenario([{ status: 500 }, { status: 200 }], {
			onExhausted: "last",
		});
		const req = { url: "/", method: "GET" as const, headers: new Headers() };
		expect((await r(req)).status).toBe(500);
		expect((await r(req)).status).toBe(200);
		expect((await r(req)).status).toBe(200);
		expect((await r(req)).status).toBe(200);
	});

	it("`onExhausted: 'throw'` throws when exhausted", async () => {
		const r = scenario([{ status: 200 }], { onExhausted: "throw" });
		const req = { url: "/", method: "GET" as const, headers: new Headers() };
		await r(req);
		await expect(r(req)).rejects.toThrow(/exhausted/);
	});

	it("rejects empty sequences eagerly", () => {
		expect(() => scenario([])).toThrow(/requires ≥ 1 response/);
	});

	it("accepts factory responses inside the sequence", async () => {
		const r = scenario([
			(req) => ({ status: 200, body: req.url }),
			{ status: 204 },
		]);
		const req = {
			url: "https://x/a",
			method: "GET" as const,
			headers: new Headers(),
		};
		expect((await r(req)).body).toBe("https://x/a");
		expect((await r(req)).status).toBe(204);
	});
});
