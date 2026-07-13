// The one error type every failure resolves to, plus the guards to branch on it.
// The normalization runner and prebuilt vendor mappers land next.

export {
  assertNeverKind,
  isNormalizedError,
  isNormalizedErrorKind,
} from './error/guards.js'
export type { NormalizedErrorJSON } from './error/normalized-error.js'
export { NormalizedError } from './error/normalized-error.js'
export type {
  NormalizedErrorContext,
  NormalizedErrorInit,
  NormalizedErrorKind,
  ProblemDetails,
} from './error/types.js'
export { parseRetryAfter } from './http/retry-after.js'
export type { Mapper, MapperContext } from './normalize/mapper.js'
export { graphqlMapper } from './normalize/mappers/graphql.js'
export { rfc9457Mapper } from './normalize/mappers/rfc9457.js'
export { stripeMapper } from './normalize/mappers/stripe.js'
export type { NormalizeOptions } from './normalize/normalize.js'
export { normalizeError } from './normalize/normalize.js'
