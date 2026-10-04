/*
 * Does the app lose anything when the reader changes the text spacing?
 *
 * WCAG 2.1 SC 1.4.12 (AA) says a person must be able to set four properties
 * and lose no content or function:
 *
 *   line height            at least 1.5 times the font size
 *   paragraph spacing      at least 2 times the font size
 *   letter spacing         at least 0.12 times the font size
 *   word spacing           at least 0.16 times the font size
 *
 * Readers with dyslexia or low vision do this with a bookmarklet or a user
 * stylesheet, and the app claims AA. `masterregister.ts` has said since it was
 * written that there is "no text-spacing (1.4.12) test", which is also the
 * prerequisite for offering spacing as a setting: a control that makes the
 * layout lose text is worse than no control.
 *
 * Run it:
 *
 *     cd app && npm run dev &
 *     npm run sweep:spacing
 *
 * It needs a browser, so like the other sweeps it is not in `ci.yml`.
 *
 * ## What it measures
 *
 * Every destination, at a phone and a desktop width. For each: what is clipped
 * or overflowing *before*, then the four properties forced on with `!important`
 * (the same override the standard's own test uses), then what is clipped or
 * overflowing *after*. Only what is **new** is reported. The app has plenty of
 * `overflow: hidden` that is decoration and a sweep that convicted all of it
 * would be argued with instead of acted on.
 *
 * Three kinds of loss, each a way text stops being readable:
 *
 *   clipped    a box with `overflow: hidden|clip` whose content no longer fits
 *              its height or width, so text is cut off
 *   ellipsis   a `text-overflow: ellipsis` box whose text now overflows it
 *   sideways   the page or its scroller now scrolls horizontally
 *
 * ## The control
 *
 * A probe that has never found anything is not known to be a probe. Before the
 * walk it injects a box that must be flagged (a fixed height that clips once
 * the line height grows) and one that must not (the same text in a box that
 * grows with its content), and refuses to continue if it cannot tell them apart.
 *
 * ## What it does not cover
 *
 * Destinations at their default tab, not every tab and not every state: a
 * modal, an empty state, an error. Text that only appears after an interaction
 * is not seen. Overlap between text boxes is not measured. A clean run means
 * "no new clipping or sideways scroll on the first view of each screen at two
 * widths", and the output says so.
 */
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { destinations, arrived, proofSelector } from './destinations.mjs';

const from = process.env.SWEEP_PLAYWRIGHT;
let chromium;
if (from) {
  ({ chromium } = createRequire(import.meta.url)(from));
} else {
  ({ chromium } = await import('playwright'));
}

const BASE = process.env.SWEEP_URL || 'http://localhost:5173/';
const CHROME = process.env.SWEEP_CHROMIUM || '/opt/pw-browsers/chromium';
const WIDTHS = (process.env.SWEEP_WIDTHS || '420,1280').split(',').map(Number);

/** The override the standard's own test applies. */
const SPACING = `
  * { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }
  p { margin-bottom: 2em !important; }
`;

/** What is clipped or overflowing right now, as signatures. */
const LOSS = () => {
  const label = (el) => {
    const cls = typeof el.className === 'string' && el.className ? '.' + el.className.split(/\s+/).slice(0, 2).join('.') : '';
    const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 28);
    return `${el.tagName.toLowerCase()}${cls} “${text}”`;
  };
  const clipped = [];
  const ellipsis = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    // Visually-hidden text (`.sr-only`) is 1px by design and clips on purpose.
    if (r.width < 4 || r.height < 4) continue;
    if (!(el.textContent || '').trim()) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) {
      ellipsis.push(label(el));
      continue;
    }
    /*
     * Per axis, because `.scrollarea` scrolls vertically and hides horizontal
     * overflow, and reading both together convicted every screen that scrolls:
     * text below the fold is not clipped, it is scrolled to.
     */
    const clipX = /hidden|clip/.test(cs.overflowX);
    const clipY = /hidden|clip/.test(cs.overflowY);
    if (!((clipY && el.scrollHeight > el.clientHeight + 1) || (clipX && el.scrollWidth > el.clientWidth + 1))) continue;
    /*
     * Overflowing is not the same as losing text, and the first version of this
     * convicted on it: a 46px button whose label wrapped to two lines has a
     * scrollHeight of 50 and a clientHeight of 44, and every glyph was still
     * inside it. So ask where the *glyphs* are. A text node's client rects are
     * the characters, not the line box, and text is lost only if they fall
     * outside the box that clips them.
     */
    const box = el.getBoundingClientRect();
    const left = box.left + el.clientLeft;
    const top = box.top + el.clientTop;
    const right = left + el.clientWidth;
    const bottom = top + el.clientHeight;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let lost = false;
    for (let n = walker.nextNode(); n && !lost; n = walker.nextNode()) {
      if (!(n.textContent || '').trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const g of range.getClientRects()) {
        if (g.width < 1 || g.height < 1) continue;
        if ((clipX && (g.right > right + 1 || g.left < left - 1)) || (clipY && (g.bottom > bottom + 1 || g.top < top - 1))) {
          lost = true;
          break;
        }
      }
    }
    if (lost) clipped.push(label(el));
  }
  const root = document.scrollingElement;
  const scroller = document.querySelector('.scrollarea');
  const sideways = [];
  if (root && root.scrollWidth > root.clientWidth + 1) sideways.push('page');
  if (scroller && scroller.scrollWidth > scroller.clientWidth + 1) sideways.push('.scrollarea');
  return { clipped, ellipsis, sideways };
};

/** A box that must be flagged once spacing is forced, and one that must not. */
const CONTROL = () => {
  const lossy = document.createElement('div');
  lossy.id = 'ctl-lossy';
  // Short enough to stay on one line before AND after, so the only thing that changes is the line height.
  lossy.style.cssText = 'height:1.2em;overflow:hidden;font-size:16px;line-height:1.2;width:480px';
  lossy.textContent = 'Fixed-height box';
  const ok = document.createElement('div');
  ok.id = 'ctl-ok';
  ok.style.cssText = 'overflow:hidden;font-size:16px;line-height:1.2;width:480px';
  ok.textContent = 'Growing box';
  const wrap = document.createElement('section');
  wrap.append(lossy, ok);
  document.body.append(wrap);
};

const diff = (before, after) => ({
  clipped: after.clipped.filter((s) => !before.clipped.includes(s)),
  ellipsis: after.ellipsis.filter((s) => !before.ellipsis.includes(s)),
  sideways: after.sideways.filter((s) => !before.sideways.includes(s)),
});

async function measure(page) {
  const before = await page.evaluate(LOSS);
  const style = await page.addStyleTag({ content: SPACING });
  await page.waitForTimeout(150);
  const after = await page.evaluate(LOSS);
  await style.evaluate((el) => el.remove());
  return diff(before, after);
}

const browser = await chromium.launch(
  existsSync(CHROME) ? { executablePath: CHROME, args: ['--no-sandbox'] } : { args: ['--no-sandbox'] },
);

const dests = destinations();
const findings = [];
const missedAt = [];
const errs = [];
let opened = 0;

for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  let at = `startup@${width}`;
  page.on('pageerror', (e) => errs.push(`${at}: ${String(e).split('\n')[0]}`));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const skip = page.getByRole('button', { name: /skip/i }).first();
  if (await skip.count()) {
    await skip.click();
    await page.waitForTimeout(1200);
  }

  // The control, on the first screen, before the walk.
  await page.evaluate(CONTROL);
  const ctl = await measure(page);
  const sawLossy = ctl.clipped.some((s) => s.includes('Fixed-height box'));
  const sawOk = ctl.clipped.some((s) => s.includes('Growing box'));
  console.log(`CONTROL @${width}  fixed-height box is flagged:     ${sawLossy}`);
  console.log(`CONTROL @${width}  box that grows is not flagged:   ${!sawOk}`);
  if (!sawLossy) throw new Error('the probe cannot see text clipped by a fixed height');
  if (sawOk) throw new Error('the probe flags a box that grows with its content');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  for (const { screen, label } of dests) {
    at = `${screen}@${width}`;
    await page.evaluate((h) => {
      location.hash = h;
    }, `#/${screen}`);
    await page.waitForTimeout(650);
    const sel = proofSelector(screen);
    const seen = await page.evaluate((s) => ({
      h1: document.querySelector('h1')?.textContent || '',
      css: s ? Boolean(document.querySelector(s)) : false,
    }), sel);
    if (arrived(screen, label, seen)) opened += 1;
    else missedAt.push(at);
    const d = await measure(page);
    if (d.clipped.length || d.ellipsis.length || d.sideways.length) findings.push({ at, ...d });
  }
  await ctx.close();
}

const total = dests.length * WIDTHS.length;
console.log(`\nOPENED: ${opened} of ${total} (${dests.length} destinations × ${WIDTHS.length} widths)${missedAt.length ? `  missed: ${missedAt.join(', ')}` : ''}`);
console.log(`pageerrors: ${errs.length}${errs.length ? '\n  ' + errs.slice(0, 5).join('\n  ') : ''}`);

const bySig = new Map();
for (const f of findings) {
  for (const s of f.clipped) bySig.set(`clipped   ${s}`, [...(bySig.get(`clipped   ${s}`) || []), f.at]);
  for (const s of f.ellipsis) bySig.set(`ellipsis  ${s}`, [...(bySig.get(`ellipsis  ${s}`) || []), f.at]);
  for (const s of f.sideways) bySig.set(`sideways  ${s}`, [...(bySig.get(`sideways  ${s}`) || []), f.at]);
}
const screensWith = new Set(findings.map((f) => f.at.split('@')[0]));
console.log(`\nSCREENS WITH NEW LOSS: ${screensWith.size} of ${dests.length}   (distinct findings: ${bySig.size})`);
for (const [sig, where] of [...bySig].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${sig}   ×${where.length}   ${where.slice(0, 3).join(', ')}${where.length > 3 ? ', …' : ''}`);
}
console.log('\nCovers each destination’s first view at each width; not other tabs, modals, empty or error states. Overlap is not measured.');

await browser.close();
if (opened !== total) {
  console.log('\nA sweep that did not open every destination is not a sweep of the app.');
  process.exit(1);
}
process.exit(findings.length > 0 ? 1 : 0);
