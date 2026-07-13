import { isNormalizedError } from '../error/guards.js'
import { NormalizedError } from '../error/normalized-error.js'
import type { NormalizedErrorKind } from '../error/types.js'
import { parseRetryAfter } from '../http/retry-after.js'
import { isHttpErrorStatus, isRetryableStatus } from '../http/status.js'
import { toErrorContext } from './context.js'
import type { Mapper, MapperContext } from './mapper.js'

/** Options for {@link normalizeError}. */
export interface NormalizeOptions {
  /** Tried in order; the first to return a non-null result wins. */
  readonly mappers?: readonly Mapper[]
  /** What the caller knows about the failed request. */
  readonly context?: MapperContext
}

/**
 * Substrings of the `TypeError.message` that `fetch` throws on a network failure,
 * per runtime. Matching a KNOWN network message — rather than any TypeError — keeps
 * an ordinary TypeError (a programming bug) from being masked as a network error.
 *
 * WARNING: the WHATWG Fetch spec mandates only that a network failure rejects with a
 * TypeError; the message text is implementation-defined and version-dependent (Deno's
 * changed when it moved to hyper). These are engine internals, not a standard, and may
 * drift between runtime versions.
 */
const NETWORK_MESSAGES: readonly string[] = [
  'failed to fetch', // Chromium/V8 (Chrome, Edge)
  'networkerror when attempting to fetch', // Firefox/Gecko
  'load failed', // Safari/WebKit
  'fetch failed', // Node undici, Cloudflare wrangler
  'network request failed', // React Native
  'error sending request', // Deno (hyper/reqwest)
  'unable to connect', // Bun
]

/**
 * The known kinds as a runtime set; the `Record` shape stays exhaustive with
 * `NormalizedErrorKind` (adding a kind to the union forces an entry here).
 */
const KNOWN_KINDS: Record<NormalizedErrorKind, true> = {
  network: true,
  timeout: true,
  canceled: true,
  http: true,
  validation: true,
  domain: true,
}

/**
 * Turn any raw error into a {@link NormalizedError}. An already-normalized error
 * passes through untouched; otherwise `mappers` are tried in order (chain of
 * responsibility), and if none claim it a built-in fallback classifies the
 * transport-level failure (abort, timeout, network) or, when a response status
 * is known, the HTTP error.
 */
export function normalizeError(raw: unknown, options: NormalizeOptions = {}): NormalizedError {
  const existing = asNormalizedError(raw)
  if (existing) return existing

  const context = options.context ?? {}
  for (const mapper of options.mappers ?? []) {
    if (typeof mapper !== 'function') continue // tolerate a stray non-function entry
    const mapped = mapper(raw, context)
    if (mapped) {
      const normalized = asNormalizedError(mapped)
      if (normalized) return normalized
      throw new TypeError('A mapper must return a NormalizedError or null')
    }
  }
  return fallback(raw, context)
}

/**
 * Recognize a value that is already normalized — a real instance, or a branded
 * plain object (SSR / duplicate package copy) rehydrated into one.
 */
function asNormalizedError(value: unknown): NormalizedError | undefined {
  if (value instanceof NormalizedError) return value
  if (isNormalizedError(value)) return rehydrate(value)
  return undefined
}

function fallback(raw: unknown, context: MapperContext): NormalizedError {
  const errContext = toErrorContext(context)

  // Aborts are matched by DOMException `name` (instanceof is unreliable across
  // realms). This intentionally also matches anything else wearing the name.
  if (nameOf(raw) === 'TimeoutError') {
    return new NormalizedError({
      kind: 'timeout',
      code: 'timeout',
      retryable: true,
      cause: raw,
      context: errContext,
    })
  }
  if (nameOf(raw) === 'AbortError') {
    return new NormalizedError({
      kind: 'canceled',
      code: 'canceled',
      cause: raw,
      context: errContext,
    })
  }

  // If a response arrived, its status is the authoritative signal — checked
  // before the TypeError branch so a post-response TypeError isn't called network.
  if (isHttpErrorStatus(context.httpStatus)) {
    const status = context.httpStatus
    const retryable = isRetryableStatus(status)
    return new NormalizedError({
      kind: 'http',
      code: `http_${status}`,
      httpStatus: status,
      retryable,
      retryAfterMs: retryable ? parseRetryAfter(context.headers?.get('retry-after')) : undefined,
      cause: raw,
      context: errContext,
    })
  }

  if (isNetworkError(raw)) {
    return new NormalizedError({
      kind: 'network',
      code: 'network_error',
      retryable: true,
      cause: raw,
      context: errContext,
    })
  }

  return new NormalizedError({
    kind: 'domain',
    code: 'unknown_error',
    cause: raw,
    context: errContext,
  })
}

function rehydrate(value: NormalizedError): NormalizedError {
  return new NormalizedError({
    // Coerce an unrecognized kind (e.g. version skew from a newer producer) to a
    // safe default, so a consumer `switch (kind)` never breaks on untrusted data.
    kind: isKnownKind(value.kind) ? value.kind : 'domain',
    code: value.code,
    message: value.message,
    httpStatus: value.httpStatus,
    retryable: value.retryable,
    retryAfterMs: value.retryAfterMs,
    context: value.context,
    problem: value.problem,
    cause: value.cause,
  })
}

function isKnownKind(kind: string): kind is NormalizedErrorKind {
  return Object.hasOwn(KNOWN_KINDS, kind)
}

function isNetworkError(raw: unknown): boolean {
  if (nameOf(raw) !== 'TypeError') return false
  const message = messageOf(raw)?.toLowerCase() ?? ''
  return NETWORK_MESSAGES.some((phrase) => message.includes(phrase))
}

function nameOf(value: unknown): string | undefined {
  return stringProp(value, 'name')
}

function messageOf(value: unknown): string | undefined {
  return stringProp(value, 'message')
}

function stringProp(value: unknown, key: 'name' | 'message'): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const property = (value as Record<string, unknown>)[key]
  return typeof property === 'string' ? property : undefined
}
