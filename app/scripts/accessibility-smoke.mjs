/*
 * Journey-level accessibility smoke against the production bundle.
 *
 * This is intentionally not called a WCAG audit or an ACR. It checks the seven
 * workflows named in docs/market-readiness/ACCESSIBILITY_READINESS.md and runs
 * axe-core over every registered destination at phone and tablet widths using
 * a real browser, including the deployed base path. Static source guards remain
 * valuable; this catches the integration failures they cannot: a skip link
 * that does not move focus or overwrites the current hash route, a route with
 * two mains, a broken ARIA reference, an unnamed visible control, or a page
 * that overflows at the 320 CSS-pixel reflow viewport used to represent 400%
 * zoom from a 1280-pixel baseline.
 *
 * The shared Accessibility tools dialog and Quick Add true modal are also
 * opened on every critical journey at each axe width so focus entry, focus
 * containment, Escape focus return and rendered modal state are measured
 * rather than inferred from source tests.
 * Exit 0 only after every journey and every configured axe width were measured.
 * Exit 1 on a finding and 2 when the instrument itself could not run.
 */
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { arrived, destinations, proofSelector } from './destinations.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.SMOKE_URL || 'http://localhost:4173/';
const ROUTE_BASE = BASE.endsWith('/') ? BASE : `${BASE}/`;
const CHROME = process.env.SMOKE_CHROME || '/opt/pw-browsers/chromium';
const SETTLE = Number(process.env.SMOKE_SETTLE || 1200);
const AXE_WIDTHS = (process.env.AXE_WIDTHS || '375,1024').split(',').map(Number);
if (!AXE_WIDTHS.length || AXE_WIDTHS.some((width) => !Number.isInteger(width) || width <= 0)
  || new Set(AXE_WIDTHS).size !== AXE_WIDTHS.length) {
  throw new Error('AXE_WIDTHS must contain unique positive integer CSS widths');
}
const AXE_VIEWPORTS = AXE_WIDTHS.map((width) => ({ width, height: 900 }));
const JOURNEYS = [
  ['Home', '#/home'],
  ['Calendar', '#/calendar'],
  ['Me', '#/me'],
  ['Courses', '#/courses'],
  ['Assignments', '#/work'],
  ['Registration', '#/yes'],
  ['Degree', '#/degree'],
];
const DESTINATIONS = destinations();

function schema() {
  const source = readFileSync(join(here, '..', 'src', 'lib', 'migrate.ts'), 'utf8');
  const match = /export const SCHEMA = (\d+)/.exec(source);
  if (!match) throw new Error('no SCHEMA in lib/migrate.ts — its shape changed');
  return Number(match[1]);
}

const require = createRequire(import.meta.url);
let chromium;
let axePath;
try {
  const from = process.env.SMOKE_PLAYWRIGHT;
  if (from) ({ chromium } = require(from));
  else ({ chromium } = await import('playwright'));
  axePath = require.resolve('axe-core/axe.min.js');
} catch (error) {
  console.error('Playwright and axe-core are required. Set SMOKE_PLAYWRIGHT to the installed Playwright package.\n' + String(error));
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
let axeMeasured = 0;
let accessibilityDialogMeasured = 0;
let trueModalMeasured = 0;
const axeControlsPassed = new Set();
const instrumentFailures = [];

function record(journey, viewport, messages) {
  for (const message of messages) findings.push(`${journey} · ${viewport}: ${message}`);
}

async function contextFor(viewport) {
  const context = await browser.newContext({
    viewport,
    reducedMotion: 'reduce',
    colorScheme: 'dark',
    // The production CSP correctly refuses Playwright's inline addScriptTag.
    // Bypass it only inside this disposable audit context so axe can inspect
    // the served page; the response headers and shipped policy are unchanged.
    bypassCSP: true,
  });
  await context.addInitScript(([key, state]) => {
    try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* measured by the page */ }
  }, ['semester.v1', { schemaVersion: schema(), sample: true, nav: 'tabs', seenOnboarding: true }]);
  return context;
}

async function seriousAxeViolations(page) {
  await page.addScriptTag({ path: axePath });
  return page.evaluate(async () => {
    const result = await globalThis.axe.run(document, { resultTypes: ['violations'] });
    return result.violations
      .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
      .map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.map((node) => ({
          target: node.target.join(' '),
          summary: (node.failureSummary || '').split('\n').slice(1, 2).join('').trim(),
        })),
      }));
  });
}

async function inspect(journey, hash, viewport, label) {
  const context = await contextFor(viewport);
  const errors = [];
  try {
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(`page error: ${String(error).split('\n')[0]}`));
    await page.goto(`${ROUTE_BASE}${hash}`, { waitUntil: 'domcontentloaded' });
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
        const before = await page.evaluate(() => ({
          hash: window.location.hash,
          heading: document.querySelector('h1')?.textContent?.trim() || '',
        }));
        await page.keyboard.press('Enter');
        await page.waitForTimeout(50);
        const target = await page.evaluate(() => {
          const main = document.querySelector('main#main');
          const rect = main?.getBoundingClientRect();
          return {
            id: document.activeElement?.id,
            tag: document.activeElement?.tagName,
            hash: window.location.hash,
            heading: document.querySelector('h1')?.textContent?.trim() || '',
            visible: Boolean(rect && rect.bottom > 0 && rect.top < window.innerHeight),
          };
        });
        if (target.id !== 'main' || target.tag !== 'MAIN') messages.push('skip link did not transfer focus to main');
        if (target.hash !== before.hash) messages.push(`skip link changed route from ${before.hash} to ${target.hash}`);
        if (target.heading !== before.heading) messages.push(`skip link changed heading from ${before.heading} to ${target.heading}`);
        if (!target.visible) messages.push('skip link target is outside the viewport after activation');
      }
    }

    record(journey, label, messages);
    measured += 1;
  } finally {
    await context.close();
  }
}

async function inspectDestination({ screen, label: destinationLabel }, viewport) {
  const context = await contextFor(viewport);
  const widthLabel = `${viewport.width}px`;
  try {
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(String(error).split('\n')[0]));
    await page.goto(`${ROUTE_BASE}#/${screen}`, { waitUntil: 'domcontentloaded' });
    await page.locator('h1').waitFor({ state: 'visible', timeout: 15_000 });
    await page.waitForTimeout(SETTLE);

    const selector = proofSelector(screen);
    const seen = await page.evaluate((proof) => ({
      h1: document.querySelector('h1')?.textContent?.trim() || '',
      css: proof ? Boolean(document.querySelector(proof)) : false,
      error: document.body.textContent?.includes('Something on this screen went wrong.') ?? false,
    }), selector);
    if (seen.error) instrumentFailures.push(`${screen} at ${widthLabel}: rendered the screen error boundary`);
    if (!arrived(screen, destinationLabel, seen)) {
      instrumentFailures.push(`${screen} at ${widthLabel}: did not reach destination (saw "${seen.h1}")`);
    }
    for (const error of pageErrors) instrumentFailures.push(`${screen} at ${widthLabel}: page error: ${error}`);

    await page.addScriptTag({ path: axePath });
    if (!axeControlsPassed.has(viewport.width)) {
      const detected = await page.evaluate(async () => {
        const planted = document.createElement('div');
        planted.id = 'semester-axe-control';
        planted.innerHTML = '<button type="button"><svg aria-hidden="true"></svg></button><img src="data:,control">';
        document.body.append(planted);
        const result = await globalThis.axe.run(planted, { resultTypes: ['violations'] });
        planted.remove();
        return result.violations.map((violation) => violation.id);
      });
      const passed = ['button-name', 'image-alt'].every((rule) => detected.includes(rule));
      if (passed) axeControlsPassed.add(viewport.width);
      else {
        instrumentFailures.push(`axe control at ${widthLabel} missed planted button-name/image-alt violations (saw ${detected.join(', ') || 'none'})`);
      }
    }

    const violations = await page.evaluate(async () => {
      const result = await globalThis.axe.run(document, { resultTypes: ['violations'] });
      return result.violations
        .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
        .map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          nodes: violation.nodes.map((node) => ({
            target: node.target.join(' '),
            summary: (node.failureSummary || '').split('\n').slice(1, 2).join('').trim(),
          })),
        }));
    });
    for (const violation of violations) {
      for (const node of violation.nodes) {
        findings.push(`${destinationLabel} · ${widthLabel} axe: ${violation.id} (${violation.impact}) at ${node.target}${node.summary ? ` — ${node.summary}` : ''}`);
      }
    }
    axeMeasured += 1;
  } catch (error) {
    instrumentFailures.push(`${screen} at ${widthLabel}: inspection failed: ${String(error).split('\n')[0]}`);
  } finally {
    await context.close();
  }
}

async function inspectAccessibilityDialog(journey, hash, viewport) {
  const context = await contextFor(viewport);
  const widthLabel = `${viewport.width}px`;
  try {
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(String(error).split('\n')[0]));
    await page.goto(`${ROUTE_BASE}${hash}`, { waitUntil: 'domcontentloaded' });
    await page.locator('h1').waitFor({ state: 'visible', timeout: 15_000 });
    await page.waitForTimeout(SETTLE);

    const opener = page.getByRole('button', { name: 'Accessibility tools', exact: true });
    await opener.waitFor({ state: 'visible', timeout: 15_000 });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Accessibility tools', exact: true });
    await dialog.waitFor({ state: 'visible', timeout: 15_000 });
    await dialog.getByRole('button', { name: 'Close Accessibility tools', exact: true }).waitFor({ state: 'visible', timeout: 15_000 });
    await dialog.getByRole('group', { name: 'Accessibility preferences', exact: true }).waitFor({ state: 'visible', timeout: 15_000 });

    const state = await page.evaluate(() => {
      const trigger = document.querySelector('button[aria-label="Accessibility tools"]');
      const modal = document.querySelector('[role="dialog"][aria-label="Accessibility tools"]');
      return {
        ariaModal: modal?.getAttribute('aria-modal'),
        dialogId: modal?.id || '',
        expanded: trigger?.getAttribute('aria-expanded'),
        controls: trigger?.getAttribute('aria-controls'),
        focusInside: Boolean(modal && modal.contains(document.activeElement)),
      };
    });
    const messages = pageErrors.map((error) => `page error: ${error}`);
    if (state.ariaModal !== 'false') messages.push(`non-modal dialog aria-modal was ${state.ariaModal || 'missing'}`);
    if (!state.dialogId || state.controls !== state.dialogId) messages.push('opener did not control the visible dialog');
    if (state.expanded !== 'true') messages.push(`opener aria-expanded was ${state.expanded || 'missing'}`);
    if (!state.focusInside) messages.push('focus did not enter the dialog');

    for (const violation of await seriousAxeViolations(page)) {
      for (const node of violation.nodes) {
        messages.push(`axe: ${violation.id} (${violation.impact}) at ${node.target}${node.summary ? ` — ${node.summary}` : ''}`);
      }
    }

    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden', timeout: 15_000 });
    const restored = await page.evaluate(() => {
      const trigger = document.querySelector('button[aria-label="Accessibility tools"]');
      return {
        focus: document.activeElement === trigger,
        expanded: trigger?.getAttribute('aria-expanded'),
      };
    });
    if (!restored.focus) messages.push('Escape did not return focus to the opener');
    if (restored.expanded !== 'false') messages.push(`closed opener aria-expanded was ${restored.expanded || 'missing'}`);

    record(`${journey} accessibility dialog`, widthLabel, messages);
    accessibilityDialogMeasured += 1;
  } catch (error) {
    instrumentFailures.push(`${journey} accessibility dialog at ${widthLabel}: inspection failed: ${String(error).split('\n')[0]}`);
  } finally {
    await context.close();
  }
}

async function inspectTrueModal(journey, hash, viewport) {
  const context = await contextFor(viewport);
  const widthLabel = `${viewport.width}px`;
  try {
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(String(error).split('\n')[0]));
    await page.goto(`${ROUTE_BASE}${hash}`, { waitUntil: 'domcontentloaded' });
    await page.locator('h1').waitFor({ state: 'visible', timeout: 15_000 });
    await page.waitForTimeout(SETTLE);

    const opener = page.getByRole('button', { name: 'Add something in one line', exact: true });
    await opener.waitFor({ state: 'visible', timeout: 15_000 });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Add something quickly', exact: true });
    await dialog.waitFor({ state: 'visible', timeout: 15_000 });
    await dialog.getByRole('textbox').waitFor({ state: 'visible', timeout: 15_000 });
    await page.waitForTimeout(50);

    const state = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"][aria-label="Add something quickly"]');
      return {
        ariaModal: modal?.getAttribute('aria-modal'),
        focusInside: Boolean(modal && modal.contains(document.activeElement)),
      };
    });
    const messages = pageErrors.map((error) => `page error: ${error}`);
    if (state.ariaModal !== 'true') messages.push(`true modal aria-modal was ${state.ariaModal || 'missing'}`);
    if (!state.focusInside) messages.push('focus did not enter the true modal');

    const focusEdge = async (edge) => page.evaluate((which) => {
      const modal = document.querySelector('[role="dialog"][aria-label="Add something quickly"]');
      const focusable = modal ? [...modal.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])')]
        .filter((element) => !element.disabled && element.getAttribute('aria-hidden') !== 'true') : [];
      const target = which === 'first' ? focusable[0] : focusable[focusable.length - 1];
      if (target instanceof HTMLElement) target.focus();
      return focusable.length;
    }, edge);
    const focusStayedInside = () => page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"][aria-label="Add something quickly"]');
      return Boolean(modal && modal.contains(document.activeElement));
    });

    if (await focusEdge('last')) {
      await page.keyboard.press('Tab');
      if (!await focusStayedInside()) messages.push('Tab escaped the true modal');
      await focusEdge('first');
      await page.keyboard.press('Shift+Tab');
      if (!await focusStayedInside()) messages.push('Shift+Tab escaped the true modal');
    } else {
      messages.push('true modal had no focusable controls');
    }

    for (const violation of await seriousAxeViolations(page)) {
      for (const node of violation.nodes) {
        messages.push(`axe: ${violation.id} (${violation.impact}) at ${node.target}${node.summary ? ` — ${node.summary}` : ''}`);
      }
    }

    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden', timeout: 15_000 });
    if (!await opener.evaluate((trigger) => document.activeElement === trigger)) {
      messages.push('Escape did not return focus to the true-modal opener');
    }

    record(`${journey} true modal`, widthLabel, messages);
    trueModalMeasured += 1;
  } catch (error) {
    instrumentFailures.push(`${journey} true modal at ${widthLabel}: inspection failed: ${String(error).split('\n')[0]}`);
  } finally {
    await context.close();
  }
}

try {
  for (const [journey, hash] of JOURNEYS) {
    await inspect(journey, hash, { width: 1280, height: 900 }, 'desktop');
    await inspect(journey, hash, { width: 320, height: 900 }, '400% reflow');
  }
  for (const viewport of AXE_VIEWPORTS) {
    for (const destination of DESTINATIONS) await inspectDestination(destination, viewport);
    for (const [journey, hash] of JOURNEYS) await inspectAccessibilityDialog(journey, hash, viewport);
    for (const [journey, hash] of JOURNEYS) await inspectTrueModal(journey, hash, viewport);
  }
} finally {
  await browser.close();
}

const expectedAxeMeasurements = DESTINATIONS.length * AXE_VIEWPORTS.length;
const expectedAccessibilityDialogMeasurements = JOURNEYS.length * AXE_VIEWPORTS.length;
const expectedTrueModalMeasurements = JOURNEYS.length * AXE_VIEWPORTS.length;
if (measured !== JOURNEYS.length * 2 || axeMeasured !== expectedAxeMeasurements
  || accessibilityDialogMeasured !== expectedAccessibilityDialogMeasurements
  || trueModalMeasured !== expectedTrueModalMeasurements || axeControlsPassed.size !== AXE_VIEWPORTS.length
  || instrumentFailures.length) {
  console.error(
    `accessibility smoke instrument incomplete: journeys ${measured}/${JOURNEYS.length * 2}; ` +
    `phone/tablet axe destinations ${axeMeasured}/${expectedAxeMeasurements}; ` +
    `accessibility dialog states ${accessibilityDialogMeasured}/${expectedAccessibilityDialogMeasurements}; ` +
    `true modal states ${trueModalMeasured}/${expectedTrueModalMeasurements}; ` +
    `controls ${axeControlsPassed.size}/${AXE_VIEWPORTS.length}` +
    `${instrumentFailures.length ? `\n${instrumentFailures.map((item) => `- ${item}`).join('\n')}` : ''}`,
  );
  process.exit(2);
}
if (findings.length) {
  console.error(`accessibility smoke found ${findings.length} issue(s):\n${findings.map((item) => `- ${item}`).join('\n')}`);
  process.exit(1);
}
console.log(
  `accessibility smoke ok — ${JOURNEYS.length} critical journeys at desktop and 400% reflow; ` +
  `${DESTINATIONS.length} registered destinations axe-scanned at ${AXE_WIDTHS.join('px and ')}px; ` +
  `${JOURNEYS.length} shared non-modal accessibility dialog states verified at each axe width; ` +
  `${JOURNEYS.length} shared true-modal states verified at each axe width; ` +
  'skip focus, dialog focus containment and return, landmarks, titles, names and ARIA references verified',
);
