import type { TodayView } from '../domains/today';

/**
 * Phase 2: the new Today, compared with the old one, on the same state.
 *
 * Nothing here changes what a student sees. The Action Center keeps computing
 * and drawing exactly what it did; a second path asks the domain layer the
 * same questions, and this file says where the two answers differ — and, for
 * the differences that are *known*, why.
 *
 * Pure, so the rules for "known" are tested rather than remembered.
 */

/** One side's answer, reduced to what can be compared: ids, in order. */
export interface Side {
  /** The most important action, then those that follow, as the ranker ordered them. */
  readonly ranked: readonly string[];
  /** What is on today, as `kind:id`, sorted. */
  readonly day: readonly string[];
}

export interface ShadowDiff {
  readonly ranking: { readonly onlyLegacy: readonly string[]; readonly onlyDomain: readonly string[]; readonly reordered: boolean };
  readonly day: { readonly onlyLegacy: readonly string[]; readonly onlyDomain: readonly string[] };
  /** Differences with a reason on record: the domain layer does not have that source yet. */
  readonly explained: readonly string[];
  /** Everything else. This is the list that must reach zero before Today is flipped. */
  readonly unexplained: readonly string[];
}

/**
 * Differences that are the domain layer's *missing sources*, not disagreement.
 * Each entry is a statement about work not yet done, so deleting one means
 * doing it.
 *
 * **Empty.** It had three — registration-day actions, campus office actions
 * and class meetings — and the slice now has all three sources. The mechanism
 * stays, taking its list as a parameter, so the next source that is genuinely
 * missing can be named instead of hidden; but nothing is excused today, and a
 * test asserts it.
 */
export const KNOWN_GAPS: readonly (readonly [RegExp, string])[] = [];


/** `appointment:abc:2026-10-08` → `appointment:abc`; the day is the comparison's, not part of the identity. */
const dropDay = (key: string): string => key.replace(/^(appointment:[^:@]+)[:@].*$/, '$1');

/** The domain's Today as a `Side`. Deadlines are `course:` on the legacy day, so they are renamed to meet it. */
export function domainSide(view: TodayView, ranked: readonly string[]): Side {
  const keys = [
    ...view.schedule.map((e) => (e.kind === 'deadline' ? `course:${e.id.replace(/^deadline:/, '')}` : dropDay(e.id))),
    ...view.dueToday.map((t) => `task:${t.id}`),
  ];
  return { ranked, day: keys.sort() };
}

/** The Action Center's rows for today, as a `Side`'s `day`. */
export function legacyDay(rows: readonly { id: string }[]): string[] {
  return rows.map((r) => dropDay(r.id)).sort();
}

const only = (a: readonly string[], b: readonly string[]): string[] => a.filter((x) => !b.includes(x));

export function diffToday(domain: Side, legacy: Side, gaps: readonly (readonly [RegExp, string])[] = KNOWN_GAPS): ShadowDiff {
  const gapOf = (id: string): string | null => gaps.find(([re]) => re.test(id))?.[1] ?? null;
  const explained: string[] = [];
  const unexplained: string[] = [];
  const note = (id: string, where: string) => {
    const gap = gapOf(id);
    if (gap) explained.push(`${where}: ${id} — ${gap}`);
    else unexplained.push(`${where}: ${id}`);
  };

  // Day: set difference. A legacy-only row is explained if it is a missing source.
  const dayLegacyOnly = only(legacy.day, domain.day);
  const dayDomainOnly = only(domain.day, legacy.day);
  for (const id of dayLegacyOnly) note(id, 'day, legacy only');
  for (const id of dayDomainOnly) unexplained.push(`day, domain only: ${id}`);

  // Ranking: take out what the legacy ranker had from a source the domain lacks,
  // then the rest must agree in order. The legacy list is cut at a fixed length,
  // so each removed id lets one more of the domain's tail show — that is not a disagreement.
  const rankLegacyOnly = only(legacy.ranked, domain.ranked);
  const missing = legacy.ranked.filter((id) => gapOf(id));
  const kept = legacy.ranked.filter((id) => !gapOf(id));
  const head = domain.ranked.slice(0, kept.length);
  const tail = domain.ranked.slice(kept.length);
  const reordered = head.length === kept.length && head.some((id, i) => id !== kept[i]) && only(kept, head).length === 0;
  for (const id of rankLegacyOnly) note(id, 'ranking, legacy only');
  for (const id of tail.slice(missing.length)) unexplained.push(`ranking, domain only: ${id}`);
  for (const id of head.filter((id) => !kept.includes(id))) unexplained.push(`ranking, domain only: ${id}`);
  if (reordered) unexplained.push(`ranking order: legacy [${kept.join(', ')}] vs domain [${head.join(', ')}]`);

  return {
    ranking: { onlyLegacy: rankLegacyOnly, onlyDomain: only(domain.ranked, legacy.ranked), reordered },
    day: { onlyLegacy: dayLegacyOnly, onlyDomain: dayDomainOnly },
    explained,
    unexplained,
  };
}

/** Whether the shadow runs. Off unless a build opts in; never on in production builds by default. */
export const shadowEnabled = (): boolean => import.meta.env.VITE_TODAY_SHADOW === 'on';
