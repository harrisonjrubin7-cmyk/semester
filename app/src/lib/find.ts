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
import { dueLabel, isoToDate } from './date';
import { DESTINATIONS, saysFor } from './nav';
import { anyAnswered, cardKey, type Reviews } from './review';
import { nearAny } from './near';
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
import type { CourseId, CourseUpdate, Note, PersonalTask, Screen, StudyMode } from './types';
import { liveGuide } from './live';

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
 * The best a near miss can score.
 *
 * Every tier above this one needed the letters typed to appear in the letters
 * stored, so a hit at or below it is the search's guess at what was meant
 * rather than a match on what was said — which is a thing the screen should be
 * able to say out loud. See `spelled`.
 */
export const NEAR_MISS = 8;

/**
 * A near miss on the words around the name rather than on the name itself —
 * "calender" against a screen whose blurb mentions a calendar. Offered, and
 * offered second.
 */
const NEAR_MISS_NEARBY = 5;

/**
 * Words nobody is searching by.
 *
 * "delete my account" failed the every-word test because no screen's keywords
 * contain "my" — which is true of every possessive and article somebody puts in
 * a sentence. Requiring them makes the loose match useless for exactly the
 * queries it exists to serve.
 *
 * Deliberately short. A long stop list starts throwing away words that carry
 * meaning, and "work" or "check" are screens here.
 */
const FILLER = new Set([
  'a', 'an', 'the', 'my', 'me', 'i', 'is', 'are', 'was', 'to', 'of', 'in', 'on',
  'for', 'at', 'and', 'or', 'do', 'does', 'did', 'can', 'how', 'where', 'what',
  'when', 'it', 'this', 'that',
]);

/**
 * Score one candidate against the query.
 *
 * `name` is what the thing is called and carries the weight; `body` is
 * everything else worth matching but not worth ranking highly. Returns 0 for
 * no match, and the caller drops those.
 *
 * `spelling` is the text a mistyped word is allowed to land on, and empty is
 * how a caller turns the typo tier off. Kept separate from `body` because the
 * two are different sizes and different jobs: `body` is everything worth
 * matching exactly — all the cards in a unit, every keyword of a screen — and
 * running an edit distance over that much text would be both slow and loose,
 * since in ten thousand words something is within two edits of anything.
 */
function score(q: string, name: string, body = '', spelling = name): number {
  const n = name.toLowerCase();
  if (n === q) return 100;
  if (n.startsWith(q)) return 80;
  // A match at a word boundary reads as intentional; mid-word is often noise.
  if (new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(n)) return 60;
  if (n.includes(q)) return 40;
  if (body.toLowerCase().includes(q)) return 20;

  /*
   * Every word, in any order, as a last resort.
   *
   * Until this, the whole query had to appear as one run of characters — so
   * "delete my account" found nothing while "delete account" found the page
   * whose button is literally labelled Delete my account. People type
   * sentences, and the words they put between the useful ones are not a reason
   * to be told there are no results.
   *
   * Scored below every direct match so it never outranks one, and only for a
   * query of more than one word, since a single word has already been tried
   * against both halves above.
   */
  const words = q.split(/\s+/).filter((w) => w && !FILLER.has(w));
  // Whenever the filtered words are not simply the query again — so a
  // multi-word query gets this, and so does "where are my grades", which comes
  // down to the single word "grades" that the direct checks above never saw.
  if (words.length > 0 && (words.length > 1 || words[0] !== q)) {
    const all = `${n} ${body.toLowerCase()}`;
    if (words.every((w) => all.includes(w))) return 10;
  }

  /*
   * A word typed wrong, as the last tier of all.
   *
   * Every tier above asks whether the letters typed are among the letters
   * stored, which answers a typed word and not a mistyped one: "calender"
   * found nothing at all, though there is a Calendar screen, and the reply was
   * a sentence suggesting a course code, a topic, a professor or the name of a
   * screen — all four of which are equally unfindable with a finger off by
   * one. See `lib/near.ts` for how far off a word is allowed to be.
   *
   * Every word still has to land, exactly or nearly, so a typo is forgiven and
   * a wrong word is not: "monopoly parsnip" is still nothing. And it scores
   * below the loose match above it, so a near miss can never come out ahead of
   * something the person actually typed.
   */
  if (words.length > 0 && spelling !== '') {
    const all = `${n} ${body.toLowerCase()}`;
    const spelled = spelling.toLowerCase();
    if (words.every((w) => all.includes(w) || nearAny(w, spelled))) {
      // A near miss on the name is a better guess than one on the words around
      // it: "calender" means the Calendar screen, not the four other screens
      // whose description happens to mention a calendar. Both are offered —
      // in that order.
      return words.every((w) => n.includes(w) || nearAny(w, n)) ? NEAR_MISS : NEAR_MISS_NEARBY;
    }
  }
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
  /**
   * Everything added since the courses were imported.
   *
   * Search read `cat.guides` — the modules as they were compiled — so a unit
   * that arrived with a reading, and every card in it, was unfindable. Typing
   * the name of the thing you added yesterday returned nothing, which reads as
   * "it did not save".
   */
  updates: CourseUpdate[] = [],
  /*
   * What has actually been answered.
   *
   * A unit's `mastery` is `unitMastery`'s blend of answers with the figure the
   * guide declared, and before the first answer it is entirely the declared
   * one — so this row read "8 cards · 47% known" about a unit nobody had
   * opened. "Known" is the strongest word on the row and it was the least
   * earned. Optional because every caller that has reviews should pass them
   * and a caller that has none is telling the truth by saying nothing.
   */
  reviews: Reviews = {},
): HitGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  /*
   * Two sweeps, and the second one usually does not happen.
   *
   * `spell` is what turns the typo tier on, by giving `score` the text a
   * mistyped word is allowed to land on. It is off for the first sweep and on
   * only if that sweep came back with nothing, which is the difference between
   * a spell-checker and a looser search: a query that found what it was
   * looking for is never diluted with words it did not ask for. Typing
   * "grades" should not also offer the screen whose blurb says "grade".
   *
   * It also means the extra work happens only in the case that was previously
   * an empty screen, so a search that is finding things costs exactly what it
   * used to.
   */
  const sweep = (spell: boolean): HitGroup[] => {
    const items: Hit[] = [];
    for (const i of datedItems(cat, now)) {
      const course = cat.byId[i.c];
      const s = score(
        q,
        i.title,
        [i.kind, i.where, i.detail, course.code, course.name, course.prof, i.dueShort, i.mon, i.dow].join(' '),
        // A typo may land on what the thing is and whose it is, not on the date
        // it is due: "wed" is two edits from "wet", "fed" and "we", and a
        // deadline surfacing because its weekday nearly spells another word is
        // the kind of result that teaches people the search is broken.
        spell ? `${i.title} ${i.kind} ${course.code} ${course.name}` : '',
      );
      if (s) items.push({ kind: 'item', id: i.id, title: i.title, sub: `${i.dueShort} · ${i.kind}`, tag: course.code, score: s });
    }

    const courses: Hit[] = [];
    for (const c of cat.courses) {
      const s = Math.max(
        score(q, c.code, `${c.name} ${c.prof} ${c.room} ${c.meets}`, spell ? `${c.code} ${c.name} ${c.prof}` : ''),
        score(q, c.name),
      );
      if (s) courses.push({ kind: 'course', id: c.id, title: c.code, sub: c.name, tag: 'Course', score: s });
    }

    // Units are where the actual studying is, and they were entirely invisible
    // to search — the one thing a person is most likely to type the name of.
    const units: Hit[] = [];
    for (const c of cat.courses) {
      // The guide as it stands today, not as it was compiled. `liveGuide` is the
      // same merge the study screens use, so a search hit and the screen it
      // opens can never disagree about what is in a unit.
      // The guide as it stands, reviews included, so a figure in a search
      // result and the same figure on the study screen cannot disagree.
      const guide =
        updates.length || Object.keys(reviews).length
          ? liveGuide(cat, c.id, updates, reviews)
          : cat.guides[c.id];
      if (!guide) continue;
      guide.units.forEach((u, index) => {
        const cards = u.cards.map((card) => `${card.q} ${card.a}`).join(' ');
        // The course the unit belongs to is part of the haystack, because
        // "1020 monopoly" is how somebody with two courses covering monopoly
        // says which one they mean — and until this it was how they got nothing.
        // A unit's own cards usually mention the subject, so this mostly showed
        // up on the courses whose cards happen not to.
        const s = score(q, u.name, `${cards} ${c.code} ${c.name}`, spell ? `${u.name} ${c.code} ${c.name}` : '');
        if (s) {
          units.push({
            kind: 'unit',
            courseId: c.id,
            unit: index,
            mode: 'cards',
            title: u.name,
            sub: `${u.cards.length} cards · ${
              anyAnswered(
                u.cards.map((card) => cardKey(c.id, card.q)),
                reviews,
              )
                ? `${u.mastery}% known`
                : 'not started'
            }`,
            tag: c.code,
            score: s,
          });
        }
      });
    }

    const noteHits: Hit[] = [];
    for (const n of notes) {
      const s = score(q, n.title || 'Untitled', n.body, spell ? n.title : '');
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
      const s = score(q, t.title, `${t.note} ${t.time}`, spell ? t.title : '');
      if (s) {
        taskHits.push({
          kind: 'task',
          id: t.id,
          title: t.title,
          /*
           * The date the way the app says dates everywhere else.
           *
           * This was the stored value — "2026-09-10 · 9:00 PM" — the one
           * machine date anywhere on screen: the row for the same task on
           * Personal reads "Thu Sep 10", and the deadline hits in the group
           * above this one, in this same list, read "Tomorrow". A search
           * result is often the second time somebody sees a thing they wrote,
           * and it should not be the one place it is written in a different
           * language.
           */
          sub: [t.date ? dueLabel(isoToDate(t.date), now, t.time) : 'Someday', t.time]
            .filter(Boolean)
            .join(' · '),
          tag: t.done ? 'Done' : 'Task',
          score: s,
        });
      }
    }

    const screens: Hit[] = [];
    for (const d of DESTINATIONS) {
      if (!allowed(d.screen, caps)) continue;
      // Searched and shown in the school's own words, so typing "commodore
      // cash" finds the meal screen and a student elsewhere is not offered a
      // sentence about somebody else's campus card. The static keywords stay in
      // the haystack either way — they cost nothing and they are how somebody
      // who has heard the word finds the screen.
      const { label, blurb } = saysFor(d, caps);
      const s = score(q, label, `${blurb} ${d.blurb} ${d.keywords}`, spell ? `${label} ${blurb} ${d.keywords}` : '');
      if (s) screens.push({ kind: 'screen', screen: d.screen, title: label, sub: blurb, tag: 'Go to', score: s });
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
  };

  const found = sweep(false);
  return found.length > 0 ? found : sweep(true);
}

export function countHits(groups: HitGroup[]): number {
  return groups.reduce((n, g) => n + g.hits.length, 0);
}

/**
 * Are these results a guess at the spelling rather than matches?
 *
 * True only when there are hits and every one of them came from the spelling
 * pass — which is the same thing as saying the strict sweep found nothing, and
 * is worth saying on screen. "5 results" for a query that matched none of them
 * is a small lie, and the person reading it is the one who knows they may have
 * mistyped.
 */
export function spelled(groups: HitGroup[]): boolean {
  const hits = groups.flatMap((g) => g.hits);
  return hits.length > 0 && hits.every((h) => h.score <= NEAR_MISS);
}
