/**
 * A project file for an essay — the document around the essay, not the essay.
 *
 * The line is the same one the rest of the app holds, and it is worth being
 * precise about where it falls rather than vague. What a student cannot get
 * here is prose to hand in. What they can get is the thing that actually
 * decides whether a paper is any good and which almost nobody is taught: a
 * question sharp enough to answer, one claim per section, sources with a note
 * about what each is *for*, and a schedule that starts before the night
 * before.
 *
 * That is not a consolation prize. Marks are lost to a thesis that is a topic
 * rather than an argument, to a paragraph that summarises a source instead of
 * using it, and to a bibliography assembled at 2am. None of those are fixed by
 * having better sentences written for you.
 *
 * So the document that comes out has headings, the question each section must
 * answer, and blanks. The blanks are the point. A file that came back already
 * filled in would be an essay with extra steps.
 *
 * The schedule is computed here rather than by the model, because dates are
 * arithmetic and a model asked for "three weeks before March 14th" will
 * sometimes say March 21st.
 */

export interface Milestone {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  what: string;
  why: string;
}

const STEPS: { at: number; what: string; why: string }[] = [
  {
    at: 0.15,
    what: 'Question settled',
    why: 'A question you can answer in a sentence. If you cannot, it is a topic, not a question.',
  },
  {
    at: 0.35,
    what: 'Sources read, notes taken',
    why: 'Each with a line on what it is for. A source you cannot say that about does not go in.',
  },
  {
    at: 0.5,
    what: 'Outline with one claim per section',
    why: 'If a section has no claim, it is summary, and summary is where marks go to die.',
  },
  { at: 0.75, what: 'Full draft', why: 'Bad and complete beats good and half. Finish it, then fix it.' },
  {
    at: 0.9,
    what: 'Revised against the rubric',
    why: 'Read the rubric line by line against the draft. This is the highest-value hour you will spend.',
  },
  {
    at: 1,
    what: 'Proofread and submitted',
    why: 'Citations checked, file named, submitted early enough that an upload failure is survivable.',
  },
];

const DAY = 86_400_000;

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Milestones counted back from the deadline.
 *
 * Two rules that matter more than the fractions. Nothing is dated in the past,
 * because a plan that opens with a step you have already missed gets closed.
 * And when there is not enough time for the steps to be distinct they collapse
 * onto the days that remain rather than being spread over days that do not
 * exist — a schedule for a paper due tomorrow should say "today, today,
 * tomorrow", which is honest, rather than pretending there is a fortnight.
 */
export function schedule(due: Date, from = new Date()): Milestone[] {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const days = Math.round((end.getTime() - start.getTime()) / DAY);

  if (days <= 0) {
    // Due today or already past. Say so rather than inventing runway.
    return STEPS.map((s) => ({ date: iso(end), what: s.what, why: s.why }));
  }

  return STEPS.map((s) => {
    const offset = Math.min(days, Math.max(0, Math.round(days * s.at)));
    return { date: iso(new Date(start.getTime() + offset * DAY)), what: s.what, why: s.why };
  });
}

/** How much room there is, said the way a person would say it. */
export function runway(due: Date, from = new Date()): string {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const days = Math.round((end.getTime() - start.getTime()) / DAY);
  if (days < 0) return 'That date has gone by.';
  if (days === 0) return 'Due today.';
  if (days === 1) return 'One day.';
  if (days < 14) return `${days} days.`;
  const weeks = Math.floor(days / 7);
  return `${days} days — about ${weeks} weeks.`;
}

export type Shape = 'essay' | 'research' | 'group' | 'presentation' | 'report';

export const SHAPES: { id: Shape; label: string; blurb: string; brief: string }[] = [
  {
    id: 'essay',
    label: 'An argued essay',
    blurb: 'A thesis, evidence, and the objection you have to answer.',
    brief:
      'An argued essay. The structure hangs off one thesis: a section per supporting claim, one ' +
      'section for the strongest objection and the reply to it, and a conclusion that says what ' +
      'follows rather than restating.',
  },
  {
    id: 'research',
    label: 'A research paper',
    blurb: 'A question, a literature, a method, findings.',
    brief:
      'A research paper. Question, what is already known and where it disagrees, how this ' +
      'addresses it, what was found, what it does and does not show.',
  },
  {
    id: 'report',
    label: 'A report or case study',
    blurb: 'A situation, an analysis, a recommendation somebody could act on.',
    brief:
      'A business-style report. The recommendation goes first, then the situation, the analysis ' +
      'behind it, the alternatives considered and why they lost, and what it would take to do.',
  },
  {
    id: 'group',
    label: 'A group project',
    blurb: 'The same, plus who is doing what and when it has to be handed over.',
    brief:
      'A group project. Everything an individual project needs, plus a section naming who owns ' +
      'each part, when each part has to be with the person who needs it next, and one date where ' +
      'the whole thing is assembled with room left to fix it.',
  },
  {
    id: 'presentation',
    label: 'A presentation',
    blurb: 'Slides that carry one argument, and what you say over them.',
    brief:
      'A presentation. One line per slide saying what that slide is for, what claim it makes, ' +
      'and what you say over it that is not written on it. Timing per section against the limit.',
  },
];

export function shape(id: string) {
  return SHAPES.find((s) => s.id === id) ?? SHAPES[0];
}

export const SYSTEM = [
  'You produce a working document for a university student to write their essay or project IN.',
  'You do not write the essay.',
  '',
  'What that means precisely, because the distinction is the whole job:',
  '· You write the headings, and under each heading the QUESTION that section has to answer and',
  '  what a good answer to it would have to do. You do not answer it.',
  '· Where the student’s own claim, evidence or example belongs, you write a blank in square',
  '  brackets saying what goes there. The blanks are the point. A file that came back already',
  '  filled in would be an essay with extra steps.',
  '· You never invent a source, an author, a title, a date, a page number or a quotation. Not one.',
  '  A fabricated citation is the single most damaging thing you could put in this document,',
  '  because it looks exactly like a real one and it is the student’s name on it. If they gave',
  '  you sources, use theirs. If they gave none, write a table with empty rows and the columns',
  '  they need to fill.',
  '· You never write body prose in the student’s voice — no topic sentences, no example',
  '  paragraphs, no "you might say something like". Those get handed in verbatim.',
  '',
  'What to include:',
  '· The question, stated as a question, with a note on what makes it answerable.',
  '· A thesis line the student fills in, with what a thesis has to do that a topic does not.',
  '· A section per claim: the claim, what would establish it, what would undermine it.',
  '· A source table: source, what it is for in this argument, where it is used. Their sources only.',
  '· The rubric as a checklist, from the instructions they gave. Do not invent criteria.',
  '· Anything in the instructions that is easy to lose marks on — word count, format, citation',
  '  style, submission method.',
  '',
  'Output GitHub-flavoured Markdown. No preamble, no closing remarks, no code fence around it.',
].join('\n');

export interface Ask {
  shape: string;
  /** The assignment instructions, pasted or read from a file. */
  instructions: string;
  /** The question or topic, in the student's words. */
  question: string;
  /** Their sources, one per line, however they wrote them. */
  sources: string;
  course: string;
  /** The schedule this file will carry, computed rather than asked for. */
  milestones: Milestone[];
  dueLabel: string;
}

export function brief(a: Ask): string {
  const s = shape(a.shape);
  const lines = [
    `Make a working document for: ${s.brief}`,
    '',
    'The assignment instructions, verbatim:',
    a.instructions.trim() || '(none given — say so at the top and leave the rubric section empty)',
  ];

  lines.push('', 'What the student says it is about:', a.question.trim() || '(they have not said yet)');

  lines.push(
    '',
    'Their sources — use these and only these; if the list is empty, leave an empty table:',
    a.sources.trim() || '(none given)',
  );

  if (a.course.trim()) lines.push('', `The course: ${a.course.trim()}`);

  lines.push(
    '',
    `Due: ${a.dueLabel}. Put this schedule in verbatim, as a table. Do not recalculate the dates:`,
    ...a.milestones.map((m) => `- ${m.date} — ${m.what}: ${m.why}`),
  );

  return lines.join('\n');
}

/** The header the file carries, so it is obvious what it is later. */
export function header(title: string, course: string, dueLabel: string): string {
  return [`# ${title}`, '', `${course ? `${course} · ` : ''}Due ${dueLabel}`, ''].join('\n');
}

export function fileName(question: string, course: string): string {
  // Lowercased as a whole rather than per part: "PSCI-1104-does-federalism"
  // is a filename with two minds about itself.
  const stem = `${course ? `${course} ` : ''}${question}`
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .split(/\s+/)
    .slice(0, 8)
    .join(' ');
  const clean = stem
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
  return `${clean || 'project'}.md`;
}

/**
 * Blanks left for the student, counted.
 *
 * Shown under the document, because a person who does not notice the brackets
 * will hand in a file that says [your claim here] — and because a count near
 * zero means the model wrote the essay after all, which is worth seeing.
 */
export function blanks(markdown: string): number {
  // A markdown link is [text](url) — the bracket is a label, not a blank.
  return (markdown.match(/\[[^\]\n]{3,}\]/g) ?? []).filter(
    (found) => !markdown.includes(`${found}(`),
  ).length;
}
