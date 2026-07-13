import { describe, expect, it } from 'vitest'
import { NormalizedError } from '../../error/normalized-error.js'
import type { Mapper } from '../mapper.js'
import { normalizeError } from '../normalize.js'

describe('normalizeError', () => {
  it('passes an already-normalized error through untouched', () => {
    const already = new NormalizedError({ kind: 'domain', code: 'card_declined' })
    expect(normalizeError(already)).toBe(already)
  })

  it('returns the first mapper that claims the error', () => {
    const calls: string[] = []
    const skip: Mapper = (_raw) => {
      calls.push('skip')
      return null
    }
    const claim: Mapper = (raw) => {
      calls.push('claim')
      return new NormalizedError({ kind: 'domain', code: 'claimed', cause: raw })
    }
    const never: Mapper = () => {
      calls.push('never')
      return new NormalizedError({ kind: 'domain', code: 'never' })
    }

    const result = normalizeError({ some: 'error' }, { mappers: [skip, claim, never] })

    expect(result.code).toBe('claimed')
    expect(calls).toEqual(['skip', 'claim']) // stops at the first match
  })

  it('hands the raw error and context to each mapper', () => {
    const seen: Array<{ raw: unknown; httpStatus?: number }> = []
    const spy: Mapper = (raw, ctx) => {
      seen.push({ raw, httpStatus: ctx.httpStatus })
      return null
    }
    normalizeError('boom', { mappers: [spy], context: { httpStatus: 500 } })
    expect(seen).toEqual([{ raw: 'boom', httpStatus: 500 }])
  })

  describe('built-in fallback', () => {
    it('classifies an AbortSignal timeout as a retryable timeout', () => {
      const err = normalizeError(new DOMException('timed out', 'TimeoutError'))
      expect(err.kind).toBe('timeout')
      expect(err.retryable).toBe(true)
    })

    it('classifies a manual abort as canceled (not retryable)', () => {
      const err = normalizeError(new DOMException('aborted', 'AbortError'))
      expect(err.kind).toBe('canceled')
      expect(err.retryable).toBe(false)
    })

    it("classifies fetch's TypeError as a retryable network error", () => {
      const err = normalizeError(new TypeError('Failed to fetch'))
      expect(err.kind).toBe('network')
      expect(err.code).toBe('network_error')
      expect(err.retryable).toBe(true)
    })

    it('classifies a known status as an http error, retryable only for 5xx/429', () => {
      const server = normalizeError(null, { context: { httpStatus: 503 } })
      expect(server).toMatchObject({
        kind: 'http',
        code: 'http_503',
        httpStatus: 503,
        retryable: true,
      })

      const client = normalizeError(null, { context: { httpStatus: 404 } })
      expect(client).toMatchObject({ kind: 'http', httpStatus: 404, retryable: false })
    })

    it('falls back to an unknown domain error otherwise', () => {
      const err = normalizeError({ weird: true })
      expect(err.kind).toBe('domain')
      expect(err.code).toBe('unknown_error')
      expect(err.cause).toEqual({ weird: true })
    })

    it('carries request context onto the error, omitting it when empty', () => {
      const withCtx = normalizeError(new TypeError('x'), {
        context: { url: 'https://api.example.com', method: 'GET', httpStatus: 500 },
      })
      expect(withCtx.context).toEqual({ url: 'https://api.example.com', method: 'GET' })

      const withoutCtx = normalizeError(new TypeError('x'))
      expect(withoutCtx.context).toBeUndefined()
    })

    it('recognizes fetch network TypeErrors across runtimes, but not arbitrary ones', () => {
      const networkMessages = [
        'Failed to fetch', // Chromium/V8
        'NetworkError when attempting to fetch resource.', // Firefox
        'Load failed', // Safari/WebKit
        'fetch failed', // Node undici
        'error sending request for url (https://x)', // Deno
        'Unable to connect. Is the computer able to access the url?', // Bun
      ]
      for (const message of networkMessages) {
        expect(normalizeError(new TypeError(message)).kind).toBe('network')
      }

      const bug = normalizeError(new TypeError("Cannot read properties of undefined (reading 'x')"))
      expect(bug.kind).toBe('domain')
      expect(bug.code).toBe('unknown_error')
    })

    it('marks only commonly-retryable statuses as retryable', () => {
      for (const status of [408, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524]) {
        expect(normalizeError(null, { context: { httpStatus: status } }).retryable).toBe(true)
      }
      for (const status of [400, 401, 404, 501, 505]) {
        expect(normalizeError(null, { context: { httpStatus: status } }).retryable).toBe(false)
      }
    })

    it('ignores a non-error status (e.g. 200) and falls through to unknown', () => {
      const result = normalizeError(null, { context: { httpStatus: 200 } })
      expect(result.kind).toBe('domain')
      expect(result.code).toBe('unknown_error')
    })

    it('classifies with only a status, leaving request context undefined', () => {
      const result = normalizeError(null, { context: { httpStatus: 503 } })
      expect(result.httpStatus).toBe(503)
      expect(result.context).toBeUndefined()
    })

    it('reads Retry-After into retryAfterMs, but only for a retryable status', () => {
      const headers = new Headers({ 'retry-after': '30' })

      const retryable = normalizeError(null, { context: { httpStatus: 503, headers } })
      expect(retryable.retryable).toBe(true)
      expect(retryable.retryAfterMs).toBe(30_000)

      const notRetryable = normalizeError(null, { context: { httpStatus: 400, headers } })
      expect(notRetryable.retryAfterMs).toBeUndefined()
    })
  })

  it('lets a mapper claim a signal the built-in fallback would also catch', () => {
    const claim: Mapper = (raw) =>
      new NormalizedError({ kind: 'domain', code: 'mapped_it', cause: raw })
    const result = normalizeError(new TypeError('Failed to fetch'), { mappers: [claim] })
    expect(result.code).toBe('mapped_it') // mapper wins over built-in network classification
  })

  it('lets a throwing mapper propagate', () => {
    const boom: Mapper = () => {
      throw new Error('mapper bug')
    }
    expect(() => normalizeError('x', { mappers: [boom] })).toThrow('mapper bug')
  })

  it('rehydrates a branded plain object into a real instance', () => {
    const pojo = new NormalizedError({
      kind: 'domain',
      code: 'card_declined',
      httpStatus: 402,
    }).toJSON()

    const result = normalizeError(pojo)
    expect(result).toBeInstanceOf(NormalizedError)
    expect(result.kind).toBe('domain')
    expect(result.code).toBe('card_declined')
    expect(result.httpStatus).toBe(402)
  })

  it('coerces an unrecognized kind on a branded object to domain', () => {
    const result = normalizeError({
      name: 'NormalizedError',
      kind: 'bogus',
      code: 'from_the_future',
      retryable: false,
    })
    expect(result).toBeInstanceOf(NormalizedError)
    expect(result.kind).toBe('domain') // an unknown kind must not break consumer switch()
    expect(result.code).toBe('from_the_future') // other fields preserved
  })

  it('tolerates non-function mapper entries instead of crashing', () => {
    const result = normalizeError('x', {
      // @ts-expect-error — a JS caller could pass non-functions
      mappers: [null, undefined, 42],
    })
    expect(result).toBeInstanceOf(NormalizedError)
    expect(result.code).toBe('unknown_error')
  })

  it('accepts a branded object from a mapper, but throws on a non-NormalizedError', () => {
    const branded: Mapper = () =>
      new NormalizedError({
        kind: 'domain',
        code: 'branded',
      }).toJSON() as unknown as NormalizedError
    const ok = normalizeError('x', { mappers: [branded] })
    expect(ok).toBeInstanceOf(NormalizedError)
    expect(ok.code).toBe('branded')

    const bogus: Mapper = () => ({ kind: 'domain', code: 'x' }) as unknown as NormalizedError
    expect(() => normalizeError('x', { mappers: [bogus] })).toThrow(TypeError)
  })

  it('ignores a non-integer or out-of-range status, falling through to unknown', () => {
    for (const bad of [500.5, Number.POSITIVE_INFINITY, Number.NaN, 600, 200, -1]) {
      expect(normalizeError(null, { context: { httpStatus: bad } }).code).toBe('unknown_error')
    }
  })
})
