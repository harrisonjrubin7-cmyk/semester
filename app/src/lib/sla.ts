/**
 * The arithmetic behind an uptime commitment, in one place.
 *
 * `docs/trust/SLA.md` prints allowed-downtime tables and a service-credit
 * schedule that a university's procurement office will read as a promise.
 * Those figures are easy to get subtly wrong by hand — a 28-day February, a
 * 365-day year, a rounding step — and a wrong one is a contract term. So the
 * document's tables are checked against these functions by `sla.test.ts`, and
 * a figure in the document that the code does not produce fails the suite.
 *
 * Nothing here is a commitment. Semester has no measured availability history
 * yet, and `docs/market-readiness/PROCUREMENT_CHECKLIST.md` says so.
 */

export const MINUTES_PER_DAY = 24 * 60;

/** Minutes in a measurement period of `days` days. */
export const periodMinutes = (days: number) => days * MINUTES_PER_DAY;

/**
 * Availability for a period, as a percentage: `(M − D) / M × 100`, where `M`
 * is total minutes and `D` is qualifying unplanned downtime — downtime the
 * executed SLA does not exclude.
 */
export function availability(totalMinutes: number, downtimeMinutes: number): number {
  if (!(totalMinutes > 0)) throw new RangeError('a measurement period has to have minutes in it');
  if (downtimeMinutes < 0 || downtimeMinutes > totalMinutes) {
    throw new RangeError('downtime has to lie between zero and the whole period');
  }
  return ((totalMinutes - downtimeMinutes) / totalMinutes) * 100;
}

/** The most qualifying downtime a target allows: `M × (1 − target / 100)`. */
export function allowedDowntime(targetPercent: number, totalMinutes: number): number {
  if (!(targetPercent > 0 && targetPercent <= 100)) throw new RangeError('a target is a percentage above zero');
  return totalMinutes * (1 - targetPercent / 100);
}

/**
 * Whether a period met a target. Compared in minutes rather than percentages,
 * because 4.32 minutes down in a 30-day month is exactly 99.99% and the
 * floating-point percentage comes out as 99.98999999999998 — a breach, on a
 * month that met the SLA. The same happens at 99.99% in every month length
 * and at 99.5% in a 29-day February.
 */
export function meets(targetPercent: number, totalMinutes: number, downtimeMinutes: number): boolean {
  return downtimeMinutes <= allowedDowntime(targetPercent, totalMinutes) + 1e-9;
}

/**
 * The starting service-credit schedule from `docs/trust/SLA.md`, as lower
 * bounds. Written as thresholds so that every availability falls in exactly
 * one band: a schedule written as ranges ("99.0%–99.89%") leaves 99.89–99.9
 * belonging to nobody, and that gap is where a dispute starts.
 */
export const CREDIT_SCHEDULE = [
  { atLeast: 99.9, creditPercent: 0 },
  { atLeast: 99.0, creditPercent: 10 },
  { atLeast: 95.0, creditPercent: 25 },
  { atLeast: 0, creditPercent: 50 },
] as const;

/** Credit owed, as a percentage of the affected monthly fee. */
export function credit(totalMinutes: number, downtimeMinutes: number): number {
  for (const band of CREDIT_SCHEDULE) {
    if (band.atLeast === 0 || meets(band.atLeast, totalMinutes, downtimeMinutes)) return band.creditPercent;
  }
  return CREDIT_SCHEDULE[CREDIT_SCHEDULE.length - 1].creditPercent;
}

/**
 * A duration in minutes as the tables print it: largest unit first, zero
 * units left out, rounded to the second — `7h 12m`, `43m 12s`, `3d 15h 36m`.
 */
export function formatDuration(minutes: number): string {
  let seconds = Math.round(minutes * 60);
  if (seconds === 0) return '0s';
  const parts: string[] = [];
  for (const [unit, size] of [
    ['d', 86400],
    ['h', 3600],
    ['m', 60],
    ['s', 1],
  ] as const) {
    const n = Math.floor(seconds / size);
    seconds -= n * size;
    if (n > 0) parts.push(`${n}${unit}`);
  }
  return parts.join(' ');
}
