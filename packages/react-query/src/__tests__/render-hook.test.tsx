// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { Transport } from "@zerovoids/http";
import {
	createClient,
	defineAdapter,
	defineEndpoint,
	typedOutput,
} from "@zerovoids/http";
import React from "react";
import { describe, expect, it } from "vitest";
import { createQueryHooks } from "../index.js";

function makeTransport(
	responses: Array<{ status: number; body?: string }>,
): Transport {
	let i = 0;
	return async () => {
		const r = responses[Math.min(i++, responses.length - 1)] ?? {
			status: 500,
		};
		return {
			status: r.status,
			headers: new Headers({ "content-type": "application/json" }),
			body: r.body ?? null,
		};
	};
}

function buildHooks(transport: Transport) {
	const svc = defineAdapter({
		baseURL: "https://api.example.com",
		endpoints: {
			getThing: defineEndpoint({
				method: "GET",
				path: "/things/:id",
				output: typedOutput<{ id: number; name: string }>(),
			}),
		},
	});
	const api = createClient({ adapters: { svc }, transport });
	return createQueryHooks(api);
}

function wrap(qc: QueryClient) {
	return ({ children }: { children: React.ReactNode }) =>
		React.createElement(QueryClientProvider, { client: qc }, children);
}

describe("renderHook integration — @zerovoids/http-react-query", () => {
	it("useQuery resolves with typed data from the transport", async () => {
		const hooks = buildHooks(
			makeTransport([{ status: 200, body: '{"id":1,"name":"alpha"}' }]),
		);
		const qc = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});

		const { result } = renderHook(
			() => hooks.svc.getThing.useQuery({ params: { id: 1 } }),
			{ wrapper: wrap(qc) },
		);

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data).toEqual({ id: 1, name: "alpha" });
		expect(result.current.error).toBeNull();
	});

	it("useQuery surfaces NormalizedError in `error` when transport fails", async () => {
		const hooks = buildHooks(makeTransport([{ status: 500 }]));
		const qc = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});

		const { result } = renderHook(
			() => hooks.svc.getThing.useQuery({ params: { id: 2 } }),
			{ wrapper: wrap(qc) },
		);

		await waitFor(() => expect(result.current.isError).toBe(true));
		const err = result.current.error;
		expect(err).toBeTruthy();
		expect(err).toMatchObject({ kind: "http", httpStatus: 500 });
	});
});
