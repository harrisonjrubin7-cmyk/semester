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
import type { CourseId, Term, Unit } from './types';

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
 * Where it came from is written into the document, in `subtitle` and in a
 * quotation block at the end, because the app's standing rule is that
 * generated material says what it was generated from.
 */
export function fromGuide(
  guide: { code: string; name: string; source: string; units: Unit[]; terms: Term[] },
  courseId: CourseId | null = null,
): Omit<Doc, 'id'> {
  const blocks: Block[] = [head(1, `${guide.code} — ${guide.name}`)];

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
  blocks.push({
    kind: 'quote',
    text: 'This started as the study guide the app built for this course. Anything you add here is yours; the guide itself is unchanged.',
    source: guide.source,
  });

  return {
    ...blankDoc(`${guide.code} — study guide`, courseId),
    subtitle: `From the study guide · ${guide.source}`,
    blocks,
  };
}
