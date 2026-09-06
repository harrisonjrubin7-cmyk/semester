import type { Insight } from './types';

/**
 * Insights as plain lines, for a report somebody saves or prints.
 *
 * The screen and the saved file have to say the same thing — a report that
 * differs from what was on screen when it was saved is a report nobody can
 * cite. So both read the same insights, and this is the only place the wording
 * differs, because a printed page has no control to expand.
 *
 * The evidence count travels with the line for the same reason it is on the
 * card: a number you cannot weigh is one you have to believe.
 */
export function insightLines(found: Insight[]): string[] {
  if (found.length === 0) return [];
  return [
    'What stands out',
    '',
    ...found.flatMap((f) => [
      `- ${f.headline}`,
      ...(f.detail ? [`  ${f.detail}`] : []),
      `  From ${f.evidence.length} ${f.evidence.length === 1 ? 'record' : 'records'}${
        f.confidence === 'tentative' ? ', so this may shift' : ''
      }.`,
    ]),
  ];
}

export type { Insight };
