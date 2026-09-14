/**
 * An SVG that still looks like itself somewhere else.
 *
 * Everything this app draws is coloured in tokens — `var(--app-accent)`,
 * `var(--app-panel)` — which is what lets one chart be right on all thirteen
 * grounds and in both directions. The moment that drawing leaves the page,
 * those tokens name nothing: an `.svg` opened in Preview, dropped into a
 * Google Doc or placed on a slide has no `:root` to read them from, and every
 * `var()` falls back to black on transparent. The chart arrives as a black
 * rectangle, which reads as a broken export rather than as a missing
 * stylesheet.
 *
 * So a saved picture is the same drawing with every token *resolved* — the
 * colours the reader was actually looking at, written out as hex — plus the
 * two things a standalone file needs and an inline element does not: the
 * namespace, and a ground under it.
 *
 * Pure apart from `standalone`, which needs a live element to read from.
 */

/** The attributes worth resolving. Anything else is geometry. */
const PAINTED = ['fill', 'stroke'] as const;

/**
 * One `var(--name, fallback)` as a colour.
 *
 * The fallback is honoured because the app writes a few — and because a token
 * this build does not set must come out as *something*: an empty string in a
 * `fill` is not "no fill", it is invalid, and a renderer that meets one may
 * drop the whole element rather than the attribute.
 */
export function resolveVar(value: string, lookup: (name: string) => string): string {
  const match = /^var\(\s*(--[a-zA-Z0-9-]+)\s*(?:,\s*([^)]*))?\)$/.exec(value.trim());
  if (!match) return value;
  const found = lookup(match[1]).trim();
  if (found) return found;
  const fallback = (match[2] ?? '').trim();
  return fallback || 'currentColor';
}

/**
 * A copy of a drawing with its colours written out, as a file.
 *
 * The original is never touched: the resolving happens on a clone, because
 * doing it in place would replace the live chart's tokens with fixed colours
 * and it would stop following the reader's theme from the moment they saved
 * it once.
 */
export function standalone(svg: SVGSVGElement, ground = ''): string {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  const styles = getComputedStyle(svg.ownerDocument.documentElement);
  const lookup = (name: string) => styles.getPropertyValue(name);

  for (const node of [copy, ...copy.querySelectorAll('*')]) {
    for (const attribute of PAINTED) {
      const value = node.getAttribute(attribute);
      if (value && value.startsWith('var(')) node.setAttribute(attribute, resolveVar(value, lookup));
    }
  }

  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  copy.removeAttribute('style');
  // A `viewBox` without a width is a picture something else decides the size
  // of. Saying it once here is what makes the file open at its own size.
  const box = copy.getAttribute('viewBox')?.split(/[\s,]+/).map(Number);
  if (box && box.length === 4) {
    copy.setAttribute('width', String(box[2]));
    copy.setAttribute('height', String(box[3]));
  }

  if (ground) {
    const paper = svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'rect');
    paper.setAttribute('x', '0');
    paper.setAttribute('y', '0');
    paper.setAttribute('width', copy.getAttribute('width') ?? '100%');
    paper.setAttribute('height', copy.getAttribute('height') ?? '100%');
    paper.setAttribute('fill', resolveVar(ground, lookup));
    copy.insertBefore(paper, copy.firstChild);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(copy)}\n`;
}

/** A filename for a saved picture — the same shaping the other savers use. */
export function pictureFileName(title: string, extension = 'svg'): string {
  const bare = title
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `${bare || 'chart'}.${extension}`;
}
