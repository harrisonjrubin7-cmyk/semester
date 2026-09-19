/*
 * Every address, opened cold, against the build that actually ships.
 *
 * `lib/route.ts` gives every screen an address so that a refresh, a bookmark
 * and a link somebody sent all work. Nothing in CI had ever opened one. The
 * suite mounts components in jsdom, and the one instrument that drives a real
 * browser — `contrast-sweep.mjs` — runs `npm run dev`, on a schedule, and
 * reaches its screens by *assigning* `location.hash` after the page is already
 * up. That is the walked case. It is not the cold one, and the difference is
 * a shipped bug:
 *
 *     #/course/bus  ->  TEST 1010 · A course added by hand
 *                       address bar rewritten to #/course/test
 *
 * `e9c7d73` fixed it and `state/deeplink.test.tsx` holds it in jsdom. This is
 * the other half — the half a jsdom test cannot reach, because the things it
 * would catch are things jsdom does not have: the production bundle, the base
 * path every asset is rewritten against, the service worker, and a hash that
 * is present in the very first navigation rather than assigned to a page that
 * has already mounted.
 *
 * ## Cold means the address is in the `goto`
 *
 * This is the whole design and it is one line's worth of difference:
 *
 *     await page.goto(BASE); location.hash = '#/course/bus';   // walked
 *     await page.goto(BASE + '#/course/bus');                  // cold
 *
 * A fresh context per case, too. A context carries localStorage, so reusing
 * one turns the second case into a returning visitor — which is the state
 * where this class of bug hides rather than shows.
 *
 * ## The precondition, and why it is seeded rather than assumed
 *
 * The deep-link bug needed **one course of the account's own**. With an empty
 * catalogue the settling effect takes its early return and nothing goes wrong;
 * with one saved course it has somewhere wrong to settle. Every real account
 * past onboarding has one, and a fresh browser profile does not, so a smoke
 * test that seeded nothing would have been green against the bug it is named
 * for. `OWN` below is that course, seeded through `addInitScript` so it is in
 * storage before the app's first line runs.
 *
 * `seenOnboarding: true` is seeded for a harder-won reason. The first version
 * of this script did what every other browser script here does — load, then
 * dismiss the adoption prompt with its SKIP button — and reported all four
 * courses rewriting the address bar to `#/home`. That is not a routing bug.
 * **SKIP navigates home**, so the probe was reading the screen *after* the
 * dismissal and had never once looked at the address it opened. `.claude/skills/run`
 * calls the prompt something every script starts by clicking past; on a cold
 * link it is something to never draw at all. Suppressed in the seed, the case
 * needs no interaction — which is also the truer test, because a person
 * following a bookmark does not press anything either.
 *
 * ## The four courses are each other's control
 *
 * Asking only for `bus` is a coin toss: a pointer that settles on "the first
 * course to hand" is right about one of the four by accident. All four are
 * asked for, each in its own cold context, and each must answer with its own
 * code. One passing and three failing is the bug; four passing is the fix;
 * and the failure line names what it drew instead, which is the thing the
 * original bug did not do.
 *
 * The codes are read from `src/data/courses/*` rather than written out here,
 * for the reason `destinations.mjs` gives: a list in a script is a list that
 * drifts from the app and says nothing when it does.
 *
 * ## Running it
 *
 *   cd app && npm run build
 *   npx vite preview --port 4173 &
 *   mkdir -p /tmp/drive && cd /tmp/drive
 *   echo '{"name":"drive","private":true,"type":"module"}' > package.json
 *   PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install playwright
 *   cd - && SMOKE_PLAYWRIGHT=/tmp/drive/node_modules/playwright npm run smoke:cold
 *
 * Exit 0 clean, 1 with findings, 2 if it could not run — never 0 for a run
 * that measured nothing, which is the failure mode this repository keeps
 * finding in its own instruments.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.SMOKE_URL || 'http://localhost:4173/';
const CHROME = process.env.SMOKE_CHROME || '/opt/pw-browsers/chromium';

/** How long to let a cold boot settle. The sample is four dynamic imports. */
const SETTLE = Number(process.env.SMOKE_SETTLE || 3000);

/**
 * The shipped courses, `{ id, code }`, read from their own source.
 *
 * `index.ts` in each course directory carries the `code:` the screen prints.
 * Throwing on a short answer rather than returning one, because a parse of a
 * file that moved reads as an empty list and an empty list is a green run.
 */
function courses() {
  const root = join(here, '..', 'src', 'data', 'courses');
  const out = [];
  for (const id of readdirSync(root)) {
    const at = join(root, id, 'index.ts');
    if (!existsSync(at)) continue;
    const code = /code: '([^']+)'/.exec(readFileSync(at, 'utf8'));
    if (code) out.push({ id, code: code[1] });
  }
  if (out.length < 2)
    throw new Error(`parsed only ${out.length} courses from data/courses — its shape changed`);
  return out;
}

/**
 * One course of the student's own — the thing that makes the catalogue
 * non-empty, which is the precondition the deep-link bug needed.
 *
 * Deliberately the same shape `state/deeplink.test.tsx` uses, and deliberately
 * a code that matches none of the shipped four: if a cold link settles on this
 * instead of on what it asked for, the failure line says `TEST 1010` and names
 * the bug outright rather than looking like a mismatch between two real
 * courses.
 */
const OWN = {
  course: {
    id: 'test',
    code: 'TEST 1010',
    name: 'A course added by hand',
    prof: '',
    email: '',
    meets: '',
    room: '',
    credits: '',
    source: '',
    grading: [],
  },
  items: [],
  schedule: [],
  guide: { code: 'TEST 1010', name: '', blurb: '', source: '', mastery: 0, audio: false, units: [], terms: [] },
  planMinutes: '45 min',
  frameLabel: 'Frames',
};

/** `SCHEMA` in `lib/migrate.ts`, read rather than written down. */
function schema() {
  const src = readFileSync(join(here, '..', 'src', 'lib', 'migrate.ts'), 'utf8');
  const m = /export const SCHEMA = (\d+)/.exec(src);
  if (!m) throw new Error('no SCHEMA in lib/migrate.ts — its shape changed');
  return Number(m[1]);
}

let chromium;
try {
  const from = process.env.SMOKE_PLAYWRIGHT;
  if (from) {
    const { createRequire } = await import('node:module');
    ({ chromium } = createRequire(import.meta.url)(from));
  } else {
    ({ chromium } = await import('playwright'));
  }
} catch (e) {
  console.error(
    'playwright is not resolvable, and it is deliberately not a dependency of\n' +
    'this project. Install it in a scratch directory and name that copy:\n\n' +
    '  mkdir -p /tmp/drive && cd /tmp/drive\n' +
    '  echo \'{"name":"drive","private":true,"type":"module"}\' > package.json\n' +
    '  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install playwright\n' +
    '  cd - && SMOKE_PLAYWRIGHT=/tmp/drive/node_modules/playwright npm run smoke:cold\n\n' +
    'See .claude/skills/run for why playwright stays out of this project.\n\n' +
    String(e).slice(0, 200),
  );
  process.exit(2);
}

/** Refuse to report on a server that is not there, rather than fail 58 cases. */
try {
  const res = await fetch(BASE, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${res.status}`);
} catch (e) {
  console.error(
    `Nothing is serving ${BASE} (${String(e).slice(0, 80)}).\n\n` +
    'This drives the built app, not the dev server:\n\n' +
    '  cd app && npm run build && npx vite preview --port 4173 &\n',
  );
  process.exit(2);
}

const SHIPPED = courses();
const SCHEMA = schema();
const browser = await chromium.launch({
  ...(existsSync(CHROME) ? { executablePath: CHROME } : {}),
  args: ['--no-sandbox'],
});

/**
 * Open one address in a browser that has never been anywhere.
 *
 * Returns what the app drew, never a verdict — the caller decides what the
 * case wanted. `errors` is every `pageerror` the load produced, which is worth
 * as much as the assertion: a screen that renders correctly while throwing is
 * a screen that is about to stop rendering correctly.
 */
async function cold(hash, { seedOwnCourse = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const errors = [];
  try {
    await ctx.addInitScript(
      ([key, state]) => {
        try {
          localStorage.setItem(key, JSON.stringify(state));
        } catch { /* a profile with storage blocked still tells us something */ }
      },
      ['semester.v1', { schemaVersion: SCHEMA, sample: true, nav: 'tabs', seenOnboarding: true, ...(seedOwnCourse ? { courses: [OWN] } : {}) }],
    );
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));

    // The address is in the navigation itself. See the header — assigning it
    // afterwards is the walked case and cannot see this class of bug.
    await page.goto(BASE.replace(/\/$/, '/') + hash, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(SETTLE);

    const drew = await page.evaluate(() => {
      const text = (document.querySelector('main') ?? document.body).innerText;
      return {
        // Every course code in this app is uppercase in the data, so this is
        // one of the few places an exact-case match is right. See
        // .claude/skills/run §3a for why that is the exception.
        codes: [...new Set(text.match(/\b[A-Z]{3,5} \d{3,4}\b/g) ?? [])],
        heading: document.querySelector('h1')?.textContent?.trim() ?? '',
        buttons: [...document.querySelectorAll('main button')].filter((b) => b.checkVisibility()).length,
      };
    });
    return { ...drew, hash: await page.evaluate(() => location.hash), errors };
  } finally {
    await ctx.close();
  }
}

const findings = [];
let ran = 0;

// ── The deep-link class, four courses as each other's control ──────────────
for (const { id, code } of SHIPPED) {
  const hash = `#/course/${id}`;
  const got = await cold(hash);
  ran++;
  if (!got.codes.includes(code)) {
    findings.push(
      `${hash} drew ${got.codes.length ? got.codes.join(', ') : '(no course code)'} — wanted ${code}` +
      (got.codes.includes('TEST 1010') ? '  ← settled on the account’s own course: the deep-link race is back' : ''),
    );
  }
  if (got.hash !== hash) findings.push(`${hash} rewrote the address bar to ${got.hash || '(empty)'}`);
  for (const e of got.errors) findings.push(`${hash} threw: ${e}`);
}

// ── A cold boot with nothing seeded still has to be usable ─────────────────
//
// The control for the block above: with no course of its own the settling
// effect takes its early return, so this must pass whether or not the fix is
// present. A run where the seeded cases fail and this one does too is not the
// deep-link bug — it is the build, and that is a different morning's work.
{
  const got = await cold('', { seedOwnCourse: false });
  ran++;
  if (got.buttons === 0) findings.push('a cold boot at the root drew no pressable control at all');
  for (const e of got.errors) findings.push(`cold boot threw: ${e}`);
}

await browser.close();

console.log(`\ncold-smoke — ${ran} cold boots against ${BASE}`);
console.log(`courses asked for: ${SHIPPED.map((c) => `${c.id} (${c.code})`).join(', ')}\n`);
if (findings.length) {
  console.log(`FINDINGS: ${findings.length}\n`);
  for (const f of findings) console.log(`  - ${f}`);
  console.log('');
  process.exit(1);
}
console.log('No findings. Every address opened cold drew what it names.\n');
