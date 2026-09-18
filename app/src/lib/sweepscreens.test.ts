/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DESTINATIONS } from './nav';
import { arrived, destinations, PROOF, proofSelector } from '../../scripts/destinations.mjs';

/**
 * The two instruments walk the app's own list of screens, and keep walking it.
 *
 * `scripts/contrast-sweep.mjs` opened six screens of sixty, by name, on one
 * line, for its whole life — and printed `FINDINGS: 0` with nothing beside it
 * to say which tenth of the app that was about. `scripts/targets-sweep.mjs`
 * read the registry from the day it was written, and the two therefore
 * disagreed about what this app contains without either of them saying so.
 * `src/lib/ci.test.ts` already keeps the pair from becoming three; this keeps
 * the pair from measuring two different apps.
 *
 * Both now read `scripts/destinations.mjs`, and this is the case that fails if
 * either one grows a list of its own again — or if `nav.ts` changes shape
 * under the parser, which would otherwise show up as a sweep that cheerfully
 * measured nothing.
 */

const SCRIPTS = join(process.cwd(), 'scripts');
const script = (name: string) => readFileSync(join(SCRIPTS, name), 'utf8');

describe('the sweeps walk the registry', () => {
  it('parses every destination, in order, with its label', () => {
    expect(destinations()).toEqual(DESTINATIONS.map((d) => ({ screen: d.screen, label: d.label })));
  });

  /*
   * The count as well as the contents, because the equality above would also
   * hold if both sides were empty — and an empty parse is exactly what a
   * moved `nav.ts` produces.
   */
  it('and there are enough of them for that to mean something', () => {
    expect(destinations().length).toBe(DESTINATIONS.length);
    expect(destinations().length).toBeGreaterThan(40);
  });

  /*
   * `wallsweep.mjs` joins the other two here rather than getting a file of its
   * own, because the failure is identical and it is the failure this test was
   * written for: a sweep that decides for itself which screens to open, and
   * prints a clean answer about a fraction of the app without saying so. It
   * asks whether any screen draws a row of equal-weight buttons with nothing
   * ranked above it — an answer that means nothing unless "any screen" is all
   * of them.
   */
  for (const name of ['contrast-sweep.mjs', 'targets-sweep.mjs', 'wallsweep.mjs']) {
    it(`${name} takes its screens from destinations.mjs`, () => {
      expect(script(name)).toContain("from './destinations.mjs'");
    });
  }

  /*
   * The proof table is a record of what those screens actually draw, taken by
   * opening all sixty. Every row is a destination but one, and the one is
   * named: `search` is the workspace's front door, which the tab strip's +
   * reaches under every navigation and which the registry does not list.
   * A row for a screen that is neither is a row nothing checks, and the
   * arrival proof it feeds would then wave through a screen that never
   * arrived.
   */
  it('keeps the proof table to screens that exist', () => {
    const known = new Set<string>([...DESTINATIONS.map((d) => d.screen), 'search']);
    expect(Object.keys(PROOF).filter((s) => !known.has(s))).toEqual([]);
  });

  /*
   * And that the proof can fail. A check that says yes to everything is the
   * shape this file exists to prevent — and the reason `search` needs one of
   * its own is that its heading says Today: outside the workspace the shell
   * has no registry row to take a title from, so the heading names a screen
   * the page is not on.
   */
  it('refuses a heading from another screen', () => {
    expect(arrived('yes', 'Registration', { h1: 'YES' })).toBe(true);
    expect(arrived('courses', 'Courses', { h1: 'courses' })).toBe(true);
    expect(arrived('courses', 'Courses', { h1: 'Today' })).toBe(false);
    expect(arrived('courses', 'Courses', { h1: '' })).toBe(false);
    expect(arrived('courses', 'Courses', null)).toBe(false);
  });

  /*
   * `home` draws one of four headings depending on the navigation
   * (`lib/chrome.ts`'s `homeShape`), and `targets-sweep.mjs` seeds
   * `nav: 'springboard'`, which is the one that draws "Semester". Held to the
   * registry's label alone, the arrival check called that screen unreached
   * and skipped it — one destination silently out of the walk, by the check
   * written to stop exactly that. The last case is the point of a list rather
   * than a shrug: a screen that fell back to Today still has to fail.
   */
  it('accepts every heading home really draws, and no others', () => {
    for (const h1 of ['Today', 'Everything', 'Semester', 'Guides']) {
      expect(arrived('home', 'Today', { h1 }), `home draws ${h1} under one of its navigations`).toBe(
        true,
      );
    }
    expect(arrived('home', 'Today', { h1: 'Courses' })).toBe(false);
    expect(arrived('courses', 'Courses', { h1: 'Semester' })).toBe(false);
  });

  it('proves the one screen a heading cannot prove by its own mark', () => {
    expect(proofSelector('search')).toBe('.deskhome-mark');
    expect(proofSelector('courses')).toBe(null);
    expect(arrived('search', 'search', { h1: 'Today', css: true })).toBe(true);
    expect(arrived('search', 'search', { h1: 'Today', css: false })).toBe(false);
  });
});
