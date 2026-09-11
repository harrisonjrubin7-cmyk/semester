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
 * So this searches deadlines, courses, study units, your notes, your tasks,
 * your appointments, the documents, sheets and decks you have made — and the
 * app's own screens, so "sync" reaches Account without knowing that Account is
 * where syncing lives.
 *
 * The made things were the last gap and the worst kind: a student writes a
 * document, comes back a fortnight later, types its name, and gets nothing.
 * The thing exists, the app made it, and the app cannot find it — which reads
 * as having lost it. They are searched by title and by their own contents now:
 * a document by its text, a sheet by what has been typed into its cells, a
 * deck by its slides.
 *
 * Ranking is deliberately dull and predictable: a match at the start of a name
 * beats a match in the middle, which beats a match in the body text. People
 * scan the first three results; being obvious matters more than being clever.
 */

import type { Catalog } from '../data/catalog';
import { datedItems } from './select';
import { forLine } from './forwork';
import { dueLabel, isoToDate } from './date';
import { DESTINATIONS, saysFor } from './nav';
import { anyAnswered, cardKey, type Reviews } from './review';
import { nearAny } from './near';
import { allowed, type Capabilities } from './school';
import { DEFAULT_ROLE, forRole, type Role } from './role';

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
import type {
  Appointment,
  CourseId,
  CourseUpdate,
  Note,
  PersonalTask,
  Screen,
  StudyMode,
} from './types';
import { liveGuide } from './live';
import type { Block, Doc } from './document';
import type { Sheet } from './sheet';
import type { StoredDeck } from './decks';

/**
 * What the student has made in the app, as one argument.
 *
 * One parameter rather than three, because this signature has grown by one
 * positional argument five times and the note beside `appointments` below says
 * what that costs. A caller with none of them passes nothing and is telling
 * the truth by saying nothing.
 */
export interface Made {
  documents?: Doc[];
  sheets?: Sheet[];
  decks?: StoredDeck[];
}

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
  | { kind: 'document'; id: string; title: string; sub: string; tag: string; score: number }
  | { kind: 'sheet'; id: string; title: string; sub: string; tag: string; score: number }
  | { kind: 'deck'; id: string; title: string; sub: string; tag: string; score: number }
  | { kind: 'task'; id: string; title: string; sub: string; tag: string; score: number }
  | { kind: 'appointment'; id: string; title: string; sub: string; tag: string; score: number }
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

/**
 * A block's words, whatever kind of block it is.
 *
 * The switch is exhaustive on purpose: adding a block kind to
 * `lib/document.ts` should fail the typecheck here rather than quietly make
 * that kind of content unsearchable.
 */
function textOfBlock(b: Block): string {
  switch (b.kind) {
    case 'heading':
    case 'text':
      return b.text;
    case 'bullets':
      return b.items.join(' ');
    case 'quote':
      return `${b.text} ${b.source}`;
    case 'table':
      return `${b.caption} ${b.rows.flat().join(' ')}`;
    case 'equation':
      return `${b.caption} ${b.latex}`;
    case 'break':
      return '';
  }
}

/**
 * A searchable body, capped.
 *
 * `score` runs a substring test over this on every keystroke, and a sheet can
 * hold ten thousand cells. Twenty thousand characters is a long document and
 * far more than anybody searches past.
 */
const BODY_CAP = 20_000;

function bodyOf(parts: string[]): string {
  let out = '';
  for (const part of parts) {
    if (!part) continue;
    out += `${part} `;
    if (out.length >= BODY_CAP) return out.slice(0, BODY_CAP);
  }
  return out;
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
  /*
   * Your own appointments.
   *
   * They were not searched at all. Seed a task, a note and an appointment that
   * share a word and search it: "2 results", the note and the task, on a
   * screen where all three are one tab apart. An appointment is the same shape
   * as a task — a title you typed, a date, a note — and it is the one of the
   * three most likely to have a person's name in it, which is exactly what
   * somebody types into a search box.
   *
   * Last in the list because that is where this signature has grown every
   * time, not because it matters least: adding it beside `tasks`, where it
   * belongs, would rewrite fifteen call sites in the test and bury the change
   * that matters in them.
   */
  appointments: Appointment[] = [],
  /**
   * Documents, sheets and decks. See `Made` above for why this is one object.
   */
  made: Made = {},
  /*
   * Who is holding the app.
   *
   * Last again, and for the last time: this signature is eleven parameters
   * now and wants an options object. That refactor touches every call in this
   * file's tests and would bury the change that matters in it, so it is a
   * separate job — but it is a job, not a preference.
   *
   * It is here at all because search is a gate like any other. The note on
   * `caps` above says why: search was the leak that would have let somebody
   * reach a meal-plan screen their university does not have, and a role is
   * the same kind of hole — a professor typing "housing" should not be
   * offered a dorm screen the directory has already stopped showing them.
   */
  role: Role = DEFAULT_ROLE,
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

    const apptHits: Hit[] = [];
    for (const a of appointments) {
      const s = score(q, a.title, `${a.note} ${a.where} ${a.time}`, spell ? a.title : '');
      if (s) {
        apptHits.push({
          kind: 'appointment',
          id: a.id,
          // The date as the app says dates, and the place, which is half of
          // why somebody looks an appointment up in the first place.
          sub: [dueLabel(isoToDate(a.date), now, a.time), a.time, a.where].filter(Boolean).join(' · '),
          title: a.title,
          tag: 'Appointment',
          score: s,
        });
      }
    }

    /*
     * The things the student made, searched by their contents as well as by
     * their names.
     *
     * A document is found by its text, a sheet by what has been typed into
     * its cells, and a deck by its slides — because a document called
     * "Untitled" with three pages of a Rawls essay in it is exactly the one
     * somebody searches for by typing "Rawls", and it is exactly the one a
     * title-only search cannot find.
     *
     * The body is capped rather than joined whole. `score` is a substring test
     * over the haystack and a sheet can hold ten thousand cells; a search box
     * that stutters on the fourth keystroke is worse than one that misses the
     * ten-thousandth cell of a spreadsheet nobody is looking for by its
     * contents.
     */
    /*
     * The deadlines, once, for the "for Friday's paper" half of the three
     * searches below.
     *
     * A document filed against a deadline is findable by that deadline's name
     * as well as by its own, because "the Rawls essay" is how a student refers
     * to a document called "Draft 3" — and the deadline's title is the only
     * place those words exist. Built here rather than inside each loop: the
     * three of them would otherwise decorate every item three times over.
     */
    const dated = datedItems(cat, now);

    const docHits: Hit[] = [];
    for (const d of made.documents ?? []) {
      const body = bodyOf(d.blocks.map(textOfBlock));
      const due = forLine(dated, d.itemId);
      const s = score(q, d.title || 'Untitled', `${d.subtitle} ${due} ${body}`, spell ? d.title : '');
      if (s) {
        docHits.push({
          kind: 'document',
          id: d.id,
          title: d.title || 'Untitled document',
          // What it is for beats what is in it: a second line that says
          // "for Reflection #2" identifies the document, and the first
          // sentence of its text mostly identifies the reading.
          sub: due || d.subtitle || first(body.replace(/\s+/g, ' ')) || 'Empty',
          tag: d.courseId ? (cat.byId[d.courseId]?.code ?? 'Document') : 'Document',
          score: s,
        });
      }
    }

    const sheetHits: Hit[] = [];
    for (const sh of made.sheets ?? []) {
      const typed = Object.values(sh.cells).filter(Boolean);
      const dueSheet = forLine(dated, sh.itemId);
      const s = score(q, sh.title || 'Untitled', `${dueSheet} ${bodyOf(typed)}`, spell ? sh.title : '');
      if (s) {
        sheetHits.push({
          kind: 'sheet',
          id: sh.id,
          title: sh.title || 'Untitled sheet',
          // What is in it, not how big the grid was dragged: a sheet with four
          // numbers in a 40×20 grid is four cells of work, and "40 × 20" would
          // describe the dragging rather than the sheet.
          sub:
            dueSheet ||
            (typed.length === 0
              ? 'Empty'
              : `${typed.length} ${typed.length === 1 ? 'cell' : 'cells'}`),
          tag: sh.courseId ? (cat.byId[sh.courseId]?.code ?? 'Sheet') : 'Sheet',
          score: s,
        });
      }
    }

    const deckHits: Hit[] = [];
    for (const d of made.decks ?? []) {
      const body = bodyOf(d.slides.flatMap((sl) => [sl.title, ...sl.bullets]));
      const dueDeck = forLine(dated, d.itemId);
      const s = score(q, d.title || 'Untitled', `${d.subtitle} ${dueDeck} ${body}`, spell ? d.title : '');
      if (s) {
        deckHits.push({
          kind: 'deck',
          id: d.id,
          title: d.title || 'Untitled deck',
          sub:
            dueDeck || `${d.slides.length} ${d.slides.length === 1 ? 'slide' : 'slides'}`,
          tag: d.courseId ? (cat.byId[d.courseId]?.code ?? 'Deck') : 'Deck',
          score: s,
        });
      }
    }

    const screens: Hit[] = [];
    for (const d of DESTINATIONS) {
      if (!allowed(d.screen, caps) || !forRole(d.screen, role)) continue;
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
      { label: 'Your appointments', hits: apptHits },
      { label: 'Documents', hits: docHits },
      { label: 'Sheets', hits: sheetHits },
      { label: 'Decks', hits: deckHits },
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
