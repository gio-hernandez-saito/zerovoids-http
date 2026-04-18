export { optimistic } from "./optimistic.js";

import {
	type QueryClient,
	type QueryKey,
	type UseInfiniteQueryOptions,
	type UseInfiniteQueryResult,
	type UseMutationOptions,
	type UseMutationResult,
	type UseQueryOptions,
	type UseQueryResult,
	type UseSuspenseInfiniteQueryOptions,
	type UseSuspenseInfiniteQueryResult,
	type UseSuspenseQueryOptions,
	type UseSuspenseQueryResult,
	useInfiniteQuery as tqUseInfiniteQuery,
	useMutation as tqUseMutation,
	useQuery as tqUseQuery,
	useSuspenseInfiniteQuery as tqUseSuspenseInfiniteQuery,
	useSuspenseQuery as tqUseSuspenseQuery,
} from "@tanstack/react-query";
import type { NormalizedError } from "@zerovoids/http";

/**
 * Deterministic canonicalization for QueryKey parts — sorts object keys so
 * `{ a: 1, b: 2 }` and `{ b: 2, a: 1 }` produce equal keys in the cache.
 * Arrays keep order; primitives pass through.
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

/**
 * Build the cache key for a given adapter/endpoint call.
 * Shape: `[adapter, endpoint]` for zero-input, `[adapter, endpoint, canonicalInput]` otherwise.
 * Partial keys (`[adapter]`, `[adapter, endpoint]`) are valid for `invalidate`.
 */
export function queryKeyFor(
	adapter: string,
	endpoint: string,
	input?: unknown,
): QueryKey {
	return input === undefined
		? [adapter, endpoint]
		: [adapter, endpoint, canonicalize(input)];
}

export type InvalidateKey =
	| readonly [string]
	| readonly [string, string]
	| readonly [string, string, unknown];

/**
 * Invalidate queries by adapter, adapter+endpoint, or adapter+endpoint+input.
 * Thin convenience over `queryClient.invalidateQueries` that keeps the key
 * shape aligned with `queryKeyFor`.
 */
export function invalidate(qc: QueryClient, key: InvalidateKey) {
	return qc.invalidateQueries({ queryKey: key as unknown as QueryKey });
}

// Types ---------------------------------------------------------------------

// Allow zero-arg endpoint fns (no required input) to be wrapped transparently.
// Using `any` here is deliberate: we sit above the strongly-typed Client and
// project its signatures through to each hook.
// biome-ignore lint/suspicious/noExplicitAny: generic projection boundary
type AnyFn = (...args: any[]) => Promise<any>;
type EndpointInput<F extends AnyFn> = Parameters<F>[0];
// Pull the success-branch data type out of `Result<T>` robustly — works even
// when the endpoint type is intersected with sibling properties (e.g., `.raw`),
// which confused the earlier `F extends (...) => Promise<...>` pattern.
type EndpointOutput<F extends AnyFn> = Extract<
	Awaited<ReturnType<F>>,
	{ error: null }
> extends { data: infer D }
	? D
	: never;

type InfiniteArgs<Input, TPageParam> = {
	input: (pageParam: TPageParam) => Input;
	initialPageParam: TPageParam;
	getNextPageParam: (
		lastPage: unknown,
		allPages: unknown[],
		lastPageParam: TPageParam,
	) => TPageParam | null | undefined;
};

export type EndpointHooks<F extends AnyFn> = {
	useQuery: (
		input: EndpointInput<F>,
		options?: Omit<
			UseQueryOptions<
				EndpointOutput<F>,
				NormalizedError,
				EndpointOutput<F>,
				QueryKey
			>,
			"queryKey" | "queryFn"
		>,
	) => UseQueryResult<EndpointOutput<F>, NormalizedError>;
	useSuspenseQuery: (
		input: EndpointInput<F>,
		options?: Omit<
			UseSuspenseQueryOptions<
				EndpointOutput<F>,
				NormalizedError,
				EndpointOutput<F>,
				QueryKey
			>,
			"queryKey" | "queryFn"
		>,
	) => UseSuspenseQueryResult<EndpointOutput<F>, NormalizedError>;
	useInfiniteQuery: <TPageParam>(
		args: InfiniteArgs<EndpointInput<F>, TPageParam>,
		options?: Omit<
			UseInfiniteQueryOptions<
				EndpointOutput<F>,
				NormalizedError,
				// biome-ignore lint/suspicious/noExplicitAny: pass-through
				any,
				QueryKey,
				TPageParam
			>,
			"queryKey" | "queryFn" | "initialPageParam" | "getNextPageParam"
		>,
		// biome-ignore lint/suspicious/noExplicitAny: pass-through
	) => UseInfiniteQueryResult<any, NormalizedError>;
	useSuspenseInfiniteQuery: <TPageParam>(
		args: InfiniteArgs<EndpointInput<F>, TPageParam>,
		options?: Omit<
			UseSuspenseInfiniteQueryOptions<
				EndpointOutput<F>,
				NormalizedError,
				// biome-ignore lint/suspicious/noExplicitAny: pass-through
				any,
				QueryKey,
				TPageParam
			>,
			"queryKey" | "queryFn" | "initialPageParam" | "getNextPageParam"
		>,
		// biome-ignore lint/suspicious/noExplicitAny: pass-through
	) => UseSuspenseInfiniteQueryResult<any, NormalizedError>;
	useMutation: (
		options?: Omit<
			UseMutationOptions<EndpointOutput<F>, NormalizedError, EndpointInput<F>>,
			"mutationFn"
		>,
	) => UseMutationResult<EndpointOutput<F>, NormalizedError, EndpointInput<F>>;
	queryKey: (input?: EndpointInput<F>) => QueryKey;
};

export type ClientHooks<TClient> = {
	[A in keyof TClient]: {
		[E in keyof TClient[A]]: TClient[A][E] extends AnyFn
			? EndpointHooks<TClient[A][E]>
			: never;
	};
};

// Runtime ------------------------------------------------------------------

/**
 * Exposed for tests: given a client endpoint fn, produces a TanStack-compatible
 * async function that returns decoded data and throws `NormalizedError` on the
 * error branch — the shape `useQuery` / `useMutation` expect.
 */
export function makeExecutor(fn: AnyFn): (input?: unknown) => Promise<unknown> {
	return async (input?: unknown) => {
		const r = await fn(input);
		if (r.error) throw r.error;
		return r.data;
	};
}

/**
 * Build a TanStack Query hook surface that mirrors the client shape.
 *
 * `hooks.adapter.endpoint.useQuery(input, options?)` runs a bound query.
 * GET/HEAD semantics suit `useQuery`; write endpoints should use `useMutation`.
 * The adapter does not enforce which hook is used — the caller picks.
 */
export function createQueryHooks<TClient extends Record<string, unknown>>(
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
				queryKey: (input?: unknown) =>
					queryKeyFor(adapterKey, endpointKey, input),
				useQuery: (input: unknown, options?: object) =>
					tqUseQuery({
						queryKey: queryKeyFor(adapterKey, endpointKey, input),
						queryFn: () => exec(input),
						...(options ?? {}),
						// biome-ignore lint/suspicious/noExplicitAny: pass-through
					} as any),
				useSuspenseQuery: (input: unknown, options?: object) =>
					tqUseSuspenseQuery({
						queryKey: queryKeyFor(adapterKey, endpointKey, input),
						queryFn: () => exec(input),
						...(options ?? {}),
						// biome-ignore lint/suspicious/noExplicitAny: pass-through
					} as any),
				useInfiniteQuery: (
					args: InfiniteArgs<unknown, unknown>,
					options?: object,
				) =>
					tqUseInfiniteQuery({
						queryKey: [adapterKey, endpointKey, "__infinite__"] as QueryKey,
						queryFn: ({ pageParam }: { pageParam: unknown }) =>
							exec(args.input(pageParam)),
						initialPageParam: args.initialPageParam,
						getNextPageParam: args.getNextPageParam,
						...(options ?? {}),
						// biome-ignore lint/suspicious/noExplicitAny: pass-through
					} as any),
				useSuspenseInfiniteQuery: (
					args: InfiniteArgs<unknown, unknown>,
					options?: object,
				) =>
					tqUseSuspenseInfiniteQuery({
						queryKey: [adapterKey, endpointKey, "__infinite__"] as QueryKey,
						queryFn: ({ pageParam }: { pageParam: unknown }) =>
							exec(args.input(pageParam)),
						initialPageParam: args.initialPageParam,
						getNextPageParam: args.getNextPageParam,
						...(options ?? {}),
						// biome-ignore lint/suspicious/noExplicitAny: pass-through
					} as any),
				useMutation: (options?: object) =>
					tqUseMutation({
						mutationFn: (input: unknown) => exec(input),
						...(options ?? {}),
						// biome-ignore lint/suspicious/noExplicitAny: pass-through
					} as any),
			};
		}
		hooks[adapterKey] = group;
	}
	return hooks as ClientHooks<TClient>;
}
