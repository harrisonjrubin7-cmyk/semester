/*
 * The automated half of docs/accessibility/AT-PASS-PROTOCOL.md: a keyboard,
 * landmark, heading, name and axe-core pass over the main screens at 1280x800
 * and at 320x640 (the WCAG 1.4.10 reflow width).
 *
 * NOT a screen-reader pass and NOT a WCAG audit. Per screen and width it
 * records: visible h1s, landmarks, heading-level skips, horizontal overflow,
 * the first 40 Tab stops (whether each shows a focus indicator, whether its
 * centre is still covered once focus has settled, whether the browser computes
 * an accessible name for it, and whether that name contains the text drawn on
 * it, SC 2.5.3), what a text-spacing override (SC 1.4.12) newly clips, and
 * axe-core's WCAG 2.0/2.1/2.2 A+AA violations and "incomplete" results.
 *
 * A tab stop's name is the browser's own accessible name, read over the
 * DevTools protocol, not `aria-label || textContent`: that heuristic read a
 * textarea named by a wrapping <label> as unnamed. A stop covered at the
 * instant focus lands but clear 250 ms later is counted as `transient`, not as
 * `obscured`: a fixed control that moves out of the way a frame later is not a
 * hidden focus (SC 2.4.11).
 *
 * `CONTROL=1` plants known faults — an unnamed button, a focusable with no
 * ring, an image with no alt, a second h1, a button whose name does not
 * contain its visible text, text that clips under the 1.4.12 spacing, and
 * low-contrast text — and the run fails (exit 3) unless every one of them was
 * reported, so a clean run can be told apart from a blind probe. Run it before
 * trusting a clean run.
 *
 * The contrast plant is a fixed element with a solid background appended to
 * <body>. The first version was prepended inside <main>, where axe could not
 * determine the background ("due to a pseudo element") and reported it as
 * `incomplete`, never as a violation, so that plant was never detected and the
 * old control said nothing about contrast. On the real screens axe still
 * returns `incomplete` for most text, so a clean contrast reading here is weak
 * evidence: `npm run sweep:contrast` measures painted pixels and is the guard.
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
          + '<button id="ctl-label" aria-label="Go">Submit order</button>'
          // Fits at normal spacing (16px at 1.2 = 19.2px in a 20px box) and clips at 1.5.
          + '<div id="ctl-clip" style="height:20px;overflow:hidden;font-size:16px;line-height:1.2">This line fits until the spacing grows</div>'
          + '<h1>Second heading</h1>';
        document.querySelector('main').prepend(box);
        const faint = document.createElement('p');
        faint.id = 'ctl-contrast';
        faint.textContent = 'faint control text';
        faint.style.cssText = 'position:fixed;right:0;bottom:0;margin:0;padding:8px;z-index:99999;pointer-events:none;font-size:16px;color:#777;background:#888';
        document.body.appendChild(faint);
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
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Accessibility.enable');
    /** The browser's own accessible name and role for the focused element. */
    const computedName = async () => {
      const { result } = await cdp.send('Runtime.evaluate', { expression: 'document.activeElement' });
      if (!result.objectId) return { name: '', role: '' };
      const { nodes } = await cdp.send('Accessibility.getPartialAXTree', { objectId: result.objectId, fetchRelatives: false });
      const n = nodes?.[0];
      return { name: String(n?.name?.value ?? '').replace(/\s+/g, ' ').trim(), role: String(n?.role?.value ?? '') };
    };
    /** What the focused element's centre is hit-tested against: '' when it is the element itself. */
    const coverOfFocused = () => page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return '';
      const r = el.getBoundingClientRect();
      const cx = Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1);
      const cy = Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1);
      const top = document.elementFromPoint(cx, cy);
      return top && !el.contains(top) && !top.contains(el)
        ? (top.getAttribute('aria-label') || top.closest('[class]')?.className?.toString().slice(0, 40) || top.tagName)
        : '';
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
        // The text drawn on a control, for SC 2.5.3 (label in name). A field's
        // own value is not a label, so only things named by their content count.
        const drawn = /^(button|a|summary)$/i.test(el.tagName) || ['button', 'link', 'tab', 'menuitem'].includes(el.getAttribute('role') || '')
          ? el.textContent.replace(/\s+/g, ' ').trim()
          : '';
        return { tag: el.tagName.toLowerCase(), drawn, indicator: outline || ring, offscreen: r.bottom < 0 || r.top > innerHeight };
      });
      if (!s) continue;
      const { name, role } = await computedName();
      s.name = name;
      s.role = role;
      // Measured the instant focus lands, then again once it has settled: a
      // fixed control that moves out of the way a frame later is `transient`.
      s.coveredAtLanding = await coverOfFocused();
      s.obscured = '';
      if (s.coveredAtLanding) {
        await page.waitForTimeout(250);
        s.obscured = await coverOfFocused();
      }
      stops.push(s);
    }
    const label = (s) => `${s.tag} "${(s.name || s.drawn).slice(0, 40)}"`;
    const firstStop = stops[0] ? label(stops[0]) : '';
    const noIndicator = stops.filter((s) => !s.indicator).map(label);
    const obscured = stops.filter((s) => s.obscured && !s.offscreen).map((s) => `${label(s)} under ${s.obscured}`);
    const transient = stops.filter((s) => s.coveredAtLanding && !s.obscured && !s.offscreen).map((s) => `${label(s)} under ${s.coveredAtLanding}`);
    // A focusable the browser gives no name to: a screen reader says only its role.
    const unnamed = stops.filter((s) => !s.name && !['presentation', 'none', 'generic', 'RootWebArea', 'WebArea'].includes(s.role)).map((s) => `${s.tag} (${s.role || 'no role'})`);
    // SC 2.5.3: the name must contain the visible text, ignoring case, spacing and
    // anything with no letter or digit in it (an icon glyph is not a label).
    // Spaces are dropped on both sides: textContent joins adjacent inline spans
    // ("Steps4/4") where the browser's name puts a space between them.
    const norm = (t) => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    const labelMismatch = stops
      .filter((s) => s.name && /[\p{L}\p{N}]/u.test(s.drawn) && !norm(s.name).includes(norm(s.drawn)))
      .map((s) => `${s.tag} shows "${s.drawn.slice(0, 60)}" but is named "${s.name}"`);

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

    // SC 1.4.12: apply the minimum text-spacing overrides and report what is
    // newly clipped. "Clipped" is an element that hides its overflow and has
    // more content than box; one already clipped before the override is not new.
    const clipped = () => page.evaluate(() => {
      const found = [];
      for (const el of document.querySelectorAll('body *')) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || !el.textContent.trim()) continue;
        const hidesX = cs.overflowX !== 'visible', hidesY = cs.overflowY !== 'visible';
        if (!hidesX && !hidesY) continue;
        if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') continue; // scrolls: nothing is lost
        if ((hidesY && el.scrollHeight > el.clientHeight + 1) || (hidesX && cs.overflowX !== 'auto' && cs.overflowX !== 'scroll' && el.scrollWidth > el.clientWidth + 1)) {
          const where = el.id ? `#${el.id}` : `${el.tagName.toLowerCase()}${typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : ''}`;
          found.push(`${where} "${el.textContent.replace(/\s+/g, ' ').trim().slice(0, 28)}"`);
        }
      }
      return found;
    });
    const clippedBefore = new Set(await clipped());
    const spacing = await page.addStyleTag({
      content: '*{line-height:1.5!important;letter-spacing:0.12em!important;word-spacing:0.16em!important}p{margin-bottom:2em!important}',
    });
    await page.waitForTimeout(400);
    const newlyClipped = (await clipped()).filter((c) => !clippedBefore.has(c));
    const spacedOverflowX = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth);
    await spacing.evaluate((el) => el.remove());

    out.push({ vp: vpName, name, hash, ...structure, tabStops: stops.length, firstStop, noIndicator, obscured, transient, unnamed, labelMismatch, newlyClipped, spacedOverflowX, violations, incomplete, errors });
    console.log([
      vpName, name,
      `h1=${structure.h1s.length}(${structure.h1s.join('|')})`,
      `main=${structure.main}`, `nav=${structure.nav}`, `overflow=${structure.overflowX}`,
      `skips=${structure.headingSkips.join(',') || 'none'}`,
      `first=${firstStop}`, `stops=${stops.length}`, `noRing=${noIndicator.length}`, `obscured=${obscured.length}`, `transient=${transient.length}`,
      `unnamed=${unnamed.length}`, `labelMismatch=${labelMismatch.length}`, `clipped=${newlyClipped.length}`, `spacedOverflow=${spacedOverflowX}`,
      `axe=${violations.map((a) => `${a.id}:${a.n}`).join(',') || 'none'}`,
      `incomplete=${incomplete.join(',') || 'none'}`, `pageerrors=${errors.length}`,
    ].join('\t'));
    await ctx.close();
  }
}
await browser.close();
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(out, null, 2));

// The control: every planted fault must have been reported on every screen it
// was planted on, or this probe is blind to that kind of fault and a clean
// run proves nothing about it.
if (process.env.CONTROL) {
  const planted = [
    ['unnamed button', (r) => r.unnamed.some((u) => u.startsWith('button'))],
    ['focusable with no ring', (r) => r.noIndicator.some((n) => n.includes('no ring'))],
    ['image with no alt', (r) => r.violations.some((v) => v.id === 'image-alt')],
    ['second h1', (r) => r.h1s.length > 1],
    ['low-contrast text', (r) => r.violations.some((v) => v.id === 'color-contrast')],
    ['label not in name (2.5.3)', (r) => r.labelMismatch.some((m) => m.includes('Submit order'))],
    ['text clipped by 1.4.12 spacing', (r) => r.newlyClipped.some((c) => c.startsWith('#ctl-clip'))],
  ];
  const missed = [];
  for (const [what, seen] of planted) {
    const blind = out.filter((r) => !seen(r)).map((r) => `${r.name}@${r.vp}`);
    console.log(`control ${blind.length ? 'MISSED' : 'ok    '} ${what}${blind.length ? `: not reported on ${blind.length} of ${out.length} (${blind.slice(0, 4).join(', ')})` : ''}`);
    if (blind.length) missed.push(what);
  }
  if (missed.length) {
    console.error(`control failed: this probe did not report ${missed.length} planted fault(s); do not trust a clean run for: ${missed.join('; ')}`);
    process.exit(3);
  }
}
