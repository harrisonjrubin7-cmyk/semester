/*
 * The golden student path, walked end to end against the production bundle.
 *
 * `docs/GO-NO-GO-CHECKLIST.md` holds the `golden-path` gate open on one line:
 * no scripted journey went from sign-in through the workspace, help and
 * completion to resuming on a second device. The accessibility smoke opens six
 * screens and checks their structure; the cold smoke opens every address. None
 * of them *does* anything — no step there depends on the one before it. This
 * one is a single student's first session, in order, and every step asserts on
 * what the student would see before the next step is allowed to start.
 *
 * ## The journey
 *
 *   1. **Arrive cold and sign in, or decline to.** A fresh browser profile,
 *      nothing seeded. The adoption prompt is walked with the buttons a new
 *      student presses — Show me, Good, Next — not skipped, and step 4 of 5
 *      is the account step. See "What sign-in means here" below.
 *   2. **Land where a first run lands.** "Add your first course" ends on the
 *      import screen (`doneScreen` in `state/slices/navigate.ts`); then Today.
 *   3. **Make something in the workspace.** An action of the student's own on
 *      Personal (`#/mine`), through "+ New action" and "Add action", and the
 *      same action shown on Today as the next thing of theirs.
 *   4. **Get help.** The Guide (`#/help`): its "When things go wrong" chapter
 *      opens and says what to do when two devices disagree. Then Support
 *      (`#/support`): its first tab carries a working `tel:` crisis line.
 *   5. **Finish it.** The action's tick box, and the row reading back as done
 *      — named "Mark … not done" and struck through.
 *   6. **Resume.** The same browser reloaded, then a second tab of it: the
 *      action is still there and still done, and the first run is not shown
 *      again.
 *   7. **Resume on a second device.** See the next section, which is the part
 *      of this that is easiest to overclaim.
 *
 * All of it at a phone viewport (390×844) and a desktop one (1280×900), each
 * in its own fresh contexts, and any uncaught page error anywhere is a finding.
 *
 * ## What the second device proves, and what it does not
 *
 * Cross-device resume in this app is an account: sign in on both and
 * `lib/cloud.ts` keeps the two copies in step through Supabase. **This script
 * never signs in**, so it does not prove that. It has no account to sign in
 * with, and the only project a production build is configured for is the live
 * one — creating throwaway accounts there from CI is not a test, it is
 * pollution, and a mocked sign-in would be a script proving that its own mock
 * works. `supabase/check.sh` stands up a throwaway Postgres for the RLS suites,
 * but no auth or PostgREST in front of it, so there is no local account
 * service to point a build at either.
 *
 * What it proves instead is the path a signed-out student actually has for
 * moving their semester, which is the backup file ("Take it with you",
 * `#/export`): the first device writes the "Everything, as data" JSON through
 * the real download, and a **second, fresh browser context** — no storage,
 * no cookies, nothing shared with the first — restores it through the real
 * file picker. Before the restore that second context is checked to *not*
 * have the action, so the restore is what put it there and not a leak between
 * contexts. After it, the action is present and still done.
 *
 * So: same-device resume and file-carried resume are proved here. Account-
 * synced resume is proved by `account-sync.mjs`, which does sign in — against
 * a local Supabase stood up from this repository in CI, so the objection above
 * to the live project does not apply to it.
 *
 * ## What sign-in means here
 *
 * Step 4 of the first run is the account step, and it has two honest shapes.
 * A build with no account service configured says "This one stays on the
 * device" and the script asserts exactly that. A build with one — every
 * production build, because `.env.production` carries the public project
 * address — shows the sign-up form, and the script asserts the form is there
 * (email, password, "Create the account", "I already have one") and then
 * presses **Not now**, which is the button a student who does not want an
 * account presses. Nothing is typed into the form and nothing is submitted.
 * The only request that form makes on its own is the public
 * `auth/v1/settings` read that decides which provider buttons to draw.
 *
 * ## Running it
 *
 *   cd app && npm run build
 *   npx vite preview --port 4173 &
 *   mkdir -p /tmp/drive && cd /tmp/drive
 *   echo '{"name":"drive","private":true,"type":"module"}' > package.json
 *   PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install playwright
 *   cd - && SMOKE_PLAYWRIGHT=/tmp/drive/node_modules/playwright npm run smoke:golden
 *
 * Exit 0 only when every step at both viewports was walked and passed. Exit 1
 * on a finding, and 2 when the instrument itself could not run — never 0 for
 * a run that measured nothing.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = (process.env.SMOKE_URL || 'http://localhost:4173/').replace(/\/?$/, '/');
const CHROME = process.env.SMOKE_CHROME || '/opt/pw-browsers/chromium';
/** How long a single expectation may take to come true. */
const WAIT = Number(process.env.SMOKE_WAIT || 15_000);

const VIEWPORTS = [
  ['phone', { width: 390, height: 844 }],
  ['desktop', { width: 1280, height: 900 }],
];

/** Every step, in order. A run that did not reach all of them is not clean. */
const STEPS = [
  'arrive and sign in or decline',
  'land where a first run lands',
  'make an action in the workspace',
  'see it on Today',
  'get help',
  'complete it',
  'resume on this device',
  'take it with you',
  'resume on a second device',
];

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

const browser = await chromium.launch({
  ...(existsSync(CHROME) ? { executablePath: CHROME } : {}),
  args: ['--no-sandbox'],
});
const scratch = mkdtempSync(join(tmpdir(), 'golden-path-'));
const findings = [];
const notes = [];
let walked = 0;

/** A named failure, so the output says which step and what was seen. */
class Finding extends Error {}
function expect(ok, message) {
  if (!ok) throw new Finding(message);
}

/** A fresh context: what a new browser profile, or a new device, starts as. */
async function device(viewport, errors) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', acceptDownloads: true });
  context.on('page', (page) => page.on('pageerror', (e) => errors.push(String(e).split('\n')[0])));
  const page = await context.newPage();
  return { context, page };
}

/** Move by address, the way the app routes (`lib/route.ts`), and wait for the screen. */
async function go(page, hash, heading) {
  await page.evaluate((h) => { location.hash = h; }, hash);
  await page.locator('h1', { hasText: heading }).first().waitFor({ state: 'visible', timeout: WAIT });
}

async function visible(locator) {
  try {
    await locator.first().waitFor({ state: 'visible', timeout: WAIT });
    return true;
  } catch {
    return false;
  }
}

async function journey(label, viewport) {
  const errors = [];
  const title = `Golden path check-in (${label})`;
  const done = new RegExp(`^Mark ${title.replace(/[()]/g, '\\$&')} not done$`);
  const open = new RegExp(`^Mark ${title.replace(/[()]/g, '\\$&')} done$`);
  const first = await device(viewport, errors);
  let second;
  let backup = '';
  let step = '';
  let reached = 0;
  const at = (name) => {
    step = name;
    reached += 1;
  };

  try {
    const { page } = first;

    // ── 1 · Arrive cold, and the account step ──────────────────────────────
    at(STEPS[0]);
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    expect(await visible(page.getByText('Your syllabi. One brain.')), 'a fresh profile did not open on the adoption prompt');
    await page.getByRole('button', { name: /^show me$/i }).click();
    expect(await visible(page.getByText(/^step 2 of 5$/i)), 'Show me did not move to step 2');
    await page.getByRole('button', { name: /^good$/i }).click();
    expect(await visible(page.getByText('When and where do you study?')), 'Good did not move to step 3');
    await page.getByRole('button', { name: /^next$/i }).click();
    expect(await visible(page.getByText(/^step 4 of 5$/i)), 'Next did not reach the account step');
    const offline = await page.getByText('This one stays on the device.').count();
    if (offline) {
      notes.push(`${label}: this build has no account service; the first run said so`);
      await page.getByRole('button', { name: /^next$/i }).click();
    } else {
      expect(await visible(page.getByText('One semester, every device.')), 'the account step drew neither the device-only notice nor the sign-up');
      expect(await visible(page.getByRole('textbox', { name: /email/i })), 'the sign-up has no email field');
      expect(await visible(page.getByLabel(/password/i)), 'the sign-up has no password field');
      expect(await visible(page.getByRole('button', { name: /^create the account$/i })), 'the sign-up has no way to create the account');
      expect(await visible(page.getByRole('button', { name: /^i already have one$/i })), 'the sign-up has no way to sign in to an existing account');
      notes.push(`${label}: sign-up offered and declined with Not now — no credentials entered`);
      await page.getByRole('button', { name: /^not now$/i }).click();
    }
    expect(await visible(page.getByText(/^step 5 of 5$/i)), 'the account step did not move on to the last step');

    // ── 2 · Where a first run lands, then Today ────────────────────────────
    at(STEPS[1]);
    await page.getByRole('button', { name: /^add your first course$/i }).click();
    expect(await visible(page.locator('h1', { hasText: 'New course' })), 'the first run did not end on the import screen');
    expect(page.url().includes('#/import'), `the first run ended at ${page.url()}, not #/import`);
    await go(page, '#/home', 'Today');

    // ── 3 · Make something of the student's own ────────────────────────────
    at(STEPS[2]);
    await go(page, '#/mine', 'Personal');
    expect(await visible(page.getByText('Nothing of your own yet.')), 'a brand-new profile already has actions of its own');
    await page.getByRole('button', { name: /new action/i }).click();
    await page.getByRole('textbox', { name: /^action$/i }).fill(title);
    await page.getByRole('button', { name: /^add action$/i }).click();
    expect(await visible(page.getByRole('button', { name: open })), 'the new action is not on Personal as something to tick');

    // ── 4 · …and it is on Today, as the student's next thing ───────────────
    at(STEPS[3]);
    await go(page, '#/home', 'Today');
    expect(await visible(page.locator('main').getByText(title, { exact: true })), 'Today does not show the action just made');

    // ── 5 · Help ───────────────────────────────────────────────────────────
    at(STEPS[4]);
    await go(page, '#/help', 'Guide');
    const wrong = page.getByRole('button', { name: /^when things go wrong/i });
    expect(await visible(wrong), 'the Guide has no "When things go wrong" chapter');
    await wrong.click();
    expect((await wrong.getAttribute('aria-expanded')) === 'true', 'the "When things go wrong" chapter did not open');
    expect(await visible(page.getByText('Two devices disagree')), 'the troubleshooting chapter opened with nothing in it');
    await go(page, '#/support', 'Support');
    const crisis = page.locator('main a[href^="tel:"]');
    expect(await visible(crisis), 'Support drew no telephone line to call');

    // ── 6 · Complete it ────────────────────────────────────────────────────
    at(STEPS[5]);
    await go(page, '#/mine', 'Personal');
    await page.getByRole('button', { name: open }).click();
    expect(await visible(page.getByRole('button', { name: done })), 'ticking the action did not mark it done');
    const struck = await page
      .getByRole('button', { name: new RegExp(`^Edit ${title.replace(/[()]/g, '\\$&')}$`) })
      .locator('span')
      .first()
      .evaluate((el) => getComputedStyle(el).textDecorationLine);
    expect(struck.includes('line-through'), `the done action is not struck through (text-decoration: ${struck})`);

    // ── 7 · Resume here: a reload, then a second tab ───────────────────────
    at(STEPS[6]);
    await page.reload({ waitUntil: 'domcontentloaded' });
    expect(await visible(page.locator('h1', { hasText: 'Personal' })), 'a reload did not come back to Personal');
    expect(await visible(page.getByRole('button', { name: done })), 'after a reload the action is gone or no longer done');
    const tab = await first.context.newPage();
    await tab.goto(`${BASE}#/mine`, { waitUntil: 'domcontentloaded' });
    expect(await visible(tab.locator('h1', { hasText: 'Personal' })), 'a second tab showed the first run again instead of the app');
    expect(await visible(tab.getByRole('button', { name: done })), 'a second tab does not have the action, done');
    await tab.close();

    // ── 8 · Take it with you ───────────────────────────────────────────────
    at(STEPS[7]);
    await go(page, '#/export', 'Take it with you');
    for (const part of ['Courses', 'Deadlines', 'Calendar', 'Notes', 'Your own actions']) {
      await page.getByRole('button', { name: `Leave out ${part}`, exact: true }).click();
    }
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: WAIT }),
      page.getByRole('button', { name: /^download as separate files$/i }).click(),
    ]);
    const name = download.suggestedFilename();
    expect(/-backup\.json$/.test(name), `the only file ticked downloaded as "${name}", not a backup`);
    backup = join(scratch, `${label}-${name}`);
    await download.saveAs(backup);
    const written = JSON.parse(readFileSync(backup, 'utf8'));
    const carried = (written.tasks || []).find((t) => t.title === title);
    expect(written.format === 'semester.backup.v1', `the backup says it is "${written.format}"`);
    expect(carried?.done === true, 'the backup file does not carry the action as done');

    // ── 9 · A second device: fresh context, restore through the picker ─────
    at(STEPS[8]);
    second = await device(viewport, errors);
    const other = second.page;
    await other.goto(BASE, { waitUntil: 'domcontentloaded' });
    expect(await visible(other.getByText('Your syllabi. One brain.')), 'the second device did not start as a fresh profile');
    await other.getByRole('button', { name: /^skip$/i }).first().click();
    await go(other, '#/mine', 'Personal');
    // The control: without it, a context that leaked state from the first
    // would pass every check below without the restore doing anything.
    expect(await other.getByRole('button', { name: done }).count() === 0, 'the second device had the action before anything was restored');
    await go(other, '#/export', 'Take it with you');
    const [chooser] = await Promise.all([
      other.waitForEvent('filechooser', { timeout: WAIT }),
      other.getByText('Restore from a backup file').click(),
    ]);
    await chooser.setFiles(backup);
    expect(await visible(other.getByText(/^ready to restore$/i)), 'choosing the backup did not offer a restore');
    await other.getByRole('button', { name: /^replace and restore$/i }).click();
    expect(await visible(other.getByText('Everything in the file is in place.')), 'the restore did not say it finished');
    await go(other, '#/mine', 'Personal');
    expect(await visible(other.getByRole('button', { name: done })), 'after the restore the second device does not have the action, done');

    if (errors.length) throw new Finding(`page errors: ${[...new Set(errors)].join(' | ')}`);
    walked += 1;
  } catch (error) {
    const message = error instanceof Finding ? error.message : `could not run: ${String(error).split('\n')[0]}`;
    findings.push(`${label} · ${step}: ${message}`);
  } finally {
    await first.context.close();
    if (second) await second.context.close();
  }
  return reached;
}

try {
  for (const [label, viewport] of VIEWPORTS) {
    const reached = await journey(label, viewport);
    console.log(`${label}: reached ${reached}/${STEPS.length} steps`);
  }
} finally {
  await browser.close();
  rmSync(scratch, { recursive: true, force: true });
}

for (const note of notes) console.log(`note · ${note}`);
if (findings.length) {
  console.error(`golden path failed ${findings.length} time(s):\n${findings.map((item) => `- ${item}`).join('\n')}`);
  process.exit(1);
}
if (walked !== VIEWPORTS.length) {
  console.error(`golden path walked ${walked}/${VIEWPORTS.length} journeys`);
  process.exit(2);
}
console.log(
  `golden path ok — ${STEPS.length} steps at ${VIEWPORTS.map(([l]) => l).join(' and ')}: ` +
    'first run, Today, an action made, help, completion, resume after reload and in a second tab, ' +
    'and restored from its backup file into a fresh context. Account-synced resume is not exercised.',
);
