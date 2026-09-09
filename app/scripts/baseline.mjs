/**
 * The screenshot baseline, and the acceptance checks that go with it.
 *
 * Command 2 rebuilt the shell every screen is drawn in, so the old baseline is
 * void — every picture in it is of a layout that no longer exists. This is how
 * the new one is made, committed rather than kept in somebody's scratch
 * directory, because a baseline you cannot regenerate is a folder of stale
 * pictures nobody dares delete.
 *
 * It does two jobs at once, deliberately. Walking fifty-five screens in four
 * grounds at three widths is expensive, and while it is there it may as well
 * check the things the restructure's acceptance list asks about — no
 * horizontal overflow, a hero on every screen that should have one, a pinned
 * bar, a description line. So this exits non-zero when the app is wrong, and
 * writes the pictures either way.
 *
 * ## Running it
 *
 *   npm run build && node scripts/baseline.mjs
 *
 * It takes about half an hour: fifty-five screens walked once, then eight key
 * screens in four grounds at three widths, then the extremes and the launcher.
 * That is a before-a-release job, not a before-a-commit one — the acceptance
 * checks it runs are also the ones `contrast.test.ts` and the unit suite cover
 * in seconds, and what this adds is the pictures and the layout arithmetic
 * that only a real browser can do.
 *
 * Playwright is not a dependency of this app — it is one browser and a large
 * download for a script most contributors never run. `npx playwright install
 * chromium` fetches it on demand, and this says so rather than failing with a
 * module error.
 *
 * Output goes to `app/shots/`, which is not tracked. The baseline is the
 * script; the pictures are what it prints.
 */

import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', 'dist');
const OUT = join(HERE, '..', 'shots');
const PREFIX = '/semester';
const PORT = 8791;

/**
 * How many shelves the registry declares.
 *
 * Read out of `lib/nav.ts` rather than written here as a number. It was
 * written here as a number — nine — and a shelf folding into another made this
 * script fail on a correct app, which is the failure mode that teaches people
 * to ignore a check. The registry is the only thing that knows.
 */
async function shelfCount() {
  const src = await readFile(join(HERE, '..', 'src', 'lib', 'nav.ts'), 'utf8');
  const list = /export const GROUPS: Group\[\] = \[([^\]]*)\]/.exec(src);
  if (!list) throw new Error('cannot find GROUPS in lib/nav.ts');
  return [...list[1].matchAll(/'([^']+)'/g)].length;
}

/** The widths the acceptance list names. */
const WIDTHS = [
  { w: 390, h: 844, name: 'phone' },
  { w: 900, h: 900, name: 'tablet' },
  { w: 1440, h: 900, name: 'desk' },
];

/**
 * The grounds worth a full pass.
 *
 * The handoff says Ink, Parchment and Fog. Bone is added because it is the
 * ground this shell was designed on and the one every token was derived from —
 * a baseline of the soft shell without it would be a baseline of the fallback.
 */
const GROUNDS = ['Ink', 'Parchment', 'Fog', 'Bone'];

/** Screens shot in every ground and width. The rest get one pass each. */
const KEY = ['Today', 'Courses', 'Study', 'Grades', 'Progress', 'Personal', 'Settings', 'Calendar'];

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm', '.map': 'application/json',
  '.pdf': 'application/pdf',
};

/** The same thing GitHub Pages does with `dist`, so the base path is real. */
function serve() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url, 'http://x');
      let p = decodeURIComponent(url.pathname);
      if (!p.startsWith(PREFIX)) return void res.writeHead(404).end();
      p = p.slice(PREFIX.length) || '/';
      let file = normalize(join(ROOT, p));
      if (!file.startsWith(ROOT)) return void res.writeHead(403).end();
      try {
        if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
        const body = await readFile(file);
        res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
      } catch {
        res.writeHead(404).end(await readFile(join(ROOT, '404.html')).catch(() => 'not found'));
      }
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
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

const B = `http://127.0.0.1:${PORT}${PREFIX}`;
const server = await serve();
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chromium' });
const problems = [];
const shots = [];

/** One page, set up the way every pass wants it. */
async function open({ w, h, forcedColors }) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: 2,
    isMobile: w < 900,
    hasTouch: w < 900,
    ...(forcedColors ? { forcedColors: 'active' } : {}),
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  /*
   * Nothing but the local server.
   *
   * Chromium asks for Google Fonts and its own telemetry, and in a sandbox
   * those requests hang rather than fail — which stops `networkidle` ever
   * firing and makes a walk that takes ninety seconds take twenty minutes.
   */
  await page.route('**/*', (route) =>
    route.request().url().startsWith(B.slice(0, B.length - PREFIX.length))
      ? route.continue()
      : route.abort(),
  );
  await page.goto(`${B}/`, { waitUntil: 'domcontentloaded' });
  await page.getByText('SKIP', { exact: false }).first().click().catch(() => {});
  await page.waitForTimeout(1400);
  return { ctx, page };
}

/** Click a button by its exact text, ignoring the navigation rows. */
const press = (page, text, notNav = true) =>
  page.evaluate(
    ([t, skipNav]) => {
      const el = [...document.querySelectorAll('button')]
        .filter((e) => !skipNav || !e.closest('.shelf-nav'))
        .find((e) => (e.innerText || '').trim() === t);
      if (!el) return false;
      el.click();
      return true;
    },
    [text, notNav],
  );

/**
 * Turn on the soft layout and the shelf navigation, and optionally a ground
 * and the largest text.
 *
 * Two pages and three choices, not one switch. When this was written the soft
 * layout drew its own rows and everything lived on one settings screen; the
 * app has since split them — Layout holds how a screen is drawn and how you
 * move between screens, Colour holds the ground and the type size — and made
 * navigation a choice independent of layout. A run that picks only the layout
 * gets no rows to walk and reaches one screen.
 */
async function set(page, { ground, largest } = {}) {
  /*
   * Click the button whose FIRST LINE is exactly this label.
   *
   * It used to be a regex over the whole `innerText`, and the soft layout was
   * matched as `^Soft\b[\s\S]*Cards lifted` — the label plus a phrase from
   * the blurb underneath it. Blurbs get rewritten; that one was, and the
   * match then failed silently, so every shot in the run was taken in the
   * wrong layout with one line of explanation buried in the problem list.
   * The label is the stable half, so match only that.
   */
  const pick = (what, label) =>
    page.evaluate(
      (t) => {
        const el = [...document.querySelectorAll('button')].find(
          (e) => (e.innerText || '').trim().split('\n')[0].trim() === t,
        );
        if (!el) return false;
        el.click();
        return true;
      },
      label,
    ).then((ok) => {
      if (!ok) problems.push(`could not choose ${what}`);
      return page.waitForTimeout(700);
    });

  await page.goto(`${B}/?screen=setNav`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);
  await pick('the soft layout', 'Soft');
  await pick('the shelf navigation', 'Shelves');

  if (ground || largest) {
    await page.goto(`${B}/?screen=setLook`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1400);
    if (ground) await pick(`the ${ground} ground`, ground);
    if (largest) await pick('the largest text size', 'LARGEST');
  }
}

/** What one screen looks like, and whether anything about it is wrong. */
async function capture(page, name, tag) {
  // Off every control, so a hover is never mistaken for a lit state.
  const size = page.viewportSize();
  await page.mouse.move(size.width - 4, Math.round(size.height / 2));
  await page.waitForTimeout(200);
  const file = join(OUT, `${tag}.png`);
  await page.screenshot({ path: file, fullPage: false });
  shots.push({ file: `shots/${tag}.png`, screen: name, tag });

  const read = await page.evaluate(() => {
    const area = document.querySelector('.scrollarea');
    const bar = document.querySelector('.soft-bar');
    const doc = document.documentElement;
    let pinned = null;
    if (bar && area) {
      const scrolls = area.scrollHeight > area.clientHeight + 1;
      area.scrollTop = 0;
      const b = bar.getBoundingClientRect();
      const a = area.getBoundingClientRect();
      pinned = !scrolls || Math.abs(b.bottom - a.bottom) <= 1.5;
    }
    const hero = document.querySelector('.soft-hero');
    return {
      overflow:
        doc.scrollWidth > doc.clientWidth + 1 ||
        (area ? area.scrollWidth > area.clientWidth + 1 : false),
      bar: !!bar,
      pinned,
      said: !!document.querySelector('.shelf-nav-said'),
      // A hero with a dash in it is an empty hero with extra steps.
      emptyHero: hero ? /(^|·)\s*[—-]\s*(·|$)/.test(hero.innerText.replace(/\n/g, ' · ')) : false,
    };
  });

  if (read.overflow) problems.push(`${tag}: scrolls sideways`);
  if (!read.bar) problems.push(`${tag}: no bottom bar`);
  if (read.pinned === false) problems.push(`${tag}: bar is not pinned`);
  if (!read.said) problems.push(`${tag}: no description line`);
  if (read.emptyHero) problems.push(`${tag}: empty hero`);
}

/** Walk both navigation rows, which is every screen the app has. */
async function everyScreen(page, tag) {
  const shelves = await page.evaluate(() =>
    [...document.querySelectorAll('.shelf-nav-row [role="tab"]')].map((e) => e.innerText.trim()),
  );
  const want = await shelfCount();
  if (shelves.length !== want) {
    problems.push(`${tag}: ${shelves.length} shelves, expected ${want}`);
  }
  const seen = new Set();
  for (let s = 0; s < shelves.length; s++) {
    await page.evaluate((i) => document.querySelectorAll('.shelf-nav-row [role="tab"]')[i].click(), s);
    await page.waitForTimeout(550);
    const n = await page.evaluate(
      () => document.querySelectorAll('.shelf-nav-row')[1].querySelectorAll('button').length,
    );
    for (let i = 0; i < n; i++) {
      await page.evaluate(
        (j) => document.querySelectorAll('.shelf-nav-row')[1].querySelectorAll('button')[j].click(),
        i,
      );
      await page.waitForTimeout(500);
      const label = await page.evaluate(
        () => document.querySelector('.shelf-nav-row:nth-of-type(2) .is-on')?.innerText.trim() ?? '?',
      );
      seen.add(label);
      await capture(page, label, `${tag}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`);
    }
  }
  return seen;
}

console.log('· every screen, phone, Ink');
{
  const { ctx, page } = await open(WIDTHS[0]);
  await set(page, { ground: 'Ink' });
  await page.goto(`${B}/?screen=home`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);
  const seen = await everyScreen(page, 'all-phone-ink');
  console.log(`  ${seen.size} screens`);
  if (seen.size !== 55) problems.push(`the walk reached ${seen.size} screens, not 55`);
  await ctx.close();
}

for (const ground of GROUNDS) {
  for (const width of WIDTHS) {
    console.log(`· key screens, ${width.name}, ${ground}`);
    const { ctx, page } = await open(width);
    await set(page, { ground });
    const shelves = await page.evaluate(() =>
      [...document.querySelectorAll('.shelf-nav-row [role="tab"]')].map((e) => e.innerText.trim()),
    );
    for (let s = 0; s < shelves.length; s++) {
      await page.evaluate((i) => document.querySelectorAll('.shelf-nav-row [role="tab"]')[i].click(), s);
      await page.waitForTimeout(450);
      const labels = await page.evaluate(() =>
        [...document.querySelectorAll('.shelf-nav-row')[1].querySelectorAll('button')].map((e) =>
          e.innerText.trim(),
        ),
      );
      for (const [i, label] of labels.entries()) {
        if (!KEY.includes(label)) continue;
        await page.evaluate(
          (j) => document.querySelectorAll('.shelf-nav-row')[1].querySelectorAll('button')[j].click(),
          i,
        );
        await page.waitForTimeout(600);
        await capture(page, label, `key-${width.name}-${ground.toLowerCase()}-${label.toLowerCase()}`);
      }
    }
    await ctx.close();
  }
}

console.log('· the extremes: largest text, and forced colours');
for (const [tag, opts] of [
  ['largest', { largest: true }],
  ['forced', {}],
]) {
  const { ctx, page } = await open({ ...WIDTHS[0], forcedColors: tag === 'forced' });
  await set(page, { ground: 'Ink', ...opts });
  for (const screen of ['home', 'courses', 'study', 'me']) {
    await page.goto(`${B}/?screen=${screen}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1300);
    await capture(page, screen, `${tag}-${screen}`);
  }
  await ctx.close();
}

/*
 * Every shelf's own row, at both ends of its scroll.
 *
 * The row is the whole navigation in the Shelves setting and it does not fit
 * a phone: standing on Semester you see four pills of eight, and the screens
 * on the shelf you are standing on scroll past the right edge. One frame of
 * it is half a picture, so each shelf gets its start and its end.
 *
 * It also checks the rule `lib/nav.ts` keeps and `nav.test.ts` asserts — no
 * shelf below five or above eight — because the unit test reads the registry
 * and this reads what a browser actually drew from it. A shelf can be the
 * right length in the registry and still come out short here, since what is
 * drawn is gated on the school's capabilities.
 */
console.log('· each shelf row, both ends');
{
  const { ctx, page } = await open(WIDTHS[0]);
  await set(page, { ground: 'Ink' });
  await page.goto(`${B}/?screen=home`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const shelves = await page.evaluate(() =>
    [...document.querySelectorAll('.shelf-nav-row [role="tab"]')].map((e) => e.innerText.trim()),
  );
  for (const [i, name] of shelves.entries()) {
    await page.evaluate((j) => document.querySelectorAll('.shelf-nav-row [role="tab"]')[j].click(), i);
    await page.waitForTimeout(700);
    const on = await page.evaluate(() => {
      const row = document.querySelectorAll('.shelf-nav-row')[1];
      if (row) row.scrollLeft = 0;
      return [...(row?.querySelectorAll('button') ?? [])].map((e) => e.innerText.trim());
    });
    if (on.length === 0) problems.push(`${name}: no screens on the shelf`);
    else if (on.length < 5 || on.length > 8) {
      problems.push(`${name}: ${on.length} screens, outside the five-to-eight rule`);
    }
    await page.waitForTimeout(300);
    await capture(page, name, `shelf-${name.toLowerCase()}-start`);
    await page.evaluate(() => {
      const row = document.querySelectorAll('.shelf-nav-row')[1];
      if (row) row.scrollLeft = row.scrollWidth;
    });
    await page.waitForTimeout(450);
    await capture(page, name, `shelf-${name.toLowerCase()}-end`);
  }
  await ctx.close();
}

console.log('· the launcher, a shelf opened, and onboarding');
{
  const { ctx, page } = await open(WIDTHS[0]);
  await set(page, { ground: 'Ink' });
  await page.goto(`${B}/?screen=me`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1600);
  if (!(await press(page, 'EVERYTHING'))) problems.push('no Everything tab on Progress');
  await page.waitForTimeout(1100);
  await page.evaluate(() => {
    const a = document.querySelector('.scrollarea');
    a.scrollTop = a.scrollHeight;
  });
  await page.waitForTimeout(400);
  const tiles = await page.evaluate(() => document.querySelectorAll('.soft-dark').length);
  const wantTiles = await shelfCount();
  if (tiles !== wantTiles) {
    problems.push(`the launcher has ${tiles} tiles, expected ${wantTiles}`);
  }
  await capture(page, 'Launcher', 'launcher');

  await page.evaluate(() => document.querySelectorAll('.soft-dark')[1].click());
  await page.waitForTimeout(800);
  const folder = await page.evaluate(() => !!document.querySelector('.soft-folder'));
  if (!folder) problems.push('a shelf did not open');
  await page.screenshot({ path: join(OUT, 'folder.png') });
  shots.push({ file: 'shots/folder.png', screen: 'Folder', tag: 'folder' });
  await ctx.close();
}

await writeFile(
  join(OUT, 'manifest.json'),
  JSON.stringify({ at: new Date().toISOString(), shots, problems }, null, 2),
);

await browser.close();
server.close();

console.log(`\n${shots.length} shots in app/shots/`);
if (problems.length === 0) {
  console.log('no problems');
} else {
  console.log(`\n${problems.length} problems:`);
  for (const p of problems) console.log(`  ${p}`);
  process.exit(1);
}
