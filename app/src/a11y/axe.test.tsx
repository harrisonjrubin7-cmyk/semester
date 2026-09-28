// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import axe from 'axe-core';
import App from '../App';
import { StoreProvider } from '../state/store';
import { AIProvider } from '../ai/store';
import { loadSeed } from '../data/seed';

/**
 * axe-core over the whole app, rendered, on the screens a student lives in.
 *
 * The other guards in `src/a11y/` each read one property out of the source —
 * labels, landmarks, titles, focus, motion. This asks the question from the
 * other end: render the real `<App />` at a route and let axe walk what came
 * out, so a rule nobody here thought to write a guard for still fails CI.
 * `npm run smoke:a11y` does the same journeys in a real browser against a
 * build, but it is not in CI; this is.
 *
 * ## The threshold
 *
 * Zero `serious` or `critical` violations. When this was written, twelve
 * screens at desktop width, three at phone width and first run measured
 * zero. The one finding on the first pass was `html-has-lang`, which is the
 * test's own document (jsdom's is bare) rather than the app's, and is handled
 * by copying `lang` from `index.html` rather than by disabling the rule.
 * `document-title` is the same finding one line down: `index.html` ships
 * `<title>Semester</title>`, the onboarding screen is drawn above the router
 * and never writes a title of its own, and jsdom starts with none — so the
 * static title is copied in the same way, and cleared between cases so that
 * no case passes on the title an earlier one left behind. It was found by a
 * shuffled run that happened to put first run first (seed 1790574758766);
 * in file order it had passed on `#/home`'s leftover title every time.
 * `moderate` and `minor` findings are not failed on here.
 *
 * ## What jsdom cannot tell axe
 *
 * jsdom does no layout and no painting. `color-contrast` therefore comes back
 * `incomplete`, never as a violation, and so does anything that needs a box
 * size. Contrast is guarded where it can be measured: `lib/contrast.test.ts`
 * walks every ground and accent, and `npm run sweep:contrast` measures the
 * rendered page. No rule is disabled here; the ones jsdom cannot answer
 * simply do not answer.
 *
 * ## Known and tracked exclusions
 *
 * None. If one is ever needed, it goes in `TRACKED` below with the rule, the
 * selector, and where the fix is tracked — never as a global `rules: { x:
 * { enabled: false } }`, which would hide every future instance too.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Rule id → selectors excused, each with why and where the fix is tracked. */
const TRACKED: Record<string, { selector: string; why: string }[]> = {};

const DESKTOP = [
  '#/home',
  '#/calendar',
  '#/courses',
  '#/work',
  '#/yes',
  '#/degree',
  '#/course/econ',
  '#/guide/econ',
  '#/guide/econ?mode=listen',
  '#/lesson/econ',
  '#/study',
  '#/settings',
];
const PHONE = ['#/home', '#/calendar', '#/guide/econ?mode=listen'];

let host: HTMLDivElement | undefined;
let root: Root | undefined;
let hadObserver = false;
let hadHitTest = false;
let hadHitOne = false;

const INDEX = readFileSync(join(__dirname, '..', '..', 'index.html'), 'utf8');
/** The page's own `lang`, read from the page rather than assumed. */
const LANG = /<html\s+lang="([^"]+)"/.exec(INDEX)?.[1];
/** The page's own static `<title>`, which stands until a screen writes its own. */
const TITLE = /<title>([^<]+)<\/title>/.exec(INDEX)?.[1];

function width(px: number) {
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches = min
      ? px >= Number(min[1])
      : max
        ? px <= Number(max[1])
        : px >= 840 && (query.includes('pointer: fine') || query.includes('hover: hover'));
    return { matches, media: query, addEventListener() {}, removeEventListener() {} };
  }) as unknown as typeof window.matchMedia;
}

beforeAll(async () => {
  await loadSeed();
});

beforeEach(() => {
  /*
   * Browser APIs jsdom lacks, stubbed with the honest empty answer and put
   * back in `afterEach`: this suite shares workers with others. axe itself
   * polyfills `elementsFromPoint` on top of `elementFromPoint`, which jsdom
   * does not have either — the assistant button hit-tests for a clear corner
   * and would throw from inside axe's polyfill otherwise.
   */
  hadObserver = 'ResizeObserver' in globalThis;
  hadHitTest = typeof document.elementsFromPoint === 'function';
  hadHitOne = typeof document.elementFromPoint === 'function';
  if (!hadObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
  if (!hadHitOne) document.elementFromPoint = (() => null) as typeof document.elementFromPoint;
  if (!hadHitTest) document.elementsFromPoint = (() => []) as typeof document.elementsFromPoint;
  localStorage.clear();
});

afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  host?.remove();
  root = undefined;
  host = undefined;
  localStorage.clear();
  history.replaceState(null, '', '/');
  document.documentElement.removeAttribute('lang');
  document.title = '';
  if (!hadObserver) delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
  if (!hadHitTest) delete (document as { elementsFromPoint?: unknown }).elementsFromPoint;
  if (!hadHitOne) delete (document as { elementFromPoint?: unknown }).elementFromPoint;
});

async function show(hash: string, stored: Record<string, unknown> = { nav: 'tabs', seenOnboarding: true }) {
  localStorage.setItem('semester.v1', JSON.stringify({ schemaVersion: 6, ...stored }));
  history.replaceState(null, '', `/${hash}`);
  if (LANG) document.documentElement.lang = LANG;
  if (TITLE) document.title = TITLE;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <StoreProvider>
        <AIProvider>
          <App />
        </AIProvider>
      </StoreProvider>,
    );
  });
  // The screens are lazy chunks behind a Suspense fallback. Wait for the
  // fallback to go, or axe audits a loading skeleton and passes it.
  for (let waited = 0; waited < 15_000; waited += 50) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    if (!host.querySelector('[aria-busy="true"]')) break;
  }
  expect(host.querySelector('[aria-busy="true"]'), `${hash} never finished loading`).toBeNull();
}

interface Finding {
  rule: string;
  impact: string;
  nodes: string[];
}

async function serious(): Promise<{ findings: Finding[]; passed: number }> {
  const result = await axe.run(document.documentElement, { resultTypes: ['violations'] });
  const findings = result.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({
      rule: v.id,
      impact: v.impact ?? '',
      nodes: v.nodes
        .filter((n) => !(TRACKED[v.id] ?? []).some((t) => n.target.join(' ').includes(t.selector)))
        .map((n) => `${n.target.join(' ')} — ${(n.failureSummary ?? '').split('\n').slice(1, 2).join('').trim()}`),
    }))
    .filter((f) => f.nodes.length > 0);
  return { findings, passed: result.passes.length };
}

describe('the probe', () => {
  it('reads the page language and static title from index.html', () => {
    expect(LANG).toBe('en');
    expect(TITLE).toBe('Semester');
  });

  it('starts every case without a title, so first run cannot pass on a leftover one', () => {
    // The control for the fix above: with the copy removed, first run alone
    // has no title at all. Asserted here on the bare document, before `show`.
    expect(document.title).toBe('');
  });

  /*
   * A control. Zero findings is also what a harness that audits nothing
   * reports — an empty document, a screen still loading, a rule set that
   * never ran. Plant the kind of defect this exists to catch in the same
   * rendered app and require axe to see each one.
   */
  it('finds planted violations in the rendered app', async () => {
    width(1280);
    await show('#/home');
    const main = host!.querySelector('main');
    expect(main, 'no <main> — the app did not render').not.toBeNull();
    const planted = document.createElement('div');
    planted.innerHTML =
      '<button type="button"><svg aria-hidden="true"></svg></button>' +
      '<img src="x.png">' +
      '<input type="text">' +
      '<div role="checkbox"></div>';
    main!.append(planted);
    const { findings } = await serious();
    expect(findings.map((f) => f.rule)).toEqual(
      expect.arrayContaining(['button-name', 'image-alt', 'label', 'aria-required-attr']),
    );
    planted.remove();
  }, 30_000);
});

describe('no serious or critical axe violations', () => {
  for (const hash of DESKTOP) {
    it(`${hash}, desktop`, async () => {
      width(1280);
      await show(hash);
      const { findings, passed } = await serious();
      // Dozens of rules pass on a real screen; a handful means axe looked at
      // almost nothing.
      expect(passed, `${hash}: axe passed only ${passed} rules`).toBeGreaterThan(15);
      expect(findings, hash).toEqual([]);
    }, 30_000);
  }

  for (const hash of PHONE) {
    it(`${hash}, phone`, async () => {
      width(390);
      await show(hash);
      const { findings } = await serious();
      expect(findings, hash).toEqual([]);
    }, 30_000);
  }

  it('first run, before anything is set up', async () => {
    width(1280);
    await show('#/home', {});
    const { findings } = await serious();
    expect(findings).toEqual([]);
  }, 30_000);
});
