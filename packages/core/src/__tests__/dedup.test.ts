import { describe, expect, it } from "vitest";
import {
	type Transport,
	type TransportRequest,
	createClient,
	dedupTransport,
	defineAdapter,
	defineEndpoint,
} from "../index.js";

function counting(
	handler: (req: TransportRequest) => Promise<{ status: number }>,
): { transport: Transport; calls: () => number } {
	let calls = 0;
	const transport: Transport = async (req) => {
		calls++;
		const r = await handler(req);
		return { status: r.status, headers: new Headers(), body: null };
	};
	return { transport, calls: () => calls };
}

describe("dedupTransport", () => {
	it("shares in-flight GETs with identical url", async () => {
		let resolve!: () => void;
		const gate = new Promise<void>((r) => {
			resolve = r;
		});
		const { transport, calls } = counting(async () => {
			await gate;
			return { status: 200 };
		});
		const deduped = dedupTransport(transport);
		const req: TransportRequest = {
			url: "https://x/users/1",
			method: "GET",
			headers: new Headers(),
		};
		const p1 = deduped(req);
		const p2 = deduped(req);
		resolve();
		const [r1, r2] = await Promise.all([p1, p2]);
		expect(calls()).toBe(1);
		expect(r1).toBe(r2);
	});

	it("does not dedupe writes by default", async () => {
		const { transport, calls } = counting(async () => ({ status: 201 }));
		const deduped = dedupTransport(transport);
		await Promise.all([
			deduped({ url: "https://x/p", method: "POST", headers: new Headers() }),
			deduped({ url: "https://x/p", method: "POST", headers: new Headers() }),
		]);
		expect(calls()).toBe(2);
	});

	it("evicts after completion so follow-ups re-fetch", async () => {
		const { transport, calls } = counting(async () => ({ status: 200 }));
		const deduped = dedupTransport(transport);
		const req: TransportRequest = {
			url: "https://x/a",
			method: "GET",
			headers: new Headers(),
		};
		await deduped(req);
		await deduped(req);
		expect(calls()).toBe(2);
	});

	it("evicts on failure too", async () => {
		let count = 0;
		const transport: Transport = async () => {
			count++;
			throw new Error("boom");
		};
		const deduped = dedupTransport(transport);
		const req: TransportRequest = {
			url: "https://x/a",
			method: "GET",
			headers: new Headers(),
		};
		await expect(deduped(req)).rejects.toThrow();
		await expect(deduped(req)).rejects.toThrow();
		expect(count).toBe(2);
	});

	it("custom key function groups requests differently", async () => {
		const { transport, calls } = counting(async () => ({ status: 200 }));
		const deduped = dedupTransport(transport, {
			key: (r) => `${r.method} ${new URL(r.url).pathname}`,
		});
		let resolve!: () => void;
		const gate = new Promise<void>((r) => {
			resolve = r;
		});
		const slow: Transport = async (req) => {
			await gate;
			return transport(req);
		};
		const outer = dedupTransport(slow, {
			key: (r) => `${r.method} ${new URL(r.url).pathname}`,
		});
		const p1 = outer({
			url: "https://x/a?v=1",
			method: "GET",
			headers: new Headers(),
		});
		const p2 = outer({
			url: "https://x/a?v=2",
			method: "GET",
			headers: new Headers(),
		});
		resolve();
		await Promise.all([p1, p2]);
		expect(calls()).toBe(1);
		void deduped; // keep type-check happy
	});

	it("integrates with createClient (concurrent GETs → 1 call)", async () => {
		let resolve!: () => void;
		const gate = new Promise<void>((r) => {
			resolve = r;
		});
		const { transport, calls } = counting(async () => {
			await gate;
			return { status: 200 };
		});
		const svc = defineAdapter({
			baseURL: "https://x",
			endpoints: { g: defineEndpoint({ method: "GET", path: "/g" }) },
		});
		const api = createClient({
			adapters: { svc },
			transport: dedupTransport(transport),
		});
		const p1 = api.svc.g();
		const p2 = api.svc.g();
		resolve();
		await Promise.all([p1, p2]);
		expect(calls()).toBe(1);
	});
});
