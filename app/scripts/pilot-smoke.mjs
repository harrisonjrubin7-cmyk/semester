/*
 * The Registration & Path pilot, walked end to end in a real browser.
 *
 * `docs/SPRINT-1-REGISTRATION-PATH.md` acceptance item 1: a new student can
 * describe their path, see a Path Snapshot labelled a planning estimate, add
 * courses, see a conflict, save a backup, see one explainable next step, act
 * on it, answer the clarity question — and find all of it still there after a
 * reload. At 390 px and 1280 px, with no page errors.
 *
 * Advisor Meeting Mode is not walked: it is the other session's Phase G.
 *
 * Runs against a served build, like `smoke:cold` and `smoke:a11y`:
 *   npm run build && npx vite preview &   # serves on 4173
 *   npm run smoke:pilot
 * Environment: SMOKE_URL, SMOKE_CHROME, SMOKE_PLAYWRIGHT, as the other smokes.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.SMOKE_URL || 'http://localhost:4173/';
const CHROME = process.env.SMOKE_CHROME || '/opt/pw-browsers/chromium';
const WIDTHS = [390, 1280];

function schema() {
  const source = readFileSync(join(here, '..', 'src', 'lib', 'migrate.ts'), 'utf8');
  const match = /export const SCHEMA = (\d+)/.exec(source);
  if (!match) throw new Error('no SCHEMA in lib/migrate.ts — its shape changed');
  return Number(match[1]);
}

let chromium;
try {
  const from = process.env.SMOKE_PLAYWRIGHT;
  if (from) ({ chromium } = createRequire(import.meta.url)(from));
  else ({ chromium } = await import('playwright'));
} catch (error) {
  console.error('Playwright is required. Set SMOKE_PLAYWRIGHT to its installed package.\n' + String(error));
  process.exit(2);
}

try {
  const response = await fetch(BASE, { redirect: 'follow' });
  if (!response.ok) throw new Error(String(response.status));
} catch (error) {
  console.error(`Nothing is serving ${BASE}: ${String(error).slice(0, 120)}`);
  process.exit(2);
}

/** A catalog with one real clash: CS 101-01 and MATH 200-01 overlap on Mon/Wed. */
const CATALOG = {
  catalog: {
    institution: 'Example University',
    importedAt: '2026-09-20T12:00:00Z',
    courses: [
      { id: 'cs1', code: 'CS 101', section: '01', title: 'Programming', term: 'Spring 2027', department: 'CS', credits: 3, instructor: '', location: '', description: '', prerequisites: '', seats: 10, meetings: [{ days: [1, 3], start: 540, end: 590 }] },
      { id: 'cs2', code: 'CS 101', section: '02', title: 'Programming', term: 'Spring 2027', department: 'CS', credits: 3, instructor: '', location: '', description: '', prerequisites: '', seats: 4, meetings: [{ days: [2, 4], start: 540, end: 615 }] },
      { id: 'm1', code: 'MATH 200', section: '01', title: 'Linear Algebra', term: 'Spring 2027', department: 'MATH', credits: 4, instructor: '', location: '', description: '', prerequisites: '', seats: 20, meetings: [{ days: [1, 3], start: 570, end: 620 }] },
    ],
  },
  cart: [],
  plans: [],
};

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const failures = [];
const check = (width, what, ok) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${width}px  ${what}`);
  if (!ok) failures.push(`${width}px ${what}`);
};

for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: 1000 } });
  // Seeded once, not on every load: the reload at the end must find the student's work.
  await ctx.addInitScript(
    ([version, catalog]) => {
      if (!localStorage.getItem('semester.v1')) {
        localStorage.setItem('semester.v1', JSON.stringify({ schemaVersion: version, nav: 'tabs', role: 'student' }));
        localStorage.setItem('semester.registration.v1', JSON.stringify(catalog));
      }
    },
    [schema(), CATALOG],
  );
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const go = async (hash) => {
    await page.evaluate((h) => { location.hash = h; }, hash);
    await page.waitForTimeout(1500);
  };
  const text = () => page.locator('main').innerText();

  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await page.getByRole('button', { name: /skip/i }).first().click();

    // 1. Path details and the Path Snapshot.
    await go('#/degree');
    const card = page.locator('section[aria-labelledby="path-snapshot-title"]');
    await card.getByText(/add your path details/i).click();
    await card.getByLabel(/programme or major/i).fill('Economics BA');
    await card.getByLabel('Graduation season').selectOption('Spring');
    await card.getByLabel('Graduation year').fill('2029');
    await card.getByLabel(/credits your degree needs/i).fill('120');
    await card.getByRole('button', { name: /save path details/i }).click();
    const snapshot = await card.innerText();
    check(width, 'Path Snapshot shows the saved path', /Economics BA/.test(snapshot) && /Spring 2029/.test(snapshot));
    check(width, 'Path Snapshot says it is not official', /not an official degree audit/i.test(snapshot));

    // 2. Courses into the cart, and the conflict found.
    await go('#/yes');
    await page.getByRole('button', { name: 'Add CS 101 section 01 to cart' }).click();
    await page.getByRole('button', { name: 'Add MATH 200 section 01 to cart' }).click();
    await page.getByRole('tab', { name: /^Cart/ }).click();
    await page.waitForTimeout(400);
    check(width, 'the cart finds the time conflict', /CS 101 and MATH 200 overlap|MATH 200 and CS 101 overlap/.test(await text()));

    // 3. A backup, saved.
    await page.getByRole('tab', { name: /registration day/i }).click();
    await page.getByLabel('Add a backup for CS 101 section 01').selectOption('cs2');
    await page.waitForTimeout(300);
    const backups = await page.evaluate(() => localStorage.getItem('semester.registration-day.v1'));
    check(width, 'a backup section is saved', /"cs1":\["cs2"\]/.test(backups ?? ''));
    check(width, 'registration day says it registers nobody', /never registers for you/i.test(await text()));

    // 4. One explainable next step, acted on.
    await go('#/home');
    const top = page.locator('.action-center article');
    check(width, 'Today shows a most important action', (await top.count()) === 1);
    check(width, 'the action carries a source label', (await top.locator('[data-source]').count()) >= 1);
    await top.getByRole('button', { name: /^why this\?$/i }).click();
    check(width, 'the explanation shows how it was ranked', await page.getByText('How it was ranked', { exact: true }).isVisible());
    await page.getByRole('button', { name: /^close$/i }).click();
    const title = await page.locator('#action-top-title').innerText();
    await top.getByRole('button', { name: /^done$/i }).click();
    await page.waitForTimeout(300);
    check(width, 'Done moves the next action up', (await page.locator('#action-top-title').innerText().catch(() => '')) !== title);

    // 5. The clarity question.
    const clarity = page.locator('.clarity-question');
    if (await clarity.count()) {
      await clarity.getByRole('button', { name: /^yes$/i }).click();
      await page.waitForTimeout(300);
    }
    const answers = await page.evaluate(() => localStorage.getItem('semester.clarity.v1:device'));
    check(width, 'the clarity answer is saved on the device', /"answer":"yes"/.test(answers ?? ''));

    // 6. Safely return later.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await go('#/home');
    check(width, 'after reload, the question is not asked again', (await page.locator('.clarity-question').count()) === 0);
    const choices = await page.evaluate(() => localStorage.getItem('semester.actions.v1:device'));
    check(width, 'after reload, the Done is still recorded', /"status":"completed"/.test(choices ?? ''));
    await go('#/degree');
    check(width, 'after reload, the path is still there', /Economics BA/.test(await text()));
  } catch (error) {
    check(width, `walked the flow without throwing — ${String(error).split('\n')[0].slice(0, 160)}`, false);
  }

  check(width, 'no page errors', errors.length === 0);
  if (errors.length) console.log(errors.slice(0, 3).join('\n'));
  await ctx.close();
}

await browser.close();
if (failures.length) {
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log('\nThe pilot flow works at every width.');
