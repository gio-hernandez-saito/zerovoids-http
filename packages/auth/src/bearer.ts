import type {
	Transport,
	TransportRequest,
	TransportResponse,
} from "@zerovoids/http";

export type BearerWithRefreshOptions = {
	/** Read the current access token. Called for every outgoing request. */
	getToken: () => string | null | Promise<string | null>;
	/**
	 * Obtain a new access token. Called at most once per batch of concurrent
	 * 401s thanks to single-flight serialization. Return `null` to surface
	 * the original 401 unchanged (e.g., refresh token itself expired).
	 */
	refresh: () => string | null | Promise<string | null>;
	/** Optional: override when to trigger refresh. Default: `res.status === 401`. */
	shouldRefresh?: (res: TransportResponse) => boolean;
	/** Header to write. Default: `authorization` (lowercased for case-insensitive compare). */
	header?: string;
	/** Scheme prefix. Default: `Bearer`. */
	scheme?: string;
};

export type BearerWithRefreshHandle = {
	/** Wrap an inner transport with Bearer injection + 401-triggered refresh. */
	wrap: (inner: Transport) => Transport;
	/**
	 * Exposed for tests / introspection: returns the currently in-flight
	 * refresh promise, or `null` when idle.
	 */
	readonly inFlight: Promise<string | null> | null;
};

/**
 * Bearer-token transport wrapper with single-flight refresh.
 *
 * When the inner transport returns 401, a refresh is triggered. Concurrent 401s
 * across multiple requests share the *same* refresh call — the first one runs,
 * others wait. After refresh, the failed request is retried **once** with the
 * new token. If the second attempt still 401s, it is surfaced unchanged; we do
 * not recurse on refresh to avoid infinite loops.
 *
 * A race between "someone else already refreshed" is handled: before calling
 * `refresh()`, we re-read `getToken()`; if it changed, we skip the refresh
 * and retry with the fresh token directly.
 */
export function bearerWithRefresh(
	options: BearerWithRefreshOptions,
): BearerWithRefreshHandle {
	const header = (options.header ?? "authorization").toLowerCase();
	const scheme = options.scheme ?? "Bearer";
	const shouldRefresh =
		options.shouldRefresh ?? ((res: TransportResponse) => res.status === 401);

	let refreshPromise: Promise<string | null> | null = null;

	const refreshSingleFlight = (): Promise<string | null> => {
		if (refreshPromise) return refreshPromise;
		const p: Promise<string | null> = (async () => {
			try {
				return await options.refresh();
			} catch {
				return null;
			}
		})().finally(() => {
			if (refreshPromise === p) refreshPromise = null;
		});
		refreshPromise = p;
		return p;
	};

	const applyToken = (req: TransportRequest, token: string): void => {
		req.headers.set(header, `${scheme} ${token}`);
	};

	const handle: BearerWithRefreshHandle = {
		wrap: (inner) => async (req) => {
			const tokenBefore = await options.getToken();
			if (tokenBefore) applyToken(req, tokenBefore);
			const res = await inner(req);
			if (!shouldRefresh(res)) return res;

			// Race: another request may have already refreshed while we were in-flight.
			const tokenNow = await options.getToken();
			if (tokenNow && tokenNow !== tokenBefore) {
				applyToken(req, tokenNow);
				return inner(req);
			}

			const newToken = await refreshSingleFlight();
			if (!newToken) return res;
			applyToken(req, newToken);
			return inner(req);
		},
		get inFlight() {
			return refreshPromise;
		},
	};
	return handle;
}
