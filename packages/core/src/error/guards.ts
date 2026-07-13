import { NormalizedError } from './normalized-error.js'
import type { NormalizedErrorKind } from './types.js'

/**
 * True for a {@link NormalizedError}. Also accepts a value that carries the
 * `name` brand and discriminating fields but is no longer an instance — e.g.
 * one that round-tripped through JSON across an SSR boundary. Requiring the
 * brand keeps raw vendor errors (which may coincidentally carry `kind`/`code`)
 * from being mistaken for already-normalized ones.
 *
 * This is a structural heuristic for trusted serialization boundaries, not a
 * security check — a hostile payload can wear the brand.
 */
export function isNormalizedError(value: unknown): value is NormalizedError {
  if (value instanceof NormalizedError) return true
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    v.name === 'NormalizedError' &&
    typeof v.kind === 'string' &&
    typeof v.code === 'string' &&
    typeof v.retryable === 'boolean'
  )
}

/** Narrow a value to a {@link NormalizedError} of one specific `kind`. */
export function isNormalizedErrorKind<K extends NormalizedErrorKind>(
  value: unknown,
  kind: K,
): value is NormalizedError & { readonly kind: K } {
  return isNormalizedError(value) && value.kind === kind
}

/**
 * Compile-time exhaustiveness guard for `switch (error.kind)` blocks: passing a
 * non-`never` value is a type error, so an unhandled kind fails to compile. If
 * one slips through at runtime it is a programming defect, so it throws a plain
 * `Error` — not a `NormalizedError`, which would masquerade as a real failure.
 */
export function assertNeverKind(kind: never): never {
  throw new Error(`Unhandled NormalizedError kind: ${String(kind)}`)
}
