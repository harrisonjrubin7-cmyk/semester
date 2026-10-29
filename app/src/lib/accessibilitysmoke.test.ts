/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(process.cwd(), 'scripts/accessibility-smoke.mjs'), 'utf8');

describe('the real-browser accessibility smoke', () => {
  it('normalizes a base URL that does not already end in a slash', () => {
    expect(source).toContain("const ROUTE_BASE = BASE.endsWith('/') ? BASE : `${BASE}/`");
    expect(source).not.toContain("BASE.replace(/\\/$/, '/')");
  });

  it('takes the complete route inventory from the shared destination parser', () => {
    expect(source).toContain("from './destinations.mjs'");
    expect(source).toContain('const DESTINATIONS = destinations()');
    expect(source).toContain('const expectedAxeMeasurements = DESTINATIONS.length * AXE_VIEWPORTS.length');
    expect(source).toContain('axeMeasured !== expectedAxeMeasurements');
  });

  it('runs axe over every destination at phone and tablet widths', () => {
    const match = /process\.env\.AXE_WIDTHS \|\| '([^']+)'/.exec(source);
    expect(match?.[1].split(',').map(Number)).toEqual([375, 1024]);
    expect(source).toContain('const AXE_VIEWPORTS = AXE_WIDTHS.map');
    expect(source).toContain('for (const viewport of AXE_VIEWPORTS)');
    expect(source).toContain("require.resolve('axe-core/axe.min.js')");
    expect(source).toContain("globalThis.axe.run(document, { resultTypes: ['violations'] })");
    expect(source).toContain("violation.impact === 'serious' || violation.impact === 'critical'");
    expect(source).toContain('bypassCSP: true');
    expect(source).toContain('the response headers and shipped policy are unchanged');
  });

  it('fails closed on malformed, non-positive or duplicate axe widths', () => {
    expect(source).toContain("throw new Error('AXE_WIDTHS must contain unique positive integer CSS widths')");
    expect(source).toContain('!Number.isInteger(width) || width <= 0');
    expect(source).toContain('new Set(AXE_WIDTHS).size !== AXE_WIDTHS.length');

    const withoutTablet = source.replace("'375,1024'", "'375'");
    expect(/process\.env\.AXE_WIDTHS \|\| '([^']+)'/.exec(withoutTablet)?.[1]).not.toContain('1024');
  });

  it('proves the axe instrument can see planted violations before accepting a clean result', () => {
    expect(source).toContain("planted.id = 'semester-axe-control'");
    expect(source).toContain("['button-name', 'image-alt'].every");
    expect(source).toContain('axeControlsPassed.add(viewport.width)');
    expect(source).toContain('axeControlsPassed.size !== AXE_VIEWPORTS.length');
  });

  it('opens and axe-scans the shared accessibility dialog on every critical journey at each width', () => {
    expect(source).toContain('async function inspectAccessibilityDialog(journey, hash, viewport)');
    expect(source).toContain("getByRole('button', { name: 'Accessibility tools', exact: true })");
    expect(source).toContain("getByRole('dialog', { name: 'Accessibility tools', exact: true })");
    expect(source).toContain("getByRole('group', { name: 'Accessibility preferences', exact: true })");
    expect(source).toContain("state.ariaModal !== 'false'");
    expect(source).toContain("await page.keyboard.press('Escape')");
    expect(source).toContain('Escape did not return focus to the opener');
    expect(source).toContain('const expectedAccessibilityDialogMeasurements = JOURNEYS.length * AXE_VIEWPORTS.length');
    expect(source).toContain('accessibilityDialogMeasured !== expectedAccessibilityDialogMeasurements');
    expect(source).toContain('for (const [journey, hash] of JOURNEYS) await inspectAccessibilityDialog');
  });

  it('opens and axe-scans a true modal on every critical journey at each width', () => {
    expect(source).toContain('async function inspectTrueModal(journey, hash, viewport)');
    expect(source).toContain("getByRole('button', { name: 'Add something in one line', exact: true })");
    expect(source).toContain("getByRole('dialog', { name: 'Add something quickly', exact: true })");
    expect(source).toContain("state.ariaModal !== 'true'");
    expect(source).toContain('Tab escaped the true modal');
    expect(source).toContain('Shift+Tab escaped the true modal');
    expect(source).toContain('Escape did not return focus to the true-modal opener');
    expect(source).toContain('const expectedTrueModalMeasurements = JOURNEYS.length * AXE_VIEWPORTS.length');
    expect(source).toContain('trueModalMeasured !== expectedTrueModalMeasurements');
    expect(source).toContain('for (const [journey, hash] of JOURNEYS) await inspectTrueModal');
  });

  it('forces and axe-scans the true modal storage-error state on every critical journey at each width', () => {
    expect(source).toContain('async function inspectTrueModalStorageError(journey, hash, viewport)');
    expect(source).toContain("startsWith('semester.productivity.v1:')");
    expect(source).toContain("getByRole('alert')");
    expect(source).toContain('Synthetic storage refusal');
    expect(source).toContain('failed capture changed the Quick Add text');
    expect(source).toContain('failed capture was persisted');
    expect(source).toContain('const expectedTrueModalStorageErrorMeasurements = JOURNEYS.length * AXE_VIEWPORTS.length');
    expect(source).toContain('trueModalStorageErrorMeasured !== expectedTrueModalStorageErrorMeasurements');
    expect(source).toContain('for (const [journey, hash] of JOURNEYS) await inspectTrueModalStorageError');
  });

  it('refuses an unreachable or error-bound destination as an instrument failure', () => {
    expect(source).toContain('if (!arrived(screen, destinationLabel, seen))');
    expect(source).toContain("seen.error) instrumentFailures.push");
    expect(source).toContain('inspection failed:');
    expect(source).toContain('instrumentFailures.length');
  });
});
