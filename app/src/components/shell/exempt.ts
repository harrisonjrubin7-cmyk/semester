import type { Screen } from '../../lib/types';

/**
 * Screens whose body must not become an inset list.
 *
 * Three kinds, and the reason is the same each time: the body is one object
 * rather than a run of rows, so a panel around it makes it narrower and harder
 * to read and buys nothing.
 *
 *   **Long-form reading.** A field guide, a lesson, a report, a draft. These
 *   already respect the `readingWidth` setting, and a grouped panel would
 *   fight it.
 *
 *   **Drawn output.** The month and week grids, the flashcard, a chart, a map.
 *   A grid is not a list; a flashcard is one card.
 *
 *   The springboard is not here: it is a nav mode rather than a screen, and
 *   renders as `home`. Its icon grid is drawn by `Springboard.tsx`, which
 *   wraps itself.
 *
 * Applied at the render site rather than inside fifteen screens, so the list
 * is one thing to read and no screen ends up half-converted.
 *
 * Their surrounding chrome — the header, the tab bar, the action rows — is
 * still grouped. Only the body is exempt.
 */
export const EXEMPT: Screen[] = [
  // Long-form reading.
  'guide',
  'lesson',
  'slides',
  'update',
  'brief',
  'essay',
  'work',
  'solve',
  'analyse',
  'ask',
  'mail',
  'proof',
  // Drawn output, and one large object rather than a list.
  'calendar',
  'drill',
  'quiz',
  'guess',
  'maps',
  'draw',
];

export function isExempt(screen: Screen): boolean {
  return EXEMPT.includes(screen);
}
