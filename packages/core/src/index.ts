export { createClient, unwrap } from "./client.js";
export type { CallOptions, Client, ClientConfig, Result } from "./client.js";

export { defaultErrorMap, defineAdapter } from "./adapter.js";
export type {
	AdapterDefinition,
	ErrorMap,
	ErrorMapContext,
} from "./adapter.js";

export { defineEndpoint } from "./endpoint.js";
export type { EndpointDefinition, ExtractPathParams } from "./endpoint.js";

export { definePlugin } from "./plugin.js";
export type { Plugin, PluginContext } from "./plugin.js";

export { fetchTransport } from "./transport/fetch.js";
export { dedupTransport, type DedupOptions } from "./transport/dedup.js";

export {
	idempotencyKey,
	type IdempotencyKeyOptions,
} from "./plugins/idempotency.js";

export {
	parseLinkHeader,
	type CursorPagination,
	type OffsetPagination,
	type LinkHeaderPagination,
	type CustomPagination,
	type PaginationStrategy,
} from "./pagination.js";

export {
	NormalizedError,
	createNormalizedError,
	type NormalizedErrorInput,
	type NormalizedErrorKind,
	type NormalizedErrorTrace,
} from "./error/normalize.js";

export { isNormalizedError, isKind, exhaustiveGuard } from "./error/guards.js";

export {
	isAuth,
	isCanceled,
	isClientError,
	isDomain,
	isNetwork,
	isRateLimited,
	isRetryable,
	isServerError,
	isTimeout,
	isValidation,
} from "./error/helpers.js";

export {
	typedInput,
	typedOutput,
	validateStandard,
} from "./schema/standard.js";

export {
	computeBackoffMs,
	maxAttempts,
	parseRetryAfter,
} from "./retry/index.js";

export { composePath, serializeQuery } from "./url.js";
export { decodeBody, isTextLike } from "./decode.js";
export { generateRequestId } from "./id.js";
export { timeoutSignal, anySignal, isTimeoutAbort } from "./timeout.js";

export type {
	HttpMethod,
	RetryStrategy,
	StandardSchemaV1,
	Transport,
	TransportRequest,
	TransportResponse,
} from "./types.js";
