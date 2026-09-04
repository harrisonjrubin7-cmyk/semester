/**
 * A syllabus in, a course out.
 *
 * This is the pipeline that built the first four courses, moved into the app so
 * anyone can run it on their own semester. The rules it enforces are the ones
 * learned building those four by hand:
 *
 *  - **Every deadline carries the sentence it came from.** A date with no quote
 *    is a date you cannot check, and the app shows the quote under "Straight
 *    from the syllabus" precisely so a student can trust the entry.
 *  - **A card is a question the exam could ask, answered in full prose with the
 *    numbers in it** — not a topic label. "Know the GGL study" is not a card.
 *  - **Nothing is invented.** No quote that is not in the document, no date the
 *    syllabus does not state, no grading weight that was not written down.
 *
 * The model returns JSON, and everything below the prompt exists because a
 * model's JSON is a proposal, not a fact: months get validated into range, ids
 * are made unique, figures keyed past the end of the unit list are dropped. The
 * same class of mistake `pipeline/validate.mjs` catches in the repo, caught here
 * before it can reach a screen.
 */

import { ask, type Citation, type Doc } from './claude';
import type { Course, CourseModule, Item, RecurringBlock } from './types';
import { check, flatten, tally, worthCiting, type Checked } from './cite';

export interface GenerationInput {
  /**
   * The syllabus, and any readings, already turned into text.
   *
   * A PDF also carries `pdf`: the file itself, base64. Where that is present
   * the document goes to the model whole and its quotes come back with a page
   * number that can be checked — see `lib/cite.ts`. The text is still sent
   * either way, because it is what everything else in this file reads.
   */
  documents: { name: string; text: string; pdf?: string }[];
  /** What the student said about the course, if anything. */
  hint: string;
  /** Year the semester falls in — dates in a syllabus rarely carry one. */
  year: number;
}

export interface GenerationResult {
  module: CourseModule;
  /** What was adjusted or thrown out on the way in, for the preview to show. */
  notes: string[];
  /** How the quotes stood up against the file, in a sentence. Empty if unchecked. */
  quotesLine?: string;
}

const SYSTEM = `You turn a university syllabus into structured course data for a study app.

Return ONLY JSON matching this shape:

{
  "course": {
    "id": "short lowercase slug, e.g. econ",
    "code": "ECON 1020",
    "name": "Principles of Microeconomics",
    "prof": "Dr. John Stromme",
    "email": "",
    "meets": "MWF · 9:05–9:55a",
    "room": "",
    "credits": "3 credits",
    "lms": "the course's Brightspace/Canvas URL if the syllabus gives one, else empty",
    "grading": [{ "what": "Problem sets", "pct": "20%" }]
  },
  "schedule": [{ "days": [1,3,5], "at": 545, "time": "9:05a", "title": "ECON 1020", "meta": "room · professor" }],
  "items": [{
    "id": "econ-ps1", "c": "econ", "kind": "Problem set", "title": "Problem Set 1",
    "month": 8, "day": 12, "dueTime": "11:59 PM", "where": "Brightspace",
    "weight": "20% of grade, lowest dropped", "detail": "one sentence of what it is",
    "quote": "the sentence from the syllabus that states this, verbatim"
  }],
  "guide": {
    "code": "ECON 1020", "name": "…", "blurb": "one line on what carries the course",
    "source": "the file it came from", "mastery": 0, "audio": false,
    "units": [{ "name": "1 · What economics is", "mastery": 0,
      "cards": [{ "q": "an exam question", "a": "the full answer, with the numbers in it" }] }],
    "terms": [{ "t": "term", "d": "definition" }],
    "selfTest": [{ "q": "…", "a": "…" }]
  }
}

Rules, in order of importance:

1. Never invent. Every "quote" must appear verbatim in the source text. If a
   date, weight or professor is not stated, leave the field empty rather than
   guessing. Omit a deadline you cannot quote.
2. Months are 0-based: January is 0, August is 7, September 8, December 11.
3. "at" is minutes past midnight (9:05am = 545). "days" are 0=Sunday..6=Saturday.
4. Cards are questions an exam could actually ask, answered in full prose with
   the specific numbers, names and mechanisms. Never a hint, never a topic label.
   Build them from the readings when readings are supplied; from the syllabus's
   own topic list when they are not.
5. Units follow the course's own structure — its weeks, chapters or sessions.
6. Keep every id lowercase, hyphenated, and prefixed with the course id.
7. mastery is 0 everywhere: the student has not studied any of it yet.`;

/** Ask for the course, then check what comes back before believing it. */
export async function generateCourse(
  input: GenerationInput,
  signal?: AbortSignal,
): Promise<GenerationResult> {
  // A PDF goes whole where the app kept it, so the model reads the page
  // rather than a flattening of it, and so the API can cite what it used.
  const docs: Doc[] = input.documents
    .filter((d) => d.pdf)
    .map((d) => ({ mediaType: 'application/pdf', data: d.pdf as string, title: d.name }));

  // Only the documents that could not be sent whole need pasting as text.
  const pasted = input.documents
    .filter((d) => !d.pdf)
    .map((d) => `--- ${d.name} ---\n${d.text.slice(0, 60_000)}`)
    .join('\n\n');

  const citations: Citation[] = [];

  const reply = await ask({
    signal,
    maxTokens: 8000,
    system: SYSTEM,
    docs,
    cite: worthCiting(docs),
    onCitation: (c) => citations.push(c),
    messages: [
      {
        role: 'user',
        content:
          `The semester falls in ${input.year}.` +
          (input.hint ? `\nThe student says: ${input.hint}` : '') +
          (pasted ? `\n\n${pasted}` : ''),
      },
    ],
  });

  return validate(reply, input, citations);
}

/** Pull the JSON out of a reply that may have wrapped it in prose or a fence. */
function extractJson(reply: string): unknown {
  const fenced = reply.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : reply.slice(reply.indexOf('{'), reply.lastIndexOf('}') + 1);
  return JSON.parse(body);
}

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'course';

/**
 * Everything the model could get wrong that the app cannot survive.
 *
 * This is deliberately unforgiving about structure and forgiving about content:
 * a missing room is fine, a month of 13 is not. What it drops, it says it
 * dropped, so the preview can show the student what was thrown away rather than
 * quietly shipping a course with three of its deadlines missing.
 */
function validate(
  reply: string,
  input: GenerationInput,
  citations: Citation[] = [],
): GenerationResult {
  const notes: string[] = [];
  let raw: {
    course?: Partial<Course>;
    schedule?: RecurringBlock[];
    items?: Partial<Item>[];
    guide?: CourseModule['guide'];
  };

  try {
    raw = extractJson(reply) as typeof raw;
  } catch {
    throw new Error('The reply was not usable JSON. Try again, or paste the syllabus as text.');
  }

  if (!raw.course?.code) throw new Error('No course code came back — the document may not be a syllabus.');
  if (!raw.guide?.units?.length) throw new Error('No study guide came back. Try adding the readings.');

  const id = slug(raw.course.id || raw.course.code);
  const source = input.documents[0]?.name ?? 'uploaded document';

  const course: Course = {
    id,
    code: raw.course.code,
    name: raw.course.name ?? '',
    prof: raw.course.prof ?? '',
    email: raw.course.email ?? '',
    meets: raw.course.meets ?? '',
    room: raw.course.room ?? '',
    credits: raw.course.credits ?? '',
    source,
    lms: typeof raw.course.lms === 'string' && /^https?:\/\//i.test(raw.course.lms)
      ? raw.course.lms
      : undefined,
    grading: raw.course.grading ?? [],
  };

  // Deadlines: a date has to be real, and a quote has to be in the document.
  //
  // The quote was already checked against the extracted text before citations
  // existed, and that check stays — it is the stronger of the two, because it
  // searches the whole document rather than only what the model says it used.
  // Two things change. It compares through `flatten`, so a curly quote or an
  // em dash no longer throws away a real quote; and where the API cited the
  // span, the page number comes with it, which is the part the text search
  // could never supply.
  const haystack = flatten(input.documents.map((d) => d.text).join('\n'));
  const seen = new Set<string>();
  const items: Item[] = [];

  for (const [n, it] of (raw.items ?? []).entries()) {
    const month = Number(it.month);
    const day = Number(it.day);
    if (!Number.isInteger(month) || month < 0 || month > 11 || !Number.isInteger(day) || day < 1 || day > 31) {
      notes.push(`Dropped "${it.title ?? 'an item'}" — its date (${it.month}/${it.day}) is not a real one.`);
      continue;
    }
    let itemId = slug(it.id || `${id}-${it.title ?? n}`);
    while (seen.has(itemId)) itemId = `${itemId}-${n}`;
    seen.add(itemId);

    // A quote that is not in the source is the one thing that must not slip
    // through: the app presents it as the syllabus's own words.
    let quote = it.quote ?? '';
    let checked: Checked | undefined;
    if (quote) {
      const inText = haystack.includes(flatten(quote));
      const cited = check(quote, citations);
      if (!inText && !cited.confirmed) {
        notes.push(
          `"${it.title ?? itemId}" quoted a sentence that is not in the document — quote removed.`,
        );
        quote = '';
      } else {
        // Confirmed either way; the page only exists if the API cited it.
        checked = { confirmed: true, ...(cited.page ? { page: cited.page } : {}) };
      }
    }

    items.push({
      id: itemId,
      c: id,
      kind: it.kind ?? 'Assignment',
      title: it.title ?? 'Untitled',
      month,
      day,
      dueTime: it.dueTime ?? '11:59 PM',
      where: it.where ?? '',
      weight: it.weight ?? '',
      detail: it.detail ?? '',
      quote,
      ...(checked ? { checked } : {}),
      source,
    });
  }

  if (items.length === 0) notes.push('No dated work was found — check the schedule table came through.');

  const schedule: RecurringBlock[] = (raw.schedule ?? [])
    .filter((b) => Array.isArray(b.days) && b.days.every((d) => d >= 0 && d <= 6))
    .map((b) => ({
      days: b.days,
      at: Math.min(1439, Math.max(0, Number(b.at) || 0)),
      time: b.time ?? '',
      title: b.title || course.code,
      meta: b.meta ?? '',
    }));
  if (schedule.length === 0) notes.push('No meeting pattern was stated, so the day rail will be empty.');

  const guide = {
    ...raw.guide,
    code: course.code,
    source,
    mastery: 0,
    audio: false,
    units: raw.guide.units.map((u) => ({
      name: u.name ?? 'Unit',
      mastery: 0,
      cards: (u.cards ?? []).filter((c) => c?.q && c?.a),
    })).filter((u) => u.cards.length > 0),
    terms: raw.guide.terms ?? [],
  };

  const cards = guide.units.reduce((n, u) => n + u.cards.length, 0);
  notes.unshift(`${guide.units.length} units, ${cards} cards, ${items.length} dated obligations.`);

  return {
    notes,
    // Only where there was a document to cite. An import from pasted text
    // gets silence rather than a reassurance the app cannot back.
    ...(citations.length > 0 ? { quotesLine: tally(items) } : {}),
    module: {
      course,
      schedule,
      items,
      guide,
      // Figures, examples and audio belong to a course built by hand. A
      // generated one gets them when someone adds them, not by pretending.
      planMinutes: `${Math.max(5, Math.round(cards / 6))} min`,
      frameLabel: `${course.code} · generated`,
    },
  };
}
