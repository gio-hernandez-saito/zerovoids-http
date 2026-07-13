import { describe, expect, it } from 'vitest'
import { NormalizedError } from '../../../error/normalized-error.js'
import { normalizeError } from '../../normalize.js'
import { graphqlMapper } from '../graphql.js'
import { stripeMapper } from '../stripe.js'

describe('graphqlMapper', () => {
  it('maps a GraphQL error (HTTP 200) to a domain error with extensions.code', () => {
    const body = {
      errors: [
        {
          message: 'Name for character with ID 1002 could not be fetched.',
          locations: [{ line: 6, column: 7 }],
          path: ['hero', 'heroFriends', 1, 'name'],
          extensions: { code: 'CAN_NOT_FETCH_BY_ID', timestamp: 'Fri Feb 9 14:33:09 UTC 2018' },
        },
      ],
      data: { hero: { name: 'R2-D2' } }, // partial data alongside errors
    }

    const error = graphqlMapper(body, { httpStatus: 200 })

    expect(error).toBeInstanceOf(NormalizedError)
    expect(error).toMatchObject({
      kind: 'domain', // 200: transport ok, failure in the body
      code: 'CAN_NOT_FETCH_BY_ID',
      message: 'Name for character with ID 1002 could not be fetched.',
      retryable: false,
    })
    expect(error?.httpStatus).toBeUndefined()
    expect(error?.cause).toBe(body) // full response (all errors, path, partial data) preserved
  })

  it('uses the FIRST error for code/message', () => {
    const error = graphqlMapper(
      {
        errors: [
          { message: 'first', extensions: { code: 'FIRST' } },
          { message: 'second', extensions: { code: 'SECOND' } },
        ],
      },
      {},
    )
    expect(error?.code).toBe('FIRST')
    expect(error?.message).toBe('first')
  })

  it('classifies as http when the server returns a non-2xx status', () => {
    const error = graphqlMapper(
      { errors: [{ message: 'Bad request', extensions: { code: 'BAD_USER_INPUT' } }] },
      { httpStatus: 400 },
    )
    expect(error?.kind).toBe('http')
    expect(error?.httpStatus).toBe(400)
    expect(error?.code).toBe('BAD_USER_INPUT')
  })

  it('falls back to http_<status> when there is no extensions.code', () => {
    const error = graphqlMapper({ errors: [{ message: 'Server exploded' }] }, { httpStatus: 500 })
    expect(error?.code).toBe('http_500')
    expect(error?.retryable).toBe(true) // 500 is retryable
  })

  it('falls back to unknown_error with no code and no status', () => {
    const error = graphqlMapper({ errors: [{ message: 'Something failed' }] }, {})
    expect(error?.code).toBe('unknown_error')
    expect(error?.kind).toBe('domain')
  })

  it('ignores a non-string extensions.code', () => {
    const error = graphqlMapper(
      { errors: [{ message: 'x', extensions: { code: 42 } }] },
      { httpStatus: 400 },
    )
    expect(error?.code).toBe('http_400')
  })

  it('skips an empty message, falling back to code', () => {
    const error = graphqlMapper({ errors: [{ message: '', extensions: { code: 'X' } }] }, {})
    expect(error?.message).toBe('X')
  })

  describe('recognition (returns null to defer)', () => {
    it.each([
      ['a primitive', 'boom'],
      ['null', null],
      ['an empty errors array', { errors: [] }],
      ['errors not an array', { errors: { message: 'x' } }],
      ['a first error without a string message', { errors: [{ extensions: { code: 'X' } }] }],
      ['a first error that is not an object', { errors: ['boom'] }],
      // recognition is first-error-only — it does not scan past errors[0]
      [
        'a first error without a message even when a later one has it',
        { errors: [{}, { message: 'x' }] },
      ],
      ['a Stripe body', { error: { type: 'card_error', code: 'card_declined' } }],
      ['an RFC 9457 body', { type: 'https://x/y', title: 't' }],
    ])('declines %s', (_label, raw) => {
      expect(graphqlMapper(raw, { httpStatus: 400 })).toBeNull()
    })
  })

  it('chains with stripeMapper, each claiming its own shape', () => {
    const mappers = [graphqlMapper, stripeMapper]

    const gql = normalizeError(
      { errors: [{ message: 'nope', extensions: { code: 'FORBIDDEN' } }] },
      {
        mappers,
        context: { httpStatus: 200 },
      },
    )
    expect(gql.code).toBe('FORBIDDEN')

    const stripe = normalizeError(
      { error: { type: 'card_error', code: 'card_declined' } },
      {
        mappers,
        context: { httpStatus: 402 },
      },
    )
    expect(stripe.code).toBe('card_declined')
  })
})
