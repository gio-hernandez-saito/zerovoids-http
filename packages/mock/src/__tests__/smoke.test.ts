import { describe, expect, it } from "vitest";
import { createMockTransport } from "../index.js";

describe("createMockTransport — matching", () => {
	it("matches by exact path", async () => {
		const t = createMockTransport({
			routes: [{ method: "GET", path: "/ping", response: { status: 200 } }],
		});
		const res = await t({
			url: "https://x.example/ping",
			method: "GET",
			headers: new Headers(),
		});
		expect(res.status).toBe(200);
	});

	it("matches by RegExp path", async () => {
		const t = createMockTransport({
			routes: [
				{ method: "GET", path: /\/users\/\d+$/, response: { status: 200 } },
			],
		});
		const res = await t({
			url: "https://x/users/42",
			method: "GET",
			headers: new Headers(),
		});
		expect(res.status).toBe(200);
	});

	it("throws on unmatched by default", async () => {
		const t = createMockTransport({ routes: [] });
		await expect(
			t({ url: "/x", method: "GET", headers: new Headers() }),
		).rejects.toThrow(/no route matched/);
	});

	it("returns 404 when onUnmatched: '404'", async () => {
		const t = createMockTransport({ routes: [], onUnmatched: "404" });
		const res = await t({ url: "/x", method: "GET", headers: new Headers() });
		expect(res.status).toBe(404);
	});
});

describe("createMockTransport — factory responses", () => {
	it("invokes a function response with the request", async () => {
		const t = createMockTransport({
			routes: [
				{
					method: "POST",
					path: "/echo",
					response: (req) => ({
						status: 200,
						headers: new Headers({ "content-type": "application/json" }),
						body: JSON.stringify({ echoed: req.url }),
					}),
				},
			],
		});
		const res = await t({
			url: "https://x/echo",
			method: "POST",
			headers: new Headers(),
		});
		expect(res.status).toBe(200);
		expect(res.body).toContain("https://x/echo");
	});
});

describe("createMockTransport — delay", () => {
	it("artificially delays the response", async () => {
		const t = createMockTransport({
			routes: [
				{ method: "GET", path: "/slow", response: { status: 200 }, delay: 25 },
			],
		});
		const start = Date.now();
		await t({ url: "/slow", method: "GET", headers: new Headers() });
		expect(Date.now() - start).toBeGreaterThanOrEqual(20);
	});
});

describe("createMockTransport — call history", () => {
	it("records every invocation", async () => {
		const t = createMockTransport({
			routes: [{ method: "GET", path: "/a", response: { status: 200 } }],
			onUnmatched: "404",
		});
		await t({
			url: "/a",
			method: "GET",
			headers: new Headers({ "x-trace": "1" }),
		});
		await t({ url: "/b", method: "GET", headers: new Headers() });
		expect(t.calls).toHaveLength(2);
		expect(t.calls[0]?.url).toBe("/a");
		expect(t.calls[0]?.headers["x-trace"]).toBe("1");
		expect(t.calls[1]?.url).toBe("/b");
	});

	it("reset() clears history", async () => {
		const t = createMockTransport({
			routes: [{ method: "GET", path: "/a", response: { status: 200 } }],
		});
		await t({ url: "/a", method: "GET", headers: new Headers() });
		expect(t.calls).toHaveLength(1);
		t.reset();
		expect(t.calls).toHaveLength(0);
	});
});

describe("createMockTransport — matchers", () => {
	it("headers matcher skips routes whose headers don't match", async () => {
		const t = createMockTransport({
			routes: [
				{
					method: "GET",
					path: "/g",
					headers: { authorization: /^Bearer / },
					response: { status: 200 },
				},
				{ method: "GET", path: "/g", response: { status: 401 } },
			],
		});
		const authed = await t({
			url: "/g",
			method: "GET",
			headers: new Headers({ authorization: "Bearer x" }),
		});
		const anon = await t({
			url: "/g",
			method: "GET",
			headers: new Headers(),
		});
		expect(authed.status).toBe(200);
		expect(anon.status).toBe(401);
	});

	it("body matcher gates a route", async () => {
		const t = createMockTransport({
			routes: [
				{
					method: "POST",
					path: "/p",
					body: (b) => typeof b === "string" && b.includes("ok"),
					response: { status: 201 },
				},
				{ method: "POST", path: "/p", response: { status: 400 } },
			],
		});
		const ok = await t({
			url: "/p",
			method: "POST",
			headers: new Headers(),
			body: '{"status":"ok"}',
		});
		const bad = await t({
			url: "/p",
			method: "POST",
			headers: new Headers(),
			body: '{"status":"nope"}',
		});
		expect(ok.status).toBe(201);
		expect(bad.status).toBe(400);
	});
});
