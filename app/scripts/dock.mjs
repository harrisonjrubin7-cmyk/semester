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
 * A couple of minutes — every destination in `lib/nav.ts` once, with a pause
 * on each for the lift's own timers to settle. It exits non-zero when a
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
import { readFile, stat } from 'node:fs/promises';
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
     * The centre of the *mark*, not of the target.
     *
     * A person aims at the word or the glyph they can see. The padded target
     * is what catches a tap that lands near it, and a control whose visible
     * middle belongs to something else is mis-tapped however generous the
     * padding around it is.
     */
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    hits.push({
      what: (el.getAttribute('aria-label') || el.textContent || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 34),
      tag: el.tagName,
      padded: el.classList.contains('tap') || el.classList.contains('tap-x') || el.classList.contains('tap-y'),
      pct: Math.round((over / (t.width * t.height)) * 100),
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
for (const s of screens) {
  await page.evaluate((x) => { location.hash = `#/${x}`; }, s);
  await page.waitForTimeout(SETTLE);
  rows.push({ screen: s, ...(await page.evaluate(census)) });
}

await browser.close();
server.close();

const drawn = rows.filter((r) => r.drawn);
const touching = drawn.filter((r) => r.hits.length);
const problems = [];
for (const r of touching) {
  for (const h of r.hits) {
    if (h.pct >= COVERED * 100) problems.push(`${r.screen}: "${h.what}" is ${h.pct}% covered`);
    if (!h.centreClear) problems.push(`${r.screen}: the centre of "${h.what}" is not reachable`);
  }
}

console.log(`screens swept: ${rows.length}`);
console.log(`button drawn: ${drawn.length}   not drawn (FILLS in components/shell/exempt.ts): ${rows.length - drawn.length}`);
console.log(`touching a visible control: ${touching.length}\n`);
for (const r of touching) {
  const what = r.hits
    .map((h) => `${h.what} [${h.tag} ${h.pct}%${h.padded ? ' padded' : ''}${h.centreClear ? '' : ' CENTRE BLOCKED'}]`)
    .join(' | ');
  console.log(`  ${r.screen.padEnd(12)} ${what}`);
}
if (errors.length) console.log(`\npage errors: ${errors.length}\n  ${errors[0]}`);

if (problems.length === 0) {
  console.log('\nnothing half covered, nothing with its centre blocked');
} else {
  console.log(`\n${problems.length} problems:`);
  for (const p of problems) console.log(`  ${p}`);
  process.exit(1);
}
