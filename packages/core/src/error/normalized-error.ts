import type {
  NormalizedErrorContext,
  NormalizedErrorInit,
  NormalizedErrorKind,
  ProblemDetails,
} from './types.js'

/** The plain-object form produced by {@link NormalizedError.toJSON}. */
export interface NormalizedErrorJSON {
  readonly name: 'NormalizedError'
  readonly kind: NormalizedErrorKind
  readonly code: string
  readonly message: string
  readonly httpStatus?: number
  readonly retryable: boolean
  readonly retryAfterMs?: number
  readonly context?: NormalizedErrorContext
  readonly problem?: ProblemDetails
  readonly cause?: unknown
}

type MutableJSON = { -readonly [K in keyof NormalizedErrorJSON]: NormalizedErrorJSON[K] }

/**
 * The single error type every failure resolves to, regardless of which vendor,
 * transport, or validator produced it. It extends `Error` (so `instanceof` and
 * stack traces work) while carrying a normalized, `kind`-discriminated payload.
 *
 * Fields are `readonly` at compile time; instances are not frozen at runtime.
 */
export class NormalizedError extends Error {
  readonly kind: NormalizedErrorKind
  readonly code: string
  readonly httpStatus?: number
  readonly retryable: boolean
  readonly retryAfterMs?: number
  readonly context?: NormalizedErrorContext
  readonly problem?: ProblemDetails

  constructor(init: NormalizedErrorInit) {
    // The raw vendor error is preserved on `.cause` (Error's native option).
    super(init.message ?? init.code, { cause: init.cause })
    this.name = 'NormalizedError'
    this.kind = init.kind
    this.code = init.code
    this.httpStatus = init.httpStatus
    this.retryable = init.retryable ?? false
    this.retryAfterMs = init.retryAfterMs
    this.context = init.context
    this.problem = init.problem
  }

  /**
   * Serialize to a plain object for structured logging and SSR boundaries. The
   * result is always JSON-safe: any cause that cannot be serialized (a circular
   * vendor object, a `bigint`, …) is replaced with a marker, and an `Error`
   * cause — from any realm — is reduced to `{ name, message }`. Absent optional
   * fields are omitted rather than emitted as `undefined`.
   */
  toJSON(): NormalizedErrorJSON {
    const json: MutableJSON = {
      name: 'NormalizedError',
      kind: this.kind,
      code: this.code,
      message: this.message,
      retryable: this.retryable,
    }
    if (this.httpStatus !== undefined) json.httpStatus = this.httpStatus
    if (this.retryAfterMs !== undefined) json.retryAfterMs = this.retryAfterMs
    if (this.context !== undefined) json.context = this.context
    if (this.problem !== undefined) json.problem = this.problem
    if (this.cause !== undefined) json.cause = safeCause(this.cause)
    return json
  }
}

/** True for an `Error` from any realm (Worker/iframe/vm), where `instanceof` fails. */
function isError(value: unknown): boolean {
  return value instanceof Error || Object.prototype.toString.call(value) === '[object Error]'
}

function safeCause(cause: unknown): unknown {
  if (isError(cause)) {
    const err = cause as Error
    return { name: err.name, message: err.message }
  }
  // Keep the cause only if it round-trips to JSON. A circular object throws; a
  // symbol/function stringifies to `undefined` — both become a marker so the
  // logging boundary neither throws nor silently drops the cause.
  try {
    const serialized = JSON.stringify(cause)
    return serialized === undefined ? '[unserializable cause]' : cause
  } catch {
    return '[unserializable cause]'
  }
}
