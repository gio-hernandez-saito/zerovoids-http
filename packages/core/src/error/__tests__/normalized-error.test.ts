import { describe, expect, it } from 'vitest'
import { assertNeverKind, isNormalizedError, isNormalizedErrorKind } from '../guards.js'
import { NormalizedError } from '../normalized-error.js'

describe('NormalizedError', () => {
  it('carries the normalized fields and preserves the raw cause', () => {
    const raw = new Error('boom')
    const err = new NormalizedError({
      kind: 'http',
      code: 'not_found',
      httpStatus: 404,
      cause: raw,
    })

    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('NormalizedError')
    expect(typeof err.stack).toBe('string')
    expect(err.kind).toBe('http')
    expect(err.code).toBe('not_found')
    expect(err.httpStatus).toBe(404)
    expect(err.retryable).toBe(false) // defaults to false when omitted
    expect(err.cause).toBe(raw) // raw error preserved verbatim
    expect(err.message).toBe('not_found') // message falls back to code
  })

  it('keeps an explicit message instead of falling back to code', () => {
    const err = new NormalizedError({
      kind: 'domain',
      code: 'card_declined',
      message: 'Your card was declined.',
    })
    expect(err.message).toBe('Your card was declined.')
  })

  it('survives a real JSON round-trip, dropping only absent optionals', () => {
    const err = new NormalizedError({
      kind: 'http',
      code: 'rate_limited',
      httpStatus: 429,
      retryable: true,
      retryAfterMs: 5000,
      context: { url: 'https://api.example.com/x', method: 'GET' },
      cause: new Error('429'),
    })

    const wire = JSON.parse(JSON.stringify(err))
    expect(wire).toEqual({
      name: 'NormalizedError',
      kind: 'http',
      code: 'rate_limited',
      message: 'rate_limited',
      httpStatus: 429,
      retryable: true,
      retryAfterMs: 5000,
      context: { url: 'https://api.example.com/x', method: 'GET' },
      cause: { name: 'Error', message: '429' },
    })
    // absent optionals are dropped by JSON, not carried as `undefined`
    expect('problem' in wire).toBe(false)
  })

  it('stays JSON-safe when the cause is a non-Error circular object', () => {
    const circular: Record<string, unknown> = { detail: 'weird' }
    circular.self = circular
    const err = new NormalizedError({ kind: 'network', code: 'offline', cause: circular })

    expect(() => JSON.stringify(err)).not.toThrow()
    expect(err.toJSON().cause).toBe('[unserializable cause]')
  })

  it('stays JSON-safe when the cause is a bigint', () => {
    const err = new NormalizedError({ kind: 'network', code: 'offline', cause: 10n })

    expect(() => JSON.stringify(err)).not.toThrow()
    expect(err.toJSON().cause).toBe('[unserializable cause]')
  })

  it('markers a symbol or function cause instead of leaking or dropping it', () => {
    const withSymbol = new NormalizedError({ kind: 'domain', code: 'x', cause: Symbol('s') })
    expect(withSymbol.toJSON().cause).toBe('[unserializable cause]')

    const withFunction = new NormalizedError({ kind: 'domain', code: 'x', cause: () => 1 })
    expect(withFunction.toJSON().cause).toBe('[unserializable cause]')
  })

  it('reduces an Error cause to name+message but keeps plain objects whole', () => {
    const withError = new NormalizedError({ kind: 'http', code: 'x', cause: new TypeError('bad') })
    expect(withError.toJSON().cause).toEqual({ name: 'TypeError', message: 'bad' })

    // a plain object (even one that looks error-like) is preserved, not reduced
    const raw = { name: 'x', message: 'y', extra: 1 }
    const withObject = new NormalizedError({ kind: 'domain', code: 'z', cause: raw })
    expect(withObject.toJSON().cause).toEqual(raw)
  })

  it('omits absent optional fields from toJSON rather than emitting undefined', () => {
    const json = new NormalizedError({ kind: 'network', code: 'offline' }).toJSON()

    expect('httpStatus' in json).toBe(false)
    expect('retryAfterMs' in json).toBe(false)
    expect('context' in json).toBe(false)
    expect('problem' in json).toBe(false)
    expect('cause' in json).toBe(false)
    expect(json).toEqual({
      name: 'NormalizedError',
      kind: 'network',
      code: 'offline',
      message: 'offline',
      retryable: false,
    })
  })

  it('preserves an RFC 9457 problem+json body verbatim', () => {
    const problem = {
      type: 'https://example.com/probs/out-of-credit',
      title: 'You do not have enough credit.',
      status: 403,
      detail: 'Your balance is 30, but the cost is 50.',
      instance: '/account/12345/msgs/abc',
    }
    const err = new NormalizedError({
      kind: 'domain',
      code: 'out_of_credit',
      httpStatus: 403,
      problem,
    })

    expect(err.problem).toEqual(problem)
    expect(err.toJSON().problem).toEqual(problem)
  })
})

describe('guards', () => {
  it('recognizes a NormalizedError instance and narrows by kind', () => {
    const err = new NormalizedError({ kind: 'network', code: 'offline' })

    expect(isNormalizedError(err)).toBe(true)
    expect(isNormalizedErrorKind(err, 'network')).toBe(true)
    expect(isNormalizedErrorKind(err, 'http')).toBe(false)
  })

  it('recognizes an SSR-deserialized error via the name brand', () => {
    const roundTripped = JSON.parse(
      JSON.stringify(new NormalizedError({ kind: 'domain', code: 'card_declined' })),
    )

    expect(roundTripped).not.toBeInstanceOf(NormalizedError)
    expect(isNormalizedError(roundTripped)).toBe(true)
  })

  it('rejects raw vendor shapes that lack the brand or mistype fields', () => {
    expect(isNormalizedError(null)).toBe(false)
    expect(isNormalizedError({ foo: 1 })).toBe(false)
    expect(isNormalizedError(new Error('plain'))).toBe(false)
    // looks normalized but has no brand — a plausible raw vendor error
    expect(isNormalizedError({ kind: 'card_error', code: 'card_declined', retryable: false })).toBe(
      false,
    )
    // branded but mistyped fields
    expect(isNormalizedError({ name: 'NormalizedError', kind: 1, code: 2, retryable: 3 })).toBe(
      false,
    )
  })
})

describe('assertNeverKind', () => {
  it('throws a plain Error naming the unhandled kind', () => {
    // @ts-expect-error — deliberately passing a non-never value at runtime
    expect(() => assertNeverKind('surprise')).toThrowError(/surprise/)

    try {
      // @ts-expect-error — same, to inspect the thrown value
      assertNeverKind('surprise')
    } catch (e) {
      expect(e).toBeInstanceOf(Error)
      expect(e).not.toBeInstanceOf(NormalizedError)
    }
  })
})
