import type {
	HttpMethod,
	Transport,
	TransportRequest,
	TransportResponse,
} from "@zerovoids/http";

export type MockResponseInit = Partial<TransportResponse> & { status: number };

export type ScenarioOptions = {
	/**
	 * What to do when the sequence is exhausted:
	 * - `"cycle"`: loop back to the first response (default; good for idempotent simulations)
	 * - `"last"`: keep returning the final response forever (good for "once stable, stays stable")
	 * - `"throw"`: throw — surfaces as a `kind: "network"` NormalizedError
	 */
	onExhausted?: "cycle" | "last" | "throw";
};

/**
 * Produce a response-factory that walks a fixed sequence of responses on each
 * call. Useful for simulating flaky or stateful APIs:
 *
 * ```ts
 * scenario([
 *   { status: 500 },                                    // first call fails
 *   { status: 500 },                                    // second call fails
 *   { status: 200, body: '{"ok":true}' },               // third call succeeds
 * ], { onExhausted: "last" })
 * ```
 */
export function scenario(
	responses: ReadonlyArray<MockResponseInit | MockResponseFactory>,
	options: ScenarioOptions = {},
): MockResponseFactory {
	if (responses.length === 0) {
		throw new Error("@zerovoids/http-mock: scenario() requires ≥ 1 response");
	}
	const onExhausted = options.onExhausted ?? "cycle";
	let i = 0;
	return async (req) => {
		let picked: MockResponseInit | MockResponseFactory;
		if (i < responses.length) {
			picked = responses[i++] as MockResponseInit | MockResponseFactory;
		} else if (onExhausted === "cycle") {
			i = 1;
			picked = responses[0] as MockResponseInit | MockResponseFactory;
		} else if (onExhausted === "last") {
			picked = responses[responses.length - 1] as
				| MockResponseInit
				| MockResponseFactory;
		} else {
			throw new Error(
				"@zerovoids/http-mock: scenario exhausted (onExhausted: 'throw')",
			);
		}
		return typeof picked === "function" ? await picked(req) : picked;
	};
}

export type MockResponseFactory = (
	req: TransportRequest,
) => MockResponseInit | Promise<MockResponseInit>;

export type MockResponse = MockResponseInit | MockResponseFactory;

export type MockHeaderMatcher = Record<string, string | RegExp>;

export type MockRoute = {
	method: HttpMethod;
	path: string | RegExp;
	response: MockResponse;
	/** Artificial delay in ms before returning the response. */
	delay?: number;
	/** Custom body matcher. Returning `false` causes the route to be skipped. */
	body?: (body: unknown) => boolean;
	/** Header matcher — all listed headers must match (string eq or RegExp test). */
	headers?: MockHeaderMatcher;
};

export type MockCall = {
	url: string;
	method: HttpMethod;
	headers: Record<string, string>;
	body: unknown;
};

export type MockTransportOptions = {
	routes: ReadonlyArray<MockRoute>;
	onUnmatched?: "throw" | "404";
};

export type MockTransport = Transport & {
	/** Chronological list of requests seen by the transport. */
	readonly calls: ReadonlyArray<MockCall>;
	/** Clears the call history. */
	reset(): void;
};

function matchesPath(path: string | RegExp, url: string): boolean {
	return typeof path === "string" ? url.endsWith(path) : path.test(url);
}

function matchesHeaders(
	matcher: MockHeaderMatcher | undefined,
	headers: Headers,
): boolean {
	if (!matcher) return true;
	for (const [k, v] of Object.entries(matcher)) {
		const actual = headers.get(k);
		if (actual === null) return false;
		if (typeof v === "string" ? actual !== v : !v.test(actual)) return false;
	}
	return true;
}

function headersToObject(h: Headers): Record<string, string> {
	const out: Record<string, string> = {};
	h.forEach((v, k) => {
		out[k] = v;
	});
	return out;
}

const delay = (ms: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createMockTransport(
	options: MockTransportOptions,
): MockTransport {
	const history: MockCall[] = [];

	const handler = async (req: TransportRequest): Promise<TransportResponse> => {
		history.push({
			url: req.url,
			method: req.method,
			headers: headersToObject(req.headers),
			body: req.body ?? null,
		});

		const match = options.routes.find((r) => {
			if (r.method !== req.method) return false;
			if (!matchesPath(r.path, req.url)) return false;
			if (!matchesHeaders(r.headers, req.headers)) return false;
			if (r.body && !r.body(req.body ?? null)) return false;
			return true;
		});

		if (match) {
			if (match.delay) await delay(match.delay);
			const init =
				typeof match.response === "function"
					? await match.response(req)
					: match.response;
			return {
				status: init.status,
				headers: init.headers ?? new Headers(),
				body: init.body ?? null,
			};
		}

		if (options.onUnmatched === "404") {
			return { status: 404, headers: new Headers(), body: null };
		}
		throw new Error(
			`@zerovoids/http-mock: no route matched ${req.method} ${req.url}`,
		);
	};

	const transport = handler as MockTransport;
	Object.defineProperty(transport, "calls", {
		get: () => history,
		enumerable: true,
	});
	transport.reset = () => {
		history.length = 0;
	};
	return transport;
}
