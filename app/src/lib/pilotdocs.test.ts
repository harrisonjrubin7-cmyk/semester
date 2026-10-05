import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { KNOWN_LIMITATIONS, KNOWN_LIMITATIONS_AS_OF, REPORT, renderKnownLimitations } from './knownlimitations';
import { destination } from './nav';
import { fromHash } from './route';
import { SUPPORT } from './privacy';

/**
 * The three pilot documents under `docs/pilot/`, held to the tree.
 *
 * - `KNOWN-LIMITATIONS.md` is rendered from `knownlimitations.ts`, and every
 *   entry there cites a file that must exist: a limitation nobody can point
 *   at is one somebody invented, which is the fault this list exists to avoid
 *   in the other direction (`SEMESTER_MARKET_READINESS.md` has been wrong
 *   both ways).
 * - `QUICK-START.md` and `FIRST-DAY-CHECKLIST.md` are written by hand from
 *   what the app does, so what is checked is that every `#/…` address they
 *   name is a screen the router knows, that both carry the date and the
 *   report route, and that neither claims a connection the tree does not have.
 *
 * The control for the address check is that a made-up address is refused.
 */

const root = join(import.meta.dirname, '../../..');
const DOC = 'docs/pilot/KNOWN-LIMITATIONS.md';
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const addresses = (text: string) => [...text.matchAll(/`(#\/[a-z-]*)`/g)].map((m) => m[1]);
/**
 * Whether an address names a screen the app has. `fromHash` alone is not
 * enough: it parses any word and says on its face that whether the screen
 * exists is the caller's question — so `#/nosuch` parses, and only the
 * destination registry can refuse it.
 */
const known = (address: string) => {
  const route = fromHash(address);
  return route !== null && destination(route.screen) !== undefined;
};

describe('known limitations', () => {
  it('cites only files that exist, and can tell a missing one', () => {
    expect(existsSync(join(root, 'app/src/lib/no-such-limitation-source.ts'))).toBe(false);
    for (const l of KNOWN_LIMITATIONS) {
      expect(l.sources.length, `${l.id} cites nothing`).toBeGreaterThan(0);
      for (const s of l.sources) expect(existsSync(join(root, s)), `${l.id} cites ${s}, which is missing`).toBe(true);
    }
  });

  it('has one entry per id, each with what does not work and what to do instead', () => {
    expect(new Set(KNOWN_LIMITATIONS.map((l) => l.id)).size).toBe(KNOWN_LIMITATIONS.length);
    for (const l of KNOWN_LIMITATIONS) {
      expect(l.title.trim(), l.id).toBeTruthy();
      expect(l.what.trim(), l.id).toBeTruthy();
      expect(l.instead.trim(), l.id).toBeTruthy();
      expect(l.instead, `${l.id} promises a version instead of a way round`).not.toMatch(/next version|coming soon|will be fixed/i);
    }
    expect(KNOWN_LIMITATIONS_AS_OF).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(REPORT.address).toBe(SUPPORT);
  });

  it('describes Ask citations as conditional instead of absent', () => {
    const limitation = KNOWN_LIMITATIONS.find((item) => item.id === 'ai-no-citations');
    expect(limitation?.title).toMatch(/not every/i);
    expect(limitation?.what).toMatch(/source title, locator and excerpt/i);
    expect(limitation?.what).toMatch(/“No source”/);
    expect(limitation?.sources).toContain('app/src/intelligence/Disclosure.tsx');
  });

  it('names a real screen in every address it gives', () => {
    // The control: a word the parser accepts and the registry does not.
    expect(fromHash('#/nosuch')?.screen).toBe('nosuch');
    expect(known('#/nosuch')).toBe(false);
    expect(known('#/home')).toBe(true);
    let named = 0;
    for (const l of KNOWN_LIMITATIONS) {
      for (const [, a] of `${l.what} ${l.instead}`.matchAll(/\((#\/[a-z-]*)\)/g)) {
        named++;
        expect(known(a), `${l.id} names ${a}`).toBe(true);
      }
    }
    expect(named).toBeGreaterThan(3);
  });

  it(`is rendered to ${DOC}, and the file matches`, () => {
    const rendered = renderKnownLimitations();
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
    expect(read(DOC), `${DOC} is stale; run \`REGISTERS=write npx vitest run src/lib/pilotdocs.test.ts\` from app/`).toBe(rendered);
  });
});

describe.each(['docs/pilot/QUICK-START.md', 'docs/pilot/FIRST-DAY-CHECKLIST.md'])('%s', (doc) => {
  const text = read(doc);

  it('is dated, and says where to write and how to report a barrier', () => {
    expect(text).toContain(`As of ${KNOWN_LIMITATIONS_AS_OF}`);
    expect(text).toContain(SUPPORT);
    expect(text).toMatch(/\bAccessibility\b/);
    expect(text).toContain('Accessibility escalation');
    // The route it points at is the site's "Report a barrier" section.
    expect(text).toContain('Report a barrier');
    expect(read('app/src/site/pages.tsx')).toContain('title="Report a barrier"');
  });

  it('names only screens the app has, and more than a few of them', () => {
    const named = addresses(text);
    expect(named.length).toBeGreaterThan(5);
    for (const a of named) expect(known(a), `${doc} names ${a}`).toBe(true);
  });

  it('claims no connection the tree does not have', () => {
    expect(text).not.toMatch(/connects? to your (registrar|school|university)['’]s systems? automatically/i);
    expect(text).toMatch(/not connected|will not do|cannot include/i);
    expect(text).toContain('KNOWN-LIMITATIONS.md');
  });
});
