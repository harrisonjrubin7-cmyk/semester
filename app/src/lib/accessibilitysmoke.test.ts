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
    expect(source).toContain('axeMeasured !== DESTINATIONS.length');
  });

  it('runs axe over every destination at 375 CSS pixels', () => {
    expect(source).toContain('const AXE_VIEWPORT = { width: 375, height: 900 }');
    expect(source).toContain("require.resolve('axe-core/axe.min.js')");
    expect(source).toContain("globalThis.axe.run(document, { resultTypes: ['violations'] })");
    expect(source).toContain("violation.impact === 'serious' || violation.impact === 'critical'");
    expect(source).toContain('bypassCSP: true');
    expect(source).toContain('the response headers and shipped policy are unchanged');
  });

  it('proves the axe instrument can see planted violations before accepting a clean result', () => {
    expect(source).toContain("planted.id = 'semester-axe-control'");
    expect(source).toContain("['button-name', 'image-alt'].every");
    expect(source).toContain('!axeControlPassed');
  });

  it('refuses an unreachable or error-bound destination as an instrument failure', () => {
    expect(source).toContain('if (!arrived(screen, label, seen))');
    expect(source).toContain("seen.error) instrumentFailures.push");
    expect(source).toContain('inspection failed:');
    expect(source).toContain('instrumentFailures.length');
  });
});
