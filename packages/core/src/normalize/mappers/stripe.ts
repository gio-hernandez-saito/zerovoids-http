import { NormalizedError } from '../../error/normalized-error.js'
import { parseRetryAfter } from '../../http/retry-after.js'
import { isHttpErrorStatus, isRetryableStatus } from '../../http/status.js'
import { toErrorContext } from '../context.js'
import type { Mapper } from '../mapper.js'

/**
 * Stripe's error envelope: `{ error: { type, code?, message? } }`. `type` is the
 * coarse category (`card_error`, `api_error`, `invalid_request_error`, …) and
 * `code` is the specific machine identifier (`card_declined`, …).
 */
interface StripeError {
  readonly type: string
  readonly code?: unknown
  readonly message?: unknown
}

/**
 * Maps a Stripe API error (`{ error: { type, code, message } }`) into a
 * {@link NormalizedError}.
 *
 * Feed it the PARSED Stripe error body as the error — `error.raw` from the Stripe
 * SDK, or `await res.json()` from a raw request — together with `context.httpStatus`
 * (and `context.headers` for `Retry-After`). The full Stripe error is preserved on
 * `cause`; vendor-specific fields (`decline_code`, `param`) are intentionally NOT
 * promoted to structured fields — read them from `cause` with your own Stripe typing.
 *
 * `code` is Stripe's specific `error.code` (e.g. `card_declined`), falling back to
 * the broader `error.type`, then `http_<status>`. `kind` follows the response
 * status — the precise identity lives in `code`/`httpStatus`.
 */
export const stripeMapper: Mapper = (raw, context) => {
  const error = asStripeError(raw)
  if (!error) return null

  const status = isHttpErrorStatus(context.httpStatus) ? context.httpStatus : undefined
  const retryable = status !== undefined && isRetryableStatus(status)

  return new NormalizedError({
    kind: status !== undefined ? 'http' : 'domain',
    code: codeFor(error, status),
    // Narrow like rfc9457's messageOf: an empty message falls back to `code`.
    message: typeof error.message === 'string' && error.message !== '' ? error.message : undefined,
    httpStatus: status,
    retryable,
    retryAfterMs: retryable ? parseRetryAfter(context.headers?.get('retry-after')) : undefined,
    cause: raw,
    context: toErrorContext(context),
  })
}

/** Duck-type a value as a Stripe error envelope: `{ error: { type: string } }`. */
function asStripeError(raw: unknown): StripeError | null {
  if (typeof raw !== 'object' || raw === null) return null
  const error = (raw as { error?: unknown }).error
  if (typeof error !== 'object' || error === null) return null
  return typeof (error as { type?: unknown }).type === 'string' ? (error as StripeError) : null
}

function codeFor(error: StripeError, status: number | undefined): string {
  if (typeof error.code === 'string' && error.code !== '') return error.code
  if (error.type !== '') return error.type // type is always a string; guard only the empty case
  if (status !== undefined) return `http_${status}`
  return 'unknown_error'
}
