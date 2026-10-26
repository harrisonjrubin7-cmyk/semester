// Extended time on timed assessments (accommodation implementation; S-55 §6 Faculty "accommodation implementation",
// acceptance T10, work packages W10/W11). Mirrors the SQL in asmMigration (asm-002) and accMigration (acc-002); unit-tested
// in tests/extTime.test.ts. The multiplier comes from an approved accommodation the student has sent to that section;
// it is never read from the client and the instructor never sees the underlying request.
export const MULTIPLIERS = [1.25, 1.5, 2, 2.5, 3] as const;
export const GRACE_MIN = 2;

export type Accommodation = { state: string; validUntil: string | null; multiplier: number | null; letterSections: string[] };
/** Largest multiplier that applies to this section today; 1 when none does. `today` is YYYY-MM-DD. */
export function multiplierFor(accs: Accommodation[], sectionId: string, today: string): number {
  const ok = accs.filter((a) => a.state === 'approved' && a.multiplier != null && a.validUntil != null && a.validUntil >= today && a.letterSections.includes(sectionId));
  return ok.length ? Math.max(...ok.map((a) => a.multiplier!)) : 1;
}
/** Extra minutes added to a time limit; untimed assessments get none. */
export const extraMinutes = (limit: number | null, mult: number) => (limit == null || mult <= 1 ? 0 : Math.ceil(limit * (mult - 1)));

/** Late when past the (extended) close or the (extended) time limit, beyond the grace period. Times in ms. */
export function isLate(now: number, startedAt: number, closesAt: number, limit: number | null, extra: number): boolean {
  const g = GRACE_MIN * 60_000, x = extra * 60_000;
  return now > closesAt + x + g || (limit != null && now > startedAt + limit * 60_000 + x + g);
}
