import { describe, expect, it } from "vitest";
import {
	type Transport,
	type TransportRequest,
	type TransportResponse,
	createClient,
	defineAdapter,
	defineEndpoint,
	typedOutput,
} from "../index.js";

function mockTransport(
	handler: (
		req: TransportRequest,
	) => TransportResponse | Promise<TransportResponse>,
): Transport {
	return async (req) => handler(req);
}

describe("pipeline — raw escape hatch", () => {
	it("returns TransportResponse on 2xx without decoding body", async () => {
		const transport = mockTransport(() => ({
			status: 200,
			headers: new Headers({ "content-type": "application/json" }),
			body: JSON.stringify({ id: 1 }),
		}));

		const svc = defineAdapter({
			baseURL: "https://x",
			endpoints: {
				get: defineEndpoint({
					method: "GET",
					path: "/users/:id",
					output: typedOutput<{ id: number }>(),
				}),
			},
		});
		const api = createClient({ adapters: { svc }, transport });

		const { data, error } = await api.svc.get.raw({ params: { id: 1 } });
		expect(error).toBeNull();
		expect(data).not.toBeNull();
		expect(data?.status).toBe(200);
		expect(data?.headers.get("content-type")).toBe("application/json");
		expect(data?.body).toBe(JSON.stringify({ id: 1 }));
	});

	it("returns TransportResponse on non-2xx without errorMap", async () => {
		const transport = mockTransport(() => ({
			status: 500,
			headers: new Headers(),
			body: "boom",
		}));

		const svc = defineAdapter({
			baseURL: "https://x",
			endpoints: { get: defineEndpoint({ method: "GET", path: "/x" }) },
		});
		const api = createClient({ adapters: { svc }, transport });

		const { data, error } = await api.svc.get.raw();
		expect(error).toBeNull();
		expect(data?.status).toBe(500);
		expect(data?.body).toBe("boom");
	});

	it("skips output schema validation in raw mode", async () => {
		const transport = mockTransport(() => ({
			status: 200,
			headers: new Headers({ "content-type": "application/json" }),
			body: JSON.stringify({ wrong: "shape" }),
		}));

		const svc = defineAdapter({
			baseURL: "https://x",
			endpoints: {
				get: defineEndpoint({
					method: "GET",
					path: "/x",
					output: typedOutput<{ id: number; name: string }>(),
				}),
			},
		});
		const api = createClient({ adapters: { svc }, transport });

		const { data, error } = await api.svc.get.raw();
		expect(error).toBeNull();
		expect(data?.status).toBe(200);
	});

	it("still surfaces network errors as NormalizedError", async () => {
		const transport = mockTransport(() => {
			throw new Error("socket reset");
		});

		const svc = defineAdapter({
			baseURL: "https://x",
			endpoints: { get: defineEndpoint({ method: "GET", path: "/x" }) },
		});
		const api = createClient({ adapters: { svc }, transport });

		const { data, error } = await api.svc.get.raw();
		expect(data).toBeNull();
		expect(error?.kind).toBe("network");
		expect(error?.code).toBe("NETWORK_ERROR");
	});
});
