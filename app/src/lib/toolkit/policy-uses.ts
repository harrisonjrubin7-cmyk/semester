export const USES = [
  ['brainstorming', 'Brainstorming'],
  ['outline-feedback', 'Outline feedback'],
  ['practice', 'Practice questions and flashcards'],
  ['grammar', 'Grammar clarification'],
  ['explanation', 'Explaining course material'],
  ['revision', 'AI-assisted revision of your writing'],
  ['diagrams', 'AI-generated diagrams or figures'],
  ['data-cleaning', 'Data-cleaning suggestions'],
  ['code-help', 'Debugging or code suggestions'],
  ['final-answers', 'Generating final answers for an assessment'],
] as const;

export type Use = (typeof USES)[number][0];
