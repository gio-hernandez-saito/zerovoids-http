import type {
	Transport,
	TransportRequest,
	TransportResponse,
} from "@zerovoids/http";
import kyDefault, { type KyInstance } from "ky";

export type KyTransportOptions = {
	/**
	 * Pre-configured ky instance. Use `ky.create({ ... })` if you need to
	 * supply a custom `fetch`, hooks, etc. Defaults to the global `ky`.
	 *
	 * NOTE: We disable ky's retry and timeout internally because the core
	 * pipeline owns those semantics. Hooks should also be avoided to prevent
	 * interference with the `@zerovoids/http` Plugin pipeline.
	 */
	ky?: KyInstance;
};

/**
 * Transport implementation backed by [ky](https://github.com/sindresorhus/ky).
 *
 * Swap the default fetch transport for ky with a one-line change:
 * ```ts
 * createClient({ adapters, transport: kyTransport() });
 * ```
 */
export function kyTransport(options: KyTransportOptions = {}): Transport {
	const client: KyInstance = options.ky ?? kyDefault;

	return async (req: TransportRequest): Promise<TransportResponse> => {
		const init: Parameters<KyInstance>[1] = {
			method: req.method,
			headers: req.headers,
			throwHttpErrors: false,
			retry: 0,
			timeout: false,
		};
		if (req.body != null) init.body = req.body as BodyInit;
		if (req.signal) init.signal = req.signal;
		const res = await client(req.url, init);
		const text = await res.text();
		return {
			status: res.status,
			headers: res.headers,
			body: text.length === 0 ? null : text,
		};
	};
}
