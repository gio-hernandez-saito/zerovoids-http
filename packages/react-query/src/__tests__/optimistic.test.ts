import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { optimistic } from "../optimistic.js";

describe("optimistic", () => {
	it("applies update on onMutate and returns prev snapshot", async () => {
		const qc = new QueryClient();
		qc.setQueryData(["svc", "user", { id: 1 }], { id: 1, name: "A" });
		const helper = optimistic<{ id: number; name: string }, { name: string }>(
			qc,
			["svc", "user", { id: 1 }],
			(prev, patch) => (prev ? { ...prev, ...patch } : prev),
		);
		const ctx = await helper.onMutate({ name: "B" });
		expect(ctx.prev).toEqual({ id: 1, name: "A" });
		expect(qc.getQueryData(["svc", "user", { id: 1 }])).toEqual({
			id: 1,
			name: "B",
		});
	});

	it("rolls back on error using the snapshot", async () => {
		const qc = new QueryClient();
		qc.setQueryData(["k"], { n: 1 });
		const helper = optimistic<{ n: number }, { n: number }>(
			qc,
			["k"],
			(_prev, input) => input,
		);
		const ctx = await helper.onMutate({ n: 99 });
		expect(qc.getQueryData(["k"])).toEqual({ n: 99 });
		helper.onError(new Error("boom"), { n: 99 }, ctx);
		expect(qc.getQueryData(["k"])).toEqual({ n: 1 });
	});

	it("no-ops rollback when context is undefined", () => {
		const qc = new QueryClient();
		qc.setQueryData(["k"], { n: 1 });
		const helper = optimistic<{ n: number }, { n: number }>(
			qc,
			["k"],
			(_p, i) => i,
		);
		helper.onError(new Error("boom"), { n: 99 }, undefined);
		expect(qc.getQueryData(["k"])).toEqual({ n: 1 });
	});

	it("invalidates the query on settle", async () => {
		const qc = new QueryClient();
		const spy = vi.spyOn(qc, "invalidateQueries");
		const helper = optimistic(qc, ["k"], (_p, i) => i);
		await helper.onSettled();
		expect(spy).toHaveBeenCalledWith({ queryKey: ["k"] });
	});

	it("cancels in-flight queries before writing optimistic data", async () => {
		const qc = new QueryClient();
		const spy = vi.spyOn(qc, "cancelQueries");
		const helper = optimistic(qc, ["k"], (_p, i) => i);
		await helper.onMutate({ n: 1 });
		expect(spy).toHaveBeenCalledWith({ queryKey: ["k"] });
	});
});
