// Student-side checks before a drop or swap request reaches the registrar. Pure (unit-tested in tests/changeRules.test.ts).
// The database re-checks seats and capacity under lock (lib/wlMigration.ts); these rules cover what only the app knows:
// the registration window, the approved credit limit and meeting-time conflicts.
export type Window = 'none' | 'not_yet' | 'open' | 'closed';
export type Sec = { id: string; term: string; credits: number; times: string };

const parse = (t: string) => {
  const m = t.match(/^([A-Za-z/]+)\s+(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
  return m ? { days: m[1].split('/'), start: +m[2] * 60 + +m[3], end: +m[4] * 60 + +m[5] } : null;
};
export function overlaps(a: string, b: string) {
  const x = parse(a), y = parse(b);
  return !!x && !!y && x.days.some((d) => y.days.includes(d)) && x.start < y.end && y.start < x.end;
}

/** Returns a refusal message, or null when the request may go to the registrar. `held` = sections the student holds this term. */
export function checkChange(input: { kind: 'drop' | 'swap'; window: Window; from: Sec; to?: Sec; held: Sec[]; maxCredits: number | null }): string | null {
  const { kind, window, from, to, held, maxCredits } = input;
  if (window === 'not_yet') return 'Changes for this term open with registration.';
  if (window === 'closed') return 'The change period is closed. Ask the registrar about a late change.';
  if (!held.some((s) => s.id === from.id)) return 'You do not hold that seat.';
  if (kind === 'drop') return null;
  if (!to) return 'Choose the section to swap into.';
  if (to.id === from.id) return 'Choose a different section.';
  if (to.term !== from.term) return 'A swap stays within one term.';
  if (held.some((s) => s.id === to.id)) return 'You already hold that section.';
  const others = held.filter((s) => s.id !== from.id);
  const clash = others.find((s) => overlaps(s.times, to.times));
  if (clash) return 'The new section meets at the same time as another of your classes.';
  if (maxCredits != null) {
    const after = others.reduce((n, s) => n + s.credits, 0) + to.credits;
    if (after > maxCredits) return `That would put you at ${after} credits; the limit is ${maxCredits}.`;
  }
  return null;
}
