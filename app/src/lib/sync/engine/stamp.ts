/**
 * A database timestamp as the integer the engine calls a version.
 *
 * The tasks table's only clock is `updated_at`, set by the database on every write (`touch_updated_at`) and
 * never by a client. It is what `cloud.ts` already compares-and-swaps on. The engine wants a number it can order
 * and a server can hand back; this is the number: **microseconds since the epoch**, which stays under 2^53 until
 * the year 2255 and, unlike milliseconds, tells apart two writes inside one millisecond.
 *
 * It goes both ways because a compare-and-swap names the stamp it expects, and the stamp has to be the one the
 * database wrote, to the microsecond. `versionToStamp(stampToVersion(s))` is the same instant as `s`, in UTC.
 */
const SHAPE = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}(?::?\d{2})?)$/

export function stampToVersion(stamp: string): number {
  const m = SHAPE.exec(stamp)
  if (!m) throw new RangeError(`not a timestamp: ${stamp}`)
  const [, day, clock, frac = '', zone] = m
  const offset = zone === 'Z' ? 0 : (() => {
    const sign = zone![0] === '-' ? -1 : 1
    const digits = zone!.slice(1).replace(':', '')
    return sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2) || 0)) * 60_000
  })()
  const whole = Date.parse(`${day}T${clock}Z`) - offset
  return whole * 1000 + Number(frac.padEnd(6, '0'))
}

export function versionToStamp(version: number): string {
  const secs = Math.floor(version / 1_000_000)
  const micros = version - secs * 1_000_000
  return `${new Date(secs * 1000).toISOString().slice(0, 19)}.${String(micros).padStart(6, '0')}Z`
}
