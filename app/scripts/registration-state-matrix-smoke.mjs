/*
 * Registration route state matrix against a production bundle.
 *
 * The account service is a synthetic project under the app's already
 * allowlisted Supabase domain. Playwright intercepts every request, so this
 * proves the assembled route and its real client parsing without contacting an institution or
 * claiming an SIS connection. The seven cases are the FC-14 contract:
 * ready, loading, empty, error, forbidden, offline and stale.
 */
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.SMOKE_URL || 'http://localhost:4177/').replace(/\/?$/, '/');
const CHROME = process.env.SMOKE_CHROME || '/opt/pw-browsers/chromium';
const WAIT = Number(process.env.SMOKE_WAIT || 15_000);
const FIXTURE_ORIGIN = 'https://semester-state-matrix.supabase.co';
const source = readFileSync(join(here, '..', 'src', 'lib', 'migrate.ts'), 'utf8');
const version = Number(/export const SCHEMA = (\d+)/.exec(source)?.[1]);
if (!Number.isInteger(version)) throw new Error('no SCHEMA in lib/migrate.ts — its shape changed');

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

const user = {
  id: 'student-1', aud: 'authenticated', role: 'authenticated', email: 'student@example.edu',
  app_metadata: { provider: 'email' }, user_metadata: {}, identities: [],
  created_at: '2026-10-01T00:00:00.000Z',
};
const jwtPart = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
// HS256 deliberately makes auth-js validate the session through the intercepted
// `/auth/v1/user` boundary instead of trying a public-key lookup. No real
// service ever receives or verifies this fixture-only token.
const token = `${jwtPart({ alg: 'HS256', typ: 'JWT' })}.${jwtPart({
  sub: user.id,
  aud: 'authenticated',
  role: 'authenticated',
  iss: `${FIXTURE_ORIGIN}/auth/v1`,
  exp: 4_102_444_800,
})}.fixture`;
const session = {
  access_token: token,
  refresh_token: 'fixture-refresh-token',
  token_type: 'bearer',
  expires_in: 3_600,
  expires_at: 4_102_444_800,
  user,
};

const term = {
  term: '2027SP', opens_at: '2026-10-01T12:00:00.000Z',
  add_drop_ends_at: '2099-01-15T12:00:00.000Z', withdraw_ends_at: '2099-03-15T12:00:00.000Z',
  max_credits: 18,
};
const section = {
  id: 'section-econ', term: term.term, course_code: 'ECON 1020', section: '01',
  title: 'Principles of Economics', credits: 3, capacity: 30, waitlist_capacity: 5,
  seats_taken: 12, waiting: 0, meetings: [{ days: [1, 3], start: 540, end: 590 }],
  prerequisites: [], requires_approval: false, version: 3,
};

const scenarios = [
  { id: 'ready', signedIn: true },
  { id: 'loading', signedIn: true, slowSections: true },
  { id: 'empty', signedIn: true, emptyTerms: true },
  { id: 'error', signedIn: true, failTerms: true },
  { id: 'forbidden', signedIn: true, flagOff: true },
  { id: 'offline', signedIn: true, offline: true },
  { id: 'stale', signedIn: true, staleWrite: true },
];

const browser = await chromium.launch({
  ...(existsSync(CHROME) ? { executablePath: CHROME } : {}),
  args: ['--no-sandbox'],
});

const json = (route, value, status = 200) => route.fulfill({
  status,
  contentType: 'application/json',
  headers: { 'access-control-allow-origin': '*' },
  body: JSON.stringify(value),
});

async function fixture(route, scenario) {
  const request = route.request();
  const url = new URL(request.url());
  if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
  if (url.origin !== FIXTURE_ORIGIN) return route.abort('blockedbyclient');
  if (url.pathname === '/auth/v1/user') {
    return scenario.signedIn ? json(route, user) : json(route, { message: 'not signed in' }, 401);
  }
  if (!url.pathname.startsWith('/rest/v1/')) return json(route, { message: 'unexpected fixture request' }, 404);

  const resource = url.pathname.slice('/rest/v1/'.length);
  if (resource === 'rpc/feature_state') return json(route, scenario.flagOff ? 'off' : 'production');
  if (resource === 'rpc/feature_narrowing') return json(route, []);
  if (resource === 'rpc/my_capabilities') return json(route, []);
  if (resource === 'rpc/my_registration') return json(route, []);
  if (resource === 'rpc/my_registration_hold') return json(route, [{ held: false, office: '', link: '' }]);
  if (resource === 'rpc/registration_enroll') {
    return json(route, scenario.staleWrite ? {
      ok: false, outcome: 'refused', reason: 'stale_seat_count',
      message: 'The seats changed.', replayed: false, promoted: 0,
      wait_position: null, seats_taken: 13, capacity: 30, hold: null,
    } : {
      ok: true, outcome: 'enrolled', reason: 'ok', message: 'Enrolled.', replayed: false,
      promoted: 0, wait_position: null, seats_taken: 13, capacity: 30, hold: null,
    });
  }
  if (resource === 'profiles') return json(route, [{ school_id: 'vu' }]);
  if (resource === 'feature_kill_switch') return json(route, []);
  if (resource === 'registration_terms') {
    if (scenario.failTerms) return json(route, { message: 'simulated registration calendar failure', code: 'XX000' }, 503);
    return json(route, scenario.emptyTerms ? [] : [term]);
  }
  if (resource === 'registration_sections') {
    if (scenario.slowSections) await new Promise((resolve) => setTimeout(resolve, 10_000));
    return json(route, [section]);
  }
  return json(route, []);
}

const results = [];
try {
  for (const scenario of scenarios) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await context.route(`${FIXTURE_ORIGIN}/**`, (route) => fixture(route, scenario));
    await context.addInitScript(([schemaVersion, authSession]) => {
      localStorage.setItem('semester.v1', JSON.stringify({
        schemaVersion, nav: 'tabs', role: 'student', seenOnboarding: true, registered: true,
      }));
      if (authSession) localStorage.setItem('semester.auth', JSON.stringify(authSession));
    }, [version, scenario.signedIn ? session : null]);

    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(String(error).split('\n')[0]));
    try {
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.locator('main').waitFor({ timeout: WAIT });
      if (scenario.offline) {
        // Fetch the lazy route once, leave it, then lose the connection. This
        // verifies the route's own offline gate rather than the shell's honest
        // "this screen has not been downloaded" boundary.
        await page.evaluate(() => { location.hash = '#/registration'; });
        await page.getByText('Sections this term', { exact: true }).waitFor({ timeout: WAIT });
        await page.evaluate(() => { location.hash = '#/today'; });
        await page.waitForURL(/#\/today$/);
        await context.setOffline(true);
      }
      await page.evaluate(() => { location.hash = '#/registration'; });

      if (scenario.id === 'ready') {
        await page.getByText('Sections this term', { exact: true }).waitFor({ timeout: WAIT });
        await page.getByRole('button', { name: 'Review ECON 1020 01' }).waitFor({ timeout: WAIT });
      } else if (scenario.id === 'loading') {
        await page.getByRole('status').filter({ hasText: 'Loading your registration for 2027SP' }).waitFor({ timeout: WAIT });
      } else if (scenario.id === 'empty') {
        await page.getByText('No registration term yet', { exact: true }).waitFor({ timeout: WAIT });
      } else if (scenario.id === 'error') {
        await page.getByRole('alert').filter({ hasText: 'Simulated registration calendar failure.' }).waitFor({ timeout: WAIT });
      } else if (scenario.id === 'forbidden') {
        await page.getByText(/Your school has not turned on registration in Semester/).waitFor({ timeout: WAIT });
      } else if (scenario.id === 'offline') {
        await page.getByRole('status').filter({ hasText: 'You are offline. Registration needs a connection' }).waitFor({ timeout: WAIT });
      } else if (scenario.id === 'stale') {
        await page.getByRole('button', { name: 'Review ECON 1020 01' }).click();
        await page.getByRole('button', { name: 'Confirm enrollment' }).click();
        await page.getByRole('alert').filter({ hasText: 'The seats in ECON 1020 01 changed while you were looking.' }).waitFor({ timeout: WAIT });
      }
      if (pageErrors.length) throw new Error(`page errors: ${pageErrors.join('; ')}`);
      results.push(scenario.id);
    } catch (error) {
      console.error(`registration ${scenario.id} state failed: ${String(error)}`);
      console.error(`at ${page.url()}\n${(await page.locator('body').innerText().catch(() => '')).slice(0, 1_500)}`);
      process.exitCode = 1;
      break;
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

if (!process.exitCode) {
  const expected = scenarios.map((scenario) => scenario.id);
  if (results.join('|') !== expected.join('|')) {
    console.error(`registration state matrix incomplete: ${results.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log(`registration state matrix ok — ${results.join(', ')}`);
  }
}
