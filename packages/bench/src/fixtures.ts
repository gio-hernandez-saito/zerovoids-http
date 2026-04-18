import {
	createClient,
	defineAdapter,
	defineEndpoint,
	typedOutput,
} from "@zerovoids/http";
import { createMockTransport } from "@zerovoids/http-mock";

/**
 * Shared fixture: a mock transport that returns a 200 JSON body immediately,
 * plus a fully-configured client pointed at it. Used by both the `vitest
 * bench` suites and the standalone `run-bench.ts` CLI so numbers are
 * comparable across invocation modes.
 */
export function buildFixtures() {
	const body = JSON.stringify({ id: 1, name: "alice" });
	const transport = createMockTransport({
		routes: [
			{
				method: "GET",
				path: "/users/1",
				response: {
					status: 200,
					headers: new Headers({ "content-type": "application/json" }),
					body,
				},
			},
		],
	});

	const svc = defineAdapter({
		baseURL: "https://x",
		endpoints: {
			getUser: defineEndpoint({
				method: "GET",
				path: "/users/:id",
				output: typedOutput<{ id: number; name: string }>(),
			}),
		},
	});
	const api = createClient({ adapters: { svc }, transport });

	const rawCall = () =>
		transport({
			url: "https://x/users/1",
			method: "GET",
			headers: new Headers(),
		});
	const pipelineCall = () => api.svc.getUser({ params: { id: 1 } });

	return { rawCall, pipelineCall };
}
