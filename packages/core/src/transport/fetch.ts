import type {
	Transport,
	TransportRequest,
	TransportResponse,
} from "../types.js";

export function fetchTransport(
	fetchImpl: typeof fetch = globalThis.fetch,
): Transport {
	return async (req: TransportRequest): Promise<TransportResponse> => {
		const init: RequestInit = {
			method: req.method,
			headers: req.headers,
			body: req.body ?? null,
		};
		if (req.signal) init.signal = req.signal;
		if (req.credentials) init.credentials = req.credentials;
		if (req.mode) init.mode = req.mode;
		if (req.cache) init.cache = req.cache;
		const res = await fetchImpl(req.url, init);
		// v0: consume body as text. Binary/streaming access will come via `.raw()` in v1.
		const text = await res.text();
		return {
			status: res.status,
			headers: res.headers,
			body: text.length === 0 ? null : text,
		};
	};
}
