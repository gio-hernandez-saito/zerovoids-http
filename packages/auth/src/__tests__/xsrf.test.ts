import type { Transport, TransportRequest } from "@zerovoids/http";
import { createClient, defineAdapter, defineEndpoint } from "@zerovoids/http";
import { describe, expect, it } from "vitest";
import { defaultCookieReader, xsrf } from "../xsrf.js";

function seenHeaders(): {
	transport: Transport;
	last: () => Headers | undefined;
} {
	let last: Headers | undefined;
	return {
		transport: async (req: TransportRequest) => {
			last = req.headers as Headers;
			return { status: 200, headers: new Headers(), body: null };
		},
		last: () => last,
	};
}

describe("xsrf plugin", () => {
	it("copies XSRF cookie to X-XSRF-TOKEN header on POST", async () => {
		const { transport, last } = seenHeaders();
		const svc = defineAdapter({
			baseURL: "https://x",
			endpoints: { p: defineEndpoint({ method: "POST", path: "/p" }) },
		});
		const api = createClient({
			adapters: { svc },
			transport,
			plugins: [
				xsrf({ readCookie: (n) => (n === "XSRF-TOKEN" ? "abc" : null) }),
			],
		});
		await api.svc.p();
		expect(last()?.get("x-xsrf-token")).toBe("abc");
	});

	it("skips GET requests", async () => {
		const { transport, last } = seenHeaders();
		const svc = defineAdapter({
			baseURL: "https://x",
			endpoints: { g: defineEndpoint({ method: "GET", path: "/g" }) },
		});
		const api = createClient({
			adapters: { svc },
			transport,
			plugins: [xsrf({ readCookie: () => "abc" })],
		});
		await api.svc.g();
		expect(last()?.has("x-xsrf-token")).toBe(false);
	});

	it("does not overwrite caller-supplied header", async () => {
		const { transport, last } = seenHeaders();
		const svc = defineAdapter({
			baseURL: "https://x",
			endpoints: { p: defineEndpoint({ method: "POST", path: "/p" }) },
		});
		const api = createClient({
			adapters: { svc },
			transport,
			plugins: [xsrf({ readCookie: () => "cookie-value" })],
		});
		await api.svc.p(undefined, { headers: { "x-xsrf-token": "manual" } });
		expect(last()?.get("x-xsrf-token")).toBe("manual");
	});

	it("custom cookie + header names", async () => {
		const { transport, last } = seenHeaders();
		const svc = defineAdapter({
			baseURL: "https://x",
			endpoints: { p: defineEndpoint({ method: "DELETE", path: "/p" }) },
		});
		const api = createClient({
			adapters: { svc },
			transport,
			plugins: [
				xsrf({
					cookieName: "csrftoken",
					headerName: "X-CSRFToken",
					readCookie: (n) => (n === "csrftoken" ? "django-val" : null),
				}),
			],
		});
		await api.svc.p();
		expect(last()?.get("x-csrftoken")).toBe("django-val");
	});

	it("skips when cookie missing", async () => {
		const { transport, last } = seenHeaders();
		const svc = defineAdapter({
			baseURL: "https://x",
			endpoints: { p: defineEndpoint({ method: "POST", path: "/p" }) },
		});
		const api = createClient({
			adapters: { svc },
			transport,
			plugins: [xsrf({ readCookie: () => null })],
		});
		await api.svc.p();
		expect(last()?.has("x-xsrf-token")).toBe(false);
	});
});

describe("defaultCookieReader", () => {
	it("parses document.cookie when available", () => {
		const g = globalThis as { document?: { cookie?: string } };
		const original = g.document;
		g.document = { cookie: "A=1; XSRF-TOKEN=xyz; B=2" };
		try {
			expect(defaultCookieReader("XSRF-TOKEN")).toBe("xyz");
			expect(defaultCookieReader("B")).toBe("2");
			expect(defaultCookieReader("missing")).toBeNull();
		} finally {
			g.document = original;
		}
	});

	it("returns null when document is unavailable", () => {
		const g = globalThis as { document?: { cookie?: string } };
		const original = g.document;
		// biome-ignore lint/performance/noDelete: intentional test teardown
		delete g.document;
		try {
			expect(defaultCookieReader("anything")).toBeNull();
		} finally {
			g.document = original;
		}
	});

	it("URL-decodes values", () => {
		const g = globalThis as { document?: { cookie?: string } };
		const original = g.document;
		g.document = { cookie: "T=%E2%98%85" };
		try {
			expect(defaultCookieReader("T")).toBe("★");
		} finally {
			g.document = original;
		}
	});
});
