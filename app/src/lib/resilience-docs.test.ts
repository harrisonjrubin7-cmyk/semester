import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The resilience, inclusion and ecosystem design documents, against the
 * repository they describe.
 *
 * Twenty-three documents written in one sitting, each naming the files on
 * `main` that already do part of what it plans. That is the claim that rots:
 * a file is renamed, the document still reads well, and the next person builds
 * a second one because the first was "absent". `roadmap.test.ts` exists because
 * its document was wrong about itself five times; this is the same check,
 * written before the first time rather than after the fifth.
 *
 * Convention (stated in the audit): a path written from the repository root —
 * `app/…`, `supabase/…`, `docs/…`, `packages/…`, `.github/…`, `.claude/…` — is on
 * `main` and must exist. A file that exists only in an open draft is written
 * relative to `app/src` with its pull request beside it, and is not checked.
 */

const ROOT = '..';
const DOCS = join(ROOT, 'docs');
const AUDIT = 'RESILIENCE-INCLUSION-ECOSYSTEM-AUDIT.md';
const PLAN = 'RESILIENCE-INCLUSION-ECOSYSTEM-TEST-PLAN.md';

/** The documents the command names, one per area. */
const AREAS = [
  'INTEGRATION-QUALITY-AND-RECONCILIATION.md',
  'SCHEMA-DRIFT-AND-CONTRACT-TESTING.md',
  'FIELD-LINEAGE-AND-SOURCE-FRESHNESS.md',
  'SYNC-SIMULATION-SANDBOX.md',
  'TENANT-MAPPING-CONFIGURATION.md',
  'PROVIDER-MATURITY-CERTIFICATION-PARTNERSHIPS.md',
  'ACTION-EXPLAINABILITY-AND-STUDENT-CONTROL.md',
  'STUDENT-DATA-CONTROL-CENTER.md',
  'FACULTY-ENABLEMENT.md',
  'SERVICE-RELIABILITY-AND-SUPPORT-OPERATIONS.md',
  'RESILIENT-STUDENT-MODE.md',
  'LOCALIZATION-PLAIN-LANGUAGE-INTERNATIONALIZATION.md',
  'NONTRADITIONAL-LEARNER-PATHWAYS.md',
  'FINANCIAL-READINESS-WORKSPACE.md',
  'CAREER-PORTABILITY-AND-LIFELONG-ACCESS.md',
  'SUPPORTER-FAMILY-PRIVACY-MODEL.md',
  'EXTENSION-ECOSYSTEM-GOVERNANCE.md',
  'DATA-PORTABILITY-AND-OFFBOARDING.md',
  'INSTITUTIONAL-CHANGE-MANAGEMENT.md',
  'AI-RECOMMENDATION-EVALUATION-HARNESS.md',
  'ETHICAL-ENGAGEMENT-AND-NOTIFICATIONS.md',
  'PERFORMANCE-AND-LOW-END-DEVICE-PLAN.md',
] as const;

/** Every area document answers the same questions, in this order. */
const SECTIONS = [
  '## What exists on main',
  '## In flight',
  '## Entity plan',
  '## Capabilities and flags',
  '## Hard boundaries',
  '## Tests',
] as const;

const read = (name: string) => readFileSync(join(DOCS, name), 'utf8');

/**
 * Backticked repository paths. A trailing `:line` is dropped, and so is
 * anything after a space, which is prose rather than a path.
 */
function repoPaths(text: string): string[] {
  const found = new Set<string>();
  for (const [, raw] of text.matchAll(/`((?:app|supabase|docs|packages|\.github|\.claude)\/[^`\s]+)`/g)) {
    found.add(raw.replace(/:\d+$/, ''));
  }
  return [...found].sort();
}

describe('the resilience design documents', () => {
  it('are all present, and the audit links every one', () => {
    const audit = read(AUDIT);
    for (const name of [...AREAS, PLAN]) {
      expect(existsSync(join(DOCS, name)), name).toBe(true);
      expect(audit.includes(`](${name})`), `the audit links ${name}`).toBe(true);
    }
  });

  it.each(AREAS)('%s answers every question, in order', (name) => {
    const text = read(name);
    const at = SECTIONS.map((heading) => text.indexOf(`\n${heading}\n`));
    expect(at.every((i) => i >= 0), `${name} is missing ${SECTIONS[at.findIndex((i) => i < 0)]}`).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it.each([AUDIT, PLAN, ...AREAS])('%s names only files that exist', (name) => {
    const missing = repoPaths(read(name)).filter((path) => !existsSync(join(ROOT, path)));
    expect(missing).toEqual([]);
  });
});

describe('the path reader', () => {
  /*
   * The control. A reader that found nothing would pass every document above,
   * so it is checked against text where the answer is known.
   */
  it('finds root paths, drops line numbers, and ignores draft-relative ones', () => {
    const text = 'See `app/src/lib/notify.ts:211`, `supabase/check.sh`, and `lib/actions.ts` on #767.';
    expect(repoPaths(text)).toEqual(['app/src/lib/notify.ts', 'supabase/check.sh']);
  });

  it('would catch a renamed file', () => {
    const missing = repoPaths('`app/src/lib/no-such-module.ts`').filter((p) => !existsSync(join(ROOT, p)));
    expect(missing).toEqual(['app/src/lib/no-such-module.ts']);
  });
});
