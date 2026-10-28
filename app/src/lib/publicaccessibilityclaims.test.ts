import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { planned } from '../../scripts/captions';

/**
 * Public accessibility wording must never outrun the source evidence. These
 * checks deliberately bind the company site and claim register to the narrow
 * repository scope, while leaving assessment, deployment and conformance open.
 */

const root = join(import.meta.dirname, '../../..');
const site = readFileSync(join(root, 'company-site/index.html'), 'utf8');
const register = readFileSync(join(root, 'PUBLIC-CLAIMS-APPROVAL-REGISTER.md'), 'utf8');
const clm007 = register.split('\n').find((line) => line.startsWith('| CLM-007 |')) ?? '';

describe('public accessibility claims', () => {
  it('does not invent an axe or manual screen-reader result for the public site', () => {
    expect(site).not.toMatch(/Every page and form:\s*axe-core/i);
    expect(site).toContain('No axe-core or manual screen-reader result is filed for the public company site.');
    expect(site).toContain('HawkScan scans an isolated static copy for web-security findings, not accessibility.');
  });

  it('states the exact caption boundary the source inventory enforces', () => {
    expect(site).toContain(`All ${planned().size} shipped prerecorded audio files have hash-pinned caption tracks in this candidate.`);
    expect(site).toContain('Four tracks are machine-generated and unreviewed');
    expect(site).toContain('live-call captions and external video caption availability are not validated by this repository');
  });

  it('separates student-app form guards from uncovered public forms', () => {
    expect(site).toContain('Student-app source guards require announced errors and the shared field pattern.');
    expect(site).toContain('Public-site forms are outside that guard and have no filed axe or manual screen-reader result.');
  });

  it('keeps CLM-007 scoped to candidate repository evidence', () => {
    expect(clm007).toContain('candidate repository runs automated accessibility guards on six student-app journeys in pull-request CI and a scheduled Chromium contrast sweep');
    for (const evidence of [
      '.github/workflows/ci.yml',
      '.github/workflows/contrast.yml',
      'app/scripts/accessibility-smoke.mjs',
      'app/src/lib/webvtt.test.ts',
    ]) expect(clm007).toContain(evidence);
    expect(clm007).toContain('no public-site axe or manual screen-reader result');
    expect(clm007).toContain('no conformance conclusion');
    expect(clm007).toContain('no implication that required-check enforcement, main, deployment or a live service has this candidate');
  });
});
