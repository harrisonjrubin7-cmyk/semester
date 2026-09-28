import { formatDate } from './locale';
import type { Choice } from './actions';
import type { Taken } from './degree';
import type { Session } from './sessions';
import { SEASONS, readTerm, termId, type Term } from './term';

/**
 * Semester Wrapped (`semester_wrapped`, Phase L, D-054): a private end-of-term
 * recap, made on the device from what the student did.
 *
 * ## What it counts, and what it will not
 *
 * Only **outcomes the student chose** (DECISION-LOG D-005, rule 7): deadlines
 * they ticked off, study sessions they finished, plans and agendas they made,
 * work they recorded. Never app usage — screens visited, days opened,
 * `lib/usage.ts` — because opening an app is not an achievement, and a recap
 * that counted it would reward the wrong thing. `WrappedInput` has no field
 * for usage; a test holds that changing usage changes nothing.
 *
 * Nothing from the institution either: no office action, demand count, seat,
 * grade point or catalog data. Every number is the student's own record.
 *
 * ## How it speaks
 *
 * - A zero is left out, not shown. There is no "0 study sessions".
 * - No streaks, no ranks, no comparison with anyone, no "you could have".
 * - An empty term says so kindly and leaves it there.
 *
 * ## Where it goes
 *
 * Nowhere, unless the student says so. Export and share each show the exact
 * text first (`wrappedText`), and hold nothing else: no name, no course
 * titles, no dates beyond the term.
 */

export interface WrappedInput {
  term: Term;
  /** `state.done` and `state.tickedAt`: deadlines ticked, and when. */
  done: Readonly<Record<string, boolean>>;
  tickedAt: Readonly<Record<string, number>>;
  /** `state.sessions`: study sittings on the plan, with `doneAt` once finished. */
  sessions: readonly Pick<Session, 'doneAt'>[];
  /** `state.taken`: courses on the student's own record. */
  taken: readonly Pick<Taken, 'term' | 'grade' | 'current'>[];
  /** Saved registration schedules (`semester.registration.v1`). */
  schedulesSaved: number;
  /** Advisor meetings prepared (`semester.advisor-meeting.v1`). */
  meetings: readonly { date: string | null; agenda: readonly unknown[] }[];
  /** Career evidence (`semester.career-evidence.v1`): artifacts by month, finished bullets by time. */
  artifacts: readonly { date: string }[];
  bullets: readonly { final: boolean; updated: number }[];
  /** Career events saved in the career library. */
  eventsSaved: number;
  /** Action Center choices (`semester.actions.v1`): what the student marked done, and when. */
  actionChoices: Readonly<Record<string, Choice>>;
}

export interface WrappedLine {
  key: string;
  count: number;
  text: string;
}

export interface Wrapped {
  title: string;
  /** "Aug 1 – Nov 30, 2026". */
  span: string;
  made: WrappedLine[];
  forward: WrappedLine[];
  empty: boolean;
  next: Term;
}

/**
 * How many saved schedules belong to this recap. A schedule has no date, only
 * its courses' term, and is made the term before the one it plans — so it
 * counts once, in the recap of the term it was planned from, and never in
 * every recap on the picker.
 */
export function schedulesFor(plans: readonly { courses: readonly { term: string }[] }[], term: Term): number {
  const next = nextTerm(term);
  const names = new Set([next.id.toLowerCase(), next.label.toLowerCase()]);
  return plans.filter((p) => {
    const counts = new Map<string, number>();
    for (const c of p.courses) {
      const t = c.term.trim().toLowerCase();
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    return top !== undefined && names.has(top[0]);
  }).length;
}

/** From the first of the term's start month to the first of the next season's. */
export function termWindow(term: Term): { start: number; end: number } {
  const at = SEASONS.findIndex((s) => s.startMonth === term.startMonth);
  const next = SEASONS[(at + 1) % SEASONS.length];
  const endYear = next.startMonth <= term.startMonth ? term.year + 1 : term.year;
  return { start: new Date(term.year, term.startMonth, 1).getTime(), end: new Date(endYear, next.startMonth, 1).getTime() };
}

/** The term someone plans next: spring after fall or winter, fall after spring or summer. */
export function nextTerm(term: Term): Term {
  const code = term.id.slice(4);
  return code === 'FA' || code === 'WI' ? readTerm(termId(term.year + 1, 'SP')) : readTerm(termId(term.year, 'FA'));
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const fmt = (at: number, withYear: boolean) =>
  formatDate(new Date(at), { month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}) });

export function wrapped(input: WrappedInput): Wrapped {
  const { start, end } = termWindow(input.term);
  const inTerm = (at: number | null | undefined) => typeof at === 'number' && Number.isFinite(at) && at >= start && at < end;
  const monthIn = (ym: string) => {
    const m = /^(\d{4})-(\d{2})$/.exec(ym);
    return m ? inTerm(new Date(Number(m[1]), Number(m[2]) - 1, 1).getTime()) : false;
  };
  const dayIn = (iso: string | null) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? inTerm(new Date(`${iso}T12:00:00`).getTime()) : false);

  const deadlines = Object.entries(input.done).filter(([id, yes]) => yes && inTerm(input.tickedAt[id])).length;
  const studied = input.sessions.filter((s) => inTerm(s.doneAt)).length;
  const agendas = input.meetings.filter((m) => dayIn(m.date) && m.agenda.length > 0).length;
  const artifacts = input.artifacts.filter((a) => monthIn(a.date)).length;
  const bullets = input.bullets.filter((b) => b.final && inTerm(b.updated)).length;
  const actions = Object.values(input.actionChoices).filter((c) =>
    c.history.some((h) => h.event === 'complete' && inTerm(h.at)),
  ).length;
  const courses = input.taken.filter((t) => !t.current && t.grade.trim() && t.term.trim().toLowerCase() === input.term.label.toLowerCase()).length;

  const keep = (lines: WrappedLine[]) => lines.filter((l) => l.count > 0);
  const made = keep([
    { key: 'schedules', count: input.schedulesSaved, text: `${plural(input.schedulesSaved, 'semester plan')} saved` },
    { key: 'study', count: studied, text: `${plural(studied, 'study session')} finished` },
    { key: 'agendas', count: agendas, text: `${plural(agendas, 'advisor agenda')} prepared` },
    { key: 'artifacts', count: artifacts, text: `${plural(artifacts, 'portfolio project')} recorded` },
    { key: 'events', count: input.eventsSaved, text: `${plural(input.eventsSaved, 'campus event')} saved` },
  ]);
  const forward = keep([
    { key: 'deadlines', count: deadlines, text: `Ticking off ${plural(deadlines, 'deadline')}` },
    { key: 'actions', count: actions, text: `Finishing ${plural(actions, 'next step')} you chose` },
    { key: 'courses', count: courses, text: `Completing ${plural(courses, 'course')} on your record` },
    { key: 'bullets', count: bullets, text: `Writing ${plural(bullets, 'résumé bullet')} in your own words` },
  ]);
  return {
    title: `Your ${input.term.label} in Semester`,
    span: `${fmt(start, false)} – ${fmt(end - 86_400_000, true)}`,
    made,
    forward,
    empty: !made.length && !forward.length,
    next: nextTerm(input.term),
  };
}

/** Exactly what an export or a share holds, and nothing else. */
export function wrappedText(w: Wrapped): string {
  const out = [w.title.toUpperCase(), ''];
  if (w.empty) out.push('A quiet term in Semester. That is fine.');
  for (const l of w.made) out.push(`• ${l.text}`);
  if (w.forward.length) {
    if (w.made.length) out.push('');
    out.push('You moved forward by:');
    for (const l of w.forward) out.push(`• ${l.text}`);
  }
  out.push('', 'Made on my own device from my own records.');
  return out.join('\n');
}
