// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import type { Transport } from "@zerovoids/http";
import {
	createClient,
	defineAdapter,
	defineEndpoint,
	typedOutput,
} from "@zerovoids/http";
import React from "react";
import { SWRConfig } from "swr";
import { describe, expect, it } from "vitest";
import { createSwrHooks } from "../index.js";

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
	return createSwrHooks(api);
}

function wrap({ children }: { children: React.ReactNode }) {
	return React.createElement(
		SWRConfig,
		{ value: { provider: () => new Map(), dedupingInterval: 0 } },
		children,
	);
}

describe("renderHook integration — @zerovoids/http-swr", () => {
	it("useSWR resolves with typed data from the transport", async () => {
		const hooks = buildHooks(
			makeTransport([{ status: 200, body: '{"id":1,"name":"alpha"}' }]),
		);

		const { result } = renderHook(
			() => hooks.svc.getThing.useSWR({ params: { id: 1 } }),
			{ wrapper: wrap },
		);

		await waitFor(() => expect(result.current.data).toBeDefined());
		expect(result.current.data).toEqual({ id: 1, name: "alpha" });
		expect(result.current.error).toBeUndefined();
	});

	it("useSWR surfaces NormalizedError in `error` when transport fails", async () => {
		const hooks = buildHooks(makeTransport([{ status: 500 }]));

		const { result } = renderHook(
			() => hooks.svc.getThing.useSWR({ params: { id: 2 } }),
			{ wrapper: wrap },
		);

		await waitFor(() => expect(result.current.error).toBeTruthy());
		expect(result.current.error).toMatchObject({
			kind: "http",
			httpStatus: 500,
		});
	});
});
