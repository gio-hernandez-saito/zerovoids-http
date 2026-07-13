import type { NormalizedError } from '../error/normalized-error.js'

/**
 * What the caller knows about the request that failed. A client-agnostic
 * normalizer only has the context you give it, so every field is optional.
 */
export interface MapperContext {
  readonly url?: string
  readonly method?: string
  readonly requestId?: string
  /** The response status, when a response was actually received. */
  readonly httpStatus?: number
  /** The response headers, used e.g. to read `Retry-After`. */
  readonly headers?: Headers
}

/**
 * Converts a raw vendor/transport error into a {@link NormalizedError}, or
 * returns `null` to defer to the next mapper (chain of responsibility).
 *
 * A mapper must not throw — a thrown error propagates out of `normalizeError`.
 * Return `null` to decline instead.
 */
export type Mapper = (raw: unknown, context: MapperContext) => NormalizedError | null
