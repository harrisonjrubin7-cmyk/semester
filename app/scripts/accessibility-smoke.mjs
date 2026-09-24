/*
 * Journey-level accessibility smoke against the production bundle.
 *
 * This is intentionally not called a WCAG audit or an ACR. It checks the six
 * workflows named in docs/market-readiness/ACCESSIBILITY_READINESS.md using a
 * real browser, including the deployed base path. Static source guards remain
 * valuable; this catches the integration failures they cannot: a skip link
 * that does not move focus, a route with two mains, a broken ARIA reference,
 * an unnamed visible control, or a page that overflows at the 320 CSS-pixel
 * reflow viewport used to represent 400% zoom from a 1280-pixel baseline.
 *
 * Exit 0 only after every journey and both viewports were measured. Exit 1 on
 * a finding and 2 when the instrument itself could not run.
 */
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.SMOKE_URL || 'http://localhost:4173/';
const CHROME = process.env.SMOKE_CHROME || '/opt/pw-browsers/chromium';
const SETTLE = Number(process.env.SMOKE_SETTLE || 1200);
const JOURNEYS = [
  ['Home', '#/home'],
  ['Calendar', '#/calendar'],
  ['Courses', '#/courses'],
  ['Assignments', '#/work'],
  ['Registration', '#/yes'],
  ['Degree', '#/degree'],
];

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

const browser = await chromium.launch({
  ...(existsSync(CHROME) ? { executablePath: CHROME } : {}),
  args: ['--no-sandbox'],
});
const findings = [];
let measured = 0;

function record(journey, viewport, messages) {
  for (const message of messages) findings.push(`${journey} · ${viewport}: ${message}`);
}

async function contextFor(viewport) {
  const context = await browser.newContext({
    viewport,
    reducedMotion: 'reduce',
    colorScheme: 'dark',
  });
  await context.addInitScript(([key, state]) => {
    try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* measured by the page */ }
  }, ['semester.v1', { schemaVersion: schema(), sample: true, nav: 'tabs', seenOnboarding: true }]);
  return context;
}

async function inspect(journey, hash, viewport, label) {
  const context = await contextFor(viewport);
  const errors = [];
  try {
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(`page error: ${String(error).split('\n')[0]}`));
    await page.goto(`${BASE.replace(/\/$/, '/')}${hash}`, { waitUntil: 'domcontentloaded' });
    await page.locator('h1').waitFor({ state: 'visible', timeout: 15_000 });
    await page.waitForTimeout(SETTLE);

    const result = await page.evaluate(() => {
      const visible = (element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden'
          && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0;
      };
      const text = (element) => (element?.textContent || '').replace(/\s+/g, ' ').trim();
      const name = (element) => {
        const labelled = (element.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean)
          .map((id) => text(document.getElementById(id))).filter(Boolean).join(' ');
        const ownLabel = element.id
          ? text(document.querySelector(`label[for="${CSS.escape(element.id)}"]`))
          : '';
        const wrapped = text(element.closest('label'));
        return element.getAttribute('aria-label')?.trim() || labelled || ownLabel || wrapped
          || element.getAttribute('alt')?.trim() || text(element) || element.getAttribute('title')?.trim() || '';
      };
      const controls = [...document.querySelectorAll('button,input,select,textarea,a[href],[role="button"],[role="link"]')]
        .filter(visible).filter((element) => !element.closest('[aria-hidden="true"],[inert]'));
      const unnamed = controls.filter((element) => !name(element)).map((element) => element.outerHTML.slice(0, 120));
      const references = [];
      for (const element of document.querySelectorAll('[aria-labelledby],[aria-describedby],[aria-controls]')) {
        for (const attribute of ['aria-labelledby', 'aria-describedby', 'aria-controls']) {
          for (const id of (element.getAttribute(attribute) || '').split(/\s+/).filter(Boolean)) {
            if (!document.getElementById(id)) references.push(`${attribute}="${id}"`);
          }
        }
      }
      const ids = [...document.querySelectorAll('[id]')].map((element) => element.id);
      const duplicateIds = [...new Set(ids.filter((id, index) => id && ids.indexOf(id) !== index))];
      const heading = text(document.querySelector('h1'));
      const root = document.documentElement;
      return {
        heading,
        title: document.title,
        mains: document.querySelectorAll('main').length,
        unnamed,
        references: [...new Set(references)],
        duplicateIds,
        overflow: Math.max(root.scrollWidth, document.body.scrollWidth) - root.clientWidth,
        controlCount: controls.length,
        lang: document.documentElement.lang,
      };
    });

    const messages = [...errors];
    if (result.mains !== 1) messages.push(`expected one main landmark, found ${result.mains}`);
    if (!result.lang) messages.push('document language is empty');
    if (!result.heading) messages.push('visible h1 is empty');
    if (!result.title.includes(result.heading) || !result.title.includes('Semester')) {
      messages.push(`title "${result.title}" does not identify "${result.heading}" and Semester`);
    }
    if (result.controlCount === 0) messages.push('measured no visible controls');
    if (result.unnamed.length) messages.push(`unnamed visible controls: ${result.unnamed.join(' | ')}`);
    if (result.references.length) messages.push(`broken ARIA references: ${result.references.join(', ')}`);
    if (result.duplicateIds.length) messages.push(`duplicate ids: ${result.duplicateIds.join(', ')}`);
    if (result.overflow > 1) messages.push(`page overflows viewport by ${Math.round(result.overflow)}px`);

    if (label === 'desktop') {
      await page.evaluate(() => {
        const active = document.activeElement;
        if (active instanceof HTMLElement) active.blur();
        document.body.tabIndex = -1;
        document.body.focus();
        document.body.removeAttribute('tabindex');
      });
      await page.keyboard.press('Tab');
      const skip = await page.evaluate(() => ({
        className: document.activeElement?.className || '',
        text: document.activeElement?.textContent?.trim() || '',
        visible: document.activeElement instanceof HTMLElement
          ? document.activeElement.getBoundingClientRect().top >= 0
          : false,
      }));
      if (!String(skip.className).split(/\s+/).includes('skip-link') || skip.text !== 'Skip to content' || !skip.visible) {
        messages.push('first Tab did not reveal and focus the skip link');
      } else {
        await page.keyboard.press('Enter');
        await page.waitForTimeout(50);
        const target = await page.evaluate(() => ({ id: document.activeElement?.id, tag: document.activeElement?.tagName }));
        if (target.id !== 'main' || target.tag !== 'MAIN') messages.push('skip link did not transfer focus to main');
      }
    }

    record(journey, label, messages);
    measured += 1;
  } finally {
    await context.close();
  }
}

try {
  for (const [journey, hash] of JOURNEYS) {
    await inspect(journey, hash, { width: 1280, height: 900 }, 'desktop');
    await inspect(journey, hash, { width: 320, height: 900 }, '400% reflow');
  }
} finally {
  await browser.close();
}

if (measured !== JOURNEYS.length * 2) {
  console.error(`accessibility smoke measured ${measured}/${JOURNEYS.length * 2} cases`);
  process.exit(2);
}
if (findings.length) {
  console.error(`accessibility smoke found ${findings.length} issue(s):\n${findings.map((item) => `- ${item}`).join('\n')}`);
  process.exit(1);
}
console.log(`accessibility smoke ok — ${JOURNEYS.length} critical journeys at desktop and 400% reflow; skip focus, landmarks, titles, names and ARIA references verified`);
