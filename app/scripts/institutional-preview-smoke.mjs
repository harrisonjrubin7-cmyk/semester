#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, '..');
const host = '127.0.0.1';
const port = Number(process.env.INSTITUTIONAL_SMOKE_PORT || 4180);
const base = `http://${host}:${port}/`;
const vite = join(appRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const expectedPreview = process.env.EXPECT_INSTITUTIONAL_PREVIEW !== 'false';

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  console.error('INSTITUTIONAL_SMOKE_PORT must be an integer from 1 to 65535');
  process.exit(2);
}

let chromium;
try {
  if (process.env.SMOKE_PLAYWRIGHT) {
    ({ chromium } = createRequire(import.meta.url)(process.env.SMOKE_PLAYWRIGHT));
  } else {
    ({ chromium } = await import('playwright'));
  }
} catch (error) {
  console.error(
    'Playwright is required for the institutional browser smoke. Install it in a scratch directory\n' +
    'and set SMOKE_PLAYWRIGHT to that package, following docs/institutional-rollout/local-preview.md.\n' +
    String(error).slice(0, 200),
  );
  process.exit(2);
}

const server = spawn(process.execPath, [vite, 'preview', '--host', host, '--port', String(port), '--strictPort'], {
  cwd: appRoot,
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverOutput = '';
server.stdout.on('data', (chunk) => { serverOutput += chunk; });
server.stderr.on('data', (chunk) => { serverOutput += chunk; });

async function waitForServer() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`preview server exited early\n${serverOutput}`);
    try {
      const response = await fetch(base);
      if (response.ok) return;
    } catch {
      // The process is still starting.
    }
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error(`preview server did not answer ${base}\n${serverOutput}`);
}

const schemaSource = readFileSync(join(appRoot, 'src', 'lib', 'migrate.ts'), 'utf8');
const schemaMatch = /export const SCHEMA = (\d+)/.exec(schemaSource);
if (!schemaMatch) throw new Error('could not read the current storage schema');
const schemaVersion = Number(schemaMatch[1]);

const cases = [
  { hash: '#/home', width: 1440, height: 1000, expected: 'Today', module: 'Synthetic Flight Plan' },
  { hash: '#/calendar', width: 390, height: 844, expected: 'Calendar', module: 'Study plan' },
  { hash: '#/study', width: 1440, height: 1000, expected: 'Study', module: 'Sample learning evidence' },
  { hash: '#/behind', width: 390, height: 844, expected: 'When you are behind', module: 'Sample Flight Plan recovery' },
  { hash: '#/university', width: 1440, height: 1000, expected: 'University', module: 'Student workspace' },
  { hash: '#/mail', width: 390, height: 844, expected: 'Email' },
  { hash: '#/search', width: 1440, height: 1000, expected: 'Search' },
];

const roleWorkspaces = [
  ['student', 'Student workspace', 'Plan my work'],
  ['faculty', 'Faculty workspace', 'Prepare assignment drafts'],
  ['teaching-assistant', 'Teaching-assistant workspace', 'Prepare office-hours support'],
  ['advisor', 'Advisor workspace', 'Prepare advising follow-up'],
  ['campus-staff', 'Student-success workspace', 'Prepare student support'],
  ['university-admin', 'Administrator workspace', 'Review audit readiness'],
  ['moderator', 'Community moderation workspace', 'Escalate a sample case'],
  ['employer', 'Employer workspace', 'Plan recruiting follow-up'],
  ['applicant', 'Applicant workspace', 'Track my application preparation'],
  ['authorized-payer', 'Authorized payer workspace', 'Prepare a payment handoff'],
  ['authorized-family', 'Authorized-family workspace', 'Prepare student-approved questions'],
  ['alumni', 'Alumni workspace', 'Prepare a mentorship profile'],
];

const chromeCandidates = [
  process.env.SMOKE_CHROME,
  '/opt/pw-browsers/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
].filter(Boolean);
const executablePath = chromeCandidates.find((candidate) => existsSync(candidate));

let browser;
const findings = [];
try {
  await waitForServer();
  browser = await chromium.launch({
    ...(executablePath ? { executablePath } : {}),
    args: ['--no-sandbox'],
  });

  for (const probe of cases) {
    const context = await browser.newContext({ viewport: { width: probe.width, height: probe.height } });
    try {
      await context.addInitScript(
        ([version]) => {
          localStorage.setItem(
            'semester.v1',
            JSON.stringify({ schemaVersion: version, sample: true, seenOnboarding: true, nav: 'tabs' }),
          );
        },
        [schemaVersion],
      );
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(`console: ${message.text()}`);
      });

      await page.goto(`${base}${probe.hash}`, { waitUntil: 'domcontentloaded' });
      await page.locator('main#main').waitFor({ state: 'visible', timeout: 10_000 });
      if (expectedPreview) {
        await page.locator('nav[aria-label="Primary"]').waitFor({ state: 'visible', timeout: 10_000 });
        await page.getByText('Synthetic preview', { exact: false }).first().waitFor({ state: 'visible' });
        if (probe.module) await page.getByText(probe.module, { exact: false }).first().waitFor({ state: 'visible' });
        const workspace = page.locator('details.institutional-workspace-disclosure');
        await workspace.locator('summary').click();
        await workspace.locator('[aria-label="Current journey"]').waitFor({ state: 'visible' });
      }

      const result = await page.evaluate(() => ({
        hash: location.hash,
        text: document.body.innerText,
        roots: document.querySelectorAll('[data-semester-root]').length,
        mains: document.querySelectorAll('main').length,
        headings: document.querySelectorAll('h1').length,
        primaryCount: document.querySelectorAll('nav[aria-label="Primary"]').length,
        flightKeys: Object.keys(localStorage).filter((key) => key.startsWith('semester.flight-plan.')),
        primary: [...document.querySelectorAll('nav[aria-label="Primary"] button')]
          .map((button) => button.textContent?.trim()),
      }));
      const expectedPrimary = ['Home', 'Calendar', 'Discover', 'Ask Semester', 'Inbox'];
      if (result.hash !== probe.hash) findings.push(`${probe.hash}: rewrote route to ${result.hash}`);
      if (expectedPreview && !result.text.includes(probe.expected)) findings.push(`${probe.hash}: did not draw ${probe.expected}`);
      if (result.roots !== 1) findings.push(`${probe.hash}: drew ${result.roots} Semester roots`);
      if (result.mains !== 1) findings.push(`${probe.hash}: drew ${result.mains} main landmarks`);
      if (result.headings !== 1) findings.push(`${probe.hash}: drew ${result.headings} page headings`);
      if (expectedPreview && result.primaryCount !== 1) findings.push(`${probe.hash}: drew ${result.primaryCount} global navigations`);
      if (expectedPreview && JSON.stringify(result.primary) !== JSON.stringify(expectedPrimary)) {
        findings.push(`${probe.hash}: primary navigation was ${JSON.stringify(result.primary)}`);
      }
      if (!expectedPreview && result.text.includes('Synthetic preview')) findings.push(`${probe.hash}: preview bar rendered with flag off`);
      if (!expectedPreview && result.text.includes('Synthetic Flight Plan')) findings.push(`${probe.hash}: Flight Plan rendered with flag off`);
      if (!expectedPreview && result.flightKeys.length) findings.push(`${probe.hash}: preview storage initialized with flag off`);
      await page.keyboard.press('Tab');
      if (await page.evaluate(() => document.activeElement === document.body)) findings.push(`${probe.hash}: keyboard focus stayed on body`);
      for (const error of errors) findings.push(`${probe.hash}: ${error}`);
      console.log(`PASS ${probe.hash} ${probe.width}x${probe.height} root=${result.roots} main=${result.mains}`);
    } finally {
      await context.close();
    }
  }

  if (expectedPreview) {
    const compactContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    try {
      await compactContext.addInitScript(
        ([version]) => localStorage.setItem('semester.v1', JSON.stringify({ schemaVersion: version, sample: true, seenOnboarding: true, nav: 'workspace' })),
        [schemaVersion],
      );
      const page = await compactContext.newPage();
      await page.goto(`${base}#/home`, { waitUntil: 'domcontentloaded' });
      await page.locator('main#main').waitFor({ state: 'visible', timeout: 10_000 });
      const chrome = await page.evaluate(() => {
        const height = (selector) => Math.round(document.querySelector(selector)?.getBoundingClientRect().height ?? 0);
        const mainTop = Math.round(document.querySelector('main#main')?.getBoundingClientRect().top ?? 0);
        const targets = [...document.querySelectorAll('.institutional-nav-button')]
          .map((button) => Math.round(button.getBoundingClientRect().height));
        return {
          bar: height('.desktop-bar'),
          primary: height('.institutional-primary-nav'),
          workspace: height('.institutional-workspace-disclosure > summary'),
          mainTop,
          targetMinimum: Math.min(...targets),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      if (chrome.bar > 60) findings.push(`compact chrome: search bar grew to ${chrome.bar}px`);
      if (chrome.primary > 50) findings.push(`compact chrome: primary navigation grew to ${chrome.primary}px`);
      if (chrome.workspace > 44) findings.push(`compact chrome: workspace disclosure grew to ${chrome.workspace}px`);
      if (chrome.mainTop > 320) findings.push(`compact chrome: page content starts at ${chrome.mainTop}px`);
      if (chrome.targetMinimum < 44) findings.push(`compact chrome: navigation target shrank to ${chrome.targetMinimum}px`);
      if (chrome.overflow > 0) findings.push(`compact chrome: page overflows horizontally by ${chrome.overflow}px`);
      console.log(`PASS compact workspace chrome main=${chrome.mainTop}px target=${chrome.targetMinimum}px`);
    } finally {
      await compactContext.close();
    }

    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    try {
      await context.addInitScript(
        ([version]) => localStorage.setItem('semester.v1', JSON.stringify({ schemaVersion: version, sample: true, seenOnboarding: true, nav: 'tabs' })),
        [schemaVersion],
      );
      const page = await context.newPage();
      await page.goto(`${base}#/behind`, { waitUntil: 'domcontentloaded' });
      await page.getByText('Sample Flight Plan recovery', { exact: false }).first().waitFor();
      await page.getByRole('button', { name: 'Prepare help request' }).click();
      await page.goto(`${base}#/mail`, { waitUntil: 'domcontentloaded' });
      await page.getByText('Help with Evidence & sampling practice', { exact: false }).waitFor();

      const previewControls = page.locator('aside[aria-label="Institutional preview controls"]');
      await previewControls.locator('summary').click();
      await previewControls.locator('select').nth(0).selectOption('cedar-coast');
      await page.getByText('Cedar Coast College', { exact: false }).first().waitFor();
      if (await page.getByText('Help with Evidence & sampling practice', { exact: false }).count()) {
        findings.push('context isolation: Northstar draft leaked into Cedar Coast');
      }

      await page.goto(`${base}#/university`, { waitUntil: 'domcontentloaded' });
      const previewDisclosure = previewControls.locator('details');
      for (const [role, title, applicableFunction] of roleWorkspaces) {
        // Changing person intentionally remounts the tenant-scoped preview and
        // closes this disclosure. Re-open it for the next role rather than
        // forcing a hidden select, which would not represent a user's path.
        if ((await previewDisclosure.getAttribute('open')) === null) {
          await previewControls.locator('summary').click();
        }
        const roleSelect = previewControls.locator('select').nth(1);
        await roleSelect.selectOption(`cedar-coast-${role}`);
        await page.getByText(title, { exact: true }).waitFor();
        await page.getByText(applicableFunction, { exact: true }).waitFor();
        const visibleRoleHeadings = await page.locator('section[aria-label*="workspace for"] .section-label').allTextContents();
        if (visibleRoleHeadings.length !== 1 || visibleRoleHeadings[0]?.trim() !== title) {
          findings.push(`role workspace ${role}: visible headings were ${JSON.stringify(visibleRoleHeadings)}`);
        }
      }
      console.log(`PASS context isolation and ${roleWorkspaces.length} role-specific workspaces`);
    } finally {
      await context.close();
    }
  }
} catch (error) {
  findings.push(String(error));
} finally {
  if (browser) await browser.close();
  if (server.exitCode === null) server.kill('SIGTERM');
}

if (findings.length) {
  console.error(`Institutional preview smoke failed (${findings.length}):\n- ${findings.join('\n- ')}`);
  process.exit(1);
}

console.log(`${expectedPreview ? 'Institutional preview' : 'Feature-flag-off'} smoke passed: ${cases.length} route/viewport probes.`);
