import type { EndpointDefinition } from "./endpoint.js";
import {
	type NormalizedError,
	type NormalizedErrorTrace,
	createNormalizedError,
} from "./error/normalize.js";
import type { PaginationStrategy } from "./pagination.js";
import { parseRetryAfter } from "./retry/index.js";

export type ErrorMapContext = {
	httpStatus: number;
	headers: Headers;
	trace: NormalizedErrorTrace;
};

export type ErrorMap = (raw: unknown, ctx: ErrorMapContext) => NormalizedError;

export type AdapterDefinition<
	TEndpoints extends Record<string, EndpointDefinition> = Record<
		string,
		EndpointDefinition
	>,
> = {
	baseURL: string;
	endpoints: TEndpoints;
	errorMap?: ErrorMap;
	defaultHeaders?: Record<string, string>;
	credentials?: RequestCredentials;
	mode?: RequestMode;
	cache?: RequestCache;
	/**
	 * Declarative pagination strategy. Consumers build next-page inputs on
	 * top of this declaration; the core pipeline never calls into it directly,
	 * so unused adapters pay zero runtime cost.
	 */
	pagination?: PaginationStrategy;
};

/**
 * Default error-mapping strategy used when an adapter omits `errorMap`.
 * Maps status → `HTTP_<status>` code, marks 5xx / 429 / 408 retryable, parses Retry-After.
 */
export const defaultErrorMap: ErrorMap = (raw, ctx) => {
	const { httpStatus, headers, trace } = ctx;
	const retryable =
		httpStatus >= 500 || httpStatus === 429 || httpStatus === 408;
	const retryAfterMs = parseRetryAfter(headers.get("retry-after"));
	return createNormalizedError({
		kind: "http",
		code: `HTTP_${httpStatus}`,
		httpStatus,
		retryable,
		...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
		cause: raw,
		trace,
	});
};

export function defineAdapter<
	const TEndpoints extends Record<string, EndpointDefinition>,
>(def: AdapterDefinition<TEndpoints>): AdapterDefinition<TEndpoints> {
	return def;
}
