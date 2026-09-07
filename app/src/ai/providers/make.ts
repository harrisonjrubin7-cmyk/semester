import type { Provide } from '../shape';

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
  const guide = look.catalog.guides[look.state.guideId];
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
  const guide = look.catalog.guides[look.state.guideId];
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
