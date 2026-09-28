/*
 * The automated half of docs/accessibility/AT-PASS-PROTOCOL.md: a keyboard,
 * landmark, heading, name and axe-core pass over the main screens at 1280x800
 * and at 320x640 (the WCAG 1.4.10 reflow width).
 *
 * NOT a screen-reader pass and NOT a WCAG audit. Per screen and width it
 * records: visible h1s, landmarks, heading-level skips, horizontal overflow,
 * the first 40 Tab stops (whether each shows a focus indicator, and whether
 * its centre is covered by something else), and axe-core's WCAG 2.0/2.1/2.2
 * A+AA violations and "incomplete" results.
 *
 * `CONTROL=1` plants known faults — an unnamed button, a focusable with no
 * ring, an image with no alt, a second h1, low-contrast text — so a clean run
 * can be told apart from a blind probe. Run it before trusting a clean run.
 *
 * Neither Playwright nor axe-core is a dependency of this app, on purpose (see
 * .claude/skills/run). Install both in a scratch directory and point at them:
 *
 *   SMOKE_PLAYWRIGHT=/scratch/node_modules/playwright \
 *   AXE_CORE=/scratch/node_modules/axe-core/axe.min.js \
 *   BASE=http://localhost:5173/ OUT=/scratch/pass.json node scripts/keyboard-pass.mjs
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';

const { chromium } = process.env.SMOKE_PLAYWRIGHT
  ? createRequire(import.meta.url)(process.env.SMOKE_PLAYWRIGHT)
  : await import('playwright');
if (!process.env.AXE_CORE) {
  console.error('Set AXE_CORE to the path of axe-core/axe.min.js');
  process.exit(2);
}
const AXE = readFileSync(process.env.AXE_CORE, 'utf8');
const CHROME = process.env.SMOKE_CHROME || '/opt/pw-browsers/chromium';
const BASE = process.env.BASE || 'http://localhost:5173/';
const SCHEMA = Number(/export const SCHEMA = (\d+)/.exec(
  readFileSync(new URL('../src/lib/migrate.ts', import.meta.url), 'utf8'),
)[1]);
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const SCREENS = [
  ['Today', '#/'],
  ['Home', '#/home'],
  ['Calendar', '#/calendar'],
  ['Courses', '#/courses'],
  ['Assignments', '#/work'],
  ['Registration', '#/yes'],
  ['Degree', '#/degree'],
  ['Search', '#/search'],
  ['Ask', '#/ask'],
  ['Settings', '#/settings'],
  ['Help', '#/help'],
  ['Meals', '#/meals'],
  ['Clocks', '#/clocks'],
].filter(([n]) => !only || only.includes(n));
const VIEWPORTS = [
  ['1280', { width: 1280, height: 800 }],
  ['320', { width: 320, height: 640 }],
];
const TABS = Number(process.env.TABS || 40);

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const out = [];
for (const [vpName, viewport] of VIEWPORTS) {
  for (const [name, hash] of SCREENS) {
    const ctx = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    await ctx.addInitScript((arg) => {
      const [schema, mode] = [Number(arg.split('|')[0]), arg.split('|')[1]];
      try {
        localStorage.setItem('semester.v1', JSON.stringify({ schemaVersion: schema, nav: 'tabs', seenOnboarding: true, sample: true, ...(mode ? { workspaceMode: mode } : {}) }));
      } catch { /* measured by the page */ }
    }, [SCHEMA, process.env.WORKSPACE_MODE || ''].join('|'));
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));
    await page.goto(`${BASE}${hash}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);
    const skip = page.getByRole('button', { name: /^skip$/i }).first();
    if (await skip.count()) { await skip.click(); await page.waitForTimeout(800); }
    await page.evaluate((h) => { location.hash = h; }, hash);
    await page.waitForTimeout(1800);

    if (process.env.CONTROL) {
      await page.evaluate(() => {
        const box = document.createElement('div');
        box.innerHTML = '<button id="ctl-unnamed"></button>'
          + '<button id="ctl-noring" style="outline:none!important;box-shadow:none!important">no ring</button>'
          + '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="10" height="10">'
          + '<p style="color:#777;background:#888">faint control text</p><h1>Second heading</h1>';
        document.querySelector('main').prepend(box);
      });
    }

    const structure = await page.evaluate(() => {
      const visible = (el) => {
        const s = getComputedStyle(el), r = el.getBoundingClientRect();
        return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
      };
      const h1s = [...document.querySelectorAll('h1')].filter(visible).map((h) => h.textContent.replace(/\s+/g, ' ').trim());
      const count = (sel) => document.querySelectorAll(sel).length;
      const levels = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(visible).map((h) => Number(h.tagName[1]));
      const skips = [];
      for (let i = 1; i < levels.length; i++) if (levels[i] > levels[i - 1] + 1) skips.push(`h${levels[i - 1]}→h${levels[i]}`);
      const root = document.documentElement;
      return {
        title: document.title,
        h1s,
        main: count('main,[role="main"]'),
        nav: count('nav,[role="navigation"]'),
        headingSkips: [...new Set(skips)],
        overflowX: Math.max(root.scrollWidth, document.body.scrollWidth) - root.clientWidth,
      };
    });

    // Keyboard: start from the top of the document, as a fresh page load does.
    await page.evaluate(() => {
      document.activeElement?.blur?.();
      document.body.tabIndex = -1;
      document.body.focus();
      document.body.removeAttribute('tabindex');
      window.scrollTo(0, 0);
    });
    const stops = [];
    for (let i = 0; i < TABS; i++) {
      await page.keyboard.press('Tab');
      const s = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const cs = getComputedStyle(el);
        const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
        const ring = cs.boxShadow && cs.boxShadow !== 'none';
        const r = el.getBoundingClientRect();
        const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || el.getAttribute('placeholder') || '')
          .replace(/\s+/g, ' ').trim().slice(0, 40);
        // Measured the instant focus lands, so a fixed control that moves out
        // of the way a frame later reads as covered here. Re-check any hit by
        // hand before calling it a finding.
        const cx = Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1);
        const cy = Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1);
        const top = document.elementFromPoint(cx, cy);
        const obscured = top && !el.contains(top) && !top.contains(el)
          ? (top.getAttribute('aria-label') || top.closest('[class]')?.className?.toString().slice(0, 40) || top.tagName)
          : '';
        return { tag: el.tagName.toLowerCase(), name, indicator: outline || ring, offscreen: r.bottom < 0 || r.top > innerHeight, obscured };
      });
      if (s) stops.push(s);
    }
    const firstStop = stops[0] ? `${stops[0].tag} "${stops[0].name}"` : '';
    const noIndicator = stops.filter((s) => !s.indicator).map((s) => `${s.tag} "${s.name}"`);
    const obscured = stops.filter((s) => s.obscured && !s.offscreen).map((s) => `${s.tag} "${s.name}" under ${s.obscured}`);

    await page.addScriptTag({ content: AXE });
    const { violations, incomplete } = await page.evaluate(async () => {
      const r = await window.axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
        resultTypes: ['violations', 'incomplete'],
      });
      return {
        violations: r.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          n: v.nodes.length,
          where: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
        })),
        incomplete: r.incomplete.map((v) => `${v.id}:${v.nodes.length}`),
      };
    });

    out.push({ vp: vpName, name, hash, ...structure, tabStops: stops.length, firstStop, noIndicator, obscured, violations, incomplete, errors });
    console.log([
      vpName, name,
      `h1=${structure.h1s.length}(${structure.h1s.join('|')})`,
      `main=${structure.main}`, `nav=${structure.nav}`, `overflow=${structure.overflowX}`,
      `skips=${structure.headingSkips.join(',') || 'none'}`,
      `first=${firstStop}`, `stops=${stops.length}`, `noRing=${noIndicator.length}`, `obscured=${obscured.length}`,
      `axe=${violations.map((a) => `${a.id}:${a.n}`).join(',') || 'none'}`,
      `incomplete=${incomplete.join(',') || 'none'}`, `pageerrors=${errors.length}`,
    ].join('\t'));
    await ctx.close();
  }
}
await browser.close();
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(out, null, 2));
