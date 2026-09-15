/**
 * The shapes a term's writing actually takes.
 *
 * A blank document is the slowest way to start any of them, and the shape is
 * never the hard part — the hard part is remembering that a lab report needs a
 * method section before the results, or which of three citation styles this
 * course asked for. So the structure is here and the thinking is not.
 *
 * ## Nothing here writes anything
 *
 * Every template is headings and empty paragraphs, with the occasional
 * instruction in a heading somebody deletes. Not one of them contains a
 * sentence of prose that could be handed in, and that is deliberate rather
 * than incidental: a template that arrived with a paragraph in it is a
 * template that gets submitted with that paragraph still in it, and the app's
 * standing rule is that it never writes coursework.
 *
 * The citation styles are the same. MLA, APA and Chicago differ in what goes
 * on the first page and what the reference list is called, and those are
 * facts about the styles rather than content — so the headings say what goes
 * where, and every field is blank because the app does not know the student's
 * name, their instructor, or what they are citing.
 */

import { blankDoc, type Block, type Doc } from './document';
import type { CaseFile, CourseId, Example, Frame, Term, Unit } from './types';

export interface Template {
  id: string;
  label: string;
  /** One line, in the second person, saying what it is for. */
  blurb: string;
  blocks: (name: string) => Block[];
}

const head = (level: 1 | 2 | 3, text: string): Block => ({ kind: 'heading', level, text });
const para = (text = ''): Block => ({ kind: 'text', text });
const list = (items: string[], numbered = false): Block => ({ kind: 'bullets', items, numbered });

/**
 * The block every citation style opens with, in that style's own order.
 *
 * Written as a heading rather than as prose so it reads as a field to fill in
 * rather than as text to leave. The names are placeholders and stay
 * placeholders — the app has never known who the student is.
 */
const identity = (style: 'MLA' | 'APA' | 'Chicago'): Block[] => {
  if (style === 'MLA') {
    // MLA puts the four lines flush left on the first page, then a centred
    // title, and no separate title page.
    return [
      para('Your name'),
      para('Instructor'),
      para('Course'),
      para('Date'),
      head(1, 'Title'),
    ];
  }
  if (style === 'APA') {
    // APA 7 wants a title page: title, author, affiliation, course,
    // instructor, due date — then the paper starts on a new page.
    return [
      head(1, 'Title'),
      para('Your name'),
      para('Department, University'),
      para('Course'),
      para('Instructor'),
      para('Due date'),
      { kind: 'break' },
    ];
  }
  // Chicago's title page carries the title a third of the way down and the
  // rest at the foot; the app has no vertical placement, so it is the same
  // fields in Chicago's order with a page break after them.
  return [
    head(1, 'Title'),
    para('Your name'),
    para('Course'),
    para('Instructor'),
    para('Date'),
    { kind: 'break' },
  ];
};

const essay = (style: 'MLA' | 'APA' | 'Chicago', references: string): Template => ({
  id: `essay-${style.toLowerCase()}`,
  label: `Essay — ${style}`,
  blurb: `A paper set out the way ${style} asks for, with the reference list named as ${style} names it.`,
  blocks: () => [
    ...identity(style),
    head(2, 'Introduction'),
    para(),
    head(2, 'Argument'),
    para(),
    head(2, 'Counterargument'),
    para(),
    head(2, 'Conclusion'),
    para(),
    { kind: 'break' },
    head(2, references),
    para(),
  ],
});

export const TEMPLATES: Template[] = [
  {
    id: 'lecture',
    label: 'Lecture notes',
    blurb: 'A date, what was covered, and somewhere for what you did not follow.',
    blocks: (name) => [
      head(1, name),
      para('Date · Topic'),
      head(2, 'What was covered'),
      list(['', '', '']),
      head(2, 'Terms'),
      list(['', '']),
      head(2, 'Not clear yet'),
      list(['']),
      head(2, 'To do before next time'),
      list(['']),
    ],
  },
  essay('MLA', 'Works Cited'),
  essay('APA', 'References'),
  essay('Chicago', 'Bibliography'),
  {
    id: 'reading',
    label: 'Reading response',
    blurb: 'The argument, the evidence, and what you make of it — with room for the citation.',
    blocks: (name) => [
      head(1, name),
      { kind: 'quote', text: '', source: 'Author, title, page' },
      head(2, 'The argument'),
      para(),
      head(2, 'The evidence'),
      list(['', '']),
      head(2, 'Where it is weak'),
      para(),
      head(2, 'What I take from it'),
      para(),
      head(2, 'For seminar'),
      list(['']),
    ],
  },
  {
    id: 'lab',
    label: 'Lab report',
    blurb: 'Method before results, results before what they mean — in that order.',
    blocks: (name) => [
      head(1, name),
      para('Date · Partners'),
      head(2, 'Aim'),
      para(),
      head(2, 'Method'),
      list(['', ''], true),
      head(2, 'Results'),
      { kind: 'table', rows: [['', ''], ['', '']], header: true, caption: '' },
      head(2, 'Analysis'),
      para(),
      head(2, 'Sources of error'),
      list(['']),
      head(2, 'Conclusion'),
      para(),
    ],
  },
  {
    id: 'problem',
    label: 'Problem set',
    blurb: 'One question per section, with the working shown rather than asserted.',
    blocks: (name) => [
      head(1, name),
      para('Course · Due'),
      head(2, 'Question 1'),
      para('Given'),
      { kind: 'equation', latex: '', caption: 'Working' },
      para('Answer'),
      head(2, 'Question 2'),
      para('Given'),
      { kind: 'equation', latex: '', caption: 'Working' },
      para('Answer'),
    ],
  },
  {
    id: 'memo',
    label: 'Policy memo',
    blurb: 'The recommendation first, then why — the way a brief is actually read.',
    blocks: (name) => [
      head(1, name),
      para('To · From · Date · Subject'),
      head(2, 'Recommendation'),
      para(),
      head(2, 'Background'),
      para(),
      head(2, 'Options'),
      list(['', '', ''], true),
      head(2, 'Analysis'),
      para(),
      head(2, 'Risks'),
      list(['']),
      head(2, 'Next steps'),
      list(['']),
    ],
  },
  {
    id: 'meeting',
    label: 'Meeting notes',
    blurb: 'Who was there, what was decided, and who is doing what.',
    blocks: (name) => [
      head(1, name),
      para('Date · Present'),
      head(2, 'Decided'),
      list(['']),
      head(2, 'Discussed'),
      list(['']),
      head(2, 'Who is doing what'),
      { kind: 'table', rows: [['Who', 'What', 'By when'], ['', '', '']], header: true, caption: '' },
    ],
  },
  {
    id: 'studyguide',
    label: 'Study guide',
    blurb: 'A unit broken into what you have to know, recall, and be able to do.',
    blocks: (name) => [
      head(1, name),
      head(2, 'What the exam covers'),
      list(['']),
      head(2, 'Definitions'),
      { kind: 'table', rows: [['Term', 'Meaning'], ['', '']], header: true, caption: '' },
      head(2, 'Has to be memorised'),
      list(['']),
      head(2, 'Has to be worked out'),
      list(['']),
      head(2, 'Still shaky'),
      list(['']),
    ],
  },
];

/** One template as a document, ready to be dispatched. */
export function fromTemplate(
  template: Template,
  name: string,
  courseId: CourseId | null = null,
): Omit<Doc, 'id'> {
  const title = name.trim() || template.label;
  return { ...blankDoc(title, courseId), blocks: template.blocks(title) };
}

export function templateById(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

/**
 * A study guide as a document you can edit.
 *
 * The guides are the app's own — built from a syllabus and its readings — and
 * until now they could be read eleven ways and changed in none. A student who
 * wanted to add their own worked example, or cut the four units the exam does
 * not cover, had no way to do either without leaving the app.
 *
 * So this is a copy, not a view. Editing the document does not touch the
 * guide, and the guide is still there to drill against — which is the right
 * way round: a guide the student had rewritten would be a guide whose cards no
 * longer match the source it cites.
 *
 * ## The whole guide, not the drillable half
 *
 * It carried the cards, the self-test and the terms — the three parts that are
 * already question-and-answer — and silently left behind the three that are
 * not: the framings, the worked examples and the case files. Those are the
 * long-form end of the guide, the part `lib/study.ts` exists to keep growing
 * as readings arrive, and they are what the field guide and the cram sheet are
 * mostly made of. A copy without them was a copy of the flashcards.
 *
 * They are here now, in the order the field guide reads them. A case is a
 * heading and four labelled lines rather than a six-column table, because six
 * columns of prose is a table nobody can read on paper and the point of this
 * document is that it gets printed.
 *
 * Where it came from is written into the document, in `subtitle` and in a
 * quotation block at the end, because the app's standing rule is that
 * generated material says what it was generated from. The same block names
 * what could not come — the diagrams, which are drawn rather than written —
 * following `Read.notes` and `lib/xlsxin.ts`: a student who can see that four
 * figures stayed behind can go and look at them, where a student handed a
 * document that never mentions them cannot.
 */
export function fromGuide(
  guide: {
    code: string;
    name: string;
    blurb?: string;
    source: string;
    units: Unit[];
    terms: Term[];
    frames?: Frame[];
    examples?: Example[];
    cases?: CaseFile[];
    selfTest?: { q: string; a: string }[];
  },
  courseId: CourseId | null = null,
  /**
   * What this course calls its framings, and how many diagrams stayed behind.
   *
   * The label because the Guide screen reads it from the module rather than
   * printing "Frames" at everybody — PSCI's are debates and ECON's are
   * question types, and a document that renamed them would be a document that
   * does not match the screen it was made from.
   */
  said: { frameLabel?: string; diagrams?: number } = {},
): Omit<Doc, 'id'> {
  const blocks: Block[] = [head(1, `${guide.code} — ${guide.name}`)];
  if (guide.blurb) blocks.push(para(guide.blurb));

  for (const unit of guide.units) {
    if (unit.cards.length === 0) continue;
    blocks.push(head(2, unit.name));
    // Question and answer as a two-column table rather than as prose: it is
    // what the card already is, it stays coverable with a hand or a sheet of
    // paper, and it exports to Word as a table somebody can revise from.
    blocks.push({
      kind: 'table',
      rows: [['Question', 'Answer'], ...unit.cards.map((card) => [card.q, card.a])],
      header: true,
      caption: '',
    });
  }

  // A framing is what an exam question about this material actually looks
  // like. Two columns, like the terms below, because that is the shape it is.
  if (guide.frames && guide.frames.length > 0) {
    blocks.push(head(2, said.frameLabel || 'Frames'));
    blocks.push({
      kind: 'table',
      rows: [
        ['Framing', 'What it is really asking'],
        ...guide.frames.map((frame) => [frame.t, frame.d]),
      ],
      header: true,
      caption: '',
    });
  }

  // The concept pointed at something the material actually works through. The
  // tag is the concept, so it leads: skimming this column is how you find the
  // example for the thing you are stuck on.
  if (guide.examples && guide.examples.length > 0) {
    blocks.push(head(2, 'Worked examples'));
    blocks.push({
      kind: 'table',
      rows: [
        ['Concept', 'Example', 'What it shows'],
        ...guide.examples.map((ex) => [ex.tag, ex.t, ex.d]),
      ],
      header: true,
      caption: '',
    });
  }

  /*
   * Claim, test, verdict, so what — the four the screen labels, as four lines
   * under a heading. The year goes beside the title rather than in a column of
   * its own, because it is a fact about the episode and not a field anybody
   * sorts by.
   *
   * `lib/study.ts` drops a case missing any of its six fields, so in practice
   * all four lines are here; they are guarded anyway, because a case file also
   * arrives from a module's own data and nothing there is checked by that.
   */
  if (guide.cases && guide.cases.length > 0) {
    blocks.push(head(2, 'Case files'));
    for (const file of guide.cases) {
      blocks.push(head(3, file.when ? `${file.title} · ${file.when}` : file.title));
      const lines = (
        [
          ['Claim', file.claim],
          ['Test', file.test],
          ['Verdict', file.verdict],
          ['So what', file.lesson],
        ] as const
      )
        .filter(([, body]) => body)
        .map(([label, body]) => `**${label}** — ${body}`);
      if (lines.length > 0) blocks.push(list(lines));
    }
  }

  // The guide's own self-test. Part of what the Guide screen shows as the
  // study guide, so a copy without it is a copy that is missing something.
  if (guide.selfTest && guide.selfTest.length > 0) {
    blocks.push(head(2, 'Self-test'));
    blocks.push({
      kind: 'table',
      rows: [['Question', 'Answer'], ...guide.selfTest.map((card) => [card.q, card.a])],
      header: true,
      caption: '',
    });
  }

  if (guide.terms.length > 0) {
    blocks.push(head(2, 'Terms'));
    blocks.push({
      kind: 'table',
      rows: [['Term', 'Meaning'], ...guide.terms.map((term) => [term.t, term.d])],
      header: true,
      caption: '',
    });
  }

  blocks.push(head(2, 'My notes'));
  blocks.push(para());
  const left = said.diagrams ?? 0;
  blocks.push({
    kind: 'quote',
    text:
      'This started as the study guide the app built for this course. Anything you add here is yours; the guide itself is unchanged.' +
      (left > 0
        ? ` The ${left === 1 ? 'diagram is' : `${left} diagrams are`} not here — ${left === 1 ? 'it is' : 'they are'} drawn rather than written, and ${left === 1 ? 'it stays' : 'they stay'} on the guide.`
        : ''),
    source: guide.source,
  });

  return {
    ...blankDoc(`${guide.code} — study guide`, courseId),
    subtitle: `From the study guide · ${guide.source}`,
    blocks,
  };
}
