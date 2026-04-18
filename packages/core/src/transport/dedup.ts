import type { HttpMethod } from "../types.js";
import type {
	Transport,
	TransportRequest,
	TransportResponse,
} from "../types.js";

export type DedupOptions = {
	methods?: ReadonlyArray<HttpMethod>;
	key?: (req: TransportRequest) => string;
};

const DEFAULT_METHODS: ReadonlyArray<HttpMethod> = ["GET", "HEAD"];

function defaultKey(req: TransportRequest): string {
	return `${req.method} ${req.url}`;
}

/**
 * In-flight request deduplication wrapper.
 *
 * Concurrent identical requests share a single transport call. The first caller
 * triggers the network; subsequent callers await the same promise and all
 * receive the same `TransportResponse` reference. Completed requests (success
 * or failure) are immediately evicted so follow-up calls re-fetch fresh.
 *
 * Only idempotent methods (`GET`, `HEAD`) are deduped by default — writes
 * must execute independently so `Idempotency-Key` semantics are preserved.
 */
export function dedupTransport(
	inner: Transport,
	options: DedupOptions = {},
): Transport {
	const methods = new Set<HttpMethod>(options.methods ?? DEFAULT_METHODS);
	const key = options.key ?? defaultKey;
	const inflight = new Map<string, Promise<TransportResponse>>();
	return async (req) => {
		if (!methods.has(req.method)) return inner(req);
		const k = key(req);
		const existing = inflight.get(k);
		if (existing) return existing;
		const p = inner(req).finally(() => {
			inflight.delete(k);
		});
		inflight.set(k, p);
		return p;
	};
}
