import type { Transport, TransportRequest } from "@zerovoids/http";
import { describe, expect, it, vi } from "vitest";
import { bearerWithRefresh } from "../bearer.js";
import { memoryStorage } from "../storage.js";

function mkReq(url = "https://x/g"): TransportRequest {
	return { url, method: "GET", headers: new Headers() };
}

describe("bearerWithRefresh — header injection", () => {
	it("attaches Bearer token from getToken", async () => {
		const seen: string[] = [];
		const inner: Transport = async (req) => {
			seen.push(req.headers.get("authorization") ?? "");
			return { status: 200, headers: new Headers(), body: null };
		};
		const auth = bearerWithRefresh({
			getToken: () => "token-1",
			refresh: async () => "unused",
		});
		await auth.wrap(inner)(mkReq());
		expect(seen[0]).toBe("Bearer token-1");
	});

	it("omits header when token is null", async () => {
		let seenAuth: string | null = null;
		const inner: Transport = async (req) => {
			seenAuth = req.headers.get("authorization");
			return { status: 200, headers: new Headers(), body: null };
		};
		const auth = bearerWithRefresh({
			getToken: () => null,
			refresh: async () => "unused",
		});
		await auth.wrap(inner)(mkReq());
		expect(seenAuth).toBeNull();
	});

	it("respects custom header + scheme", async () => {
		let seen: string | null = null;
		const inner: Transport = async (req) => {
			seen = req.headers.get("x-api-auth");
			return { status: 200, headers: new Headers(), body: null };
		};
		const auth = bearerWithRefresh({
			getToken: () => "t",
			refresh: async () => "unused",
			header: "X-API-Auth",
			scheme: "Token",
		});
		await auth.wrap(inner)(mkReq());
		expect(seen).toBe("Token t");
	});
});

describe("bearerWithRefresh — 401 → refresh → retry", () => {
	it("retries once with new token after refresh", async () => {
		const storage = memoryStorage("old");
		let calls = 0;
		const inner: Transport = async (req) => {
			calls++;
			const tok = req.headers.get("authorization");
			if (tok === "Bearer old")
				return { status: 401, headers: new Headers(), body: null };
			return { status: 200, headers: new Headers(), body: null };
		};
		const auth = bearerWithRefresh({
			getToken: () => storage.get(),
			refresh: async () => {
				await storage.set("new");
				return "new";
			},
		});
		const res = await auth.wrap(inner)(mkReq());
		expect(res.status).toBe(200);
		expect(calls).toBe(2);
	});

	it("surfaces 401 when refresh returns null", async () => {
		const inner: Transport = async () => ({
			status: 401,
			headers: new Headers(),
			body: null,
		});
		const auth = bearerWithRefresh({
			getToken: () => "bad",
			refresh: async () => null,
		});
		const res = await auth.wrap(inner)(mkReq());
		expect(res.status).toBe(401);
	});

	it("surfaces 401 when refresh throws", async () => {
		const inner: Transport = async () => ({
			status: 401,
			headers: new Headers(),
			body: null,
		});
		const auth = bearerWithRefresh({
			getToken: () => "bad",
			refresh: async () => {
				throw new Error("refresh failed");
			},
		});
		const res = await auth.wrap(inner)(mkReq());
		expect(res.status).toBe(401);
	});

	it("does NOT retry a second time if refreshed token also 401s", async () => {
		const storage = memoryStorage("old");
		let calls = 0;
		const inner: Transport = async () => {
			calls++;
			return { status: 401, headers: new Headers(), body: null };
		};
		const auth = bearerWithRefresh({
			getToken: () => storage.get(),
			refresh: async () => {
				await storage.set("new");
				return "new";
			},
		});
		const res = await auth.wrap(inner)(mkReq());
		expect(res.status).toBe(401);
		expect(calls).toBe(2);
	});

	it("custom shouldRefresh triggers on 419", async () => {
		let calls = 0;
		const inner: Transport = async () => {
			calls++;
			return calls === 1
				? { status: 419, headers: new Headers(), body: null }
				: { status: 200, headers: new Headers(), body: null };
		};
		const auth = bearerWithRefresh({
			getToken: () => "old",
			refresh: async () => "new",
			shouldRefresh: (r) => r.status === 419,
		});
		const res = await auth.wrap(inner)(mkReq());
		expect(res.status).toBe(200);
		expect(calls).toBe(2);
	});
});

describe("bearerWithRefresh — single-flight", () => {
	it("concurrent 401s share one refresh call", async () => {
		const storage = memoryStorage("old");
		let refreshCalls = 0;
		let innerCalls = 0;
		let resolveRefresh!: (t: string) => void;
		const refreshed = new Promise<string>((r) => {
			resolveRefresh = r;
		});
		const inner: Transport = async (req) => {
			innerCalls++;
			const t = req.headers.get("authorization");
			if (t === "Bearer old")
				return { status: 401, headers: new Headers(), body: null };
			return { status: 200, headers: new Headers(), body: null };
		};
		const auth = bearerWithRefresh({
			getToken: () => storage.get(),
			refresh: async () => {
				refreshCalls++;
				const t = await refreshed;
				await storage.set(t);
				return t;
			},
		});
		const wrapped = auth.wrap(inner);
		const p1 = wrapped(mkReq("https://x/a"));
		const p2 = wrapped(mkReq("https://x/b"));
		const p3 = wrapped(mkReq("https://x/c"));
		await new Promise((r) => setTimeout(r, 5));
		resolveRefresh("new");
		const results = await Promise.all([p1, p2, p3]);
		expect(refreshCalls).toBe(1);
		expect(results.every((r) => r.status === 200)).toBe(true);
		// 3 initial 401s + 3 retries = 6
		expect(innerCalls).toBe(6);
	});

	it("serial refreshes after first resolves start a fresh single-flight", async () => {
		const storage = memoryStorage("old");
		let refreshCalls = 0;
		const inner: Transport = async (req) => {
			const t = req.headers.get("authorization");
			if (t === "Bearer old" || t === "Bearer expired-again")
				return { status: 401, headers: new Headers(), body: null };
			return { status: 200, headers: new Headers(), body: null };
		};
		const auth = bearerWithRefresh({
			getToken: () => storage.get(),
			refresh: async () => {
				refreshCalls++;
				const t = refreshCalls === 1 ? "expired-again" : "good";
				await storage.set(t);
				return t;
			},
		});
		// First call: old → 401 → refresh → expired-again → still 401 (no 2nd refresh).
		const r1 = await auth.wrap(inner)(mkReq());
		expect(r1.status).toBe(401);
		expect(refreshCalls).toBe(1);
		// Second independent call triggers a fresh refresh.
		const r2 = await auth.wrap(inner)(mkReq());
		expect(r2.status).toBe(200);
		expect(refreshCalls).toBe(2);
	});

	it("inFlight is null when idle and set during refresh", async () => {
		let resolveRefresh!: () => void;
		const gate = new Promise<void>((r) => {
			resolveRefresh = r;
		});
		const inner: Transport = async (req) => {
			return req.headers.get("authorization") === "Bearer old"
				? { status: 401, headers: new Headers(), body: null }
				: { status: 200, headers: new Headers(), body: null };
		};
		const auth = bearerWithRefresh({
			getToken: () => "old",
			refresh: async () => {
				await gate;
				return "new";
			},
		});
		expect(auth.inFlight).toBeNull();
		const p = auth.wrap(inner)(mkReq());
		await new Promise((r) => setTimeout(r, 5));
		expect(auth.inFlight).not.toBeNull();
		resolveRefresh();
		await p;
		expect(auth.inFlight).toBeNull();
	});

	it("skips refresh when token already rotated during flight (race)", async () => {
		const storage = memoryStorage("old");
		const refresh = vi.fn(async () => "never-called");
		const inner: Transport = async (req) => {
			const t = req.headers.get("authorization");
			// First pass: sees old → 401.
			// Meanwhile external code rotated to "hot". Second pass sees hot → 200.
			if (t === "Bearer old") {
				await storage.set("hot");
				return { status: 401, headers: new Headers(), body: null };
			}
			return { status: 200, headers: new Headers(), body: null };
		};
		const auth = bearerWithRefresh({
			getToken: () => storage.get(),
			refresh,
		});
		const res = await auth.wrap(inner)(mkReq());
		expect(res.status).toBe(200);
		expect(refresh).not.toHaveBeenCalled();
	});
});
