import { NormalizedError } from '../../error/normalized-error.js'
import type { ProblemDetails } from '../../error/types.js'
import { parseRetryAfter } from '../../http/retry-after.js'
import { isHttpErrorStatus, isRetryableStatus } from '../../http/status.js'
import { toErrorContext } from '../context.js'
import type { Mapper, MapperContext } from '../mapper.js'

// RFC 9457 §4.1: a problem with no specific identity uses "about:blank", which
// carries no more meaning than the bare HTTP status — so it is treated as absent.
const NO_TYPE = 'about:blank'

// An absolute-URI scheme (RFC 3986 §3.1), used to tell an opaque URI (urn:, mailto:)
// apart from a relative reference like "/errors/x".
const HAS_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/

/**
 * Maps an RFC 9457 "Problem Details" body (`application/problem+json`) into a
 * {@link NormalizedError}, preserving the body verbatim on `problem`.
 *
 * Feed it the PARSED problem body as the error — `await res.json()` (fetch),
 * `error.response.data` (axios), or `await error.response.json()` (ky) — along with
 * `context.httpStatus`/`context.headers` from the response. Recognition is by body
 * SHAPE (a `type`, `title`, or `detail` text member), not the `content-type`
 * header, since many APIs send problem-shaped bodies as plain `application/json`.
 *
 * `code` is the last path segment of the problem `type` URI (e.g.
 * `https://example.com/probs/out-of-credit` → `out-of-credit`), falling back to
 * `http_<status>` when the type is absent, `about:blank`, or has no usable path
 * (a bare origin or an opaque `urn:`/`mailto:` URI).
 */
export const rfc9457Mapper: Mapper = (raw, context) => {
  const problem = asProblemDetails(raw)
  if (!problem) return null

  const status = resolveStatus(problem, context)
  const retryable = status !== undefined && isRetryableStatus(status)

  return new NormalizedError({
    // A problem anchored to an HTTP status is an `http` error; without any status
    // it is a named condition we can only classify as `domain`.
    kind: status !== undefined ? 'http' : 'domain',
    code: codeFor(problem, status),
    message: messageOf(problem),
    httpStatus: status,
    retryable,
    retryAfterMs: retryable ? parseRetryAfter(context.headers?.get('retry-after')) : undefined,
    problem,
    cause: raw,
    context: toErrorContext(context),
  })
}

/**
 * Duck-type a value as an RFC 9457 body. All problem members are optional, so at
 * least one authored text member (`type`/`title`/`detail`) is required to avoid
 * claiming every stray object — an empty `{}` is valid problem+json but meaningless.
 */
function asProblemDetails(raw: unknown): ProblemDetails | null {
  if (typeof raw !== 'object' || raw === null) return null
  const body = raw as Record<string, unknown>
  const authored =
    typeof body.type === 'string' ||
    typeof body.title === 'string' ||
    typeof body.detail === 'string'
  return authored ? (body as ProblemDetails) : null
}

/**
 * The actual response status is authoritative; RFC 9457 §3.1 calls the body's
 * `status` member advisory (a convenience for offline processing). Fall back to it
 * only when the response status was not supplied.
 */
function resolveStatus(problem: ProblemDetails, context: MapperContext): number | undefined {
  if (isHttpErrorStatus(context.httpStatus)) return context.httpStatus
  if (isHttpErrorStatus(problem.status)) return problem.status
  return undefined
}

/**
 * A human-readable message from the problem, preferring the occurrence-specific
 * `detail` over the type-level `title`. Both are declared `string` but reach us
 * from an unvalidated cast, so each is narrowed — a non-string (or empty) member
 * is skipped, and the NormalizedError falls back to `code` when neither is usable.
 */
function messageOf(problem: ProblemDetails): string | undefined {
  if (typeof problem.detail === 'string' && problem.detail !== '') return problem.detail
  if (typeof problem.title === 'string' && problem.title !== '') return problem.title
  return undefined
}

function codeFor(problem: ProblemDetails, status: number | undefined): string {
  const fromType = codeFromType(problem.type)
  if (fromType) return fromType
  if (status !== undefined) return `http_${status}`
  return 'unknown_error'
}

/**
 * Last path segment of the problem `type`, or `undefined` when it has no usable
 * path. An absolute URI must be hierarchical (a leading-`/` path) to yield a code,
 * so a bare origin (`https://ex.com`) or an opaque URI (`urn:`/`mailto:`) falls
 * back to `http_<status>` rather than leaking a host or the whole URI as the code.
 */
function codeFromType(type: unknown): string | undefined {
  if (typeof type !== 'string') return undefined
  const trimmed = type.trim()
  if (trimmed === '' || trimmed === NO_TYPE) return undefined

  let path: string
  if (HAS_SCHEME.test(trimmed)) {
    let url: URL
    try {
      url = new URL(trimmed)
    } catch {
      return undefined // a malformed absolute URI has no path to name a code
    }
    if (!url.pathname.startsWith('/')) return undefined // opaque scheme, no hierarchy
    path = url.pathname
  } else {
    // A relative reference: drop any query/fragment and treat the rest as the path.
    path = (trimmed.split('#')[0] ?? '').split('?')[0] ?? ''
  }
  return path.split('/').filter(Boolean).pop()
}
