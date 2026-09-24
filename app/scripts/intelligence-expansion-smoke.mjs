#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, '..');
const host = '127.0.0.1';
const port = Number(process.env.INTELLIGENCE_SMOKE_PORT || 4192);
const base = `http://${host}:${port}/`;
const vite = join(appRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const featureEnv = {
  VITE_INSTITUTIONAL_PREVIEW: 'true',
  VITE_SEMESTER_INTELLIGENCE: 'sandbox',
  VITE_JOURNEY_NAVIGATION: 'preview',
  VITE_ADAPTIVE_LEARNING: 'preview',
  VITE_CAREER_SKILLS_GRAPH: 'preview',
  VITE_MULTIMODAL_CAPTURE: 'preview',
  VITE_UNIVERSITY_CONTROL_PLANE: 'preview',
};

let chromium;
try {
  if (process.env.SMOKE_PLAYWRIGHT) {
    ({ chromium } = createRequire(import.meta.url)(process.env.SMOKE_PLAYWRIGHT));
  } else {
    ({ chromium } = await import('playwright'));
  }
} catch (error) {
  console.error('Playwright is required. Set SMOKE_PLAYWRIGHT to a playwright or playwright-core package.\n' + String(error));
  process.exit(2);
}

const run = (command, args, env = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: appRoot,
      env: { ...process.env, ...env },
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)));
  });

const build = (env) => run(process.execPath, [vite, 'build'], env);
const institutionalSmoke = (preview, smokePort) =>
  run(process.execPath, [join(here, 'institutional-preview-smoke.mjs')], {
    ...featureEnv,
    EXPECT_INSTITUTIONAL_PREVIEW: String(preview),
    INSTITUTIONAL_SMOKE_PORT: String(smokePort),
    ...(preview ? {} : Object.fromEntries(Object.keys(featureEnv).map((key) => [key, '']))),
  });

// Deep UI checks below use a deterministic rendered response contract. The
// disclosure fixture itself is a component test because a production build
// must never hide a test-only answer behind a URL or local-storage switch.
const disclosureTest = readFileSync(join(appRoot, 'src', 'intelligence', 'Disclosure.test.tsx'), 'utf8');
for (const required of ['Syllabus · p. 4', 'Course material', 'Information Semester used', 'Hint mode']) {
  if (!disclosureTest.includes(required)) throw new Error(`grounded response fixture lost ${required}`);
}
const capturePolicy = readFileSync(join(appRoot, 'src', 'lib', 'capture-policy.ts'), 'utf8');
if (!capturePolicy.includes("policy.recording === 'prohibited'")) {
  throw new Error('capture policy no longer refuses prohibited recording');
}
const studyModes = readFileSync(join(appRoot, 'src', 'lib', 'modes.ts'), 'utf8');
for (const mode of ['cards', 'read', 'field', 'watch', 'slides', 'doc', 'quiz', 'figures', 'cases', 'cram', 'listen']) {
  if (!studyModes.includes(`id: '${mode}'`)) throw new Error(`existing study format lost: ${mode}`);
}

await build({
  VITE_INSTITUTIONAL_PREVIEW: '',
  VITE_SEMESTER_INTELLIGENCE: '',
  VITE_JOURNEY_NAVIGATION: '',
  VITE_ADAPTIVE_LEARNING: '',
  VITE_CAREER_SKILLS_GRAPH: '',
  VITE_MULTIMODAL_CAPTURE: '',
  VITE_UNIVERSITY_CONTROL_PLANE: '',
});
await institutionalSmoke(false, port + 1);
await build(featureEnv);
await institutionalSmoke(true, port + 2);

const server = spawn(process.execPath, [vite, 'preview', '--host', host, '--port', String(port), '--strictPort'], {
  cwd: appRoot,
  env: { ...process.env, ...featureEnv },
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
      if ((await fetch(base)).ok) return;
    } catch { /* still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`preview server did not answer ${base}\n${serverOutput}`);
}

const schemaSource = readFileSync(join(appRoot, 'src', 'lib', 'migrate.ts'), 'utf8');
const schemaVersion = Number(/export const SCHEMA = (\d+)/.exec(schemaSource)?.[1]);
if (!Number.isInteger(schemaVersion)) throw new Error('could not read storage schema');

const chromeCandidates = [
  process.env.SMOKE_CHROME,
  '/opt/pw-browsers/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
].filter(Boolean);
const executablePath = chromeCandidates.find((candidate) => existsSync(candidate));
const findings = [];
const check = (condition, message) => { if (!condition) findings.push(message); };

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), args: ['--no-sandbox'] });

  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    await context.addInitScript(([version]) => {
      localStorage.setItem('semester.v1', JSON.stringify({ schemaVersion: version, sample: true, seenOnboarding: true, nav: 'tabs' }));
    }, [schemaVersion]);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

    const open = async (hash, ready) => {
      await page.goto(`${base}${hash}`, { waitUntil: 'domcontentloaded' });
      await page.locator('main#main').waitFor({ state: 'visible' });
      if (ready) await ready().waitFor({ state: 'visible', timeout: 10_000 });
      const shell = await page.evaluate(() => ({
        roots: document.querySelectorAll('[data-semester-root]').length,
        mains: document.querySelectorAll('main').length,
        headings: document.querySelectorAll('h1').length,
        primary: document.querySelectorAll('nav[aria-label="Primary"]').length,
      }));
      check(shell.roots === 1, `${hash} ${viewport.width}px: ${shell.roots} roots`);
      check(shell.mains === 1, `${hash} ${viewport.width}px: ${shell.mains} mains`);
      check(shell.headings === 1, `${hash} ${viewport.width}px: ${shell.headings} h1 headings`);
      check(shell.primary === 1, `${hash} ${viewport.width}px: ${shell.primary} primary navigations`);
    };

    await open('#/everything', () => page.getByRole('searchbox', { name: 'Search journeys and tools' }));
    check(await page.locator('button[data-journey-id]').count() === 6, `${viewport.width}px: directory did not show six journeys`);
    const allTools = page.getByRole('button', { name: /All tools \(/ });
    check(await allTools.count() === 1, `${viewport.width}px: All tools control missing`);
    if (await allTools.count()) {
      await allTools.click();
      check(await page.getByText('All applications', { exact: true }).count() === 1, `${viewport.width}px: All tools catalog did not open`);
    }

    await open('#/ask', () => page.getByRole('group', { name: 'Academic integrity mode' }));
    check((await page.locator('h1').innerText()).includes('Ask Semester'), `${viewport.width}px: assistant was not Ask Semester`);
    const modes = await page.getByRole('group', { name: 'Academic integrity mode' }).getByRole('button').allTextContents();
    check(JSON.stringify(modes) === JSON.stringify(['Explain', 'Hint', 'Practice', 'Review', 'Draft']), `${viewport.width}px: integrity modes were ${JSON.stringify(modes)}`);

    await open('#/study', () => page.getByText('One course. Eleven study formats.', { exact: true }));
    check(await page.getByText('One course. Eleven study formats.', { exact: true }).count() === 1, `${viewport.width}px: eleven-format study entry missing`);
    await page.getByRole('button', { name: 'Guides', exact: true }).click();
    await page.locator('details.course-mastery').first().waitFor({ state: 'visible', timeout: 10_000 });
    const mastery = await page.evaluate(() => {
      const details = document.querySelector('details.course-mastery');
      return details ? { summary: details.querySelector('summary')?.textContent ?? '', text: details.textContent ?? '' } : null;
    });
    check(Boolean(mastery), `${viewport.width}px: learning evidence missing`);
    check(/Learning evidence · readiness \d+–\d+%/.test(mastery?.summary ?? ''), `${viewport.width}px: readiness chart had no textual summary`);
    check((mastery?.text ?? '').includes('Forecast range, not a grade.'), `${viewport.width}px: readiness explanation missing`);

    await open('#/career', () => page.getByRole('button', { name: 'Skills & fit' }));
    await page.getByRole('button', { name: 'Skills & fit' }).click();
    await page.getByText('Matched evidence', { exact: true }).waitFor({ state: 'visible', timeout: 10_000 });
    check(await page.getByText('Matched evidence', { exact: true }).count() === 1, `${viewport.width}px: matched skills explanation missing`);
    check(await page.getByText('Missing', { exact: true }).count() === 1, `${viewport.width}px: missing skills explanation missing`);
    check(!/\b\d{1,3}% match\b/i.test(await page.locator('main').innerText()), `${viewport.width}px: black-box career score appeared`);

    await open('#/update', () => page.getByText('Course capture', { exact: true }));
    check((await page.locator('main').innerText()).includes('until you confirm them'), `${viewport.width}px: extracted facts were not held for confirmation`);

    await open('#/university', () => page.getByRole('button', { name: 'Control' }));
    await page.getByRole('button', { name: 'Control' }).click();
    check((await page.locator('main').innerText()).includes('Preview persona does not grant authorization'), `${viewport.width}px: preview role looked authorized`);
    check(await page.getByRole('button', { name: 'Apply through verified gateway' }).isDisabled(), `${viewport.width}px: preview could apply a production change`);

    // Produce tenant-owned evidence and an unsent action, then move to a new
    // tenant. The provider key must remove both from the active UI while the
    // old tenant's namespaced recovery copy remains available locally.
    await open('#/study', () => page.locator('section[aria-label="Sample learning evidence"]'));
    const sample = page.locator('section[aria-label="Sample learning evidence"]');
    await sample.locator('button[data-choice="0"]').first().click();
    check(await sample.locator('[data-evidence="evidence"]').count() === 1, `${viewport.width}px: could not create sample learning evidence`);
    await open('#/behind', () => page.getByRole('button', { name: 'Prepare help request' }));
    await page.getByRole('button', { name: 'Prepare help request' }).click();
    await open('#/mail', () => page.getByText('Help with Evidence & sampling practice', { exact: false }));
    check(await page.getByText('Help with Evidence & sampling practice', { exact: false }).count() === 1, `${viewport.width}px: could not create pending local action`);
    const preview = page.locator('aside[aria-label="Institutional preview controls"]');
    await preview.locator('summary').click();
    await preview.locator('select').nth(0).selectOption('cedar-coast');
    await page.getByText('Cedar Coast College', { exact: false }).first().waitFor();
    check(await page.getByText('Help with Evidence & sampling practice', { exact: false }).count() === 0, `${viewport.width}px: pending Northstar action crossed tenants`);
    await open('#/study', () => page.locator('section[aria-label="Sample learning evidence"]'));
    check(await page.locator('[data-evidence="evidence"]').count() === 0, `${viewport.width}px: Northstar learning evidence crossed tenants`);

    for (const error of errors) findings.push(`${viewport.width}px console: ${error}`);
    console.log(`PASS intelligence expansion ${viewport.width}x${viewport.height}`);
    await context.close();
  }
} catch (error) {
  findings.push(String(error));
} finally {
  if (browser) await browser.close();
  if (server.exitCode === null) server.kill('SIGTERM');
}

if (findings.length) {
  console.error(`Intelligence expansion smoke failed (${findings.length}):\n- ${findings.join('\n- ')}`);
  process.exit(1);
}
console.log('Intelligence expansion smoke passed: default and preview builds, 7 institutional routes, and 2 deep responsive journeys.');
