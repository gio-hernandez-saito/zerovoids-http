import { describe, expect, it } from 'vitest'
import { NormalizedError } from '../../../error/normalized-error.js'
import { normalizeError } from '../../normalize.js'
import { rfc9457Mapper } from '../rfc9457.js'
import { stripeMapper } from '../stripe.js'

describe('stripeMapper', () => {
  it('maps a card error, taking code from the specific error.code', () => {
    const body = {
      error: {
        type: 'card_error',
        code: 'card_declined',
        decline_code: 'insufficient_funds',
        message: 'Your card was declined.',
        param: 'card',
      },
    }

    const error = stripeMapper(body, { httpStatus: 402 })

    expect(error).toBeInstanceOf(NormalizedError)
    expect(error).toMatchObject({
      kind: 'http',
      code: 'card_declined',
      httpStatus: 402,
      retryable: false,
      message: 'Your card was declined.',
    })
    // The full Stripe error — including decline_code/param — is preserved on cause.
    expect(error?.cause).toBe(body)
  })

  it('falls back to error.type when there is no specific code', () => {
    const error = stripeMapper(
      { error: { type: 'api_error', message: 'Internal error' } },
      {
        httpStatus: 500,
      },
    )
    expect(error?.code).toBe('api_error')
    expect(error?.kind).toBe('http')
    expect(error?.retryable).toBe(true) // 500 is in the retryable set
  })

  it('reads Retry-After for a rate-limit error', () => {
    const headers = new Headers({ 'retry-after': '2' })
    const error = stripeMapper(
      { error: { type: 'rate_limit_error', code: 'rate_limit' } },
      {
        httpStatus: 429,
        headers,
      },
    )
    expect(error?.retryable).toBe(true)
    expect(error?.retryAfterMs).toBe(2000)
  })

  it('classifies a Stripe error with no status as domain', () => {
    const error = stripeMapper(
      { error: { type: 'invalid_request_error', code: 'parameter_missing' } },
      {},
    )
    expect(error?.kind).toBe('domain')
    expect(error?.httpStatus).toBeUndefined()
    expect(error?.code).toBe('parameter_missing')
  })

  it('does not throw or coerce on a non-string code/message', () => {
    const error = stripeMapper(
      { error: { type: 'api_error', code: 42, message: { nested: 1 } } },
      {
        httpStatus: 500,
      },
    )
    expect(error?.code).toBe('api_error') // non-string code skipped → falls back to type
    expect(error?.message).toBe('api_error') // non-string message → falls back to code
  })

  it('skips an empty message, falling back to code', () => {
    const error = stripeMapper({ error: { type: 'api_error', message: '' } }, { httpStatus: 500 })
    expect(error?.message).toBe('api_error')
  })

  describe('recognition (returns null to defer)', () => {
    it.each([
      ['a primitive', 'boom'],
      ['null', null],
      ['an object without error', { message: 'nope' }],
      ['error without a type', { error: { code: 'x' } }],
      ['a non-string type', { error: { type: 99 } }],
      ['an RFC 9457 body', { type: 'https://x/y', title: 't' }],
    ])('declines %s', (_label, raw) => {
      expect(stripeMapper(raw, { httpStatus: 400 })).toBeNull()
    })
  })

  it('chains with rfc9457Mapper, each claiming its own shape', () => {
    const mappers = [stripeMapper, rfc9457Mapper]

    const stripe = normalizeError(
      { error: { type: 'card_error', code: 'card_declined' } },
      { mappers, context: { httpStatus: 402 } },
    )
    expect(stripe.code).toBe('card_declined')

    const problem = normalizeError(
      { type: '/errors/gone', title: 'Gone' },
      { mappers, context: { httpStatus: 410 } },
    )
    expect(problem.code).toBe('gone')
  })
})
