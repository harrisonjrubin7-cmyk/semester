import { describe, expect, it } from 'vitest';
import { WEB_ICONS, svgFor } from './webicons';
import { SHAPES, STROKE, type IconName } from '../components/icons.data';

describe('the glyphs the website draws as CSS masks', () => {
  it('asks for twelve, and the app has every one of them', () => {
    // Read out of the page's own `<sc-helmet>` block, by loading it and
    // collecting every mask-image — not guessed from what the sidebar shows,
    // which is where an earlier count of nine came from. `make`, `campus` and
    // `person` only appear once their screens render.
    expect(WEB_ICONS).toHaveLength(12);
    for (const name of WEB_ICONS) expect(SHAPES[name], name).toBeDefined();
  });

  it('names them exactly as the website does', () => {
    expect([...WEB_ICONS].sort()).toEqual([
      'calendar',
      'campus',
      'check',
      'courses',
      'make',
      'map',
      'notes',
      'person',
      'search',
      'study',
      'today',
      'upkeep',
    ]);
  });
});

describe('one glyph as a file', () => {
  it('is a whole SVG document, with the namespace a standalone file needs', () => {
    // Inline in JSX the namespace is implied. In a file loaded by the CSS
    // mask-image property it is not, and without it the file is not an image.
    const out = svgFor('check');
    expect(out).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(out).toContain(`viewBox="${STROKE.viewBox}"`);
    expect(out.trim().endsWith('</svg>')).toBe(true);
  });

  it('is stroked in a colour, because a mask has no currentColor to inherit', () => {
    // `stroke="currentColor"` is right inline and resolves to nothing here,
    // which would leave the sidebar blank in a way that looks exactly like the
    // 404 this replaces.
    const out = svgFor('search');
    expect(out).toContain('stroke="#000"');
    expect(out).not.toContain('currentColor');
  });

  it('draws circles as circles, not as path data pretending to be one', () => {
    expect(svgFor('search')).toContain('<circle cx="11" cy="11" r="7"/>');
    expect(svgFor('check')).toContain('<path d="M20 6 9 17l-5-5"/>');
  });

  it('carries every shape the component draws, in order', () => {
    for (const name of WEB_ICONS) {
      const out = svgFor(name);
      const drawn = (out.match(/<(path|circle)/g) ?? []).length;
      expect(drawn, name).toBe(SHAPES[name].length);
    }
  });

  it('keeps the system’s stroke, so the website and the app draw one weight', () => {
    expect(STROKE.width).toBe(1.5);
    for (const name of WEB_ICONS) {
      expect(svgFor(name), name).toContain('stroke-width="1.5"');
    }
  });
});

describe('the shapes, which the app and the website now share', () => {
  it('has no icon that draws nothing', () => {
    for (const [name, shapes] of Object.entries(SHAPES)) {
      expect(shapes.length, name).toBeGreaterThan(0);
    }
  });

  it('still holds the eighteen the app renders, not only the twelve exported', () => {
    // The website wants twelve; the app draws chevrons, a bell, a plus, play
    // and pause besides. Trimming SHAPES to the exported list would break them.
    expect(Object.keys(SHAPES)).toHaveLength(18);
    for (const name of ['chevronLeft', 'chevronRight', 'bell', 'plus', 'play', 'pause']) {
      expect(SHAPES[name as IconName], name).toBeDefined();
    }
  });
});
