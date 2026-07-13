// HTTP-date in the IMF-fixdate form, e.g. "Sun, 06 Nov 1994 08:49:37 GMT" — the
// format servers send for Retry-After. Validating the shape first stops `Date.parse`
// (which is famously lenient) from turning garbage like "1.5" into a stray date.
const IMF_FIXDATE = /^[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/

/**
 * Parse an HTTP `Retry-After` value (RFC 9110 §10.2.3) into milliseconds. Accepts
 * either `delay-seconds` (a non-negative integer) or an IMF-fixdate HTTP-date;
 * returns `undefined` for anything else.
 *
 * The value is parsed faithfully and NOT capped — bounding an absurd delay is a
 * retry-policy decision for the caller, not the parser's. `now` is injectable for
 * deterministic tests.
 */
export function parseRetryAfter(
  value: string | null | undefined,
  now: number = Date.now(),
): number | undefined {
  if (value == null) return undefined
  const trimmed = value.trim()

  // delay-seconds: a non-negative integer number of seconds.
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000

  // HTTP-date: milliseconds from now until then, clamped at 0 for past dates.
  if (!IMF_FIXDATE.test(trimmed)) return undefined
  const date = Date.parse(trimmed)
  if (Number.isNaN(date)) return undefined
  return Math.max(0, date - now)
}
