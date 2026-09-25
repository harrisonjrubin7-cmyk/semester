import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The readiness scorecard claims things are missing. Those are claims too.
 *
 * `SEMESTER_MARKET_READINESS.md` and `docs/market-readiness/` exist to tell a
 * university — and the next session — what this repository has and has not
 * built. Four of its rows were false within a day, every one in the same
 * direction: **something reported absent that was already there.**
 * Observability, the content-security policy, data export and deletion, and AI
 * metering.
 *
 * That direction is the dangerous one. An overstated gap sends a security
 * reviewer hunting for work already done, and tells the next session to build
 * a second copy of it — and duplicate work is a fault this repository
 * demonstrably already has from a different cause.
 *
 * ## Why a grep is not enough, which is how all four happened
 *
 * Each false row came from searching a keyword in a few directories and
 * reading silence as absence. Three things defeat that here, and none is an
 * accident:
 *
 *   - **The concept is not the name.** There is no `telemetry` module; there
 *     is `diagnose`. There is no `dataClassification`; there is `CLAIMS`.
 *   - **The tree is wider than `app/src`.** `app/server/`, `app/scripts/`,
 *     `packages/` and `supabase/` all hold things the scorecard speaks about.
 *     The first sweep missed the entire institution gateway.
 *   - **A refusal reads exactly like an absence.** The two most misleading
 *     rows were both cases where this project considered the thing and
 *     declined it in writing. A grep cannot tell "never built" from "argued
 *     against and rejected", and that difference is the whole meaning of the
 *     row.
 *
 * ## So each absence carries a probe
 *
 * Every entry in `ABSENT` is something the scorecard says is missing, paired
 * with the file that would exist if it were not. If that file appears, the
 * claim has gone stale and this goes red — on the day the thing is built,
 * rather than whenever somebody next re-reads the document.
 *
 * `PRESENT` is the control, and it is the half that is easy to leave out. A
 * probe pointed at the wrong directory would report every absence as confirmed
 * and read as a clean bill of health. These four are also the rows that were
 * once wrongly recorded as missing, so the control doubles as the regression
 * test for the specific mistake.
 */

const root = join(import.meta.dirname, '../../..');
const scorecard = join(root, 'SEMESTER_MARKET_READINESS.md');
const goLive = join(root, 'docs/market-readiness/GO_LIVE_CHECKLIST.md');
const pilot = join(root, 'docs/market-readiness/PILOT_PLAYBOOK.md');

/**
 * Things the scorecard reports as not built, and where they would live.
 *
 * Paths rather than greps, deliberately. A grep over prose is what produced
 * the four wrong rows; a path either exists or it does not, and the answer
 * does not turn on somebody's choice of noun.
 */
const ABSENT: { claim: string; wouldBe: string }[] = [
  { claim: 'no DB-level admin audit log', wouldBe: 'supabase/adminaudit.check.sql' },
  { claim: 'no SSO — no SAML or OIDC', wouldBe: 'app/src/lib/sso.ts' },
  { claim: 'no per-university feature flags', wouldBe: 'app/src/lib/featureflags.ts' },
  { claim: 'no field-level classification vocabulary', wouldBe: 'app/src/lib/classification.ts' },
];

/** Things the scorecard reports as present, cited by path. The control. */
const PRESENT: { claim: string; at: string }[] = [
  { claim: 'consent-based local diagnostics', at: 'app/src/lib/diagnose.ts' },
  { claim: 'a content-security policy, with its own guard', at: 'app/src/lib/csp.test.ts' },
  { claim: 'erasure from this device', at: 'app/src/lib/erase.ts' },
  { claim: 'portable and restorable data export', at: 'app/src/lib/export.ts' },
  { claim: 'cloud-account deletion', at: 'app/src/lib/cloud.ts' },
  { claim: 'hourly public production smoke', at: '.github/workflows/production-smoke.yml' },
  { claim: 'the privacy disclosure written as data', at: 'app/src/lib/privacy.ts' },
];

describe('the market-readiness scorecard', () => {
  it('is there to be read', () => {
    expect(existsSync(scorecard)).toBe(true);
    expect(readFileSync(scorecard, 'utf8').length).toBeGreaterThan(2000);
  });

  /*
   * The control, first, because every assertion after it depends on the probe
   * being able to see a file at all.
   */
  it('cites files that exist, which is what makes the absences below mean anything', () => {
    for (const { claim, at } of PRESENT) {
      expect(existsSync(join(root, at)), `${claim}: ${at} is cited and missing`).toBe(true);
    }
  });

  it('has not gone stale about what is still missing', () => {
    for (const { claim, wouldBe } of ABSENT) {
      expect(
        existsSync(join(root, wouldBe)),
        `${wouldBe} exists, so the scorecard is wrong to say “${claim}”. ` +
          'Update the row and move this entry to PRESENT.',
      ).toBe(false);
    }
  });

  /*
   * The document's account of its own errors is part of it, not a footnote. It
   * is what tells the next reader that a gap here is a claim to check rather
   * than a fact to act on.
   */
  it('keeps the record of how it has been wrong', () => {
    const text = readFileSync(scorecard, 'utf8');
    expect(text).toMatch(/How this document has been wrong/i);
    for (const thing of ['diagnose', 'csp.test.ts', 'erase.ts', 'public.usage']) {
      expect(text, `the corrections table no longer names ${thing}`).toContain(thing);
    }
  });

  it('keeps every control-centre document it promises', () => {
    const named = [
      'EXECUTIVE_READINESS', 'PRODUCT_READINESS', 'SECURITY_READINESS',
      'PRIVACY_READINESS', 'ACCESSIBILITY_READINESS', 'INTEGRATION_READINESS',
      'INFRASTRUCTURE_READINESS', 'DATA_READINESS', 'AI_GOVERNANCE',
      'IMPLEMENTATION_PLAYBOOK', 'PILOT_PLAYBOOK', 'SUPPORT_PLAYBOOK',
      'INCIDENT_RESPONSE', 'DISASTER_RECOVERY', 'UNIVERSITY_ONBOARDING',
      'MIGRATION_PLAYBOOK', 'PROCUREMENT_CHECKLIST', 'GO_LIVE_CHECKLIST',
      'INCIDENT_COMMUNICATION_TEMPLATES',
    ];
    for (const doc of named) {
      expect(
        existsSync(join(root, 'docs/market-readiness', `${doc}.md`)),
        `docs/market-readiness/${doc}.md is promised by the index and absent`,
      ).toBe(true);
    }
  });

  it('does not regress export and deletion to an unmet release claim', () => {
    const release = readFileSync(goLive, 'utf8');
    const entry = release
      .split('\n')
      .find((line) => /Data export and account deletion available to users/i.test(line));
    expect(entry).toMatch(/^- \[x\]/);

    const entryTable = readFileSync(pilot, 'utf8')
      .split('\n')
      .find((line) => /\| Data export and deletion available \|/i.test(line));
    expect(entryTable).toMatch(/\*\*Met\*\*/);
  });
});
