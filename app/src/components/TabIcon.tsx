/**
 * A glyph for any screen that can go in the bar.
 *
 * The bar used to hold seven screens fixed in a source file, and seven icons
 * drawn for them. Once a student can put any of forty-two screens in it, the
 * other thirty-five need something to show — and drawing thirty-five icons
 * would mostly produce thirty-five squares with faint differences, which is
 * worse than not trying.
 *
 * So: the drawn icon where one exists, and otherwise the icon of the shelf
 * the screen sits on in `lib/nav.ts`. One fallback per shelf. A student
 * who puts Draft it, Make a deck and Draw it in the bar gets three pen nibs,
 * which is honest — they are three things from the same shelf — and the label
 * underneath is what tells them apart. The alternative was a blank square,
 * and a blank square says nothing at all.
 */

import { createElement } from 'react';
import { glyphFor } from './icons.pick';
import type { Screen } from '../lib/types';

/**
 * The glyph as an element — the only thing this file exports.
 *
 * `createElement` rather than `const Icon = glyphFor(screen)` and `<Icon />`:
 * every component here is a stable module-level reference, so the two are the
 * same at runtime, but the second reads to a linter as a component being
 * defined during render — which is a real bug in general and would be worth
 * the warning if it were true here.
 */
export function TabGlyph({ screen, size = 17 }: { screen: Screen; size?: number }) {
  return createElement(glyphFor(screen), { size });
}
