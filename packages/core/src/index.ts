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
