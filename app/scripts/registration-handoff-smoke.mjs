/*
 * Seeded registration-readiness journey against the production bundle.
 *
 * This proves a student's prepared plan, explicit confirmation before opening
 * the institution's registration system, and a durable device-local report.
 * It does not call an SIS, submit enrollment, verify a seat, or promote the
 * student's report to an institutional record. The destination is intercepted
 * locally so CI sends no external request.
 */
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.SMOKE_URL || 'http://localhost:4173/').replace(/\/?$/, '/');
const CHROME = process.env.SMOKE_CHROME || '/opt/pw-browsers/chromium';
const WAIT = Number(process.env.SMOKE_WAIT || 15_000);
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

const registration = {
  catalog: {
    institution: 'Example University',
    importedAt: '2026-10-10T12:00:00.000Z',
    courses: [
      {
        id: 'cs-101-01', code: 'CS 101', section: '01', title: 'Programming', term: 'Spring 2027',
        department: 'CS', credits: 3, instructor: '', location: 'Engineering 101', description: '',
        prerequisites: '', seats: 10, crn: '55012', meetings: [{ days: [1, 3], start: 540, end: 590 }],
      },
      {
        id: 'cs-101-02', code: 'CS 101', section: '02', title: 'Programming', term: 'Spring 2027',
        department: 'CS', credits: 3, instructor: '', location: 'Engineering 102', description: '',
        prerequisites: '', seats: 8, crn: '55013', meetings: [{ days: [2, 4], start: 540, end: 615 }],
      },
    ],
  },
  cart: ['cs-101-01'],
  plans: [],
};

const registrationDay = {
  opensAt: '2027-04-01T12:00', source: 'student_entered', backups: { 'cs-101-01': ['cs-101-02'] },
  checks: ['holds', 'advisor', 'prereqs', 'portal', 'copied'], creditTarget: 3, minCredits: null,
  maxCredits: null, studyHours: null, portalUrl: 'https://register.example.edu/', remind: true,
  manual: false, handoff: null,
};

const browser = await chromium.launch({
  ...(existsSync(CHROME) ? { executablePath: CHROME } : {}),
  args: ['--no-sandbox'],
});
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
await context.route('https://register.example.edu/**', (route) => route.fulfill({
  status: 200,
  contentType: 'text/html',
  body: '<!doctype html><title>Example University registration</title><h1>Official registration system</h1>',
}));
await context.addInitScript(
  ([schemaVersion, plan, day]) => {
    if (!localStorage.getItem('semester.v1')) {
      localStorage.setItem('semester.v1', JSON.stringify({ schemaVersion, nav: 'tabs', role: 'student' }));
    }
    if (!localStorage.getItem('semester.registration.v1')) {
      localStorage.setItem('semester.registration.v1', JSON.stringify(plan));
    }
    if (!localStorage.getItem('semester.registration-day.v1')) {
      localStorage.setItem('semester.registration-day.v1', JSON.stringify(day));
    }
  },
  [version, registration, registrationDay],
);

const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(String(error).split('\n')[0]));

try {
  await page.goto(`${BASE}#/yes`, { waitUntil: 'domcontentloaded' });
  const skip = page.getByRole('button', { name: /^skip$/i });
  await skip.waitFor({ state: 'visible', timeout: WAIT });
  await skip.click();
  await page.evaluate(() => { location.hash = '#/yes'; });
  const tab = page.getByRole('tab', { name: 'Registration day' });
  await tab.waitFor({ state: 'visible', timeout: WAIT });
  await tab.click();
  const readiness = await page.locator('.portal-stats[aria-label="Registration readiness"]').innerText();
  if (!readiness.includes('8/8')) throw new Error(`the seeded plan was not complete: ${readiness}`);
  await page.getByRole('button', { name: 'Open official registration system' }).click();

  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ timeout: WAIT });
  const confirmation = await dialog.innerText();
  const shownDestination = ((await dialog.locator('.dialog-url').textContent()) ?? '').trim();
  if (!/You are leaving Semester/i.test(confirmation) || new URL(shownDestination).origin !== new URL(registrationDay.portalUrl).origin) {
    throw new Error('the handoff confirmation did not identify its boundary and destination');
  }

  const popupPromise = page.waitForEvent('popup', { timeout: WAIT });
  await dialog.getByRole('button', { name: 'Open in a new tab' }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded');
  if (new URL(popup.url()).origin !== 'https://register.example.edu') {
    throw new Error(`the handoff opened an unexpected origin: ${popup.url()}`);
  }
  await popup.close();

  const standing = page.getByLabel('Where your registration stands');
  await standing.selectOption('submitted');
  await page.getByText(/You marked this “Submitted”/).waitFor({ timeout: WAIT });
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('semester.registration-day.v1') || 'null'));
  if (stored?.handoff?.status !== 'submitted') throw new Error('the student report was not saved');
  if (Object.keys(stored.handoff).sort().join('|') !== 'destination|history|status|updatedAt') {
    throw new Error('the handoff stored more than destination, status, and timestamps');
  }

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('tab', { name: 'Registration day' }).click();
  await page.getByLabel('Where your registration stands').waitFor({ timeout: WAIT });
  if (await page.getByLabel('Where your registration stands').inputValue() !== 'submitted') {
    throw new Error('the student report did not survive reload');
  }
  if (pageErrors.length) throw new Error(`page errors: ${pageErrors.join('; ')}`);
  console.log('registration handoff ok — prepared plan, confirmed destination, durable student report');
} catch (error) {
  console.error(`registration handoff failed: ${String(error)}`);
  console.error(`at ${page.url()}\n${(await page.locator('body').innerText().catch(() => '')).slice(0, 1_500)}`);
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}
