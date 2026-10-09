/*
 * One student, one account, two devices: the part of the golden path that
 * `golden-path.mjs` says in as many words it does not prove.
 *
 * `docs/GO-NO-GO-CHECKLIST.md` holds `golden-path` at PARTIAL on one line —
 * "the journey never signs in, so resuming on a second device through an
 * account is unproved". The golden path could not sign in because the only
 * account service a build was ever pointed at was the live one, and making
 * throwaway accounts in production from CI is pollution, not a test.
 *
 * This runs against a **local** Supabase instead — `supabase start` from this
 * repository's own `supabase/` directory, every migration applied from zero,
 * real GoTrue and real PostgREST in front of a real Postgres with the real
 * row-level security. Nothing is mocked: the app signs up, signs in and syncs
 * through the same `lib/cloud.ts` a student's copy runs.
 *
 * ## The journey
 *
 *   1. **Sign up on the first device**, in the first run's own account step —
 *      the form a new student sees, not the Account screen — and land where a
 *      first run lands.
 *   2. **Make an action and finish it** on Personal.
 *   3. **Wait for the server to hold it.** Not for the app to *say* "Synced":
 *      the script asks PostgREST for the account's `state` row with the
 *      student's own token, so what it reads is exactly what a second device
 *      would be given, row-level security included.
 *   4. **Open a second device.** A fresh browser context — no storage, no
 *      cookies — first checked to *not* have the action, so what follows is
 *      the account carrying it and not a leak between contexts.
 *   5. **Sign in there**, through `#/login`, and see the action — still done.
 *   6. **And back the other way.** The second device makes an action of its
 *      own; the server holds it; the first device, reloaded, shows it.
 *   7. **Export the account** from the second device and inspect the exact
 *      JSON blob the download helper hands to the browser for both actions.
 *   8. **Delete the account** through the Privacy screen, observe the Edge
 *      Function's complete-erasure receipt, prove the old session no longer
 *      identifies a user, and prove its access JWT cannot recreate protected
 *      application state through PostgREST.
 *
 * Both viewports, each with its own account, and any uncaught page error is a
 * finding, as in the golden path.
 *
 * ## What it bypasses, and why that is not the thing under test
 *
 * The contexts run with `bypassCSP`. A local Supabase answers on
 * `http://127.0.0.1:54321`, and `vite.config.ts` (`cspExtraConnect`) admits
 * only https origins to `connect-src` — deliberately, because an http origin
 * in a deployed build is a bug. So without the bypass the page's own policy
 * refuses every request this script exists to make. The policy is the
 * subject of `cold-smoke.mjs` and the header tests; this is about the account.
 *
 * ## It will not touch a live project
 *
 * The sign-up form reads `auth/v1/settings` as soon as it draws. The script
 * watches for that request and refuses to type anything unless it went to a
 * loopback address — so a build accidentally configured for production exits
 * 2 before a single account is made.
 *
 * ## Running it
 *
 *   supabase start                     # from the repository root
 *   cd app
 *   VITE_SUPABASE_URL=http://127.0.0.1:54321 \
 *   VITE_SUPABASE_KEY="$(supabase status -o json | jq -r .PUBLISHABLE_KEY)" \
 *     npx vite build --outDir /tmp/sync-dist
 *   npx vite preview --outDir /tmp/sync-dist --port 4174 &
 *   SMOKE_SUPABASE_SERVICE_KEY="$(supabase status -o json | jq -er '.SECRET_KEY // .SERVICE_ROLE_KEY')" \
 *     SMOKE_URL=http://localhost:4174/ SMOKE_PLAYWRIGHT=… npm run smoke:sync
 *
 * Exit 0 only when every step at both viewports was walked and passed. Exit 1
 * on a finding, and 2 when the instrument itself could not run — never 0 for
 * a run that measured nothing.
 */
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { ProofUnavailable, proveDeletedAccountAbsent, tryDeletedAccountStateWrite } from './account-sync-proof.mjs';

const BASE = (process.env.SMOKE_URL || 'http://localhost:4174/').replace(/\/?$/, '/');
const CHROME = process.env.SMOKE_CHROME || '/opt/pw-browsers/chromium';
const LOCAL_SERVICE_KEY = process.env.SMOKE_SUPABASE_SERVICE_KEY || '';
/** How long a single expectation may take to come true. */
const WAIT = Number(process.env.SMOKE_WAIT || 15_000);
/**
 * How long the server may take to hold a change. A push waits for edits to
 * settle (`PUSH_SETTLE_MS`, 2.5 s, in `lib/syncstatus.ts`) and then makes a
 * round trip; ten times that is generous without hiding a push that never
 * happens.
 */
const SETTLE = Number(process.env.SMOKE_SYNC_WAIT || 25_000);

const VIEWPORTS = [
  ['phone', { width: 390, height: 844 }],
  ['desktop', { width: 1280, height: 900 }],
];

/** Every step, in order. A run that did not reach all of them is not clean. */
const STEPS = [
  'sign up in the first run',
  'make an action and finish it',
  'the server holds it',
  'a second device starts without it',
  'sign in on the second device and see it done',
  'the second device adds one',
  'the server holds that too',
  'the first device, reloaded, shows it',
  'download the account export and inspect it',
  'delete the account and invalidate the old session',
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
if (!LOCAL_SERVICE_KEY) {
  console.error('Set SMOKE_SUPABASE_SERVICE_KEY to the ephemeral service key printed by the local Supabase stack.');
  process.exit(2);
}

const browser = await chromium.launch({
  ...(existsSync(CHROME) ? { executablePath: CHROME } : {}),
  args: ['--no-sandbox'],
});
const findings = [];
const notes = [];
let walked = 0;

/** A named failure, so the output says which step and what was seen. */
class Finding extends Error {}
/** The instrument could not run — exit 2, not 1. */
class Unrunnable extends Error {}
function expect(ok, message) {
  if (!ok) throw new Finding(message);
}

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);

/**
 * A fresh context: what a new browser profile, or a new device, starts as.
 *
 * It records where the account service is and the public key the build sends
 * it, both read off the first `auth/v1/settings` request the page makes —
 * so the script needs no configuration of its own to agree with the build.
 */
async function device(viewport, errors) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', bypassCSP: true });
  const service = { origin: '', key: '' };
  context.on('page', (page) => page.on('pageerror', (e) => errors.push(String(e).split('\n')[0])));
  context.on('request', (request) => {
    const url = new URL(request.url());
    if (!service.origin && url.pathname.endsWith('/auth/v1/settings')) {
      service.origin = url.origin;
      service.key = request.headers()['apikey'] ?? '';
    }
  });
  const page = await context.newPage();
  return { context, page, service };
}

/** Refuse to type credentials into anything but a local account service. */
async function local(service) {
  const until = Date.now() + WAIT;
  while (!service.origin && Date.now() < until) await new Promise((r) => setTimeout(r, 100));
  if (!service.origin) throw new Unrunnable('the sign-up form never asked an account service for its settings');
  const host = new URL(service.origin).hostname;
  if (!LOOPBACK.has(host) && host !== '::1') {
    throw new Unrunnable(`this build talks to ${service.origin}, not a local Supabase — refusing to make accounts there`);
  }
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
 * The Privacy screen's section headings are buttons too: `FoldHead` gives a
 * heading the same accessible name as the action it introduces. Select the
 * product's primary block control before asserting uniqueness, so the check
 * distinguishes "open this section" from "perform this account action".
 *
 * Keep the exact-one assertion. If the action is ever rendered twice, the
 * failure includes enough DOM state to tell a duplicate control from a
 * hidden transition copy without weakening the journey to `.first()`.
 */
async function primaryAction(page, name, missing) {
  const action = page
    .locator('button.btn.btn-block')
    .filter({ hasText: name })
    .filter({ visible: true });
  // `go()` can see the shell's route heading before this lazy screen's chunk
  // has replaced the Suspense fallback. Locator counts are immediate, so wait
  // for the control itself before deciding whether it is absent or duplicated.
  await action.first().waitFor({ state: 'visible', timeout: WAIT }).catch(() => {});
  const count = await action.count();
  if (count !== 1) {
    const seen = await page.getByRole('button', { name }).evaluateAll((buttons) =>
      buttons.map((button) => {
        const style = getComputedStyle(button);
        const box = button.getBoundingClientRect();
        return {
          className: button.className,
          expanded: button.getAttribute('aria-expanded'),
          display: style.display,
          visibility: style.visibility,
          width: Math.round(box.width),
          height: Math.round(box.height),
        };
      }),
    );
    throw new Finding(`${missing} (found ${count} visible primary controls; named buttons: ${JSON.stringify(seen)})`);
  }
  return action;
}

/**
 * Whether the account's `state` row on the server mentions `text`, read with
 * the signed-in student's own token (`storageKey: 'semester.auth'` in
 * `lib/cloud.ts`), so row-level security decides what comes back exactly as
 * it would for another device.
 */
async function held(page, service, text) {
  const until = Date.now() + SETTLE;
  while (Date.now() < until) {
    const found = await page.evaluate(
      async ({ origin, key, text }) => {
        const session = JSON.parse(localStorage.getItem('semester.auth') || 'null');
        const token = session?.access_token;
        if (!token) return false;
        const response = await fetch(`${origin}/rest/v1/state?select=data`, {
          headers: { apikey: key, Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return false;
        return JSON.stringify(await response.json()).includes(text);
      },
      { ...service, text },
    );
    if (found) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

/** The server holds the named personal action and its completed tick, not merely an earlier open copy. */
async function heldDone(page, service, title) {
  const until = Date.now() + SETTLE;
  while (Date.now() < until) {
    const found = await page.evaluate(
      async ({ origin, key, title }) => {
        const session = JSON.parse(localStorage.getItem('semester.auth') || 'null');
        const token = session?.access_token;
        if (!token) return false;
        const response = await fetch(`${origin}/rest/v1/state?select=data`, {
          headers: { apikey: key, Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return false;
        const rows = await response.json();
        const data = rows?.[0]?.data;
        const task = data?.tasks?.find((candidate) => candidate?.title === title);
        return Boolean(task?.id && data?.done?.[task.id]);
      },
      { ...service, title },
    );
    if (found) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function addAction(page, title) {
  await page.getByRole('button', { name: /new action/i }).click();
  await page.getByRole('textbox', { name: /^action$/i }).fill(title);
  await page.getByRole('button', { name: /^add action$/i }).click();
}

async function journey(label, viewport) {
  const errors = [];
  const stamp = `${Date.now().toString(36)}${randomBytes(3).toString('hex')}`;
  const email = `sync-${label}-${stamp}@example.test`;
  const password = randomBytes(12).toString('base64url');
  const title = `Account sync check-in ${label} ${stamp}`;
  const reply = `Second device reply ${label} ${stamp}`;
  const open = (t) => new RegExp(`^Mark ${escape(t)} done$`);
  const done = (t) => new RegExp(`^Mark ${escape(t)} not done$`);
  const first = await device(viewport, errors);
  let second;
  let step = '';
  let reached = 0;
  const at = (name) => {
    step = name;
    reached += 1;
  };

  try {
    const { page } = first;

    // ── 1 · Sign up where a new student is offered it ──────────────────────
    at(STEPS[0]);
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    expect(await visible(page.getByText('Your syllabi. One brain.')), 'a fresh profile did not open on the adoption prompt');
    await page.getByRole('button', { name: /^show me$/i }).click();
    await page.getByRole('button', { name: /^good$/i }).click();
    await page.getByRole('button', { name: /^next$/i }).click();
    expect(await visible(page.getByText(/^step 4 of 5$/i)), 'the first run did not reach the account step');
    expect(
      (await page.getByText('This one stays on the device.').count()) === 0,
      'this build has no account service configured — build it with VITE_SUPABASE_URL and VITE_SUPABASE_KEY',
    );
    await page.getByRole('textbox', { name: /email/i }).fill(email);
    await local(first.service);
    await page.getByLabel(/password/i).fill(password);
    // An adult: the form asks for a date of birth and refuses under 13 (D-139).
    await page.getByLabel(/date of birth/i).fill('2000-01-01');
    await page.getByRole('button', { name: /^create the account$/i }).click();
    const made = await visible(page.getByText(/^step 5 of 5$/i));
    if (!made) {
      const said = (await page.getByRole('alert').allTextContents()).join(' ').trim()
        || (await page.getByRole('status').allTextContents()).join(' ').trim();
      expect(false, `creating the account did not move the first run on${said ? ` — the form said: ${said}` : ''}`);
    }
    await page.getByRole('button', { name: /^add your first course$/i }).click();
    expect(await visible(page.locator('h1', { hasText: 'New course' })), 'the first run did not end on the import screen');

    // ── 2 · Something of the student's own, finished ───────────────────────
    at(STEPS[1]);
    await go(page, '#/mine', 'Personal');
    await addAction(page, title);
    expect(await visible(page.getByRole('button', { name: open(title) })), 'the new action is not on Personal as something to tick');
    await page.getByRole('button', { name: open(title) }).click();
    expect(await visible(page.getByRole('button', { name: done(title) })), 'ticking the action did not mark it done');

    // ── 3 · The server has it — read the way another device would ──────────
    at(STEPS[2]);
    expect(await heldDone(page, first.service, title), `the account's state row did not hold the finished action within ${SETTLE / 1000}s`);

    // ── 4 · A second device, checked empty first ───────────────────────────
    at(STEPS[3]);
    second = await device(viewport, errors);
    const other = second.page;
    await other.goto(BASE, { waitUntil: 'domcontentloaded' });
    expect(await visible(other.getByText('Your syllabi. One brain.')), 'the second device did not open on the adoption prompt');
    await other.getByRole('button', { name: /^skip$/i }).first().click();
    await go(other, '#/mine', 'Personal');
    expect(
      (await other.getByText(title, { exact: true }).count()) === 0,
      'a fresh second context already had the action before signing in — the contexts are not separate',
    );

    // ── 5 · Sign in there, and the action arrives, still done ──────────────
    at(STEPS[4]);
    await other.evaluate(() => { location.hash = '#/login'; });
    expect(await visible(other.getByRole('textbox', { name: /email/i })), '#/login drew no email field');
    await other.getByRole('textbox', { name: /email/i }).fill(email);
    await local(second.service);
    await other.getByLabel(/password/i).fill(password);
    await other.getByRole('button', { name: /^sign in$/i }).click();
    // A device that has been through the first run is not empty, so the app
    // may ask which copy to keep (`lib/adopt.ts`). "Keep both" is the option
    // `components/Adopting.tsx` preselects as the one where nothing is lost,
    // and it is the one that still has to bring the account's copy across —
    // the other two would pass this step by discarding a side. Its confirm
    // button is named exactly that; the options' names carry their blurbs.
    const ask = other.getByRole('dialog', { name: 'Which copy to keep' });
    // The phone viewport can still be reconciling its first local copy after
    // sign-in when the shell reports success. Give the adoption decision the
    // same bounded window as the sync it controls instead of racing it with a
    // five-second probe and then asserting against the pre-adoption copy.
    if (await visible(ask, SETTLE)) {
      notes.push(`${label}: the second device asked which copy to keep; kept both`);
      // Prove the compact viewport can reach the real control. Playwright's
      // normal click waits for the button to be visible, stable, enabled and
      // unobstructed; bypassing those checks would let a mobile UI regression
      // pass even though a student could not make the adoption choice.
      const keepBoth = ask.getByRole('button', { name: /^keep both$/i });
      await keepBoth.scrollIntoViewIfNeeded({ timeout: WAIT });
      await keepBoth.click({ timeout: SETTLE });
      await ask.waitFor({ state: 'hidden', timeout: WAIT });
    }
    expect(await visible(other.getByText('Signed in', { exact: true })), 'signing in on the second device did not reach "Signed in"');
    await go(other, '#/mine', 'Personal');
    expect(await visible(other.getByRole('button', { name: done(title) }), SETTLE), 'the second device, signed in, does not show the action as done');

    // ── 6 · …and back: the second device adds one ──────────────────────────
    at(STEPS[5]);
    await addAction(other, reply);
    expect(await visible(other.getByRole('button', { name: open(reply) })), 'the second device could not add an action of its own');

    at(STEPS[6]);
    expect(await held(other, second.service, reply), `the account's state row did not hold the second device's action within ${SETTLE / 1000}s`);
    expect(await held(other, second.service, title), 'the second device\'s push dropped the first device\'s action from the account');

    // ── 7 · The first device, reloaded, has both ───────────────────────────
    at(STEPS[7]);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await go(page, '#/mine', 'Personal');
    expect(await visible(page.getByRole('button', { name: open(reply) }), SETTLE), 'the first device, reloaded, does not show the second device\'s action');
    expect(await visible(page.getByRole('button', { name: done(title) })), 'the first device lost its own finished action after the reload');

    // ── 8 · The account export contains what both devices made ────────────
    at(STEPS[8]);
    await go(other, '#/privacy', 'Privacy');
    // Capture the exact Blob passed to URL.createObjectURL. Waiting for a
    // native browser `download` event is fragile here: the button changes its
    // accessible name while its asynchronous RPC is in flight, and a pending
    // Playwright event promise can reject before the click action settles.
    // The product path is still exercised end to end — Privacy calls the real
    // RPC, `download()` creates the Blob and clicks its anchor — while the
    // verifier reads the payload before browser/OS download handling can make
    // the test runner's filesystem part of the result.
    await other.evaluate(() => {
      const original = URL.createObjectURL.bind(URL);
      Object.defineProperty(window, '__semesterExportCapture', {
        configurable: true,
        value: { blob: null, original },
      });
      URL.createObjectURL = (blob) => {
        window.__semesterExportCapture.blob = blob;
        return original(blob);
      };
    });
    const exportButton = await primaryAction(
      other,
      /^download my account data$/i,
      'the Privacy screen did not expose exactly one visible account export action',
    );
    await exportButton.click();
    expect(await visible(other.getByText(/saved .* with rows from/i)), 'the Privacy screen did not confirm the account export');
    const exported = await other.evaluate(async (timeout) => {
      const capture = window.__semesterExportCapture;
      const until = Date.now() + timeout;
      while (!capture?.blob && Date.now() < until) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      const body = capture?.blob ? await capture.blob.text() : '';
      if (capture?.original) URL.createObjectURL = capture.original;
      delete window.__semesterExportCapture;
      return body;
    }, WAIT);
    expect(Boolean(exported), 'the account export produced no readable JSON blob');
    let exportFile;
    try {
      exportFile = JSON.parse(exported);
    } catch {
      throw new Finding('the account export was not valid JSON; refusing to continue to deletion');
    }
    const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    expect(isRecord(exportFile), 'the account export was not a JSON object');
    expect(exportFile.format === 'semester.account-export', 'the account export had the wrong format');
    expect(exportFile.version === 1, 'the account export had an unsupported version');
    expect(isRecord(exportFile.account), 'the account export had no account record');
    expect(exportFile.account.email === email, 'the account export did not identify the account it belongs to');
    expect(isRecord(exportFile.tables), 'the account export had no table map');
    expect(Array.isArray(exportFile.withheld), 'the account export did not describe withheld records');
    const stateRows = exportFile.tables.state;
    expect(Array.isArray(stateRows) && stateRows.length === 1, 'the account export did not contain exactly one state row');
    const stateRow = stateRows[0];
    expect(isRecord(stateRow), 'the exported state row was not an object');
    expect(typeof stateRow.user_id === 'string' && stateRow.user_id.length > 0, 'the exported state row had no owner');
    expect(isRecord(stateRow.data), 'the exported state row had no structured data');
    const stateData = JSON.stringify(stateRow.data);
    expect(stateData.includes(title), 'the exported state row did not contain the first device action');
    expect(stateData.includes(reply), 'the exported state row did not contain the second device action');

    // ── 9 · Complete server-side deletion and local sign-out ──────────────
    at(STEPS[9]);
    const oldSession = await other.evaluate(() => JSON.parse(localStorage.getItem('semester.auth') || 'null'));
    expect(Boolean(oldSession?.access_token), 'the signed-in device had no session before deletion');
    expect(Boolean(oldSession?.user?.id), 'the signed-in device had no user identity before deletion');
    const deleteButton = await primaryAction(
      other,
      /^delete my account$/i,
      'the Privacy screen did not expose exactly one visible account deletion action',
    );
    await deleteButton.click();
    const deletion = other.getByRole('dialog', { name: 'Delete your account' });
    expect(await visible(deletion), 'the destructive account confirmation did not open');
    await deletion.getByRole('textbox').fill('DELETE');
    const receiptReady = other.waitForResponse(
      (response) => response.request().method() === 'POST' && new URL(response.url()).pathname.endsWith('/functions/v1/delete-account'),
      { timeout: WAIT },
    );
    await deletion.getByRole('button', { name: /^delete it$/i }).click();
    const receipt = await receiptReady;
    const receiptBody = await receipt.json().catch(() => ({}));
    expect(receipt.ok(), `the delete-account function answered ${receipt.status()}`);
    expect(receiptBody?.erased === true, 'the delete-account receipt did not confirm data erasure');
    expect(receiptBody?.signInRemoved === true, 'the delete-account receipt did not confirm sign-in removal');
    expect(await visible(other.getByText(/you are signed out/i)), 'the Privacy screen did not confirm local sign-out');
    const staleSession = await other.evaluate(async ({ origin, key, token }) => {
      const response = await fetch(`${origin}/auth/v1/user`, {
        headers: { apikey: key, Authorization: `Bearer ${token}` },
      });
      return { ok: response.ok, status: response.status };
    }, { ...second.service, token: oldSession.access_token });
    expect(!staleSession.ok && staleSession.status >= 400, 'the deleted account\'s old session still identifies a user');
    let staleApplicationWrite;
    let privilegedAbsence;
    try {
      staleApplicationWrite = await tryDeletedAccountStateWrite({
        origin: second.service.origin,
        publicKey: second.service.key,
        staleToken: oldSession.access_token,
        userId: oldSession.user.id,
      });
      privilegedAbsence = await proveDeletedAccountAbsent({
        origin: second.service.origin,
        serviceKey: LOCAL_SERVICE_KEY,
        userId: oldSession.user.id,
      });
    } catch (error) {
      if (error instanceof ProofUnavailable) throw new Unrunnable(error.message);
      throw error;
    }
    expect(
      staleApplicationWrite.denied,
      `the deleted account's old access token recreated protected application state (status ${staleApplicationWrite.status})`,
    );
    expect(privilegedAbsence.authUserAbsent, 'the deleted account is still present in the local auth service');
    expect(privilegedAbsence.stateAbsent, 'the deleted account still has a protected application state row');

    walked += 1;
  } catch (error) {
    if (error instanceof Unrunnable) throw error;
    const what = error instanceof Finding ? error.message : String(error).split('\n')[0];
    findings.push(`${label} · ${step}: ${what}`);
  } finally {
    if (reached < STEPS.length && !findings.some((f) => f.startsWith(`${label} ·`))) {
      findings.push(`${label}: stopped at step ${reached} of ${STEPS.length} (${step})`);
    }
    for (const e of errors) findings.push(`${label}: uncaught page error — ${e}`);
    await first.context.close();
    await second?.context.close();
  }
}

try {
  for (const [label, viewport] of VIEWPORTS) await journey(label, viewport);
} catch (error) {
  await browser.close();
  console.error(`Could not run: ${error.message}`);
  process.exit(2);
}
await browser.close();

for (const note of notes) console.log(`  · ${note}`);
if (findings.length) {
  console.log(`\n✗ Account sync: ${findings.length} finding(s)`);
  for (const f of findings) console.log(`  - ${f}`);
  process.exit(1);
}
if (walked !== VIEWPORTS.length) {
  console.error(`Walked ${walked} of ${VIEWPORTS.length} journeys, with no finding to say why.`);
  process.exit(2);
}
console.log(`\n✓ Account sync: ${STEPS.length} steps at ${VIEWPORTS.length} viewports, one account each, two devices each`);
