/**
 * More than one semester at a time.
 *
 * A deadline in this app carried a month and a day and no year, because
 * `SEMESTER_YEAR` was a constant set to 2026 and every date was read against
 * it. That is fine for one fall and wrong for everything after it: a January
 * exam in a spring course, a summer session, or simply opening the app in 2027
 * and finding it still filing everything under this year.
 *
 * ## A term is a label and a year, and that is all
 *
 * `2026FA`. Six characters, sortable as a string, and readable by a person
 * looking at saved data — which matters more than it sounds, because this id
 * ends up in an exported file and in a shared paper's code.
 *
 * A course belongs to a term. An item takes its year from its course's term,
 * stamped on at catalogue-build time so that every screen downstream keeps
 * reading `item.date` and knows nothing about any of this.
 *
 * ## The one subtlety, which is real
 *
 * A term's months do not all fall in the term's year. A winter session runs
 * December into January; the December is the term's year and the January is
 * the next one. `yearFor` is that rule, and it is one comparison: a month
 * earlier than the term's own starting month belongs to the following year.
 * Fall and spring never trip it, which is why it went unnoticed until a
 * winter term existed.
 */

export interface Season {
  code: string;
  label: string;
  /** Month index the season starts in, 0-based. */
  startMonth: number;
}

export const SEASONS: Season[] = [
  { code: 'SP', label: 'Spring', startMonth: 0 },
  { code: 'SU', label: 'Summer', startMonth: 4 },
  { code: 'FA', label: 'Fall', startMonth: 7 },
  // Deliberately after Fall: a winter session starts in December and runs into
  // January, which is what makes `yearFor` earn its keep.
  { code: 'WI', label: 'Winter', startMonth: 11 },
];

export interface Term {
  /** '2026FA' — what a course stores and what sorts correctly as a string. */
  id: string;
  /** 'Fall 2026' — what a person reads. */
  label: string;
  year: number;
  startMonth: number;
}

/**
 * The term every course saved before terms existed belongs to.
 *
 * Not "whatever term it is today": those courses hold Fall 2026 dates, and
 * filing them under the current term after the semester ends would move every
 * deadline in them by a year. This is the honest answer to "when were these",
 * and it is only ever a fallback.
 */
export const LEGACY_TERM = '2026FA';

export function termId(year: number, seasonCode: string): string {
  return `${year}${seasonCode.toUpperCase()}`;
}

/** '2026FA' → the term. Anything unreadable falls back to the legacy term. */
export function readTerm(id: string | undefined): Term {
  const m = /^(\d{4})(SP|SU|FA|WI)$/i.exec((id ?? '').trim());
  if (!m) return readTerm(id === LEGACY_TERM ? undefined : LEGACY_TERM);
  const year = Number(m[1]);
  const season = SEASONS.find((s) => s.code === m[2].toUpperCase()) ?? SEASONS[2];
  return {
    id: termId(year, season.code),
    label: `${season.label} ${year}`,
    year,
    startMonth: season.startMonth,
  };
}

/**
 * The calendar year a month falls in, for a given term.
 *
 * A month before the term's own starting month is in the following year — the
 * January of a December-start winter session. Every other term answers with
 * its own year, which is why this was invisible for so long.
 */
export function yearFor(term: Term, month: number): number {
  return month < term.startMonth ? term.year + 1 : term.year;
}

/** The term a date falls in, for defaulting a new course sensibly. */
export function termNow(now: Date): Term {
  const month = now.getMonth();
  const year = now.getFullYear();
  // Latest season whose start month this one is at or past. December belongs
  // to Winter of the same year; January to Spring, not to last year's Winter,
  // because a person adding a course in January means this spring.
  const season = [...SEASONS].reverse().find((s) => month >= s.startMonth) ?? SEASONS[0];
  return readTerm(termId(year, season.code));
}

/** Newest first, which is the order somebody wants a term picker in. */
export function sortTerms(ids: string[]): Term[] {
  return [...new Set(ids)]
    .map(readTerm)
    .sort((a, b) => b.year - a.year || b.startMonth - a.startMonth);
}

/**
 * Whether a term has finished, given today.
 *
 * A term is over once the term *after* it has begun, which is a rule that
 * needs no end dates and is right within a few weeks — good enough for
 * greying out a shelf, and not used for anything that would mind being a
 * fortnight out.
 */
export function isPast(term: Term, now: Date): boolean {
  const current = termNow(now);
  return term.year < current.year || (term.year === current.year && term.startMonth < current.startMonth);
}
