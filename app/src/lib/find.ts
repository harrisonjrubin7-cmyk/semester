/**
 * One search box that finds everything.
 *
 * It used to search deadlines and nothing else, which meant the app knew far
 * more than it would admit: type "monopoly" and get nothing, though there is a
 * unit called that with nine cards in it; type "gmail" and get nothing, though
 * there is a screen for exactly that. A search that silently covers a tenth of
 * the app teaches people not to search, and then everything has to be found by
 * remembering where it was put.
 *
 * So this searches deadlines, courses, study units, your notes, your tasks —
 * and the app's own screens, so "sync" reaches Account without knowing that
 * Account is where syncing lives.
 *
 * Ranking is deliberately dull and predictable: a match at the start of a name
 * beats a match in the middle, which beats a match in the body text. People
 * scan the first three results; being obvious matters more than being clever.
 */

import type { Catalog } from '../data/catalog';
import { datedItems } from './select';
import { DESTINATIONS } from './nav';
import { allowed, type Capabilities } from './school';

/**
 * The default for a caller that has not been given a school.
 *
 * Everything on rather than everything off: a missing argument should not
 * quietly make six screens unfindable, which is a failure nobody would notice
 * until somebody could not find their meal plan.
 */
const ANY: Capabilities = {
  mealPlan: 'both',
  housing: true,
  campusMap: true,
  registrarUrl: 'https://example.invalid',
  orgPortalUrl: 'https://example.invalid',
};
import type { CourseId, Note, PersonalTask, Screen, StudyMode } from './types';

export type Hit =
  | { kind: 'item'; id: string; title: string; sub: string; tag: string; score: number }
  | { kind: 'course'; id: CourseId; title: string; sub: string; tag: string; score: number }
  | {
      kind: 'unit';
      courseId: CourseId;
      unit: number;
      mode: StudyMode;
      title: string;
      sub: string;
      tag: string;
      score: number;
    }
  | { kind: 'note'; id: string; title: string; sub: string; tag: string; score: number }
  | { kind: 'task'; id: string; title: string; sub: string; tag: string; score: number }
  | { kind: 'screen'; screen: Screen; title: string; sub: string; tag: string; score: number };

export interface HitGroup {
  label: string;
  hits: Hit[];
}

/**
 * Score one candidate against the query.
 *
 * `name` is what the thing is called and carries the weight; `body` is
 * everything else worth matching but not worth ranking highly. Returns 0 for
 * no match, and the caller drops those.
 */
function score(q: string, name: string, body = ''): number {
  const n = name.toLowerCase();
  if (n === q) return 100;
  if (n.startsWith(q)) return 80;
  // A match at a word boundary reads as intentional; mid-word is often noise.
  if (new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(n)) return 60;
  if (n.includes(q)) return 40;
  if (body.toLowerCase().includes(q)) return 20;
  return 0;
}

const first = (text: string, n = 80): string =>
  text.length > n ? `${text.slice(0, n).trimEnd()}…` : text;

export function findEverything(
  cat: Catalog,
  now: Date,
  query: string,
  notes: Note[],
  tasks: PersonalTask[],
  /**
   * What this school has. Screens it has no equivalent of are not findable —
   * search was the leak that would have let somebody reach a meal plan screen
   * their university does not have.
   */
  caps: Capabilities = ANY,
): HitGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const items: Hit[] = [];
  for (const i of datedItems(cat, now)) {
    const course = cat.byId[i.c];
    const s = score(q, i.title, [i.kind, i.where, i.detail, course.code, course.name, course.prof, i.dueShort, i.mon, i.dow].join(' '));
    if (s) items.push({ kind: 'item', id: i.id, title: i.title, sub: `${i.dueShort} · ${i.kind}`, tag: course.code, score: s });
  }

  const courses: Hit[] = [];
  for (const c of cat.courses) {
    const s = Math.max(score(q, c.code, `${c.name} ${c.prof} ${c.room} ${c.meets}`), score(q, c.name));
    if (s) courses.push({ kind: 'course', id: c.id, title: c.code, sub: c.name, tag: 'Course', score: s });
  }

  // Units are where the actual studying is, and they were entirely invisible
  // to search — the one thing a person is most likely to type the name of.
  const units: Hit[] = [];
  for (const c of cat.courses) {
    const guide = cat.guides[c.id];
    if (!guide) continue;
    guide.units.forEach((u, index) => {
      const cards = u.cards.map((card) => `${card.q} ${card.a}`).join(' ');
      const s = score(q, u.name, cards);
      if (s) {
        units.push({
          kind: 'unit',
          courseId: c.id,
          unit: index,
          mode: 'cards',
          title: u.name,
          sub: `${u.cards.length} cards · ${u.mastery}% known`,
          tag: c.code,
          score: s,
        });
      }
    });
  }

  const noteHits: Hit[] = [];
  for (const n of notes) {
    const s = score(q, n.title || 'Untitled', n.body);
    if (s) {
      noteHits.push({
        kind: 'note',
        id: n.id,
        title: n.title || 'Untitled note',
        sub: first(n.body.replace(/\s+/g, ' ')) || 'Empty',
        tag: n.courseId ? (cat.byId[n.courseId]?.code ?? 'Note') : 'Note',
        score: s,
      });
    }
  }

  const taskHits: Hit[] = [];
  for (const t of tasks) {
    const s = score(q, t.title, `${t.note} ${t.time}`);
    if (s) {
      taskHits.push({
        kind: 'task',
        id: t.id,
        title: t.title,
        sub: [t.date ?? 'Someday', t.time].filter(Boolean).join(' · '),
        tag: t.done ? 'Done' : 'Task',
        score: s,
      });
    }
  }

  const screens: Hit[] = [];
  for (const d of DESTINATIONS) {
    if (!allowed(d.screen, caps)) continue;
    const s = score(q, d.label, `${d.blurb} ${d.keywords}`);
    if (s) screens.push({ kind: 'screen', screen: d.screen, title: d.label, sub: d.blurb, tag: 'Go to', score: s });
  }

  const groups: HitGroup[] = [
    { label: 'Deadlines', hits: items },
    { label: 'Study units', hits: units },
    { label: 'Courses', hits: courses },
    { label: 'Your notes', hits: noteHits },
    { label: 'Your tasks', hits: taskHits },
    { label: 'Places in the app', hits: screens },
  ];

  return groups
    .map((g) => ({ label: g.label, hits: g.hits.sort((a, b) => b.score - a.score).slice(0, 8) }))
    .filter((g) => g.hits.length > 0)
    // A group whose best hit is stronger goes first, so typing a course code
    // does not bury the course under six deadlines that mention it.
    .sort((a, b) => b.hits[0].score - a.hits[0].score);
}

export function countHits(groups: HitGroup[]): number {
  return groups.reduce((n, g) => n + g.hits.length, 0);
}
