import type { AdapterDefinition } from "./adapter.js";
import type { EndpointDefinition, ExtractPathParams } from "./endpoint.js";
import type { NormalizedError } from "./error/normalize.js";
import { executeCall } from "./pipeline.js";
import type { Plugin } from "./plugin.js";
import { fetchTransport } from "./transport/fetch.js";
import type {
	RetryStrategy,
	StandardSchemaV1,
	Transport,
	TransportResponse,
} from "./types.js";

export type CallOptions = {
	signal?: AbortSignal;
	timeout?: number;
	headers?: Record<string, string>;
	credentials?: RequestCredentials;
	mode?: RequestMode;
	cache?: RequestCache;
};

export type Result<T> =
	| { data: T; error: null }
	| { data: null; error: NormalizedError };

type HasPathParams<P extends string> = ExtractPathParams<P> extends Record<
	string,
	never
>
	? false
	: true;

// `EndpointDefinition`'s schema fields are optional (`body?:` etc.). A
// required-field match pattern (`E extends { body: ... }`) fails against
// types that declare the field with `?:`, so we pattern-match with the same
// optional modifier and strip `undefined` with `NonNullable` before extracting
// the generic payload. Without this, endpoints defined via `typedOutput<T>()`
// leaked `unknown` all the way through to UI consumers.
type InferBody<E> = E extends { body?: infer S }
	? NonNullable<S> extends StandardSchemaV1<infer B>
		? B
		: never
	: never;
type InferQuery<E> = E extends { query?: infer S }
	? NonNullable<S> extends StandardSchemaV1<infer Q>
		? Q
		: never
	: never;
type InferHeaders<E> = E extends { headers?: infer S }
	? NonNullable<S> extends StandardSchemaV1<infer H>
		? H
		: never
	: never;
type InferOutput<E> = E extends { output?: infer S }
	? NonNullable<S> extends StandardSchemaV1<unknown, infer O>
		? O
		: unknown
	: unknown;

type EndpointCallInput<E extends EndpointDefinition> = (HasPathParams<
	E["path"]
> extends true
	? { params: ExtractPathParams<E["path"]> }
	: { params?: never }) &
	(E extends { body: StandardSchemaV1 }
		? { body: InferBody<E> }
		: { body?: never }) &
	(E extends { query: StandardSchemaV1 }
		? { query: InferQuery<E> }
		: { query?: never }) &
	(E extends { headers: StandardSchemaV1 }
		? { headers: InferHeaders<E> }
		: { headers?: never });

type RequiredKeys<T> = {
	[K in keyof T]-?: undefined extends T[K] ? never : K;
}[keyof T];

type CallFn<E extends EndpointDefinition> = RequiredKeys<
	EndpointCallInput<E>
> extends never
	? (
			input?: EndpointCallInput<E>,
			options?: CallOptions,
		) => Promise<Result<InferOutput<E>>>
	: (
			input: EndpointCallInput<E>,
			options?: CallOptions,
		) => Promise<Result<InferOutput<E>>>;

type RawFn<E extends EndpointDefinition> = RequiredKeys<
	EndpointCallInput<E>
> extends never
	? (
			input?: EndpointCallInput<E>,
			options?: CallOptions,
		) => Promise<Result<TransportResponse>>
	: (
			input: EndpointCallInput<E>,
			options?: CallOptions,
		) => Promise<Result<TransportResponse>>;

type EndpointFn<E extends EndpointDefinition> = CallFn<E> & {
	raw: RawFn<E>;
};

export type Client<TAdapters extends Record<string, AdapterDefinition>> = {
	[A in keyof TAdapters]: {
		[E in keyof TAdapters[A]["endpoints"]]: TAdapters[A]["endpoints"][E] extends EndpointDefinition
			? EndpointFn<TAdapters[A]["endpoints"][E]>
			: never;
	};
};

export type ClientConfig<TAdapters extends Record<string, AdapterDefinition>> =
	{
		adapters: TAdapters;
		transport?: Transport;
		plugins?: ReadonlyArray<Plugin>;
		retry?: RetryStrategy;
		timeout?: number;
	};

export function createClient<
	const TAdapters extends Record<string, AdapterDefinition>,
>(config: ClientConfig<TAdapters>): Client<TAdapters> {
	const transport = config.transport ?? fetchTransport();
	const plugins = config.plugins ?? [];

	// Plugin ID uniqueness check — prevents accidental duplicates
	const seen = new Set<string>();
	for (const p of plugins) {
		if (seen.has(p.id)) {
			throw new Error(`@zerovoids/http: duplicate plugin id "${p.id}"`);
		}
		seen.add(p.id);
	}

	const client: Record<string, Record<string, unknown>> = {};
	for (const adapterKey in config.adapters) {
		const adapter = config.adapters[adapterKey];
		if (!adapter) continue;
		const endpoints: Record<string, unknown> = {};
		for (const epKey in adapter.endpoints) {
			const endpoint = adapter.endpoints[epKey];
			if (!endpoint) continue;
			const call = (input?: unknown, options?: CallOptions) =>
				executeCall({
					transport,
					plugins,
					retry: config.retry,
					timeout: config.timeout,
					adapter,
					endpoint,
					input,
					options: options ?? {},
				});
			(call as unknown as { raw: unknown }).raw = (
				input?: unknown,
				options?: CallOptions,
			) =>
				executeCall({
					transport,
					plugins,
					retry: config.retry,
					timeout: config.timeout,
					adapter,
					endpoint,
					input,
					options: options ?? {},
					raw: true,
				});
			endpoints[epKey] = call;
		}
		client[adapterKey] = endpoints;
	}
	return client as unknown as Client<TAdapters>;
}

/**
 * Convert a `Result<T>` Promise into a throw-on-error Promise.
 * Lets callers opt-in to exception-style handling per call.
 */
export async function unwrap<T>(promise: Promise<Result<T>>): Promise<T> {
	const { data, error } = await promise;
	if (error) throw error;
	return data as T;
}
