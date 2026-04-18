import { generateRequestId } from "../id.js";
import type { Plugin } from "../plugin.js";
import type { HttpMethod } from "../types.js";

export type IdempotencyKeyOptions = {
	methods?: ReadonlyArray<HttpMethod>;
	header?: string;
	generate?: () => string;
};

const DEFAULT_METHODS: ReadonlyArray<HttpMethod> = ["POST", "PATCH"];

/**
 * Auto-inject `Idempotency-Key` on write requests so safe retries cannot
 * double-charge / double-create. Caller-supplied headers win — this never
 * overwrites an existing key.
 */
export function idempotencyKey(options: IdempotencyKeyOptions = {}): Plugin {
	const methods = new Set<HttpMethod>(options.methods ?? DEFAULT_METHODS);
	const header = (options.header ?? "Idempotency-Key").toLowerCase();
	const generate = options.generate ?? generateRequestId;
	return {
		id: "core:idempotency-key",
		name: "idempotencyKey",
		init: async (url, request) => {
			if (!methods.has(request.method)) return { url, options: request };
			if (request.headers.has(header)) return { url, options: request };
			request.headers.set(header, generate());
			return { url, options: request };
		},
	};
}
