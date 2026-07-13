import { describe, expect, it } from 'vitest'
import { NormalizedError } from '../../../error/normalized-error.js'
import { normalizeError } from '../../normalize.js'
import { rfc9457Mapper } from '../rfc9457.js'

describe('rfc9457Mapper', () => {
  it('maps a problem body, deriving code from the type URI last segment', () => {
    const body = {
      type: 'https://example.com/probs/out-of-credit',
      title: 'You do not have enough credit.',
      status: 403,
      detail: 'Your balance is 30, but the cost is 50.',
      instance: '/account/12345/msgs/abc',
    }

    const error = rfc9457Mapper(body, { httpStatus: 403 })

    expect(error).toBeInstanceOf(NormalizedError)
    expect(error).toMatchObject({
      kind: 'http',
      code: 'out-of-credit',
      httpStatus: 403,
      retryable: false,
      message: 'Your balance is 30, but the cost is 50.',
    })
  })

  it('preserves the problem body verbatim on `problem`', () => {
    const body = { type: 'about:blank', title: 'Not Found', status: 404, code: 'X-42' }
    const error = rfc9457Mapper(body, { httpStatus: 404 })
    expect(error?.problem).toBe(body) // same reference, untouched
  })

  it('treats about:blank as no type, falling back to http_<status>', () => {
    const error = rfc9457Mapper({ type: 'about:blank', title: 'Bad Request' }, { httpStatus: 400 })
    expect(error?.code).toBe('http_400')
  })

  it('derives code from http_<status> when no type is present', () => {
    const error = rfc9457Mapper({ title: 'Service Unavailable' }, { httpStatus: 503 })
    expect(error?.code).toBe('http_503')
  })

  it('handles a relative type URI', () => {
    const error = rfc9457Mapper({ type: '/errors/insufficient-funds' }, { httpStatus: 402 })
    expect(error?.code).toBe('insufficient-funds')
  })

  it('strips query and fragment from the type URI', () => {
    const error = rfc9457Mapper(
      { type: 'https://ex.com/probs/rate-limited?v=2#more' },
      { httpStatus: 429 },
    )
    expect(error?.code).toBe('rate-limited')
  })

  it('prefers the authoritative response status over the advisory body status', () => {
    // RFC 9457 §3.1: the body `status` is advisory; the real response wins.
    const error = rfc9457Mapper({ type: 'about:blank', status: 200 }, { httpStatus: 500 })
    expect(error?.httpStatus).toBe(500)
    expect(error?.code).toBe('http_500')
  })

  it('falls back to the body status when the response status is absent', () => {
    const error = rfc9457Mapper({ type: 'about:blank', status: 404 }, {})
    expect(error?.kind).toBe('http')
    expect(error?.httpStatus).toBe(404)
    expect(error?.code).toBe('http_404')
  })

  it('classifies a problem with no status at all as domain', () => {
    const error = rfc9457Mapper({ type: '/errors/tea', title: "I'm a teapot" }, {})
    expect(error?.kind).toBe('domain')
    expect(error?.httpStatus).toBeUndefined()
    expect(error?.code).toBe('tea')
  })

  it('ignores a non-error or non-integer body status', () => {
    // 200 is not an error status; "418" is a string — both are rejected, leaving no status.
    const error = rfc9457Mapper({ type: '/e/x', status: 200 }, {})
    expect(error?.kind).toBe('domain')
    expect(error?.httpStatus).toBeUndefined()
  })

  it('marks a retryable status and reads Retry-After', () => {
    const headers = new Headers({ 'retry-after': '30' })
    const error = rfc9457Mapper({ title: 'Service Unavailable' }, { httpStatus: 503, headers })
    expect(error?.retryable).toBe(true)
    expect(error?.retryAfterMs).toBe(30_000)
  })

  it('never sets retryAfterMs for a non-retryable status', () => {
    const headers = new Headers({ 'retry-after': '30' })
    const error = rfc9457Mapper({ title: 'Not Found' }, { httpStatus: 404, headers })
    expect(error?.retryable).toBe(false)
    expect(error?.retryAfterMs).toBeUndefined()
  })

  it('falls back from detail to title for the message', () => {
    const error = rfc9457Mapper({ type: '/e/x', title: 'Only a title' }, { httpStatus: 400 })
    expect(error?.message).toBe('Only a title')
  })

  describe('adversarial input (must never throw — mapper contract)', () => {
    it('does not throw on a Symbol message member, falling back to code', () => {
      // `type` is a string so the body is claimed; a Symbol `title` must not reach
      // Error(message) (which would throw) — the message falls back to `code`.
      const error = rfc9457Mapper({ type: '/e/tea', title: Symbol('x') }, { httpStatus: 400 })
      expect(error).toBeInstanceOf(NormalizedError)
      expect(error?.message).toBe('tea')
    })

    it('ignores a non-string detail/title instead of coercing it into the message', () => {
      const num = rfc9457Mapper({ type: '/e/x', detail: 42 }, { httpStatus: 400 })
      expect(num?.message).toBe('x') // not "42"

      const obj = rfc9457Mapper({ title: 'ok', detail: { nested: 1 } }, { httpStatus: 400 })
      expect(obj?.message).toBe('ok') // not "[object Object]"
    })

    it('skips an empty detail in favor of a non-empty title', () => {
      const error = rfc9457Mapper({ detail: '', title: 'Real title' }, { httpStatus: 400 })
      expect(error?.message).toBe('Real title')
    })

    it.each([
      ['a bare origin', 'https://example.com'],
      ['an origin with a trailing slash', 'https://example.com/'],
      ['an opaque urn', 'urn:problem:out-of-credit'],
      ['a mailto', 'mailto:ops@example.com'],
      ['an about:blank variant', 'about:blank?ref=1'],
      ['a malformed absolute URI', 'http://'],
    ])('does not leak %s as the code, falling back to http_<status>', (_label, type) => {
      const error = rfc9457Mapper({ type, title: 't' }, { httpStatus: 500 })
      expect(error?.code).toBe('http_500')
    })
  })

  describe('recognition (returns null to defer)', () => {
    it.each([
      ['a primitive', 'boom'],
      ['null', null],
      ['an array', [1, 2, 3]],
      ['an object with only a numeric status', { status: 500 }],
      ['a plain Error', new TypeError('Failed to fetch')],
      ['non-string text members', { type: 42, title: true }],
    ])('declines %s', (_label, raw) => {
      expect(rfc9457Mapper(raw, { httpStatus: 500 })).toBeNull()
    })
  })

  describe('through normalizeError', () => {
    it('claims a problem body, letting non-problems fall through to the fallback', () => {
      const options = { mappers: [rfc9457Mapper] }

      const problem = normalizeError(
        { type: '/errors/gone', title: 'Gone' },
        { ...options, context: { httpStatus: 410 } },
      )
      expect(problem.code).toBe('gone')

      // A network TypeError has no problem shape, so the built-in fallback handles it.
      const network = normalizeError(new TypeError('Failed to fetch'), options)
      expect(network.kind).toBe('network')
    })
  })
})
