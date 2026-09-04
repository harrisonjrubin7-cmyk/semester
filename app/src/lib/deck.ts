/**
 * Planning a deck.
 *
 * `pptx.ts` writes the file; this decides what goes on the slides. Two ways in,
 * and the free one comes first on purpose.
 *
 * **From a unit you already have.** Every study guide in the app is already a
 * list of questions and answers, which is already a deck: a title, then a slide
 * per card. No model, no key, no waiting, and nothing invented — it is your own
 * material rearranged. That covers the commonest case, which is being asked to
 * present the reading.
 *
 * **From a brief.** A topic, notes, a document, a set of findings. Here a model
 * plans the slides, and it is held to the rules the rest of the app holds it
 * to: it works from what you gave it, it does not invent a source or a
 * statistic, and where a number or a citation is needed and absent it writes a
 * blank rather than a plausible one. A deck is the format where an invented
 * figure does the most damage, because it goes on a wall in front of a room.
 *
 * The plan comes back as JSON, and `readPlan` is deliberately forgiving about
 * everything except structure — a prose apology around the JSON is common and
 * survivable, a slide with no title is not.
 */

import type { Guide } from './types';
import type { Deck, Slide } from './pptx';
import { unitName } from './unit';

export interface Kind {
  id: string;
  label: string;
  blurb: string;
  brief: string;
  /** A sensible number of content slides, before the title and the close. */
  slides: number;
}

export const KINDS: Kind[] = [
  {
    id: 'present',
    label: 'Present the reading',
    blurb: 'You were assigned a text and have to take the class through it.',
    slides: 8,
    brief:
      'A presentation of a reading to a seminar. What the author is arguing, what it rests on, ' +
      'the strongest objection, and two questions the room can actually discuss. Not a summary ' +
      'in slide form.',
  },
  {
    id: 'findings',
    label: 'Report findings',
    blurb: 'A project, a data set, a case — what you found and what follows.',
    slides: 9,
    brief:
      'A findings presentation. The result goes near the front, not the end. Then what was done, ' +
      'what was found, what it does and does not show, and what should happen next.',
  },
  {
    id: 'pitch',
    label: 'A pitch',
    blurb: 'A club, a proposal, a competition — you want a decision.',
    slides: 7,
    brief:
      'A pitch. The problem in one slide, the proposal in one, why this and not the obvious ' +
      'alternative, what it costs, and exactly what is being asked for. It ends on the ask.',
  },
  {
    id: 'teach',
    label: 'Teach it',
    blurb: 'A concept, explained to somebody who has not met it.',
    slides: 8,
    brief:
      'A teaching deck. Build it: the thing itself, then why it is not obvious, then a worked ' +
      'example, then where it breaks down. One idea per slide, and each slide earns the next.',
  },
  {
    id: 'brief',
    label: 'A briefing',
    blurb: 'A situation somebody needs to understand quickly.',
    slides: 7,
    brief:
      'A briefing for people with no background. What is happening, why now, who the actors are, ' +
      'what is at stake, and what to watch. Neutral, and clear about what is contested.',
  },
];

export function kind(id: string): Kind {
  return KINDS.find((k) => k.id === id) ?? KINDS[0];
}

/**
 * A unit of a study guide, as a deck. No model involved.
 *
 * Question on one slide, answer on the next, exactly as the in-app slideshow
 * does it — showing an answer beside its question turns a study aid into a
 * document. The bullets on an answer slide are the answer's own sentences,
 * split, because a wall of text in 15pt is not a slide.
 */
export function fromUnit(guide: Guide, index: number): Deck {
  const unit = guide.units[index];
  if (!unit) return { title: guide.code, subtitle: guide.name, slides: [] };

  const name = unitName(unit.name);
  const slides: Slide[] = [
    { title: name, bullets: [], note: `${guide.code} · ${unit.cards.length} things to know`, opening: true },
  ];

  unit.cards.forEach((card, i) => {
    slides.push({ title: card.q, bullets: [], note: `${i + 1} of ${unit.cards.length}` });
    slides.push({ title: card.q, bullets: sentences(card.a), note: 'The answer' });
  });

  slides.push({ title: 'Questions', bullets: [], note: `${guide.code} · ${name}`, opening: true });
  return { title: name, subtitle: guide.code, slides };
}

/**
 * An answer, cut into bullets.
 *
 * Sentence boundaries, then anything still very long gets broken at a
 * semicolon or an em dash. Abbreviations are why this is not simply a split on
 * ".": "e.g." and "U.S." are common in exactly this material.
 */
export function sentences(text: string): string[] {
  const guarded = text
    .replace(/\b([A-Z])\.([A-Z])\./g, '$1∙$2∙')
    .replace(/\b(e|i)\.g\./gi, '$1∙g∙')
    .replace(/\bi\.e\./gi, 'i∙e∙')
    .replace(/\betc\./gi, 'etc∙');

  const out: string[] = [];
  for (const piece of guarded.split(/(?<=[.!?])\s+/)) {
    const clean = piece.replace(/∙/g, '.').trim();
    if (!clean) continue;
    if (clean.length <= 150) {
      out.push(clean);
      continue;
    }
    // Still too long for a bullet. Break at the next weakest joint.
    const halves = clean.split(/\s+—\s+|;\s+/).map((h) => h.trim()).filter(Boolean);
    out.push(...(halves.length > 1 ? halves : [clean]));
  }
  return out.length ? out : [text.trim()].filter(Boolean);
}

// ── The planned kind ─────────────────────────────────────────────────────

export const SYSTEM = [
  'You plan a slide deck for a university student to stand up and present. You return JSON and',
  'nothing else.',
  '',
  'Shape:',
  '{"title": "...", "subtitle": "...", "slides": [{"title": "...", "note": "...",',
  ' "bullets": ["...", "..."], "say": "..."}]}',
  '',
  '· "title" is the line on the slide. Make it a claim, not a label: "Federalism is contested by',
  '  design" tells the room something; "Federalism" does not.',
  '· "bullets" is what is written on the slide. Three to five, short, and NOT sentences you are',
  '  going to read aloud. A slide read aloud is a slide nobody listens to.',
  '· "note" is one short line under the title, or omitted.',
  '· "say" is what the presenter says over that slide and does NOT write on it. This is where the',
  '  actual content goes. Two or three sentences.',
  '',
  'Rules that hold whatever the brief asks for:',
  '· Work only from what the student gave you. Do not invent a statistic, a date, a study, a',
  '  quotation, an author or a source. A figure on a slide is believed by a whole room at once.',
  '· Where the deck needs a number or a citation the student did not give, write it as a blank in',
  '  square brackets naming what is needed — [the enrolment figure from the report] — in the',
  '  bullet where it belongs.',
  '· One idea per slide. If a slide has two, it is two slides.',
  '· No slide that says "Introduction", "Agenda", "Overview", "Thank you" or "Any questions".',
  '  They are the slides people add when they have nothing to say.',
  '',
  'Output the JSON alone. No code fence, no commentary before or after.',
].join('\n');

export interface Planned {
  title: string;
  subtitle: string;
  slides: { title: string; note?: string; bullets: string[]; say?: string }[];
}

export interface Ask {
  kindId: string;
  topic: string;
  /** Notes, the document, the findings — whatever it is built from. */
  material: string;
  /** What the assignment or the audience asked for. */
  instructions: string;
  minutes: number;
  audience: string;
}

export function brief(a: Ask): string {
  const k = kind(a.kindId);
  const lines = [
    `Plan: ${k.brief}`,
    '',
    `Topic: ${a.topic.trim() || '(not said — say so in the first slide’s bullets as a blank)'}`,
    `Audience: ${a.audience.trim() || 'a university class'}`,
    `Length: ${a.minutes} minutes, so about ${slidesFor(a.minutes, k)} content slides.`,
  ];

  lines.push(
    '',
    'The material. Use this and only this — anything not here is a bracketed blank:',
    a.material.trim() || '(none given; every specific claim must be a blank)',
  );

  if (a.instructions.trim()) {
    lines.push('', 'What was asked for, verbatim:', a.instructions.trim());
  }

  return lines.join('\n');
}

/**
 * Slides for the time available.
 *
 * About a minute and a half a slide, which is the rate a person actually
 * presents at rather than the rate they imagine. Bounded so a five-minute talk
 * still gets a shape and a forty-minute one does not get sixty slides.
 */
export function slidesFor(minutes: number, k = KINDS[0]): number {
  const rough = Math.round(minutes / 1.5);
  return Math.max(3, Math.min(24, rough || k.slides));
}

/**
 * The JSON, read back.
 *
 * Forgiving about a prose wrapper or a code fence, because both are common and
 * neither is a real failure. Strict about structure: a slide with no title is
 * dropped rather than written as a blank slide, and a plan with no slides at
 * all throws, because a deck of nothing is a bug the screen must show.
 */
export function readPlan(text: string): Planned {
  const trimmed = text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('No plan came back — try again.');

  let raw: unknown;
  try {
    raw = JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    throw new Error('The plan came back malformed. Try again.');
  }

  const obj = raw as Partial<Planned>;
  const slides = Array.isArray(obj.slides) ? obj.slides : [];
  const clean = slides
    .filter((s): s is Planned['slides'][number] => Boolean(s && typeof s.title === 'string' && s.title.trim()))
    .map((s) => ({
      title: String(s.title).trim(),
      note: typeof s.note === 'string' && s.note.trim() ? s.note.trim() : undefined,
      bullets: (Array.isArray(s.bullets) ? s.bullets : [])
        .filter((b) => typeof b === 'string' && b.trim())
        .map((b) => String(b).trim()),
      say: typeof s.say === 'string' && s.say.trim() ? s.say.trim() : undefined,
    }));

  if (!clean.length) throw new Error('The plan had no slides in it. Try again.');

  return {
    title: typeof obj.title === 'string' && obj.title.trim() ? obj.title.trim() : clean[0].title,
    subtitle: typeof obj.subtitle === 'string' ? obj.subtitle.trim() : '',
    slides: clean,
  };
}

/** A plan, with the title slide and the close the model was told not to write. */
export function toDeck(plan: Planned): Deck {
  return {
    title: plan.title,
    subtitle: plan.subtitle,
    slides: [
      { title: plan.title, bullets: [], note: plan.subtitle || undefined, opening: true },
      ...plan.slides.map((s) => ({ title: s.title, bullets: s.bullets, note: s.note })),
    ],
  };
}

/** The blanks left in a plan, so they can be counted and shown. */
export function holes(plan: Planned): string[] {
  const found: string[] = [];
  for (const slide of plan.slides) {
    for (const text of [slide.title, ...slide.bullets, slide.say ?? '']) {
      for (const hole of text.match(/\[[^\]\n]{3,}\]/g) ?? []) found.push(hole);
    }
  }
  return found;
}

/** The speaker notes, as a document to print and hold. */
export function speakerNotes(plan: Planned): string {
  const lines = [`# ${plan.title}`, plan.subtitle, ''];
  plan.slides.forEach((s, i) => {
    lines.push(`## ${i + 2}. ${s.title}`);
    if (s.bullets.length) lines.push(...s.bullets.map((b) => `- ${b}`));
    if (s.say) lines.push('', `**Say:** ${s.say}`);
    lines.push('');
  });
  return lines.join('\n');
}
