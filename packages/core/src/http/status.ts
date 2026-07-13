/**
 * A coarse allowlist of HTTP statuses commonly treated as *transient*. This is a
 * CONVENTION, not a standard: it mirrors Google Cloud Storage's retry list
 * (408, 429, 500, 502, 503, 504) plus Cloudflare's origin 5xx (520–524, documented
 * by Cloudflare as retryable). RFC 9110 gives only 503 explicit "temporary" wording;
 * 501 and 505 are excluded as RFC-permanent.
 *
 * It marks a failure's *class* only. Deciding to actually retry additionally
 * requires an idempotent method (RFC 9110 §9.2.2) or an idempotency key, and should
 * honor `Retry-After`.
 */
const RETRYABLE_STATUS: ReadonlySet<number> = new Set([
  408, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524,
])

/** Whether `status` is an integer in the HTTP error range (400–599). */
export function isHttpErrorStatus(status: unknown): status is number {
  return typeof status === 'number' && Number.isInteger(status) && status >= 400 && status <= 599
}

/**
 * Whether `status` is in the transient-class allowlist above — a hint about the
 * failure's *class*, not a verdict that retrying is safe. See {@link RETRYABLE_STATUS}.
 */
export function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUS.has(status)
}
