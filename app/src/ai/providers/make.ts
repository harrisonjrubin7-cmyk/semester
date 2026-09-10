import type { Provide } from '../shape';
import { guideNow } from '../shape';
import { FORMULAS } from '../../lib/maths';
import { filled as filledRows } from '../../lib/sheet';

/**
 * The Make group — the screens that produce something.
 *
 * These ask for the student's own work rather than showing the app's, which
 * changes what a provider should hand over. There is no list of records to
 * describe; what matters is what is available to build from, and — on two of
 * them — what the screen will not do.
 */

/** Draw it — a graph, a flow, a timeline, a matrix. */
export const draw: Provide = (look) => {
  const course = look.catalog.byId[look.state.guideId];
  const guide = guideNow(look, look.state.guideId);
  return {
    summary: course
      ? `Drawing a figure${guide ? ` from ${course.code}'s ${guide.units.length} units` : ''}.`
      : 'Drawing a figure. No course is open.',
    visible: guide ? guide.units.map((u) => ({ unit: u.name, cards: u.cards.length })) : [],
    actions: ['open_screen'],
    suggestions: ['Which of these would make a clear diagram?', 'What shape fits this idea?'],
  };
};

/** Make a deck — a real PowerPoint file, from a unit or a brief. */
export const deck: Provide = (look) => {
  const course = look.catalog.byId[look.state.guideId];
  const guide = guideNow(look, look.state.guideId);
  return {
    summary: course
      ? `Building a deck${guide ? ` from ${course.code} — ${guide.units.length} units to draw on` : ''}.`
      : 'Building a deck. No course is open.',
    visible: guide ? guide.units.map((u) => ({ unit: u.name, cards: u.cards.length })) : [],
    actions: ['open_screen'],
    suggestions: ['What should the running order be?', 'How many slides is ten minutes?'],
  };
};

/**
 * Write a document — the block editor.
 *
 * What travels is the shape rather than the prose: how many blocks of what
 * kind, the headings, the word count, and the *captions* of the tables and
 * equations. Not the paragraphs. A document open in this editor is somebody's
 * coursework, and handing a model the whole of it every time they asked a
 * question about a heading would be sending the essay to answer a question
 * about its title.
 *
 * The headings are the exception and they earn it: "does this argument
 * follow" and "what is missing here" are the two questions this screen is
 * asked, and neither can be answered from a word count.
 */
export const write: Provide = (look) => {
  const { state, catalog } = look;
  const doc = state.documents.find((d) => d.id === state.documentId) ?? null;
  if (!doc) {
    return {
      summary: `Documents — ${state.documents.length} written. None open.`,
      visible: state.documents.slice(0, 20).map((d) => ({
        title: d.title || 'Untitled',
        words: docWords(d),
        ...(d.courseId ? { course: catalog.byId[d.courseId]?.code } : {}),
      })),
      actions: ['make_document', 'open_screen'],
      suggestions: ['Draft a memo on this reading', 'Turn my notes into a document'],
    };
  }
  const shape = doc.blocks.map((b) => {
    if (b.kind === 'heading') return { heading: b.text, level: b.level };
    if (b.kind === 'table') return { table: b.caption || `${b.rows.length} rows` };
    if (b.kind === 'equation') return { equation: b.caption || 'no caption' };
    if (b.kind === 'bullets') return { list: `${b.items.length} items` };
    return { block: b.kind };
  });
  return {
    summary:
      `Writing “${doc.title || 'Untitled'}” — ${docWords(doc)} words, ${doc.blocks.length} blocks` +
      `${doc.courseId ? `, filed under ${catalog.byId[doc.courseId]?.code ?? 'a course'}` : ''}. ` +
      'The paragraphs themselves are not sent; the headings and the shape are.',
    visible: shape,
    actions: ['make_document', 'open_screen'],
    suggestions: [
      'Does this structure hold together?',
      'What is missing between these sections?',
      'What should the opening paragraph do?',
    ],
  };
};

/** Words in a document, counted the way `lib/document.ts` counts them. */
function docWords(doc: { blocks: { kind: string; text?: string; items?: string[] }[] }): number {
  let n = 0;
  const count = (text: string) => {
    const clean = text.trim();
    if (clean) n += clean.split(/\s+/).length;
  };
  for (const block of doc.blocks) {
    if (block.kind === 'heading' || block.kind === 'text' || block.kind === 'quote') {
      count(block.text ?? '');
    } else if (block.kind === 'bullets') (block.items ?? []).forEach(count);
  }
  return n;
}

/**
 * Sheet or table — the grid, as values.
 *
 * The displayed values travel, not the formulas: what a student asks here is
 * "does this total look right" and "what does this column say", and both are
 * questions about the numbers. The formulas are the app's own arithmetic and
 * are computed on the device — a model asked to check them would be checking
 * its own reading of a language it cannot run.
 *
 * Capped hard. A two-hundred-row sheet is a real thing to build and is not a
 * thing to send in full to answer one question about it.
 */
export const sheet: Provide = (look) => {
  const { state, catalog } = look;
  const open = state.sheets.find((s) => s.id === state.sheetId) ?? null;
  if (!open) {
    return {
      summary: `Sheets — ${state.sheets.length} made. None open.`,
      visible: state.sheets.slice(0, 20).map((s) => ({
        title: s.title || 'Untitled',
        ...(s.courseId ? { course: catalog.byId[s.courseId]?.code } : {}),
      })),
      actions: ['make_sheet', 'open_screen'],
      suggestions: ['Build me a gradebook for this course', 'Make a table of these figures'],
    };
  }
  const rows = filledRows(open).slice(0, 30);
  return {
    summary:
      `A sheet, “${open.title || 'Untitled'}” — ${rows.length} rows of values` +
      `${open.courseId ? `, filed under ${catalog.byId[open.courseId]?.code ?? 'a course'}` : ''}. ` +
      'These are the computed values; the arithmetic is done on the device.',
    visible: rows.map((row) => ({ row: row.join(' | ') })),
    actions: ['make_sheet', 'open_screen'],
    suggestions: [
      'Does this total look right?',
      'What does this column actually say?',
      'What would a weighted average of these be?',
    ],
  };
};

/**
 * Equations — the library, and what has been kept.
 *
 * The notation travels rather than a rendering of it, because the notation is
 * what somebody wants changed: "make this the sample version", "what is the
 * sigma here". Nothing on this screen computes, and the provider says so, or
 * a model would offer to work an example out of a formula the app has no way
 * to evaluate.
 */
export const equations: Provide = (look) => {
  const { state, catalog } = look;
  return {
    summary:
      `Equations — ${state.equations.length} kept, and a library of ${FORMULAS.length} the courses use. ` +
      'Nothing on this screen computes: it writes a formula, it does not evaluate one.',
    visible: state.equations.slice(0, 25).map((e) => ({
      name: e.name,
      latex: e.latex,
      ...(e.courseId ? { course: catalog.byId[e.courseId]?.code } : {}),
    })),
    actions: ['save_equation', 'open_screen'],
    suggestions: [
      'Write this formula in the notation',
      'What does each symbol here stand for?',
      'Which of these do I need for the midterm?',
    ],
  };
};

/**
 * Sources — every reading kept, with what each is for.
 *
 * The `role` field is the one that earns marks and the one people leave
 * blank, so it travels: "which of these have I not said what they are for"
 * is the question this screen exists to answer.
 */
export const sources: Provide = (look) => {
  const { state, catalog } = look;
  if (state.sources.length === 0) {
    return {
      summary: 'Sources — nothing kept yet.',
      visible: [],
      actions: ['add_source', 'open_screen'],
      suggestions: ['What counts as a source I should keep?', 'How should I cite a lecture?'],
    };
  }
  const rows = state.sources.slice(0, 40).map((s) => ({
    raw: s.raw.slice(0, 140),
    ...(s.role ? { forWhat: s.role } : { forWhat: 'not said' }),
    ...(s.courseId ? { course: catalog.byId[s.courseId]?.code } : {}),
    ...(s.project ? { project: s.project } : {}),
  }));
  const unexplained = rows.filter((r) => r.forWhat === 'not said').length;
  return {
    summary: `Sources — ${state.sources.length} kept, ${unexplained} with nothing said about what they are for.`,
    visible: rows,
    actions: ['add_source', 'open_screen'],
    suggestions: [
      'Which of these have I not said what they are for?',
      'Which of these are about the same thing?',
      'What am I missing for this argument?',
    ],
  };
};

/**
 * Draft it — cover letters, statements, newsletters. Not coursework.
 *
 * The provider says what the screen is fenced off from, because that fence
 * is the screen's whole design and an assistant that does not know about it
 * would cheerfully offer to help with the thing it excludes.
 */
export const essay: Provide = () => ({
  summary:
    'Drafting a piece of writing that is not coursework — a cover letter, a personal statement, a newsletter. The screen is deliberately fenced off from graded work.',
  visible: [],
  actions: ['open_screen'],
  suggestions: [
    'What should the opening paragraph do?',
    'Is this too long for what it is?',
    'What is this missing that a reader would want?',
  ],
});

/** Check the writing — spelling, grammar and punctuation, read back. */
export const proof: Provide = () => ({
  summary:
    'Checking a piece of writing for spelling, grammar and punctuation. It reads what is on the screen back to you and changes nothing on its own.',
  visible: [],
  actions: ['open_screen'],
  suggestions: ['Why is this sentence hard to read?', 'Is this the right word here?'],
});
