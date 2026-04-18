import type { NormalizedError } from "./normalize.js";

/** True if the error is marked retryable by the adapter. */
export function isRetryable(error: NormalizedError): boolean {
	return error.retryable;
}

/** True for 401 / 403 — auth failure or forbidden. */
export function isAuth(error: NormalizedError): boolean {
	return error.httpStatus === 401 || error.httpStatus === 403;
}

/** True for any 4xx (client-fault) HTTP error. */
export function isClientError(error: NormalizedError): boolean {
	return (
		error.kind === "http" &&
		error.httpStatus !== undefined &&
		error.httpStatus >= 400 &&
		error.httpStatus < 500
	);
}

/** True for any 5xx (server-fault) HTTP error. */
export function isServerError(error: NormalizedError): boolean {
	return (
		error.kind === "http" &&
		error.httpStatus !== undefined &&
		error.httpStatus >= 500
	);
}

/** True for 429 rate-limited responses. */
export function isRateLimited(error: NormalizedError): boolean {
	return error.httpStatus === 429;
}

/** True for network-layer failures (DNS, connection reset, CORS). */
export function isNetwork(error: NormalizedError): boolean {
	return error.kind === "network";
}

/** True when the request exceeded its timeout. */
export function isTimeout(error: NormalizedError): boolean {
	return error.kind === "timeout";
}

/** True when the consumer aborted the request. */
export function isCanceled(error: NormalizedError): boolean {
	return error.kind === "canceled";
}

/** True when schema validation (input or output) failed. */
export function isValidation(error: NormalizedError): boolean {
	return error.kind === "validation";
}

/** True for adapter-defined domain errors (e.g. `CARD_DECLINED`). */
export function isDomain(error: NormalizedError): boolean {
	return error.kind === "domain";
}
