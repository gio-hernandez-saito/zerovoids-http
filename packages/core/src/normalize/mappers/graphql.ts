import { NormalizedError } from '../../error/normalized-error.js'
import { parseRetryAfter } from '../../http/retry-after.js'
import { isHttpErrorStatus, isRetryableStatus } from '../../http/status.js'
import { toErrorContext } from '../context.js'
import type { Mapper } from '../mapper.js'

/**
 * A single GraphQL error (spec §7.1.2): `message` is required; `extensions` is a
 * map reserved for implementers, by convention carrying a machine `code`.
 */
interface GraphQLError {
  readonly message: string
  readonly extensions?: unknown
}

/**
 * Maps a GraphQL error response (`{ errors: [{ message, extensions }] }`, per the
 * GraphQL spec §7) into a {@link NormalizedError}.
 *
 * GraphQL commonly returns errors with HTTP 200 — the transport succeeds and the
 * failure lives in the body — so absent an HTTP error status this normalizes to
 * `kind: 'domain'`. The FIRST error drives `code`/`message`; the full response
 * (every error, its `locations`/`path`, and any partial `data`) is kept on `cause`.
 *
 * `code` comes from the first error's `extensions.code` (the conventional location:
 * `extensions` is the spec-reserved map, and a top-level `code` is spec-discouraged),
 * falling back to `http_<status>` then `unknown_error`.
 */
export const graphqlMapper: Mapper = (raw, context) => {
  const first = firstGraphQLError(raw)
  if (!first) return null

  const status = isHttpErrorStatus(context.httpStatus) ? context.httpStatus : undefined
  const retryable = status !== undefined && isRetryableStatus(status)

  return new NormalizedError({
    kind: status !== undefined ? 'http' : 'domain',
    code: codeFor(first, status),
    message: first.message !== '' ? first.message : undefined,
    httpStatus: status,
    retryable,
    retryAfterMs: retryable ? parseRetryAfter(context.headers?.get('retry-after')) : undefined,
    cause: raw,
    context: toErrorContext(context),
  })
}

/** The first error of a GraphQL response (`{ errors: [{ message: string }] }`), or null. */
function firstGraphQLError(raw: unknown): GraphQLError | null {
  if (typeof raw !== 'object' || raw === null) return null
  const errors = (raw as { errors?: unknown }).errors
  if (!Array.isArray(errors) || errors.length === 0) return null
  const first = errors[0]
  if (typeof first !== 'object' || first === null) return null
  return typeof (first as { message?: unknown }).message === 'string'
    ? (first as GraphQLError)
    : null
}

function codeFor(error: GraphQLError, status: number | undefined): string {
  const { extensions } = error
  if (typeof extensions === 'object' && extensions !== null) {
    const code = (extensions as { code?: unknown }).code
    if (typeof code === 'string' && code !== '') return code
  }
  if (status !== undefined) return `http_${status}`
  return 'unknown_error'
}
