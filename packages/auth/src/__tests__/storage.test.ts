import { describe, expect, it } from "vitest";
import { localStorageStorage, memoryStorage } from "../storage.js";

describe("memoryStorage", () => {
	it("starts empty by default", async () => {
		const s = memoryStorage();
		expect(await s.get()).toBeNull();
	});

	it("honors initial value", async () => {
		const s = memoryStorage("init");
		expect(await s.get()).toBe("init");
	});

	it("set / get round trip", async () => {
		const s = memoryStorage();
		await s.set("t1");
		expect(await s.get()).toBe("t1");
		await s.set(null);
		expect(await s.get()).toBeNull();
	});
});

describe("localStorageStorage", () => {
	it("uses injected backend", async () => {
		const backing = new Map<string, string>();
		const backend = {
			getItem: (k: string) => backing.get(k) ?? null,
			setItem: (k: string, v: string) => {
				backing.set(k, v);
			},
			removeItem: (k: string) => {
				backing.delete(k);
			},
		};
		const s = localStorageStorage("tok", backend);
		expect(await s.get()).toBeNull();
		await s.set("v1");
		expect(backing.get("tok")).toBe("v1");
		await s.set(null);
		expect(backing.has("tok")).toBe(false);
	});

	it("falls back to in-memory when no backend and no globalThis.localStorage", async () => {
		const g = globalThis as { localStorage?: unknown };
		const original = g.localStorage;
		// biome-ignore lint/performance/noDelete: intentional test teardown
		delete g.localStorage;
		try {
			const s = localStorageStorage("tok");
			await s.set("x");
			expect(await s.get()).toBe("x");
		} finally {
			if (original !== undefined) g.localStorage = original;
		}
	});
});
