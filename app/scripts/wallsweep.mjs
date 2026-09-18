/*
 * Where is the app asking you to choose between equals?
 *
 * The improvement list's item 5 says "one primary action, not six identical
 * buttons". PR #503 removed the row the audits named — six pills under Study's
 * one filled action — and found the wall was not a hierarchy problem at all:
 * every pill was an alias for a screen that already existed, so the fix was
 * deletion. `COMPETITION.md` §8 then wrote down what that left open, and it is
 * the sentence this instrument exists for:
 *
 *   > the hierarchy is local rather than designed — each section decided its
 *   > own emphasis
 *
 * A screen-level property, invisible from any one section, and checkable. So
 * this opens all fifty-eight destinations at phone width and asks two
 * questions of what Chromium actually drew:
 *
 *   1. **Is there a row of four or more buttons with nothing ranked above it?**
 *      That is the wall.
 *   2. **How many filled actions does one screen offer at once?** One is an
 *      emphasis. Five is a texture — and five is what Study drew, because each
 *      course card filled its own recommendation and a term has four courses.
 *
 * Run it:
 *
 *     cd app && npm run dev &
 *     npm run sweep:walls
 *
 * It needs a browser, so it is not in `ci.yml` for the reason `contrast.yml`
 * gives at length. It is about a minute rather than half an hour — one width,
 * one ground, no states — because a wall is structural and repainting it in
 * another colour does not make it one.
 *
 * ## Four things this got wrong first, each of which it reported as a finding
 *
 * Kept because a probe's corrections are the only evidence its clean sweep is
 * worth anything, and every one of these produced a confident wrong number:
 *
 *   1. **A toggle is supposed to be flat.** Four segments of a segmented
 *      control are peers; filling one would say it does more than its
 *      neighbours rather than that it is the one you are on.
 *   2. **`aria-current` is a state marker too.** Reading only `aria-pressed`,
 *      `aria-selected` and `role=tab`, the first version reported the app's own
 *      tab bar — which marks Today with `aria-current="page"` and is exactly
 *      right. A probe blind to the marker it should be looking for convicts the
 *      best-behaved row on the screen.
 *   3. **"Near" is not "in the same parent."** Study's four alternatives sit in
 *      their own `div`, and the recommendation ranking them is a sibling of
 *      that `div`, not a child. Scoped to one parent, the probe reported a wall
 *      where the hierarchy was built deliberately with its reasoning in a
 *      comment above it.
 *   4. **A row is ranked by anything above it, not only by the top rung.**
 *      This is the one that would have done damage. Dropping Study's per-course
 *      `tone="primary"` to secondary fixed the screen — one filled action
 *      instead of five — and a probe that only knew `btn-primary` immediately
 *      reported four new walls, one per course card, arguing for putting the
 *      five filled buttons back. `primary > secondary > ghost > plain` is a
 *      four-step vocabulary and the middle of it is where most ranking lives.
 */
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { destinations, arrived } from './destinations.mjs';

/*
 * The same escape hatch `contrast-sweep.mjs` and `paint.mjs` carry, for the
 * same reason: a bare `import 'playwright'` cannot resolve in a container where
 * the library is installed outside the project on purpose — the app does not
 * depend on Playwright and should not start.
 */
const from = process.env.SWEEP_PLAYWRIGHT;
let chromium;
if (from) {
  ({ chromium } = createRequire(import.meta.url)(from));
} else {
  ({ chromium } = await import('playwright'));
}

const BASE = process.env.SWEEP_URL || 'http://localhost:5173/';
const CHROME = process.env.SWEEP_CHROMIUM || '/opt/pw-browsers/chromium';

/** A row of four or more sibling buttons, and what ranks it. */
const WALLS = () => {
  const tier = (b) =>
    /\b(btn-primary|portal-primary)\b/.test(String(b.className))
      ? 3
      : /\bbtn-secondary\b/.test(String(b.className))
        ? 2
        : /\bbtn-ghost\b/.test(String(b.className))
          ? 1
          : 0;
  const stateful = (b) =>
    b.hasAttribute('aria-pressed') ||
    b.hasAttribute('aria-current') ||
    b.hasAttribute('aria-selected') ||
    b.getAttribute('role') === 'tab' ||
    b.closest('[role="tablist"]') !== null;

  const seen = [];
  for (const parent of document.querySelectorAll('*')) {
    /*
     * `.btn` only, and the scope is the argument. It is this app's own "this is
     * a button" class, and the vocabulary for ranking one lives beside it in
     * the same stylesheet — so a row of four `.btn`s with nothing above them is
     * a row that could have been ranked with what is already there.
     *
     * `btn-icon` is excluded as chrome: the five in the header are add, search,
     * all apps, alerts and profile, five peers of app furniture, and no one of
     * them is the point of any screen. `bare` is excluded because it is a row
     * rather than a button — `behind` draws ten overdue items and five things
     * to do about them that way, and a list does not have a primary member.
     */
    const kids = [...parent.children].filter(
      (el) =>
        el.tagName === 'BUTTON' &&
        el.offsetParent !== null &&
        el.getBoundingClientRect().width > 0 &&
        /\bbtn\b/.test(String(el.className)) &&
        !/\bbtn-icon\b/.test(String(el.className)),
    );
    if (kids.length < 4) continue;

    // Up to the enclosing card, which is what a person reads as one thing.
    let box = parent;
    for (let up = 0; up < 4 && box.parentElement; up += 1) {
      box = box.parentElement;
      if (/blueprint|card/.test(String(box.className || '')) || /^(SECTION|ARTICLE|MAIN)$/.test(box.tagName)) break;
    }
    const mine = Math.max(...kids.map(tier));
    const above = [...box.querySelectorAll('button')].filter(
      (b) => b.offsetParent !== null && !kids.includes(b) && tier(b) > mine,
    ).length;
    const look = kids.map((b) => {
      const cs = getComputedStyle(b);
      return [cs.backgroundColor, cs.borderTopColor, cs.borderTopWidth, cs.color, cs.fontWeight].join('|');
    });
    seen.push({
      n: kids.length,
      toggles: kids.filter(stateful).length,
      distinct: new Set(look).size,
      above,
      labels: kids.map((b) => (b.textContent || b.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 24)),
      where:
        parent.tagName.toLowerCase() +
        (typeof parent.className === 'string' && parent.className
          ? '.' + parent.className.split(/\s+/).slice(0, 2).join('.')
          : ''),
    });
  }
  return seen;
};

/**
 * Filled actions on one screen.
 *
 * A form's own submit is not one of them, for the reason
 * `screens/studyhierarchy.test.tsx` gives: "Save journal entry" commits the box
 * above it and means nothing without it, where an offer the screen makes on
 * arrival is a different kind of thing. Counting it would make this false about
 * screens that read correctly, which is how a measurement starts being argued
 * with instead of acted on.
 */
const FILLED = () => {
  const filled = [...document.querySelectorAll('button')].filter(
    (b) =>
      b.offsetParent !== null &&
      /\b(btn-primary|portal-primary)\b/.test(String(b.className)) &&
      /*
       * And actually filled, which the class alone stopped guaranteeing — but
       * asked of **both** background properties, which is the fifth thing this
       * probe got wrong and the one that would have been mistaken for a win.
       *
       * Why ask at all: `.studio-entry > .portal-primary.is-quiet` keeps the
       * primary class for its shape and size and paints nothing, because the
       * button has to stay in the same place at the same size on every tab and
       * only its emphasis moves. A probe reading the class would call that
       * filled and report a screen this instrument had just been used to fix.
       *
       * Why both: `.device .btn-primary` is `background: var(--chrome)`, and
       * `--chrome` is a `linear-gradient(…)`. A gradient is a
       * *background-image*, so `backgroundColor` on every filled button in
       * this app reads `rgba(0, 0, 0, 0)`. Asking only for the colour reported
       * 122 of 125 states as offering no action at all — a number that looks
       * like a clean sweep and says the app has almost no buttons. This is
       * `paint.mjs`'s lesson one instrument over: the thing that makes a
       * gradient invisible to a style query is exactly what makes it visible
       * to a person.
       */
      (getComputedStyle(b).backgroundColor !== 'rgba(0, 0, 0, 0)' ||
        getComputedStyle(b).backgroundImage !== 'none') &&
      !b.closest('form') &&
      !b.hasAttribute('aria-pressed'),
  );
  return { n: filled.length, labels: filled.map((b) => (b.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30)) };
};

/**
 * The tab strip on this screen, if it has one, as labels to click.
 *
 * Found rather than written down, for the reason `destinations.mjs` exists:
 * `contrast-sweep.mjs` had six screens in a hand-written list and printed
 * findings about a tenth of the app under a heading that said FINDINGS. A
 * hand-written table of which screens have tabs would go stale the same way
 * and be just as quiet about it.
 *
 * A strip is a parent whose visible children are *all* buttons and all carry
 * `aria-pressed` — which is what `components/Segmented.tsx` renders and what a
 * filter row does not, because a filter row has something else in it. Only the
 * first such group is walked: a second one is usually a filter *within* a tab,
 * and the product of the two is a combinatorial walk nobody asked for.
 */
const STRIP = () => {
  for (const parent of document.querySelectorAll('*')) {
    const kids = [...parent.children].filter((el) => el.offsetParent !== null);
    if (kids.length < 2) continue;
    if (!kids.every((el) => el.tagName === 'BUTTON' && el.hasAttribute('aria-pressed'))) continue;
    return kids.map((el) => (el.textContent || '').trim().replace(/\s+/g, ' '));
  }
  return [];
};

/*
 * The control, injected into the running app so it goes through the same code
 * path as everything else. Two halves, because a broken probe fails each way:
 * a flat six must be found, and a six with one filled member must not.
 */
const CONTROL = () => {
  const mk = (id, primary) => {
    /*
     * Inside a `<section>`, which is not decoration. The box-walk climbs to
     * the enclosing card and stops at the first `section`, `article` or `main`
     * — so a control appended straight to `body` climbs all the way out and
     * finds whatever the real screen has, which is how the first version of
     * this reported that it could not see its own flat six. The control has to
     * be bounded the way a real card is or it is measuring the page.
     */
    const bound = document.createElement('section');
    const box = document.createElement('div');
    box.id = id;
    box.style.display = 'flex';
    for (let i = 0; i < 6; i += 1) {
      const b = document.createElement('button');
      b.textContent = `ctl-${id}-${i}`;
      b.className = i === 0 && primary ? 'btn btn-primary' : 'btn';
      b.style.cssText =
        i === 0 && primary
          ? 'background:#3b6ef5;color:#fff;border:1px solid #3b6ef5;padding:8px'
          : 'background:transparent;color:#222;border:1px solid #ccc;padding:8px';
      box.appendChild(b);
    }
    bound.appendChild(box);
    document.body.appendChild(bound);
  };
  mk('flat', false);
  mk('ranked', true);
};

const browser = await chromium.launch(
  existsSync(CHROME) ? { executablePath: CHROME, args: ['--no-sandbox'] } : { args: ['--no-sandbox'] },
);
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
const page = await ctx.newPage();
const errs = [];
let at = 'startup';
page.on('pageerror', (e) => errs.push(`${at}: ${String(e).split('\n')[0]}`));

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const skip = page.getByRole('button', { name: /skip/i }).first();
if (await skip.count()) {
  await skip.click();
  await page.waitForTimeout(1200);
}

await page.evaluate(CONTROL);
const ctl = (await page.evaluate(WALLS)).filter((r) => r.labels.some((l) => l.startsWith('ctl-')));
const flat = ctl.find((r) => r.labels.some((l) => l.startsWith('ctl-flat')));
const ranked = ctl.find((r) => r.labels.some((l) => l.startsWith('ctl-ranked')));
console.log(`CONTROL  a flat six is found:      ${!!flat && flat.above === 0 && flat.distinct === 1}`);
console.log(`CONTROL  a ranked six is not:      ${!!ranked && ranked.distinct === 2}`);
if (!flat || flat.above !== 0 || flat.distinct !== 1) throw new Error('the probe cannot see a flat row of six');
if (!ranked || ranked.distinct !== 2) throw new Error('the probe cannot tell a ranked row from a flat one');
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

const dests = destinations();
const rows = [];
const filled = [];
let opened = 0;
let tabs = 0;
const missed = [];
for (const { screen, label } of dests) {
  at = screen;
  await page.evaluate((h) => {
    location.hash = h;
  }, `#/${screen}`);
  await page.waitForTimeout(650);
  /*
   * Setting the hash is a request, not an arrival — `contrast-sweep.mjs` says
   * so at length, and a sweep that audits the screen it was already on reports
   * a clean answer about the wrong page. `arrived()` holds the rendered
   * heading to the registry's label.
   */
  const seen = await page.evaluate(() => ({
    h1: document.querySelector('h1')?.textContent || '',
    h2: [...document.querySelectorAll('h2')].map((e) => e.textContent || '').join(' | '),
    marks: [...document.querySelectorAll('[data-screen]')].map((e) => e.getAttribute('data-screen')).join(','),
  }));
  if (arrived(screen, label, seen)) opened += 1;
  else missed.push(screen);
  for (const r of await page.evaluate(WALLS)) rows.push({ screen, ...r });
  filled.push({ screen, ...(await page.evaluate(FILLED)) });

  /*
   * And every tab of it.
   *
   * A destination is not a state. The first version of this walked fifty-eight
   * screens at whichever tab each opened on, and reported that exactly one
   * screen offered more than one filled action — which was true, and narrower
   * than it sounded. Study's Revise tab, which that walk never opened, offered
   * two: the plan's own `Start —` and the standing studio entry above the tab
   * strip. The measurement was right about what it measured and the word
   * "destination" was doing work the sweep had not done.
   */
  const strip = await page.evaluate(STRIP);
  for (const name of strip.slice(1)) {
    at = `${screen}#${name}`;
    const btn = page.getByRole('button', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }).first();
    if (!(await btn.count())) continue;
    await btn.click();
    await page.waitForTimeout(600);
    for (const r of await page.evaluate(WALLS)) rows.push({ screen: `${screen}#${name}`, ...r });
    filled.push({ screen: `${screen}#${name}`, ...(await page.evaluate(FILLED)) });
    tabs += 1;
  }
}

console.log(`\nOPENED: ${opened} of ${dests.length}${missed.length ? `  (missed: ${missed.join(', ')})` : ''}, plus ${tabs} tabs within them`);
console.log(`pageerrors: ${errs.length}${errs.length ? '\n  ' + errs.slice(0, 5).join('\n  ') : ''}`);

const walls = rows.filter((r) => r.distinct === 1 && r.toggles === 0 && r.above === 0);
console.log(`\nrows of 4+ sibling .btn buttons:   ${rows.length}`);
console.log(`  all one weight:                  ${rows.filter((r) => r.distinct === 1).length}`);
console.log(`  and containing no toggle:        ${rows.filter((r) => r.distinct === 1 && r.toggles === 0).length}`);
console.log(`WALLS (nothing ranked above them): ${walls.length}`);
for (const w of walls) console.log(`  ${w.screen}  ${w.where}  ${w.labels.join(' · ')}`);

const competing = filled.filter((f) => f.n > 1);
console.log(`\nfilled actions per screen — 0: ${filled.filter((f) => f.n === 0).length}  1: ${filled.filter((f) => f.n === 1).length}  more: ${competing.length}`);
for (const f of competing) console.log(`  ${f.n}  ${f.screen}: ${f.labels.join(' · ')}`);

await browser.close();
if (opened !== dests.length) {
  console.log('\nA sweep that did not open every destination is not a sweep of the app.');
  process.exit(1);
}
process.exit(walls.length + competing.length > 0 ? 1 : 0);
