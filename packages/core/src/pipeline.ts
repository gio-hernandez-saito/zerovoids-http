import type { AdapterDefinition } from "./adapter.js";
import { defaultErrorMap } from "./adapter.js";
import type { CallOptions, Result } from "./client.js";
import { decodeBody } from "./decode.js";
import type { EndpointDefinition } from "./endpoint.js";
import {
	type NormalizedErrorTrace,
	createNormalizedError,
} from "./error/normalize.js";
import { generateRequestId } from "./id.js";
import type { Plugin, PluginContext } from "./plugin.js";
import { computeBackoffMs, maxAttempts } from "./retry/index.js";
import { validateStandard } from "./schema/standard.js";
import { anySignal, isTimeoutAbort, timeoutSignal } from "./timeout.js";
import type {
	RetryStrategy,
	Transport,
	TransportRequest,
	TransportResponse,
} from "./types.js";
import { composePath } from "./url.js";

export type PipelineConfig = {
	transport: Transport;
	plugins: ReadonlyArray<Plugin>;
	retry?: RetryStrategy | undefined;
	timeout?: number | undefined;
};

export type ExecuteArgs = PipelineConfig & {
	adapter: AdapterDefinition;
	endpoint: EndpointDefinition;
	input: unknown;
	options: CallOptions;
	raw?: boolean;
};

type InputShape = {
	params?: Record<string, string | number>;
	body?: unknown;
	query?: Record<string, unknown>;
	headers?: Record<string, string>;
};

const delay = (ms: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, ms));

function toHeaderObj(h: unknown): Record<string, string> {
	if (!h || typeof h !== "object" || Array.isArray(h)) return {};
	const out: Record<string, string> = {};
	for (const [k, v] of Object.entries(h as Record<string, unknown>)) {
		if (typeof v === "string") out[k] = v;
		else if (typeof v === "number" || typeof v === "boolean")
			out[k] = String(v);
	}
	return out;
}

function mergeHeaders(
	...layers: Array<Record<string, string> | undefined>
): Headers {
	const h = new Headers();
	for (const layer of layers) {
		if (!layer) continue;
		for (const [k, v] of Object.entries(layer)) {
			h.set(k.toLowerCase(), v);
		}
	}
	return h;
}

function serializeBody(body: unknown, headers: Headers): BodyInit | null {
	if (body === undefined || body === null) return null;
	if (typeof body === "string") return body;
	if (body instanceof ArrayBuffer) return body;
	if (typeof FormData !== "undefined" && body instanceof FormData) return body;
	if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams)
		return body;
	if (typeof Blob !== "undefined" && body instanceof Blob) return body;
	if (typeof ReadableStream !== "undefined" && body instanceof ReadableStream)
		return body;
	if (!headers.has("content-type"))
		headers.set("content-type", "application/json");
	return JSON.stringify(body);
}

function isAbortError(e: unknown): boolean {
	return (
		e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError")
	);
}

async function safeHook(
	hook:
		| ((
				ctx: PluginContext,
		  ) => Promise<PluginContext> | PluginContext | undefined)
		| undefined,
	ctx: PluginContext,
): Promise<void> {
	if (!hook) return;
	try {
		await hook(ctx);
	} catch {
		/* plugin hook errors are isolated */
	}
}

async function safeErrorHook(
	hook:
		| ((ctx: PluginContext & { error: unknown }) => Promise<void> | void)
		| undefined,
	ctx: PluginContext & { error: unknown },
): Promise<void> {
	if (!hook) return;
	try {
		await hook(ctx);
	} catch {
		/* isolated */
	}
}

function decideRetry(
	strategy: RetryStrategy,
	response: TransportResponse | null,
	networkError: unknown,
): boolean {
	if (typeof strategy !== "number" && strategy.shouldRetry) {
		return strategy.shouldRetry(response);
	}
	if (networkError) return true;
	if (!response) return false;
	const s = response.status;
	return s === 408 || s === 429 || (s >= 500 && s < 600);
}

function onRetryHook(
	strategy: RetryStrategy,
	response: TransportResponse | null,
	attempt: number,
): void {
	if (typeof strategy !== "number" && strategy.onRetry) {
		try {
			strategy.onRetry(response, attempt);
		} catch {
			/* isolated */
		}
	}
}

export async function executeCall(args: ExecuteArgs): Promise<Result<unknown>> {
	const { transport, plugins, adapter, endpoint, input, options } = args;
	const requestId = generateRequestId();
	const method = endpoint.method;

	const inputObj: InputShape = (input ?? {}) as InputShape;

	const trace = (url: string, attempt: number): NormalizedErrorTrace => ({
		requestId,
		url,
		method,
		attempt,
	});

	// 1. Validate input schemas
	if (endpoint.body && inputObj.body !== undefined) {
		const r = await validateStandard(endpoint.body, inputObj.body);
		if (!r.ok) {
			return {
				data: null,
				error: createNormalizedError({
					kind: "validation",
					code: "BODY_INVALID",
					retryable: false,
					cause: r.issues,
					trace: trace(adapter.baseURL + endpoint.path, 1),
				}),
			};
		}
		inputObj.body = r.value;
	}
	if (endpoint.query && inputObj.query !== undefined) {
		const r = await validateStandard(endpoint.query, inputObj.query);
		if (!r.ok) {
			return {
				data: null,
				error: createNormalizedError({
					kind: "validation",
					code: "QUERY_INVALID",
					retryable: false,
					cause: r.issues,
					trace: trace(adapter.baseURL + endpoint.path, 1),
				}),
			};
		}
		inputObj.query = r.value as Record<string, unknown>;
	}
	if (endpoint.headers && inputObj.headers !== undefined) {
		const r = await validateStandard(endpoint.headers, inputObj.headers);
		if (!r.ok) {
			return {
				data: null,
				error: createNormalizedError({
					kind: "validation",
					code: "HEADERS_INVALID",
					retryable: false,
					cause: r.issues,
					trace: trace(adapter.baseURL + endpoint.path, 1),
				}),
			};
		}
		inputObj.headers = r.value as Record<string, string>;
	}

	// 2. Compose URL + headers + body
	const url = composePath(
		adapter.baseURL,
		endpoint.path,
		inputObj.params,
		inputObj.query,
	);
	const headers = mergeHeaders(
		adapter.defaultHeaders,
		toHeaderObj(inputObj.headers),
		toHeaderObj(options.headers),
	);
	const body = serializeBody(inputObj.body, headers);

	// 3. Signal composition
	const timeoutMs = options.timeout ?? args.timeout;
	const signal = anySignal([
		options.signal,
		timeoutMs !== undefined ? timeoutSignal(timeoutMs) : undefined,
	]);

	// 4. Build base request
	const credentials = options.credentials ?? adapter.credentials;
	const mode = options.mode ?? adapter.mode;
	const cache = options.cache ?? adapter.cache;
	let request: TransportRequest = {
		url,
		method,
		headers,
		body,
		signal,
		...(credentials !== undefined ? { credentials } : {}),
		...(mode !== undefined ? { mode } : {}),
		...(cache !== undefined ? { cache } : {}),
	};

	// 5. Plugin init (URL rewriting stage)
	for (const p of plugins) {
		if (!p.init) continue;
		try {
			const result = await p.init(request.url, request);
			request = { ...result.options, url: result.url };
		} catch (e) {
			return {
				data: null,
				error: createNormalizedError({
					kind: "network",
					code: "PLUGIN_INIT_FAILED",
					retryable: false,
					cause: e,
					trace: trace(request.url, 1),
				}),
			};
		}
	}

	// 6. Retry loop
	const retryStrategy: RetryStrategy = args.retry ?? 1;
	const totalAttempts = Math.max(1, maxAttempts(retryStrategy));

	let response: TransportResponse | null = null;
	let networkError: unknown = null;
	let attempt = 1;

	for (attempt = 1; attempt <= totalAttempts; attempt++) {
		const ctx: PluginContext = { url: request.url, request, attempt };

		for (const p of plugins) {
			await safeHook(p.hooks?.onRequest, ctx);
		}

		try {
			response = await transport(request);
			networkError = null;
		} catch (e) {
			if (isAbortError(e)) {
				const reason = (request.signal as AbortSignal | undefined)?.reason;
				const kind =
					isTimeoutAbort(reason) || isTimeoutAbort(e) ? "timeout" : "canceled";
				return {
					data: null,
					error: createNormalizedError({
						kind,
						code: kind === "timeout" ? "TIMEOUT" : "CANCELED",
						retryable: false,
						cause: e,
						trace: trace(request.url, attempt),
					}),
				};
			}
			networkError = e;
			response = null;
		}

		const canRetry = attempt < totalAttempts;
		if (!canRetry) break;
		if (!decideRetry(retryStrategy, response, networkError)) break;

		onRetryHook(retryStrategy, response, attempt);
		const backoff = computeBackoffMs(retryStrategy, attempt, response);
		if (backoff > 0) await delay(backoff);
	}

	// 7. Network error terminal (no response)
	if (!response) {
		return {
			data: null,
			error: createNormalizedError({
				kind: "network",
				code: "NETWORK_ERROR",
				retryable: false,
				cause: networkError,
				trace: trace(request.url, attempt),
			}),
		};
	}

	// 7.5. Raw escape hatch — skip decode / errorMap / output-validate.
	// Success branch returns the TransportResponse regardless of status;
	// network/timeout/canceled still surface as NormalizedError above.
	if (args.raw) {
		const rawCtx: PluginContext = {
			url: request.url,
			request,
			response,
			attempt,
		};
		for (const p of plugins) {
			await safeHook(p.hooks?.onResponse, rawCtx);
		}
		return { data: response, error: null };
	}

	// 8. Decode body
	const contentType = response.headers.get("content-type");
	let responseBody: unknown;
	try {
		responseBody = await decodeBody(
			response.body,
			contentType,
			response.status,
		);
	} catch (e) {
		return {
			data: null,
			error: createNormalizedError({
				kind: "network",
				code: "DECODE_ERROR",
				httpStatus: response.status,
				retryable: false,
				cause: e,
				trace: trace(request.url, attempt),
			}),
		};
	}

	// 9. onResponse hooks
	const respCtx: PluginContext = {
		url: request.url,
		request,
		response,
		attempt,
	};
	for (const p of plugins) {
		await safeHook(p.hooks?.onResponse, respCtx);
	}

	// 10. Non-2xx → errorMap
	if (response.status < 200 || response.status >= 300) {
		const errorMap = adapter.errorMap ?? defaultErrorMap;
		const error = errorMap(responseBody, {
			httpStatus: response.status,
			headers: response.headers,
			trace: trace(request.url, attempt),
		});
		for (const p of plugins) {
			await safeErrorHook(p.hooks?.onError, { ...respCtx, error });
		}
		return { data: null, error };
	}

	// 11. Output validation
	if (endpoint.output) {
		const r = await validateStandard(endpoint.output, responseBody);
		if (!r.ok) {
			return {
				data: null,
				error: createNormalizedError({
					kind: "validation",
					code: "RESPONSE_INVALID",
					httpStatus: response.status,
					retryable: false,
					cause: r.issues,
					trace: trace(request.url, attempt),
				}),
			};
		}
		responseBody = r.value;
	}

	// 12. onSuccess hooks
	for (const p of plugins) {
		await safeHook(p.hooks?.onSuccess, respCtx);
	}

	return { data: responseBody, error: null };
}
