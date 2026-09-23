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
  { hash: '#/search', width: 1440, height: 1000, expected: 'Semester' },
  { hash: '#/calendar', width: 390, height: 844, expected: 'Calendar' },
  { hash: '#/ask', width: 1440, height: 1000, expected: 'Ask' },
  { hash: '#/mail', width: 390, height: 844, expected: 'Email' },
  { hash: '#/home', width: 1440, height: 1000, expected: 'Today' },
  { hash: '#/courses', width: 1440, height: 1000, expected: 'Courses' },
  { hash: '#/study', width: 1440, height: 1000, expected: 'Study' },
  { hash: '#/create', width: 1440, height: 1000, expected: 'Create' },
  { hash: '#/university', width: 1440, height: 1000, expected: 'University' },
  { hash: '#/career', width: 1440, height: 1000, expected: 'Career' },
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
      await page.locator('nav[aria-label="Primary"]').waitFor({ state: 'visible', timeout: 10_000 });
      await page.getByText('Synthetic preview', { exact: false }).first().waitFor({ state: 'visible' });

      const result = await page.evaluate(() => ({
        hash: location.hash,
        text: document.body.innerText,
        primary: [...document.querySelectorAll('nav[aria-label="Primary"] button')]
          .map((button) => button.textContent?.trim()),
      }));
      const expectedPrimary = ['Home', 'Calendar', 'Discover', 'Ask Semester', 'Inbox'];
      if (result.hash !== probe.hash) findings.push(`${probe.hash}: rewrote route to ${result.hash}`);
      if (!result.text.includes(probe.expected)) findings.push(`${probe.hash}: did not draw ${probe.expected}`);
      if (JSON.stringify(result.primary) !== JSON.stringify(expectedPrimary)) {
        findings.push(`${probe.hash}: primary navigation was ${JSON.stringify(result.primary)}`);
      }
      for (const error of errors) findings.push(`${probe.hash}: ${error}`);
      console.log(`PASS ${probe.hash} ${probe.width}x${probe.height}`);
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

console.log(`Institutional preview smoke passed: ${cases.length} route/viewport probes.`);
