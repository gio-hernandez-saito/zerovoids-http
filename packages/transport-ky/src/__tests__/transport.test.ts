import kyDefault from "ky";
import { describe, expect, it } from "vitest";
import { kyTransport } from "../index.js";

/**
 * ky 1.x passes either a Request object or (url, init) to the underlying fetch.
 * When it's already a Request, we must use it as-is — constructing a new Request
 * from just the URL loses the method/body/headers/signal.
 */
function stubFetch(
	handler: (req: Request) => Response | Promise<Response>,
): typeof fetch {
	return async (input, init) => {
		const req =
			input instanceof Request
				? input
				: new Request(typeof input === "string" ? input : input.url, init);
		return handler(req);
	};
}

describe("kyTransport", () => {
	it("returns a Transport function", () => {
		expect(typeof kyTransport()).toBe("function");
	});

	it("maps ky response to TransportResponse shape", async () => {
		const ky = kyDefault.create({
			fetch: stubFetch(
				() =>
					new Response('{"ok":true}', {
						status: 200,
						headers: { "content-type": "application/json" },
					}),
			),
		});
		const transport = kyTransport({ ky });
		const res = await transport({
			url: "https://example.com/x",
			method: "GET",
			headers: new Headers(),
		});
		expect(res.status).toBe(200);
		expect(res.body).toBe('{"ok":true}');
		expect(res.headers.get("content-type")).toBe("application/json");
	});

	it("does NOT throw on non-2xx (core pipeline owns error mapping)", async () => {
		const ky = kyDefault.create({
			fetch: stubFetch(
				() =>
					new Response("", {
						status: 500,
						headers: { "content-type": "text/plain" },
					}),
			),
		});
		const transport = kyTransport({ ky });
		const res = await transport({
			url: "https://example.com/boom",
			method: "GET",
			headers: new Headers(),
		});
		expect(res.status).toBe(500);
		expect(res.body).toBeNull();
	});

	it("propagates headers", async () => {
		let seen: Headers | null = null;
		const ky = kyDefault.create({
			fetch: stubFetch((req) => {
				seen = req.headers;
				return new Response(null, { status: 204 });
			}),
		});
		const transport = kyTransport({ ky });
		await transport({
			url: "https://example.com/x",
			method: "GET",
			headers: new Headers({ "x-test": "1" }),
		});
		expect(seen).not.toBeNull();
		expect((seen as unknown as Headers).get("x-test")).toBe("1");
	});

	it("propagates method and body", async () => {
		let method: string | null = null;
		let body: string | null = null;
		const ky = kyDefault.create({
			fetch: stubFetch(async (req) => {
				method = req.method;
				body = await req.text();
				return new Response(null, { status: 200 });
			}),
		});
		const transport = kyTransport({ ky });
		await transport({
			url: "https://example.com/x",
			method: "POST",
			headers: new Headers({ "content-type": "application/json" }),
			body: JSON.stringify({ hello: "world" }),
		});
		expect(method).toBe("POST");
		expect(body).toBe('{"hello":"world"}');
	});

	it("attaches the AbortSignal to the outgoing request", async () => {
		let received: AbortSignal | undefined;
		const ky = kyDefault.create({
			fetch: stubFetch((req) => {
				received = req.signal;
				return new Response(null, { status: 200 });
			}),
		});
		const transport = kyTransport({ ky });
		const ctrl = new AbortController();
		await transport({
			url: "https://example.com/x",
			method: "GET",
			headers: new Headers(),
			signal: ctrl.signal,
		});
		expect(received).toBeDefined();
		expect(received instanceof AbortSignal).toBe(true);
	});
});
