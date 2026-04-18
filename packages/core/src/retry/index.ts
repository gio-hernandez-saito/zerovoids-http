import type { RetryStrategy, TransportResponse } from "../types.js";

/**
 * Parse a Retry-After header → milliseconds, or undefined.
 * Supports both seconds (delta-seconds per RFC 7231) and HTTP-date formats.
 */
export function parseRetryAfter(header: string | null): number | undefined {
	if (!header) return undefined;
	const trimmed = header.trim();
	if (trimmed === "") return undefined;
	const asNumber = Number(trimmed);
	if (Number.isFinite(asNumber) && asNumber >= 0) return asNumber * 1000;
	const ts = Date.parse(trimmed);
	if (Number.isFinite(ts)) return Math.max(0, ts - Date.now());
	return undefined;
}

export function computeBackoffMs(
	strategy: RetryStrategy,
	attempt: number,
	response: TransportResponse | null,
): number {
	const retryAfter = parseRetryAfter(
		response?.headers.get("retry-after") ?? null,
	);
	if (retryAfter !== undefined) return retryAfter;

	if (typeof strategy === "number") return 0;
	if (strategy.type === "linear") return strategy.delay;

	const base = strategy.baseDelay * 2 ** (attempt - 1);
	const capped = Math.min(base, strategy.maxDelay);
	const jitter = 0.5 + Math.random() * 0.5;
	return Math.floor(capped * jitter);
}

export function maxAttempts(strategy: RetryStrategy): number {
	if (typeof strategy === "number") return strategy;
	return strategy.attempts;
}
