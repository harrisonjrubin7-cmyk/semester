/**
 * The twelve glyphs the website draws, written out as files.
 *
 * The website's sidebar and headers do not use `<img>` or inline SVG — they use
 * CSS masks:
 *
 *     .ic-today { mask-image: url("icons/today.svg"); background: currentColor }
 *
 * which is why the missing ones were invisible in two senses. Nothing appeared
 * where the glyph should be, and nothing about the failure was reachable from
 * the outside: a mask URL is not an attribute, so the shim in `webback.ts` that
 * mends `src` and `href` never sees it, and a 404 on a mask paints nothing and
 * reports nothing.
 *
 * ## Why these are generated rather than drawn
 *
 * Every name the website asks for is a name the app already has, drawn in
 * `components/icons.data.ts`. Writing twelve files by hand would put a second
 * copy of each glyph in the repository, and the day somebody redraws the map
 * icon in the app the website would keep the old one — silently, because a
 * stale glyph is still a glyph. Generating them from the same shapes means
 * there is one drawing of each and no way for the two to drift.
 *
 * ## Masks, not pictures
 *
 * A mask reads the alpha channel and throws the colour away, so these are
 * stroked in flat black — not `currentColor`, which resolves to nothing in a
 * file loaded as a mask, and would leave the sidebar blank in a way that looks
 * exactly like the 404 this replaces.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SHAPES, STROKE, type IconName } from '../components/icons.data.ts';

/**
 * The names the website asks for, which are the app's own names.
 *
 * Listed rather than derived from `SHAPES`, because writing all eighteen would
 * ship six files nothing loads, and because this list is the record of what the
 * website actually wants — read out of its `<sc-helmet>` block by loading the
 * page and collecting every `mask-image` in it, not guessed from the sidebar.
 */
export const WEB_ICONS = [
  'today',
  'calendar',
  'notes',
  'courses',
  'study',
  'check',
  'map',
  'upkeep',
  'search',
  'make',
  'campus',
  'person',
] as const satisfies readonly IconName[];

/** One glyph, as a standalone file. */
export function svgFor(name: IconName): string {
  const shapes = SHAPES[name]
    .map((s) => ('c' in s ? `<circle cx="${s.c[0]}" cy="${s.c[1]}" r="${s.c[2]}"/>` : `<path d="${s.d}"/>`))
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${STROKE.viewBox}" fill="none"` +
    ` stroke="#000" stroke-width="${STROKE.width}"` +
    ` stroke-linecap="${STROKE.cap}" stroke-linejoin="${STROKE.join}">${shapes}</svg>\n`
  );
}

/** All twelve into `dist/web/icons/`, returning what was written. */
export async function writeIcons(dir: string): Promise<string[]> {
  await mkdir(dir, { recursive: true });
  const done: string[] = [];
  for (const name of WEB_ICONS) {
    await writeFile(join(dir, `${name}.svg`), svgFor(name));
    done.push(`${name}.svg`);
  }
  return done;
}
