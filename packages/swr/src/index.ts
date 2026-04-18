import type { NormalizedError } from "@zerovoids/http";
import useSWR, { type SWRConfiguration, type SWRResponse } from "swr";
import useSWRInfinite, {
	type SWRInfiniteConfiguration,
	type SWRInfiniteResponse,
} from "swr/infinite";

/**
 * Deterministic canonicalization — sorts object keys so `{a,b}` and `{b,a}`
 * share a single SWR cache entry. Arrays keep order; primitives pass through.
 */
export function canonicalize(v: unknown): unknown {
	if (v === null || typeof v !== "object") return v;
	if (Array.isArray(v)) return v.map(canonicalize);
	const keys = Object.keys(v as object).sort();
	const out: Record<string, unknown> = {};
	for (const k of keys) {
		out[k] = canonicalize((v as Record<string, unknown>)[k]);
	}
	return out;
}

export type SwrKey =
	| readonly [string, string]
	| readonly [string, string, unknown];

/**
 * Build the cache key for a given adapter/endpoint call. Shape is
 * `[adapter, endpoint]` for zero-input calls, `[adapter, endpoint, canonicalInput]`
 * otherwise — matches `@zerovoids/http-react-query` so shared fixtures work.
 */
export function swrKeyFor(
	adapter: string,
	endpoint: string,
	input?: unknown,
): SwrKey {
	return input === undefined
		? [adapter, endpoint]
		: [adapter, endpoint, canonicalize(input)];
}

// biome-ignore lint/suspicious/noExplicitAny: generic projection boundary
type AnyFn = (...args: any[]) => Promise<any>;
type EndpointInput<F extends AnyFn> = Parameters<F>[0];
// Extract the success branch of `Result<T>` by picking the union member
// with `error: null` — survives intersection types (e.g., `.raw` sibling).
type EndpointOutput<F extends AnyFn> = Extract<
	Awaited<ReturnType<F>>,
	{ error: null }
> extends { data: infer D }
	? D
	: never;

/**
 * Test-exposed helper: wraps an endpoint fn so its `Result` branch is
 * flattened to either resolving with data or throwing `NormalizedError`.
 * SWR's `error` slot then receives the normalized shape unchanged.
 */
export function makeExecutor(fn: AnyFn): (input?: unknown) => Promise<unknown> {
	return async (input?: unknown) => {
		const r = await fn(input);
		if (r.error) throw r.error;
		return r.data;
	};
}

export type EndpointHooks<F extends AnyFn> = {
	useSWR: (
		input: EndpointInput<F>,
		config?: SWRConfiguration<EndpointOutput<F>, NormalizedError>,
	) => SWRResponse<EndpointOutput<F>, NormalizedError>;
	useSWRInfinite: <TPage = EndpointOutput<F>>(
		getInput: (
			pageIndex: number,
			previousPageData: TPage | null,
		) => EndpointInput<F> | null,
		config?: SWRInfiniteConfiguration<EndpointOutput<F>, NormalizedError>,
	) => SWRInfiniteResponse<EndpointOutput<F>, NormalizedError>;
	key: (input?: EndpointInput<F>) => SwrKey;
};

export type ClientHooks<TClient> = {
	[A in keyof TClient]: {
		[E in keyof TClient[A]]: TClient[A][E] extends AnyFn
			? EndpointHooks<TClient[A][E]>
			: never;
	};
};

/**
 * Build an SWR hook surface that mirrors the client shape.
 *
 * `hooks.adapter.endpoint.useSWR(input, config?)` runs a bound query.
 * `NormalizedError` is surfaced via SWR's `error` slot unchanged — pair with
 * the `isKind` / `isAuth` helpers from `@zerovoids/http` for exhaustive UI
 * branching.
 */
export function createSwrHooks<TClient extends Record<string, unknown>>(
	client: TClient,
): ClientHooks<TClient> {
	const hooks: Record<string, Record<string, unknown>> = {};
	for (const adapterKey of Object.keys(client)) {
		const adapter = (client as Record<string, unknown>)[adapterKey];
		if (!adapter || typeof adapter !== "object") continue;
		const group: Record<string, unknown> = {};
		for (const endpointKey of Object.keys(adapter as object)) {
			const fn = (adapter as Record<string, unknown>)[endpointKey];
			if (typeof fn !== "function") continue;
			const exec = makeExecutor(fn as AnyFn);
			group[endpointKey] = {
				key: (input?: unknown) => swrKeyFor(adapterKey, endpointKey, input),
				useSWR: (input: unknown, config?: SWRConfiguration) =>
					useSWR(
						swrKeyFor(adapterKey, endpointKey, input),
						() => exec(input),
						config,
					),
				useSWRInfinite: (
					getInput: (pageIndex: number, prev: unknown) => unknown | null,
					config?: SWRInfiniteConfiguration,
				) =>
					useSWRInfinite(
						(pageIndex, previousPageData) => {
							const input = getInput(pageIndex, previousPageData);
							if (input === null || input === undefined) return null;
							return [adapterKey, endpointKey, canonicalize(input)];
						},
						(key) => {
							const arr = key as unknown[];
							return exec(arr[2]);
						},
						config,
					),
			};
		}
		hooks[adapterKey] = group;
	}
	return hooks as ClientHooks<TClient>;
}
