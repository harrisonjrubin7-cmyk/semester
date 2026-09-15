/**
 * Where the assistant's button rests, on every screen in the app.
 *
 * `ai/Assistant.tsx` draws one floating button, mounted in the shell rather
 * than by a screen, and it must not cover a primary action on any of them. It
 * keeps that promise by asking: `elementsFromPoint` at five places under the
 * button, and a lift of its own height — twice at most — when something
 * tappable answers.
 *
 * Whether the asking is enough is not a question the unit suite can answer.
 * jsdom has no layout, so `elementsFromPoint` does not exist there at all, and
 * `ai/dock.test.ts` is reduced to checking which five points get asked. The
 * rest has to be measured in a browser. This is that measurement, and it is
 * committed for the reason `scripts/baseline.mjs` gives about its pictures: a
 * number nobody can regenerate is a number nobody can argue with.
 *
 * ## Running it
 *
 *   npm run build && node scripts/dock.mjs
 *
 * A couple of minutes — every destination in `lib/nav.ts` once, then the
 * fourteen `NAMED` screens at a real id, with a pause on each for the lift's
 * own timers to settle. An id-addressed row is marked with a trailing `#`. It exits non-zero when a
 * visible control is half covered or has its centre blocked, and prints the
 * whole census either way. `SIMPLIFY-AUDIT.md` §7 holds the last full run and
 * what it concluded.
 *
 * Playwright is not a dependency of this app, for the reason `baseline.mjs`
 * gives: one browser and a large download for a script most contributors never
 * run. `npx playwright install chromium` fetches it on demand.
 *
 * ## Why there is no `npm run check:dock`
 *
 * There was, and `lib/ci.test.ts` was right to fail it. Its rule is that a
 * script *named* `check:` is one somebody wrote to verify something, so the
 * workflow has to run it — a check nothing runs is not a check. Satisfying
 * that here would mean a browser download and a sixty-screen walk on every
 * pull request, plus the timing waits below turning red on a slow runner for
 * reasons that are not this app's.
 *
 * `baseline.mjs` already settled this, and is the shape to follow: a script
 * that needs a real browser and takes minutes is a before-a-release job, run
 * by hand, with no entry in the scripts block to promise otherwise. If the
 * four minutes are ever judged worth paying, the honest way in is a CI step
 * that runs it *and* a `check:` name, not one without the other.
 *
 * ## Three ways this measured the wrong thing
 *
 * Each of them produced a confident wrong answer before it was caught, and
 * each is guarded below rather than remembered.
 *
 * **The button is not found by its label.** `aria-label^="Ask about"` also
 * matches the in-content "Ask about: …" affordance on `progress`, so that
 * screen was measured against itself and reported 100% covered. It is found by
 * `aria-keyshortcuts="a"` *and* `position: fixed`.
 *
 * **Laid out is not the same as on screen.** Chrome gives content inside a
 * closed `<details>` a real `getBoundingClientRect` — right size, right place,
 * and invisible. On `study` that is fourteen "controls", one of which was
 * reported as having its centre blocked by a button resting nowhere near it.
 * The filter is `checkVisibility()`, never a non-zero rect.
 *
 * **A padded target is bigger than its border box.** `.tap`, `.tap-x` and
 * `.tap-y` in `styles/app.css` grow a small control's *target* to 44px with a
 * transparent `::after` while the mark stays put, and `elementsFromPoint` —
 * which is what the button's own probes use — hit-tests the overlay. Measuring
 * the border box measures a different element than the one that was found. It
 * does not reliably read low, either: `links`' EDIT is 41% by its border box
 * and 48% by its target, because the assistant sits above it and the padding
 * reaches up into the assistant.
 *
 * **"Blocked" meant "something else is on top", which is two questions.** The
 * subject here is one button, and `elementFromPoint` answers about whatever is
 * frontmost — a panel elsewhere on the page, or `null` for a centre below the
 * fold, since it is viewport-relative. Both read as blocked and neither is.
 * The centre is asked about only when it falls inside the button's own rect.
 *
 * ## What it still over-reports, deliberately
 *
 * Rectangles. The assistant is `border-radius: 50%`, and both this and
 * `tappable()` compare bounding boxes, so about a fifth of the button's area
 * is claimed and not occupied — that same EDIT is 48% by the arithmetic and
 * 35% sampled on a 1px grid. The error is always in the one direction, which
 * makes the button lift a shade sooner than it must, and correcting it would
 * spend a distance calculation per probe to make it *less* willing to move out
 * of somebody's way. See `SIMPLIFY-AUDIT.md` §7.
 */

import { createServer } from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', 'dist');
const PORT = 8792;

/**
 * The path the build expects to be served from.
 *
 * `vite.config.ts` takes it from `VITE_BASE` and defaults to `/`, so a plain
 * `npm run build` and the one the Pages workflow makes disagree — and served
 * under the wrong one the app returns 404 for every chunk, renders an empty
 * body, and this reports sixty screens with no button on any of them. Which it
 * did. Read out of the built `index.html` instead of assumed.
 */
async function base() {
  const html = await readFile(join(ROOT, 'index.html'), 'utf8');
  const asset = /(?:src|href)="([^"]*\/assets\/[^"]+)"/.exec(html);
  if (!asset) throw new Error('cannot find an asset link in dist/index.html — is the app built?');
  return asset[1].slice(0, asset[1].indexOf('/assets/'));
}

/** Phone width, which is where the button and the content compete hardest. */
const VIEWPORT = { width: 402, height: 874 };

/**
 * How long to wait on each screen.
 *
 * The lift is not a layout property — it is an effect that re-measures on a
 * timer, and the longest of those runs to 1200ms. Reading the button's rect
 * before then measures where it started, not where it settled.
 */
const SETTLE = 2600;

/** Half the control, which is the threshold `tappable()` itself uses. */
const COVERED = 0.5;

/**
 * Every destination, read out of the registry rather than written here.
 *
 * `baseline.mjs` learned this twice: a list of screens written into a script
 * fails on a correct app the first time a screen leaves the registry, and a
 * check that fails on a correct app is a check people learn to ignore.
 */
async function destinations() {
  const src = await readFile(join(HERE, '..', 'src', 'lib', 'nav.ts'), 'utf8');
  const all = [...src.matchAll(/^\s{4}screen: '([^']+)',$/gm)].map((m) => m[1]);
  if (all.length === 0) throw new Error('cannot find any screens in lib/nav.ts');
  return [...new Set(all)];
}

/**
 * The screens that are only a place once something exists.
 *
 * `NAMED` in `lib/route.ts` addresses fourteen screens by id, and the first
 * census swept none of them — it walked `#/<screen>` and stopped, so `course`,
 * `item`, `event`, the five study modes and the four makers were counted as
 * their *library*, which is a different screen with different controls under
 * the button. `write` and `sheet` are the ones that matter: dense editor
 * chrome, a toolbar along the bottom, and nothing like the empty library the
 * bare address draws.
 *
 * Ids come from the registry wherever there is one, for the reason
 * `destinations()` gives — a list written into this file fails on a correct
 * app the first time the data moves.
 */
async function ids() {
  const data = join(HERE, '..', 'src', 'data');

  // The course id *is* the directory name: `#/course/econ` and
  // `src/data/courses/econ/` are the same string, so the listing is the list.
  const courses = (await readdir(join(data, 'courses'), { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  if (!courses.length) throw new Error('no courses in src/data/courses');
  const course = courses[0];

  // One deadline and one campus event, read out of the files that hold them.
  const one = (src, re, what) => {
    const m = re.exec(src);
    if (!m) throw new Error(`cannot find ${what} — has the data moved?`);
    return m[1];
  };
  const item = one(
    await readFile(join(data, 'courses', course, 'index.ts'), 'utf8'),
    new RegExp(`id: '(${course}-[^']+)'`),
    `an item id in src/data/courses/${course}/index.ts`,
  );
  const event = one(
    await readFile(join(data, 'events.ts'), 'utf8'),
    /id: '([^']+)'/,
    'an event id in src/data/events.ts',
  );

  return { course, item, event };
}

/**
 * The three that cannot be addressed at all until one has been made.
 *
 * An id the app does not know falls back to the library on these — measured:
 * `#/write/nope` draws the same 2,159 characters as `#/write`. So the only way
 * to the editor is to make a document, which means clicking the affordance
 * that makes one, which means matching a label. That is the fragile step in
 * this script and it is written to fail loudly rather than quietly skip: a
 * renamed button throws here instead of silently reporting one fewer screen.
 *
 * `note` is not in this list. It takes any id and opens a blank editor, which
 * is the same screen a real note draws.
 */
const MAKERS = [
  ['write', /^Blank document/i],
  ['sheet', /^Blank sheet/i],
  ['deck', /^Blank presentation/i],
];

/** The same thing GitHub Pages does with `dist`, so the base path is real. */
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm', '.map': 'application/json',
  '.pdf': 'application/pdf',
};

function serve(prefix) {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (!p.startsWith(prefix)) return void res.writeHead(404).end();
      p = p.slice(prefix.length) || '/';
      let file = normalize(join(ROOT, p));
      if (!file.startsWith(ROOT)) return void res.writeHead(403).end();
      try {
        if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
        res
          .writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
          .end(await readFile(file));
      } catch {
        res.writeHead(404).end(await readFile(join(ROOT, '404.html')).catch(() => 'not found'));
      }
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

/**
 * The census, run in the page.
 *
 * Kept as one function passed to `page.evaluate` rather than several round
 * trips: every rect has to be read from the same layout, and a query that
 * scrolls or settles between two of them measures two different screens.
 */
function census() {
  const fab = [...document.querySelectorAll('button[aria-keyshortcuts="a"]')].find(
    (b) => getComputedStyle(b).position === 'fixed',
  );
  if (!fab) return { drawn: false, hits: [] };
  const f = fab.getBoundingClientRect();

  /*
   * What the finger aims at, which is not always the border box.
   *
   * `styles/app.css` grows an undersized control's target to 44px with a
   * transparent `::after` in whichever axis has room — sideways for something
   * in a vertical list, up and down for something in a row — and leaves the
   * drawing alone. `elementsFromPoint` hit-tests that overlay, so the button's
   * own probes already find these controls through it; measuring the border
   * box would be measuring a different element than the one that was found.
   */
  const target = (el, r) => {
    const cls = el.classList;
    const w = cls.contains('tap') || cls.contains('tap-x') ? Math.max(r.width, 44) : r.width;
    const h = cls.contains('tap') || cls.contains('tap-y') ? Math.max(r.height, 44) : r.height;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    return { left: cx - w / 2, right: cx + w / 2, top: cy - h / 2, bottom: cy + h / 2, width: w, height: h };
  };

  const hits = [];
  const controls = document.querySelectorAll(
    'main button, main a, main input, main textarea, main select, main [role="button"]',
  );
  for (const el of controls) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    // Laid out is not the same as on screen — see the note at the top.
    if (!el.checkVisibility()) continue;
    const t = target(el, r);
    const over =
      Math.max(0, Math.min(t.right, f.right) - Math.max(t.left, f.left)) *
      Math.max(0, Math.min(t.bottom, f.bottom) - Math.max(t.top, f.top));
    if (over <= 0) continue;

    /*
     * How much of it is really gone, which the rectangles above overstate.
     *
     * The assistant is `border-radius: 50%`, so a fifth of the box the
     * arithmetic claims is not occupied by anything; and a padded target is
     * only reachable where its `::after` is actually frontmost. Both are
     * settled by asking, on a 2px grid over the target: how many of these
     * points does a tap still reach?
     *
     * `elementFromPoint` is viewport-relative and answers `null` outside it,
     * which is not the same as covered — points off screen are not sampled,
     * and a target entirely off screen is reported as unmeasured rather than
     * as buried. That confusion has already produced one round of nonsense on
     * seven screens at once; see the note at the top.
     */
    let reached = 0;
    let asked = 0;
    for (let x = Math.ceil(t.left); x < t.right; x += 2) {
      for (let y = Math.ceil(t.top); y < t.bottom; y += 2) {
        if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
        asked += 1;
        const hit = document.elementFromPoint(x, y);
        if (hit === el || el.contains(hit)) reached += 1;
      }
    }
    /*
     * Is the *button* on the centre of the mark — not "is anything".
     *
     * A person aims at the word or the glyph they can see, and a control whose
     * visible middle belongs to something else is mis-tapped however generous
     * the padding around it is. But the subject of this census is one button,
     * and asking the looser question has now produced two separate rounds of
     * confident nonsense:
     *
     *   - `study`, where the answer was a `.blueprint` panel a hundred pixels
     *     away and the button was nowhere near it;
     *   - seven screens at once, where the centre lay *below the fold* —
     *     `elementFromPoint` is viewport-relative and returns `null` for a
     *     point outside it, which read as "blocked" and is not.
     *
     * So the question is asked only where it can mean anything: the centre has
     * to be inside the button's own rect before it is worth asking who is on
     * top of it. That is also why the off-screen case cannot come back — the
     * button is on screen, so any point inside it is too.
     */
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const underButton = cx >= f.left && cx <= f.right && cy >= f.top && cy <= f.bottom;
    const top = underButton ? document.elementFromPoint(cx, cy) : el;
    hits.push({
      what: (el.getAttribute('aria-label') || el.textContent || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 34),
      tag: el.tagName,
      padded: el.classList.contains('tap') || el.classList.contains('tap-x') || el.classList.contains('tap-y'),
      /*
       * One cell of a table, which is a different kind of control.
       *
       * `td`/`th` rather than a class or a label: the spreadsheet's cells are
       * real `<input>`s in a real `<table>`, and the markup is the only part
       * of that which cannot drift. See the note on the grid at the top.
       */
      celled: !!el.closest('td, th'),
      /* What the rectangles say, kept because it is what `costOf` in the app
         reasons with — and so the gap between the two stays visible. */
      boxPct: Math.round((over / (t.width * t.height)) * 100),
      /* What a finger finds. `null` when none of it was on screen to ask. */
      pct: asked ? Math.round(((asked - reached) / asked) * 100) : null,
      asked,
      centreClear: top === el || el.contains(top),
    });
  }
  return { drawn: true, rest: Math.round(f.top), hits };
}

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error(
    'This needs Playwright, which is not a dependency of the app.\n' +
      '  npx playwright install chromium\n' +
      'then run it again.',
  );
  process.exit(2);
}

const screens = await destinations();
const PREFIX = await base();
const server = await serve(PREFIX);
const B = `http://127.0.0.1:${PORT}${PREFIX}`;
/*
 * The browser Playwright installed, unless the machine already has one.
 *
 * `CHROMIUM` points at a build that is already on disk — a CI image or a
 * sandbox with the download baked in — so a run there does not fetch a second
 * copy of the same browser to do the same job.
 */
const browser = await chromium.launch(
  process.env.CHROMIUM
    ? { executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] }
    : { channel: 'chromium' },
);
const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));
// Nothing but the local server: outbound requests hang in a sandbox rather
// than failing, which is `baseline.mjs`'s note and the same trap here.
const ORIGIN = `http://127.0.0.1:${PORT}`;
await page.route('**/*', (route) => (route.request().url().startsWith(ORIGIN) ? route.continue() : route.abort()));
await page.goto(`${B}/`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.getByRole('button', { name: /skip/i }).first().click({ timeout: 3000 }).catch(() => {});

const rows = [];
const visit = async (label, hash) => {
  await page.evaluate((h) => { location.hash = h; }, hash);
  await page.waitForTimeout(SETTLE);
  rows.push({ screen: label, ...(await page.evaluate(census)) });
};

for (const s of screens) await visit(s, `#/${s}`);

// The id-addressed screens, each at a real id rather than at its library.
const { course, item, event } = await ids();
for (const [label, hash] of [
  ['course', `#/course/${course}`],
  ['edit', `#/edit/${course}`],
  ['guide', `#/guide/${course}`],
  ['drill', `#/drill/${course}`],
  ['quiz', `#/quiz/${course}`],
  ['lesson', `#/lesson/${course}`],
  ['slides', `#/slides/${course}`],
  ['item', `#/item/${item}`],
  ['event', `#/event/${event}`],
  // Any id opens a blank note, which is the note editor. See `MAKERS`.
  ['note', '#/note/one'],
  ['call', '#/call/abc-defg'],
]) await visit(`${label}#`, hash);

for (const [screen, label] of MAKERS) {
  await page.evaluate((x) => { location.hash = `#/${x}`; }, screen);
  await page.waitForTimeout(SETTLE);
  await page
    .locator('main')
    .getByRole('button', { name: label })
    .first()
    .click({ timeout: 8000 })
    .catch(() => {
      throw new Error(
        `cannot make a ${screen}: nothing in \`main\` is named ${label}. ` +
          'The affordance has been renamed — fix the pattern in MAKERS rather ' +
          'than letting the screen go unmeasured.',
      );
    });
  await page.waitForTimeout(SETTLE);
  const at = await page.evaluate(() => location.hash);
  if (!new RegExp(`^#/${screen}/.`).test(at)) {
    throw new Error(`making a ${screen} left the address at ${at}, so the editor never opened`);
  }
  rows.push({ screen: `${screen}#`, ...(await page.evaluate(census)) });
}

await browser.close();
server.close();

const drawn = rows.filter((r) => r.drawn);
const touching = drawn.filter((r) => r.hits.length);
const problems = [];
const spared = [];
for (const r of touching) {
  for (const h of r.hits) {
    const bad = (h.pct !== null && h.pct >= COVERED * 100) || !h.centreClear;
    if (!bad) continue;
    /*
     * A cell of a table is exempt, and it is the only exemption.
     *
     * Measured on the spreadsheet editor, at every position the button can
     * take: rows are 26px and the grid tiles the screen, so a 52px button
     * covers 52% of one cell and 30-38% of its neighbour *wherever it sits* —
     * lift 0, 58 and 116 score identically, which is not a rule failing to
     * find the good position but the absence of one.
     *
     * It is exempt because a cell is not a control you can lose. The same
     * affordance repeats across hundreds of cells, the table is navigable from
     * the keyboard, and the cell under the button is one arrow-key from a
     * clear one — none of which is true of the "Remove this paragraph" this
     * run was written to catch. Still counted and still printed, marked
     * `cell`, so that a screen which quietly becomes a grid is visible here
     * rather than silently forgiven.
     */
    (h.celled ? spared : problems).push(
      `${r.screen}: ${h.centreClear ? `"${h.what}" is ${h.pct}% covered` : `the centre of "${h.what}" is under the button`}`,
    );
  }
}

console.log(`screens swept: ${rows.length}`);
console.log(`button drawn: ${drawn.length}   not drawn (FILLS in components/shell/exempt.ts): ${rows.length - drawn.length}`);
console.log(`touching a visible control: ${touching.length}\n`);
for (const r of touching) {
  const what = r.hits
    .map(
      (h) =>
        `${h.what} [${h.tag} ${h.pct === null ? 'off screen' : `${h.pct}%`}` +
        `${h.pct !== null && h.boxPct !== h.pct ? ` (${h.boxPct}% by box)` : ''}` +
        `${h.padded ? ' padded' : ''}${h.celled ? ' cell' : ''}` +
        `${h.centreClear ? '' : ' CENTRE BLOCKED'}]`,
    )
    .join(' | ');
  console.log(`  ${r.screen.padEnd(12)} ${what}`);
}
if (errors.length) console.log(`\npage errors: ${errors.length}\n  ${errors[0]}`);

if (spared.length) {
  console.log(`\n${spared.length} in a table cell, exempt and counted — see the note in this file:`);
  for (const p of spared) console.log(`  ${p}`);
}

if (problems.length === 0) {
  console.log('\nnothing half covered, nothing with its centre blocked, outside a table cell');
} else {
  console.log(`\n${problems.length} problems:`);
  for (const p of problems) console.log(`  ${p}`);
  process.exit(1);
}
