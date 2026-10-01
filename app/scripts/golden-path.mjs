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
 *      import screen (`doneScreen` in `state/slices/navigate.ts`).
 *   3. **Add a course from its syllabus**, right there: pasted, built, the
 *      review's dates checked and approved, saved, and both dates listed on
 *      the course. The one model request in it is answered by a stub — see
 *      "The syllabus" above `journey` for exactly what that does and does not
 *      prove. Then Today.
 *   4. **Make something in the workspace.** An action of the student's own on
 *      Personal (`#/mine`), through "+ New action" and "Add action", and the
 *      same action shown on Today as the next thing of theirs.
 *   5. **Plan.** The calendar (`#/calendar`) marks the course's first deadline
 *      on its day, and double-clicking that day adds something to it.
 *   6. **Path.** My Path (`#/degree`): the path details saved, and the Path
 *      Snapshot rewritten to show them — still saying it is not an audit.
 *   7. **A deadline's own page.** From the course's Assignments, the first
 *      deadline's page (`#/item/<id>`): the syllabus sentence it was read
 *      from, verbatim; Source & details, saying who can see it; and "Work for
 *      this" to file work against it.
 *   8. **Get help.** The Guide (`#/help`): its "When things go wrong" chapter
 *      opens and says what to do when two devices disagree. "Describe the
 *      problem" names whose question it is. With `VITE_HUMAN_HELP` on, "Ask …"
 *      opens the request to a person and shows exactly what would be sent,
 *      carrying the question; signed out, the screen says sending needs sign-in
 *      and offers nothing that sends — and nothing is pressed that would. CI
 *      walks it both ways. Then Support (`#/support`): a working `tel:` line.
 *   9. **Finish it.** The action's tick box, and the row reading back as done
 *      — named "Mark … not done" and struck through.
 *  10. **Resume.** The same browser reloaded, then a second tab of it: the
 *      action is still there and still done, and the first run is not shown
 *      again.
 *  11. **Take it with you**, then **resume on a second device.** See the next section, which is the part
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
/**
 * Set by the CI run against a build with `VITE_HUMAN_HELP` on, so that run
 * fails if the request to a person never appears — rather than passing by
 * taking the branch a build without it takes.
 */
const EXPECT_HUMAN_HELP = process.env.SMOKE_EXPECT_HUMAN_HELP === '1';
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
  'add a course from its syllabus',
  'make an action in the workspace',
  'see it on Today',
  'plan: the deadline on the calendar, and something added there',
  'path: record the degree',
  'open a deadline\'s own page, with where it came from',
  'get help, and find whose question it is',
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

async function visible(locator, timeout = WAIT) {
  try {
    await locator.first().waitFor({ state: 'visible', timeout });
    return true;
  } catch {
    return false;
  }
}

/**
 * Wait for a completed action to be on this device's disk, not merely painted.
 *
 * The normal path is the `tasks` IndexedDB store. A browser that refused the
 * database uses the older `semester.v1` localStorage copy, so the probe accepts
 * that honest fallback too. This is a test-side acknowledgement only: it does
 * not reach into React state, call the writer, or make an unsaved edit pass.
 */
async function taskIsDurable(page, title) {
  return page.evaluate(
    async ({ wanted, timeout }) => {
      const local = () => {
        try {
          const state = JSON.parse(localStorage.getItem('semester.v1') || 'null');
          return Array.isArray(state?.tasks) && state.tasks.some((task) => task?.title === wanted && task?.done === true);
        } catch {
          return false;
        }
      };
      if (local()) return true;

      const database = await Promise.race([
        new Promise((resolve) => {
          const request = indexedDB.open('semester-store');
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(null);
          request.onblocked = () => resolve(null);
        }),
        new Promise((resolve) => setTimeout(() => resolve(null), Math.min(timeout, 3_000))),
      ]);
      if (!database || !database.objectStoreNames.contains('tasks')) return false;

      const read = () => new Promise((resolve) => {
        const request = database.transaction('tasks', 'readonly').objectStore('tasks').getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve([]);
      });
      const until = Date.now() + timeout;
      try {
        while (Date.now() < until) {
          const tasks = await read();
          if (tasks.some((task) => task?.title === wanted && task?.done === true)) return true;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        return false;
      } finally {
        database.close();
      }
    },
    { wanted: title, timeout: WAIT },
  );
}

// ── The syllabus, and the one part of adding it that is not the app's ──────
//
// Turning a syllabus into a course is a model call (`generateCourse` in
// `lib/generate.ts`, through `ask` in `lib/claude.ts`) — there is no local
// parser that finds deadlines. CI has no model and should not spend on one,
// so that single request is answered here. Everything either side of it is
// the app's own: taking the pasted text, sending it, streaming the reply,
// `validate` checking every quote against the text the student gave, the
// review with its approval box, and the save.
//
// The answer is not free to be anything. The stub refuses (500) unless the
// request carries the syllabus the student pasted — its title and every
// sentence the reply will quote as a deadline — and its reply quotes that
// syllabus verbatim — so `validate` keeps the quotes rather than stripping
// them as invented. What this does not prove is that a real model reads a
// real syllabus well; that is a question for an evaluation, not a journey.
//
// Dates are this month's, so the deadline is on the calendar Plan opens to.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];
const CODE = 'GOLD 101';

function syllabus() {
  const now = new Date();
  const month = now.getMonth();
  const last = new Date(now.getFullYear(), month + 1, 0).getDate();
  const first = Math.min(now.getDate() + 2, last);
  const second = Math.min(first + 5, last);
  const due = [
    { title: 'Problem Set 1', day: first, time: '11:59 PM', kind: 'Problem set',
      quote: `Problem Set 1 is due ${MONTHS[month]} ${first} at 11:59 PM.` },
    { title: 'Project proposal', day: second, time: '5:00 PM', kind: 'Project',
      quote: `The project proposal is due ${MONTHS[month]} ${second} at 5:00 PM.` },
  ];
  const text = [
    `${CODE}: Walking the Golden Path`,
    'Instructor: Dr. Ada Example. Office hours by appointment.',
    'Meets Tuesdays and Thursdays, 10:00 to 11:15 in the morning.',
    '',
    'This course follows one student through a first week: reading a syllabus,',
    'planning the work it sets, and keeping track of what is finished. There',
    'are no prerequisites. Bring the syllabus of another course you are taking.',
    '',
    'Grading: problem sets 40%, final project 60%.',
    '',
    'Schedule',
    ...due.map((d) => d.quote),
  ].join('\n');
  const reply = {
    course: {
      id: 'gold', code: CODE, name: 'Walking the Golden Path', prof: 'Dr. Ada Example',
      email: '', meets: 'TR · 10:00–11:15a', room: '', credits: '', lms: '',
      grading: [{ what: 'Problem sets', pct: '40%' }, { what: 'Final project', pct: '60%' }],
    },
    attendance: { allowed: 0, penaltyPer: 0, worth: 0, note: '' },
    schedule: [],
    items: due.map((d, n) => ({
      id: `gold-${n + 1}`, c: 'gold', kind: d.kind, title: d.title, month, day: d.day,
      dueTime: d.time, where: '', weight: '', detail: '', quote: d.quote,
    })),
    guide: {
      code: CODE, name: 'Walking the Golden Path', blurb: 'One student, one first week.',
      source: '', mastery: 0, audio: false,
      units: [{ name: '1 · The first week', mastery: 0, cards: [
        { q: 'What is due first in GOLD 101?', a: due[0].quote },
      ] }],
      terms: [{ t: 'Golden path', d: 'The one journey every student takes first.' }],
      selfTest: [{ q: 'When is the project proposal due?', a: due[1].quote }],
    },
  };
  // What the request must carry before the stub answers it: the title, and
  // every sentence the reply quotes as a deadline.
  const needed = [`${CODE}: Walking the Golden Path`, ...due.map((d) => d.quote)];
  return { text, reply, month, first, due, needed };
}

/** Anthropic's streamed Messages reply, carrying `text` as one delta. */
function streamed(text) {
  const events = [
    ['message_start', { type: 'message_start', message: { id: 'msg_golden_path', type: 'message',
      role: 'assistant', model: 'golden-path-stub', content: [], stop_reason: null,
      usage: { input_tokens: 1, output_tokens: 1 } } }],
    ['content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }],
    ['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } }],
    ['content_block_stop', { type: 'content_block_stop', index: 0 }],
    ['message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 1 } }],
    ['message_stop', { type: 'message_stop' }],
  ];
  return events.map(([name, data]) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`).join('');
}

/**
 * Answer every model request this context makes — whichever route the build
 * takes (`route()` in `lib/assistant.ts`: a proxy's `/v1/messages`, the API's
 * own, or the shared Edge Function) — and count what was asked.
 */
async function stubModel(context, course) {
  const asked = { calls: 0, withSyllabus: 0, missing: [] };
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
  };
  await context.route(
    (url) => /\/v1\/messages$/.test(url.pathname) || /\/functions\/v1\/claude/.test(url.pathname),
    async (route) => {
      const request = route.request();
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      asked.calls += 1;
      // Every sentence the reply will quote, not only the title: a request
      // that carried the heading and lost the schedule must not be answered
      // with the deadlines it never sent (found by review on #978, and shown:
      // with the pasted text cut to 60 characters, a title-only check passed).
      const body = request.postData() ?? '';
      const missing = course.needed.filter((line) => !body.includes(line));
      if (missing.length) {
        asked.missing = missing;
        return route.fulfill({ status: 500, headers: cors, contentType: 'application/json',
          body: JSON.stringify({ error: { message: `the golden-path stub was sent a request without: ${missing.join(' | ')}` } }) });
      }
      asked.withSyllabus += 1;
      return route.fulfill({ status: 200, headers: cors, contentType: 'text/event-stream',
        body: streamed(JSON.stringify(course.reply)) });
    },
  );
  return asked;
}

async function journey(label, viewport) {
  const errors = [];
  const title = `Golden path check-in (${label})`;
  const done = new RegExp(`^Mark ${title.replace(/[()]/g, '\\$&')} not done$`);
  const open = new RegExp(`^Mark ${title.replace(/[()]/g, '\\$&')} done$`);
  const first = await device(viewport, errors);
  const course = syllabus();
  const asked = await stubModel(first.context, course);
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

    // ── 3 · A course from its syllabus, where the first run left the student ─
    at(STEPS[2]);
    const paste = async () => {
      await page.getByRole('button', { name: /paste the syllabus in as text/i }).click();
      await page.getByLabel('Paste the syllabus').fill(course.text);
      await page.getByRole('button', { name: /^take this text$/i }).click();
    };
    await paste();
    const buildIt = page.getByRole('button', { name: /^build the course from \d+ words$/i });
    if (!(await visible(buildIt, 5_000))) {
      // A build with no model configured says so and offers the one door out.
      // A student's own key is that door; this one is never sent anywhere,
      // because the stub above answers the request it would authorise.
      const setUp = page.getByRole('button', { name: /^set up the assistant$/i });
      expect(await visible(setUp), 'the import screen offered neither a build button nor a way to set up the assistant');
      notes.push(`${label}: no model configured in this build; set a placeholder key the stub answers for`);
      await setUp.click();
      await page.getByLabel('API key').fill('sk-ant-golden-path-placeholder');
      await page.getByRole('button', { name: /^save on this device$/i }).click();
      await go(page, '#/import', 'New course');
      await paste();
    }
    expect(await visible(buildIt), 'the pasted syllabus did not offer to build the course');
    await buildIt.click();
    const approve = page.getByRole('checkbox', { name: /i checked the course information/i });
    expect(
      await visible(approve, 30_000),
      asked.missing.length
        ? `the model request did not carry the syllabus it is answered from — missing: ${asked.missing.join(' | ')}`
        : 'building the course did not reach the review',
    );
    expect(asked.withSyllabus === 1, `the model was asked ${asked.calls} time(s), ${asked.withSyllabus} with the pasted syllabus`);
    const fields = await page.locator('input, textarea').evaluateAll((els) => els.map((e) => e.value));
    const shown = await page.locator('body').innerText();
    for (const d of course.due) {
      expect(fields.includes(d.title) || shown.includes(d.title), `the review does not list "${d.title}"`);
    }
    await approve.check();
    await page.getByRole('button', { name: new RegExp(`^Add ${CODE} — ${course.due.length} dates$`) }).click();
    expect(await visible(page.locator('h1', { hasText: CODE })), `saving the course did not open ${CODE}`);
    expect(page.url().includes('#/course/'), `saving the course landed at ${page.url()}, not the course`);
    const courseAt = new URL(page.url()).hash;
    // The overview shows only what is next; the tab lists every date taken.
    await page.getByRole('tab', { name: 'Assignments', exact: true }).click();
    for (const d of course.due) {
      expect(await visible(page.locator('main').getByText(d.title, { exact: true })), `${CODE}'s assignments do not list "${d.title}"`);
    }
    await go(page, '#/home', 'Today');
    // First use must fetch the deferred capture chunk and focus its real field.
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('q');
    const quick = page.getByRole('dialog', { name: 'Add something quickly' });
    expect(await visible(quick), 'first-use Quick Add did not load');
    const quickField = quick.getByRole('textbox', { name: 'What to add' });
    await quickField.fill('Read a chapter tomorrow');
    expect(await quickField.inputValue() === 'Read a chapter tomorrow', 'deferred Quick Add field is not usable');
    await page.keyboard.press('Escape');
    await quick.waitFor({ state: 'hidden' });

    // ── 3 · Make something of the student's own ────────────────────────────
    at(STEPS[3]);
    await go(page, '#/mine', 'Personal');
    expect(await visible(page.getByText('Nothing of your own yet.')), 'a brand-new profile already has actions of its own');
    await page.getByRole('button', { name: /new action/i }).click();
    await page.getByRole('textbox', { name: /^action$/i }).fill(title);
    await page.getByRole('button', { name: /^add action$/i }).click();
    expect(await visible(page.getByRole('button', { name: open })), 'the new action is not on Personal as something to tick');

    // ── 4 · …and it is on Today, as the student's next thing ───────────────
    at(STEPS[4]);
    await go(page, '#/home', 'Today');
    expect(await visible(page.locator('main').getByText(title, { exact: true })), 'Today does not show the action just made');

    // ── 6 · Plan: the course's deadline is on its day, and a day takes more ─
    at(STEPS[5]);
    await go(page, '#/calendar', 'Calendar');
    const day = page.getByRole('gridcell', {
      name: new RegExp(`^\\w+ ${course.first} ${MONTHS[course.month]}\\..*\\b\\d+ deadlines?\\b`),
    });
    expect(await visible(day), `the calendar does not show a deadline on ${MONTHS[course.month]} ${course.first}`);
    await day.first().click();
    await day.first().waitFor({ state: 'visible', timeout: WAIT });
    expect(await day.first().getAttribute('aria-selected') === 'true', 'the deadline day did not become selected');
    // The phone grid can replace the selected cell between Playwright's two
    // synthetic pointer clicks even after selection has settled. Dispatch the
    // browser's native bubbling event on the acknowledged selected cell so
    // this gate exercises the application's real double-click handler without
    // depending on the node surviving two separate automation clicks.
    await day.first().dispatchEvent('dblclick');
    const what = page.getByRole('textbox', { name: /^what is on /i });
    expect(await visible(what), 'double-clicking the day did not offer to add something there');
    await what.fill(`Study group for ${CODE}`);
    await page.getByRole('button', { name: /^add it$/i }).click();
    expect(await visible(page.getByText(/^Added to /)), 'adding to the day did not say it was added');

    // ── 7 · Path: what the degree needs, recorded ──────────────────────────
    at(STEPS[6]);
    await go(page, '#/degree', 'The degree');
    const card = page.locator('section[aria-labelledby="path-snapshot-title"]');
    const year = String(new Date().getFullYear() + 3);
    await card.getByText(/add your path details/i).click();
    await card.getByLabel(/programme or major/i).fill('Economics BA');
    await card.getByLabel('Graduation season').selectOption('Spring');
    await card.getByLabel('Graduation year').fill(year);
    await card.getByRole('button', { name: /save path details/i }).click();
    // The form closes on save, taking its "Saved on this device." with it;
    // what stays is the card rewritten and the door to edit what was saved.
    expect(await visible(card.getByRole('button', { name: /^edit your path details$/i })), 'saving the path details did not close the form into its saved state');
    const snapshot = await card.innerText();
    expect(/Economics BA/.test(snapshot) && snapshot.includes(`Spring ${year}`), 'the Path Snapshot does not show the path just saved');
    expect(/not an official degree audit/i.test(snapshot), 'the Path Snapshot no longer says it is not an official audit');

    // ── 8 · A deadline's own page, and where it came from ──────────────────
    //
    // Step 6 of GOLDEN-PATH-TEST-SCRIPT.md is "a source-linked Assignment or
    // Study workspace". The AI Toolkit's workspace is behind build flags a
    // production build leaves off, and is not tied to any deadline; the page
    // every student has is the deadline's own (`ItemDetail`, `#/item/<id>`):
    // the syllabus's sentence it was read from, its Source & details, and
    // "Work for this" to file work against it.
    at(STEPS[7]);
    const firstDue = course.due[0];
    await page.evaluate((h) => { location.hash = h; }, courseAt);
    await page.getByRole('tab', { name: 'Assignments', exact: true }).click();
    await page.getByRole('button', { name: new RegExp(`^(?!Mark ).*${firstDue.title}`) }).first().click();
    // The header names the kind ("Problem set", `headers.ts`); the title is
    // the page's own.
    expect(await visible(page.locator('h1', { hasText: firstDue.kind })), `opening "${firstDue.title}" did not reach a ${firstDue.kind} page`);
    expect(page.url().includes('#/item/'), `"${firstDue.title}" opened at ${page.url()}, not its own page`);
    expect(await visible(page.locator('main').getByText(firstDue.title, { exact: true })), `the page opened is not "${firstDue.title}"'s`);
    expect(await visible(page.getByText('Straight from the syllabus')), 'the deadline page does not say where it came from');
    expect(await visible(page.locator('main').getByText(firstDue.quote, { exact: true })), 'the deadline page does not quote the syllabus sentence it was read from');
    await page.getByRole('button', { name: /^source & details$/i }).first().click();
    const details = page.getByRole('dialog', { name: 'Source & details' });
    expect(await visible(details), 'Source & details did not open');
    expect(/only you/i.test(await details.innerText()), 'Source & details does not say who can see this');
    await page.keyboard.press('Escape');
    await details.waitFor({ state: 'hidden', timeout: WAIT });
    expect(await visible(page.getByText('Work for this')), 'the deadline page has no place to file work against it');

    // ── 9 · Help ───────────────────────────────────────────────────────────
    at(STEPS[8]);
    await go(page, '#/help', 'Guide');
    const wrong = page.getByRole('button', { name: /^when things go wrong/i });
    expect(await visible(wrong), 'the Guide has no "When things go wrong" chapter');
    await wrong.click();
    expect((await wrong.getAttribute('aria-expanded')) === 'true', 'the "When things go wrong" chapter did not open');
    expect(await visible(page.getByText('Two devices disagree')), 'the troubleshooting chapter opened with nothing in it');

    // Whose question it is. Every build has this: the problem in the
    // student's words, and the office that owns it (`NoWrongDoor.tsx`).
    const problem = page.getByRole('region', { name: 'Describe the problem' });
    await problem.getByLabel('What is going on').fill(`I do not understand how ${firstDue.title} in ${CODE} will be graded.`);
    await problem.getByRole('button', { name: /^find the right door$/i }).click();
    const door = problem.getByRole('status');
    expect(await visible(door), '"Find the right door" gave no answer');
    const answer = await door.first().innerText();
    expect(/ owns this\.|every door, so none is wrong/i.test(answer), `"Find the right door" named no owner: ${answer.slice(0, 120)}`);

    // And, in a build with human help on (`VITE_HUMAN_HELP`), the request to
    // that person: what would be sent, shown before anything is. Signed out,
    // there is nothing to press that sends — the script checks exactly that
    // and never looks for a send button to press.
    const ask = problem.getByRole('button', { name: /^ask /i });
    if (await ask.count()) {
      await ask.first().click();
      const question = page.getByLabel('Your question');
      expect(await visible(question), '"Ask" did not open the request to a person');
      // A live region headed "Exactly what will be sent" (`GetHelp.tsx`).
      const sent = page.locator('[aria-live="polite"]', { has: page.getByText('Exactly what will be sent', { exact: true }) });
      expect(await visible(sent), 'the request to a person does not show what will be sent');
      expect((await sent.innerText()).includes(firstDue.title), 'what will be sent does not carry the question the student wrote');
      expect(await visible(page.getByText(/sign in with your university account to send this/i)), 'a signed-out request did not say it needs sign-in to send');
      expect(
        (await page.getByRole('button', { name: /^(review and send|yes, send to )/i }).count()) === 0,
        'a signed-out student was offered a way to send',
      );
      notes.push(`${label}: human help is on in this build; the request preview was checked, nothing sent`);
    } else {
      expect(!EXPECT_HUMAN_HELP, 'this build was meant to have human help on, and "Find the right door" offered no way to ask a person');
      notes.push(`${label}: human help is off in this build (VITE_HUMAN_HELP); the right door was found, no request to preview`);
    }
    await go(page, '#/support', 'Support');
    const crisis = page.locator('main a[href^="tel:"]');
    expect(await visible(crisis), 'Support drew no telephone line to call');

    // ── 6 · Complete it ────────────────────────────────────────────────────
    at(STEPS[9]);
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
    //
    // The database writer deliberately coalesces edits for a quarter second.
    // Reloading in the same browser turn as the click raced that contract: the
    // new button had painted, but the persistence effect had not necessarily
    // queued the write yet. That made this check alternate between passing
    // and losing the action on otherwise identical CI runs.
    //
    // `taskIsDurable` is the acknowledgement rather than an arbitrary sleep.
    // It reads the same object store a reload will read and waits for the exact
    // completed action. Only then do the reload and independent tab prove they
    // can reconstruct the state the first tab wrote.
    at(STEPS[10]);
    expect(await taskIsDurable(page, title), 'the completed action did not reach device storage');
    await page.reload({ waitUntil: 'domcontentloaded' });
    expect(await visible(page.locator('h1', { hasText: 'Personal' })), 'a reload did not come back to Personal');
    expect(await visible(page.getByRole('button', { name: done })), 'after a reload the action is gone or no longer done');
    const tab = await first.context.newPage();
    await tab.goto(`${BASE}#/mine`, { waitUntil: 'domcontentloaded' });
    expect(await visible(tab.locator('h1', { hasText: 'Personal' })), 'a second tab showed the first run again instead of the app');
    expect(await visible(tab.getByRole('button', { name: done })), 'a second tab does not have the action, done');
    await tab.close();

    // ── 8 · Take it with you ───────────────────────────────────────────────
    at(STEPS[11]);
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
    at(STEPS[12]);
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
    'first run, a course added from its syllabus, Today, an action made, Plan, Path, a deadline\'s own page, ' +
    'help and the right door, completion, ' +
    'resume after reload and in a second tab, and restored from its backup file into a fresh context. ' +
    'Account-synced resume is account-sync.mjs.',
);
