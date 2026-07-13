import { describe, expect, it } from 'vitest'
import { parseRetryAfter } from '../retry-after.js'

describe('parseRetryAfter', () => {
  it('parses delay-seconds into milliseconds', () => {
    expect(parseRetryAfter('120')).toBe(120_000)
    expect(parseRetryAfter('0')).toBe(0)
    expect(parseRetryAfter('  30  ')).toBe(30_000) // trims whitespace
  })

  it('parses an HTTP-date relative to now', () => {
    const now = Date.parse('2026-01-01T00:00:00.000Z')
    const future = new Date(now + 5000).toUTCString()
    expect(parseRetryAfter(future, now)).toBe(5000)
  })

  it('clamps a past HTTP-date to 0', () => {
    const now = Date.parse('2026-01-01T00:00:10.000Z')
    const past = new Date(now - 5000).toUTCString()
    expect(parseRetryAfter(past, now)).toBe(0)
  })

  it('rejects non-integer, negative, hex, and garbage', () => {
    expect(parseRetryAfter('1.5')).toBeUndefined()
    expect(parseRetryAfter('-5')).toBeUndefined()
    expect(parseRetryAfter('0x10')).toBeUndefined()
    expect(parseRetryAfter('soon')).toBeUndefined()
  })

  it('handles null, undefined, and empty input', () => {
    expect(parseRetryAfter(null)).toBeUndefined()
    expect(parseRetryAfter(undefined)).toBeUndefined()
    expect(parseRetryAfter('   ')).toBeUndefined()
  })
})
