/**
 * A practice paper, not another round of flashcards.
 *
 * The app already had a quiz: ten multiple-choice questions drawn mechanically
 * from the guide's cards, with the wrong options borrowed from other cards.
 * That is a good recall drill and it is nothing like an exam. An exam has a
 * shape — so many marks of recognition, so many of explanation, one question
 * that wants a paragraph — it is worth a fixed number of points, it is sat
 * against a clock, and it is marked against a key.
 *
 * ## Counted here, written there
 *
 * The shape of the paper is arithmetic and it is done in this file: how many
 * questions of each kind fit in the time, what each is worth, what the paper
 * totals. The model is asked only for the questions themselves. That is the
 * same split the analysis and the daily reports use, for the same reason — a
 * model asked to "make a 50-minute exam worth 100 points" will hand back nine
 * questions worth 96.
 *
 * ## Marking, honestly
 *
 * Multiple choice is marked by the app, because a letter either matches or it
 * does not. Written answers are not. Automatically marking free text against a
 * key is a thing that can be done badly and cannot be done well, and a
 * practice paper that tells you your answer was wrong when it was right is
 * worse than no practice paper. So a written answer is shown beside the key
 * and you mark it yourself, in three grades. Self-marking is also the part of
 * revision that teaches the most, which is a good enough reason on its own.
 */

import { allCards } from '../data/catalog';
import type { Guide } from './types';

export type Kind = 'choice' | 'short' | 'long';

export interface Question {
  id: string;
  kind: Kind;
  prompt: string;
  /** Four options for a choice question, in order. Empty otherwise. */
  options: string[];
  /** The index of the right option, or the model answer for a written one. */
  answer: string;
  /** Why that is the answer — the part that makes marking teach you something. */
  why: string;
  points: number;
  /** Which unit or topic it came from, when that is known. */
  from?: string;
}

export interface Exam {
  title: string;
  course: string;
  minutes: number;
  questions: Question[];
}

export interface Format {
  id: string;
  label: string;
  blurb: string;
  /** Share of the paper's questions, by kind. Must sum to 1. */
  mix: Record<Kind, number>;
}

export const FORMATS: Format[] = [
  {
    id: 'mixed',
    label: 'A real paper',
    blurb: 'Recognition, explanation, and one that wants a paragraph.',
    mix: { choice: 0.5, short: 0.35, long: 0.15 },
  },
  {
    id: 'choice',
    label: 'All multiple choice',
    blurb: 'The whole paper marked by the app. Fast, and least like an essay exam.',
    mix: { choice: 1, short: 0, long: 0 },
  },
  {
    id: 'short',
    label: 'Short answer',
    blurb: 'Say it in two or three sentences. The hardest thing to fake.',
    mix: { choice: 0, short: 1, long: 0 },
  },
  {
    id: 'essay',
    label: 'Essay questions',
    blurb: 'Three or four that each want a real argument.',
    mix: { choice: 0, short: 0.25, long: 0.75 },
  },
];

export function format(id: string): Format {
  return FORMATS.find((f) => f.id === id) ?? FORMATS[0];
}

/** What each kind is worth, and roughly how long it takes to answer. */
const WORTH: Record<Kind, { points: number; minutes: number }> = {
  choice: { points: 2, minutes: 1.2 },
  short: { points: 6, minutes: 4 },
  long: { points: 15, minutes: 12 },
};

export interface Shape {
  counts: Record<Kind, number>;
  points: number;
  /** How the time divides, for the paper's header. */
  minutes: number;
}

/**
 * How many questions of each kind fit in the time.
 *
 * Budgeted by minutes rather than by count, because that is the constraint a
 * real paper is written against. The rounding is deliberately generous to the
 * cheap kinds and strict with the expensive ones: an extra multiple-choice
 * question costs a minute and an extra essay costs twelve, so a paper that
 * overruns overruns by a lot.
 *
 * At least one question of any kind the format asks for, so a fifteen-minute
 * mixed paper is still mixed rather than quietly all multiple choice.
 */
export function shapeFor(minutes: number, formatId: string): Shape {
  const f = format(formatId);
  const time = Math.max(5, Math.min(180, minutes));
  const counts: Record<Kind, number> = { choice: 0, short: 0, long: 0 };

  for (const kind of ['long', 'short', 'choice'] as Kind[]) {
    const share = f.mix[kind];
    if (share <= 0) continue;
    const budget = time * share;
    const n = Math.floor(budget / WORTH[kind].minutes);
    counts[kind] = Math.max(1, n);
  }

  const points = (Object.keys(counts) as Kind[]).reduce(
    (sum, k) => sum + counts[k] * WORTH[k].points,
    0,
  );
  return { counts, points, minutes: time };
}

export function total(questions: Question[]): number {
  return questions.reduce((sum, q) => sum + q.points, 0);
}

export function pointsFor(kind: Kind): number {
  return WORTH[kind].points;
}

// ── Marking ──────────────────────────────────────────────────────────────

/** What you said, and — for a written answer — how you marked it. */
export interface Answer {
  /** The chosen option index for a choice question, or the text written. */
  given: string;
  /** Self-marked, for written answers only. */
  mark?: 'right' | 'partly' | 'wrong';
}

/**
 * The marks for one question.
 *
 * A choice question is marked by the app: a letter matches or it does not.
 * A written one is not marked by anything but you — automatically scoring free
 * text against a key is a thing that can be done badly and cannot be done
 * well, and a paper that calls a right answer wrong is worse than no paper.
 * Half marks for "partly", which is what a real marker gives.
 */
export function marksFor(question: Question, answer: Answer | undefined): number {
  if (!answer) return 0;
  if (question.kind === 'choice') {
    return answer.given !== '' && answer.given === question.answer ? question.points : 0;
  }
  if (answer.mark === 'right') return question.points;
  if (answer.mark === 'partly') return question.points / 2;
  return 0;
}

export interface Result {
  got: number;
  outOf: number;
  pct: number;
  /** Questions still waiting on a self-mark. */
  unmarked: number;
}

export function result(questions: Question[], answers: Record<string, Answer>): Result {
  const outOf = total(questions);
  const got = questions.reduce((sum, q) => sum + marksFor(q, answers[q.id]), 0);
  const unmarked = questions.filter(
    (q) => q.kind !== 'choice' && answers[q.id]?.given?.trim() && !answers[q.id]?.mark,
  ).length;
  return {
    got,
    outOf,
    pct: outOf === 0 ? 0 : Math.round((got / outOf) * 100),
    unmarked,
  };
}

/** The line under a result. Plain, and never a lecture. */
export function verdict(r: Result): string {
  if (r.outOf === 0) return 'Nothing to mark.';
  if (r.unmarked > 0) {
    return `${r.unmarked} still to mark — the score below is only what is marked so far.`;
  }
  if (r.pct >= 90) return 'You know this. Spend the time on something you do not.';
  if (r.pct >= 75) return 'Solid. The marks you dropped are the ones worth reading back.';
  if (r.pct >= 55) return 'Halfway. Read the key on everything you missed before drilling again.';
  return 'Early. This is what a first sitting looks like — the key below is the useful part.';
}

// ── Drawn from a guide, with no model at all ─────────────────────────────

/**
 * A paper built from the cards you already have.
 *
 * Multiple choice with decoys borrowed from other cards in the same guide —
 * the wrong options are all true of something, which is the discrimination an
 * exam actually asks for — plus short-answer questions whose key is the card's
 * own answer. Free, instant, offline, and nothing in it is invented.
 *
 * What it cannot do is write an essay question, because a card is not an
 * argument. The format list says so rather than producing a bad one.
 */
export function fromGuide(guide: Guide, shape: Shape, seed: number): Question[] {
  const all = allCards(guide);
  if (all.length === 0) return [];

  let s = (seed * 9301) % 233280 || 1;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  const pool = [...all];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const clip = (text: string) =>
    text.length > 118 ? `${text.slice(0, 116).replace(/[ ,;—]+$/, '')}…` : text;

  const out: Question[] = [];
  let at = 0;

  for (let n = 0; n < shape.counts.choice && at < pool.length; n++, at++) {
    const card = pool[at];
    const wrong: string[] = [];
    const seen = new Set([card.a]);
    for (let guard = 0; wrong.length < 3 && guard < 400; guard++) {
      const candidate = all[Math.floor(rnd() * all.length)];
      if (!candidate || seen.has(candidate.a)) continue;
      seen.add(candidate.a);
      wrong.push(clip(candidate.a));
    }
    // Fewer than four distinct answers in the whole guide: a two-option
    // question is a coin toss, so it is skipped rather than shipped.
    if (wrong.length < 3) continue;

    const options = [clip(card.a), ...wrong];
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    out.push({
      id: `c${n}`,
      kind: 'choice',
      prompt: card.q,
      options,
      answer: String(options.indexOf(clip(card.a))),
      why: card.a,
      points: WORTH.choice.points,
    });
  }

  for (let n = 0; n < shape.counts.short && at < pool.length; n++, at++) {
    const card = pool[at];
    out.push({
      id: `s${n}`,
      kind: 'short',
      prompt: card.q,
      options: [],
      answer: card.a,
      why: '',
      points: WORTH.short.points,
    });
  }

  return out;
}

// ── Written by a model ───────────────────────────────────────────────────

export const SYSTEM = [
  'You write a practice examination for a university student. You return JSON and nothing else.',
  '',
  'Shape:',
  '{"title": "...", "questions": [',
  '  {"kind": "choice", "prompt": "...", "options": ["...","...","...","..."], "answer": 2,',
  '   "why": "...", "from": "..."},',
  '  {"kind": "short", "prompt": "...", "answer": "...", "why": "...", "from": "..."},',
  '  {"kind": "long", "prompt": "...", "answer": "...", "why": "...", "from": "..."}]}',
  '',
  '· "answer" on a choice question is the INDEX of the right option, 0 to 3.',
  '· "answer" on a written question is the model answer — what a full-mark response contains,',
  '  as points rather than as a finished essay.',
  '· "why" is what the question is actually testing and the mistake it is built to catch. This is',
  '  the part that teaches, so it is never "because that is the definition".',
  '· "from" names the unit or topic it comes from.',
  '',
  'How to write questions:',
  '· Every question comes from the material given. Do not test something that is not in it, and',
  '  do not invent a fact, a figure, a date, a case or a source to build a question around.',
  '· A multiple-choice question has ONE right option and three that are wrong but tempting —',
  '  each should be right for a question that was not asked. Options must not differ in length',
  '  or specificity in a way that gives it away, and never "all of the above".',
  '· Test whether they can use it, not whether they have seen it. "Which of these is a public',
  '  good?" is worth asking; "public goods are defined as" is not.',
  '· A long question asks for an argument with a position in it, not a summary.',
  '· Spread the questions across the material rather than clustering on the first unit.',
  '',
  'Output the JSON alone. No code fence, no commentary.',
].join('\n');

export interface Ask {
  formatId: string;
  shape: Shape;
  course: string;
  /** The material the paper must be built from. */
  material: string;
  /** What the real exam is like, if they know. */
  about: string;
  topics: string;
}

export function brief(a: Ask): string {
  const f = format(a.formatId);
  const lines = [
    `Write a practice paper: ${f.blurb}`,
    '',
    'Exactly this many questions, no more and no fewer:',
    `- multiple choice: ${a.shape.counts.choice}`,
    `- short answer: ${a.shape.counts.short}`,
    `- long answer: ${a.shape.counts.long}`,
    '',
    `It is sat in ${a.shape.minutes} minutes. Do not put the marks or the timing in the JSON —`,
    'they are computed by the app and would only disagree with it.',
  ];

  if (a.course.trim()) lines.push('', `Course: ${a.course.trim()}`);
  if (a.topics.trim()) lines.push('', `Cover these topics: ${a.topics.trim()}`);
  if (a.about.trim()) lines.push('', 'What the real exam is like:', a.about.trim());

  lines.push(
    '',
    'The material. Every question must come from this and nothing outside it:',
    a.material.trim() || '(none given — say so in the first question rather than inventing one)',
  );

  return lines.join('\n');
}

/**
 * The JSON, read back into questions the screen can render.
 *
 * Forgiving about a fence or an apology around it. Strict about the two things
 * that would produce a broken paper: a choice question whose answer index does
 * not point at an option it has, and a question with no prompt. Both are
 * dropped rather than shown, because a question with no right answer is worse
 * than one fewer question.
 */
export function readExam(text: string, shape: Shape): { title: string; questions: Question[] } {
  const trimmed = text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('No paper came back — try again.');

  let raw: unknown;
  try {
    raw = JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    throw new Error('The paper came back malformed. Try again.');
  }

  const obj = raw as { title?: unknown; questions?: unknown };
  const list = Array.isArray(obj.questions) ? obj.questions : [];
  const questions: Question[] = [];

  list.forEach((entry, i) => {
    const q = entry as Record<string, unknown>;
    const prompt = typeof q.prompt === 'string' ? q.prompt.trim() : '';
    if (!prompt) return;

    const kind: Kind = q.kind === 'choice' ? 'choice' : q.kind === 'long' ? 'long' : 'short';
    const why = typeof q.why === 'string' ? q.why.trim() : '';
    const from = typeof q.from === 'string' && q.from.trim() ? q.from.trim() : undefined;

    if (kind === 'choice') {
      const options = (Array.isArray(q.options) ? q.options : [])
        .filter((o): o is string => typeof o === 'string' && o.trim().length > 0)
        .map((o) => o.trim());
      const index = Number(q.answer);
      // An index pointing outside its own options is a question with no right
      // answer. There is no salvaging it, so it goes.
      if (options.length < 2 || !Number.isInteger(index) || index < 0 || index >= options.length) {
        return;
      }
      questions.push({
        id: `q${i}`,
        kind,
        prompt,
        options,
        answer: String(index),
        why,
        points: WORTH.choice.points,
        from,
      });
      return;
    }

    const answer = typeof q.answer === 'string' ? q.answer.trim() : '';
    if (!answer) return;
    questions.push({
      id: `q${i}`,
      kind,
      prompt,
      options: [],
      answer,
      why,
      points: WORTH[kind].points,
      from,
    });
  });

  if (!questions.length) throw new Error('The paper had no usable questions. Try again.');

  return {
    title:
      typeof obj.title === 'string' && obj.title.trim()
        ? obj.title.trim()
        : `Practice paper · ${shape.minutes} minutes`,
    questions,
  };
}

// ── On paper ─────────────────────────────────────────────────────────────

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export function letter(i: number): string {
  return LETTERS[i] ?? String(i + 1);
}

/**
 * The paper as a document, key at the end.
 *
 * Key at the end rather than beside each question, so it can be printed and
 * sat properly. A practice paper you can see the answers to while answering is
 * a reading exercise.
 */
export function paper(exam: Exam): string {
  const lines = [
    `# ${exam.title}`,
    '',
    [exam.course, `${exam.minutes} minutes`, `${total(exam.questions)} marks`]
      .filter(Boolean)
      .join(' · '),
    '',
  ];

  exam.questions.forEach((q, i) => {
    lines.push(`**${i + 1}.** (${q.points}) ${q.prompt}`);
    if (q.kind === 'choice') {
      q.options.forEach((o, n) => lines.push(`- ${letter(n)}. ${o}`));
    } else {
      lines.push('', q.kind === 'long' ? '_(a page)_' : '_(two or three sentences)_');
    }
    lines.push('');
  });

  lines.push('---', '', '## The key', '');
  exam.questions.forEach((q, i) => {
    const answer =
      q.kind === 'choice' ? `${letter(Number(q.answer))}. ${q.options[Number(q.answer)]}` : q.answer;
    lines.push(`**${i + 1}.** ${answer}`);
    if (q.why) lines.push('', `_${q.why}_`);
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * A short, typeable code for a seed, and back again.
 *
 * Base 36 keeps a five-digit seed to four characters, which is short enough to
 * read down a phone to somebody and hard enough to mistype that a wrong one
 * fails loudly rather than quietly producing a different paper. Uppercase on
 * the way out because that is how people read a code aloud; case-insensitive
 * on the way back in because that is not how they type it.
 */
export function seedCode(seed: number): string {
  return Math.abs(Math.round(seed)).toString(36).toUpperCase().padStart(4, '0');
}

/** A code back to its seed, or null when it is not one. */
export function readSeed(code: string): number | null {
  const clean = code.trim().toLowerCase();
  if (!/^[0-9a-z]{1,8}$/.test(clean)) return null;
  const seed = Number.parseInt(clean, 36);
  return Number.isFinite(seed) && seed > 0 ? seed : null;
}

export function examFileName(title: string): string {
  const stem = title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8)
    .join('-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
  return `${stem || 'practice-paper'}.md`;
}

/**
 * A paper, offered to a class room.
 *
 * No new table and no new schema: a shared paper is a message carrying its
 * code, because the code already reproduces the questions exactly. Anybody in
 * the room types it in and sits the same paper, and their marks are their own
 * — which is the only version of "compare marks" that does not need somebody's
 * answers to leave their device.
 */
export function invite(args: {
  code: string;
  courseCode: string;
  minutes: number;
  formatId: string;
}): string {
  return [
    `Practice paper ${args.code} — ${args.courseCode}, ${args.minutes} min, ${format(
      args.formatId,
    ).label.toLowerCase()}.`,
    'Sit the same one: Practice paper → Sit one you have sat before → enter the code.',
  ].join('\n');
}

/**
 * A paper code found in a message, or null.
 *
 * Anchored to the word "paper" so an ordinary four-character word in a
 * sentence is not offered as a paper somebody can sit — a chip that leads
 * nowhere is worse than no chip.
 */
export function codeIn(body: string): string | null {
  const found = /\bpaper\s+([0-9A-Z]{4})\b/.exec(body);
  return found ? found[1] : null;
}

/** A countdown, said the way a clock says it. */
export function clock(seconds: number): string {
  const left = Math.max(0, Math.round(seconds));
  const m = Math.floor(left / 60);
  const s = left % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
