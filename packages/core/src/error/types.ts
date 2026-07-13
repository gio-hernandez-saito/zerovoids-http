/**
 * The fixed set of failure categories every error collapses into. It is a
 * coarse **routing hint** ("roughly what failed") — `code` is the precise
 * identity. Most HTTP/gRPC failures funnel into `http` or `domain`, so consumers
 * that need to tell auth from not-found from rate-limit branch on
 * `code`/`httpStatus`, not on `kind` alone.
 *
 * The first three are pre-response failures that no HTTP-status scheme can
 * express — which is why fetch clients like ky surface separate `HTTPError` /
 * `TimeoutError` / `AbortError`.
 */
export type NormalizedErrorKind =
  | 'network' // no response received — DNS/TLS failure, connection refused, offline
  | 'timeout' // deadline exceeded before a response (~gRPC DEADLINE_EXCEEDED)
  | 'canceled' // aborted by the caller (~gRPC CANCELLED; DOM AbortError)
  | 'http' // a non-2xx response; the status class lives in `httpStatus`
  | 'validation' // response failed schema validation (~gRPC INVALID_ARGUMENT)
  | 'domain' // a vendor business error (~gRPC FAILED_PRECONDITION; Stripe *_error)

/**
 * RFC 9457 "Problem Details" members, preserved verbatim when a vendor already
 * responds with `application/problem+json`. Kept as an interop passthrough
 * rather than hoisted into first-class fields, because `type`/`instance` are
 * URIs that carry no meaning for the many vendors that do not speak RFC 9457.
 */
export interface ProblemDetails {
  /** A URI reference identifying the problem *type* — RFC 9457's primary identifier. */
  readonly type?: string
  /** A short, human-readable summary of the problem type. */
  readonly title?: string
  /** The HTTP status code for this occurrence. */
  readonly status?: number
  /** A human-readable explanation specific to this occurrence. */
  readonly detail?: string
  /** A URI reference identifying this specific occurrence. */
  readonly instance?: string
  /** RFC 9457 permits arbitrary extension members. */
  readonly [extension: string]: unknown
}

/** Request context, attached when the caller knows it. All fields optional. */
export interface NormalizedErrorContext {
  readonly url?: string
  readonly method?: string
  readonly requestId?: string
}

/** The data used to construct a {@link NormalizedError}. */
export interface NormalizedErrorInit {
  readonly kind: NormalizedErrorKind
  /**
   * A short, machine-readable identifier for the failure (e.g. `card_declined`,
   * `RATE_LIMITED`) — the `code`/`reason` field that recurs across Stripe,
   * Google `ErrorInfo`, Apollo `extensions.code`, and JSON:API. Distinct from
   * RFC 9457's `type`, which is a URI and lives on `problem.type`.
   */
  readonly code: string
  /** Human-readable message. Falls back to `code` when omitted. */
  readonly message?: string
  /** Present for `kind: 'http'` (and often `'domain'`). Mirrors RFC 9457 `status`. */
  readonly httpStatus?: number
  /** Whether retrying the same request could plausibly succeed. Defaults to `false`. */
  readonly retryable?: boolean
  /**
   * `Retry-After` (RFC 9110), normalized to milliseconds. Mappers MUST NOT set
   * this unless `retryable` is `true`; consumers should ignore it otherwise.
   */
  readonly retryAfterMs?: number
  /** The original vendor/transport error, preserved verbatim for forensics. */
  readonly cause?: unknown
  /** RFC 9457 body, preserved verbatim when the vendor speaks `application/problem+json`. */
  readonly problem?: ProblemDetails
  readonly context?: NormalizedErrorContext
}
