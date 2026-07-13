import type { NormalizedErrorContext } from '../error/types.js'
import type { MapperContext } from './mapper.js'

/**
 * Project the request-identifying fields of a {@link MapperContext} onto the shape
 * stored on a NormalizedError, returning `undefined` when none are known — so an
 * empty `context` object is never attached. `httpStatus`/`headers` are inputs to
 * classification, not part of the stored context, and are intentionally dropped.
 */
export function toErrorContext(ctx: MapperContext): NormalizedErrorContext | undefined {
  if (ctx.url === undefined && ctx.method === undefined && ctx.requestId === undefined) {
    return undefined
  }
  return { url: ctx.url, method: ctx.method, requestId: ctx.requestId }
}
