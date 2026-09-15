import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { withoutComments } from '../styles/rules';

/**
 * A row that scrolls sideways says so — every one of them, not one of three.
 *
 * `chiprow.test.ts` next door is about the CSS: `.chiprow` hides its scrollbar
 * and `data-more` brings back a fade at whichever end has more beyond it. That
 * rule was written, it works, and it reached exactly one of the app's three
 * chip rows. The other two wrote `<div className="chiprow">` by hand and never
 * set `data-more`, so they scrolled in silence — which is the fault the rule
 * exists to fix, still live, on the rows that had copied the class instead of
 * calling the component.
 *
 * Measured on the deployed build at 390px: the Coming-up course filter held
 * 403px of chips in a 354px row and cut "BUS 1600" to "B" at the screen edge,
 * with `data-more` absent and `mask-image` reading `none`.
 *
 * So the class belongs to one component now, and this is what keeps it there.
 * A file that writes the class itself is a row that has opted out of the
 * measurement without saying so, and the failure is invisible: it looks
 * finished, it scrolls correctly, and only the fade is missing.
 *
 * Comments are blanked first, with the style linter's own `withoutComments`.
 * Two of the three files here now carry a note *about* the class, naming it
 * in prose, and a rule that cannot tell a warning from a use would fail on
 * the sentence explaining itself.
 */
const HOME = 'src/components/ui.tsx';

function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sources(path, out);
    else if (path.endsWith('.tsx')) out.push(path);
  }
  return out;
}

describe('the chiprow class', () => {
  it('is written in one place, which is the component that measures the row', () => {
    const wearing = sources('src')
      .filter((p) =>
        /className="chiprow"|className=\{[^}]*chiprow/.test(withoutComments(readFileSync(p, 'utf8'))),
      )
      .map((p) => p.replace(/\\/g, '/'));
    expect(wearing).toEqual([HOME]);
  });

  it('is worn by a row that reports which end has more', () => {
    const home = withoutComments(readFileSync(HOME, 'utf8'));
    const at = home.indexOf('className="chiprow"');
    expect(at).toBeGreaterThan(0);
    const tag = home.slice(at, home.indexOf('>', at));
    expect(tag).toContain('data-more={more}');
    expect(tag).toContain('ref={row}');
  });

  it('measures again when the number of chips changes', () => {
    // Chips arrive with the catalogue. A row measured before its courses
    // exist has nothing to say about its own edges, which is why the hook
    // takes a count rather than running once on mount.
    const home = withoutComments(readFileSync(HOME, 'utf8'));
    expect(home).toMatch(/useEdges\(count\)/);
    expect(home).toMatch(/\}, \[count\]\)/);
  });
});
