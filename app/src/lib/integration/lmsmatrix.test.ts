import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ALL_STEPS, API_TARGET, BLACKBOARD_API_USES, BLACKBOARD_CHECKLIST, BLACKBOARD_NEVER, CANVAS_ADMIN_PERMISSIONS, CANVAS_SCOPES, CLIENT, CLIENT_BEHAVIOUR,
  DECISION_RULE, DELIVERY_CONTRACT, DISCOVERY_FLOW, FOUND, GRADE_WRITE, LTI_MIGRATIONS, MATRIX, MOODLE_CHECKLIST, MOODLE_PRINCIPLES, PAGINATION_RULES,
  PASS_FAIL_GATES, PLATFORMS, PLATFORM_NAME, PLUGIN_RISK_REVIEW, PROCESSOR, RATE_LIMITS, REGISTRATION, SANDBOX_TEST, SCORECARD, SCORE_SCALE, SOURCES,
  STANDARD, STATUSES, SUCCESS, TOKEN_FLOW, weightedScore, type Step,
} from './lmsmatrix';

/**
 * Holds the LMS interoperability matrix to the tree: every registration field
 * that claims a column names one the migrations create, the Canvas scopes are
 * the ones the key module defines (and the roster scope is the one it
 * refuses), every step cites the kind of file its status claims and only files
 * that exist, the scorecard's weights sum to one hundred, and the supplied
 * PDFs are never evidence.
 *
 * `docs/LMS-INTEROPERABILITY-MATRIX.md` is rendered from the data; run
 * `npm run registers` from app/ to rewrite it. The last test fails while stale.
 */

const root = join(import.meta.dirname, '../../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const DOC = 'docs/LMS-INTEROPERABILITY-MATRIX.md';
const KEY_MODULE = 'supabase/functions/_shared/ltikey.ts';

const isDoc = (p: string) => /\.(md|pdf|json)$/.test(p) && !p.startsWith('.github/');
const isTest = (p: string) => /\.test\.tsx?$/.test(p) || /^supabase\/[^/]+\.check\.sql$/.test(p);
const isCode = (p: string) => !isDoc(p);

/** The columns of `public.lti_platform`, read out of the migrations that create and alter it. */
function platformColumns(): Set<string> {
  const cols = new Set<string>();
  for (const path of LTI_MIGRATIONS) {
    const sql = read(path);
    const start = sql.indexOf('create table if not exists public.lti_platform (');
    if (start >= 0) {
      const block = sql.slice(start, sql.indexOf(');', start));
      for (const m of block.matchAll(/^\s+([a-z_]+)\s+(?:text|uuid|timestamptz)\b/gm)) cols.add(m[1]);
    }
    for (const m of sql.matchAll(/alter table public\.lti_platform\s+add column if not exists ([a-z_]+)/g)) cols.add(m[1]);
  }
  return cols;
}

describe('the LMS interoperability matrix', () => {
  it('keeps the five supplied documents where it says, and never cites them as evidence', () => {
    expect(SOURCES).toHaveLength(5);
    for (const s of SOURCES) expect(existsSync(join(root, s.path)), s.path).toBe(true);
    const supplied = new Set(SOURCES.map((s) => s.path));
    for (const s of ALL_STEPS) for (const e of s.evidence) expect(supplied.has(e.path), `${s.id} cites a supplied PDF`).toBe(false);
    expect(STANDARD).toMatch(/Standards first, discovery second, proprietary APIs third/);
  });

  it('compares the four platforms on seventeen dimensions, every cell filled', () => {
    expect(PLATFORMS).toEqual(['canvas', 'blackboard', 'moodle', 'brightspace']);
    expect(MATRIX).toHaveLength(17);
    expect(new Set(MATRIX.map((d) => d.id)).size).toBe(17);
    for (const d of MATRIX) {
      for (const p of PLATFORMS) expect(d.cells[p].trim().length, `${d.id} ${PLATFORM_NAME[p]}`).toBeGreaterThan(10);
      expect(d.semester.trim().length, d.id).toBeGreaterThan(20);
    }
  });

  it('weights the scorecard to one hundred, scores 0–4, and gates before any total', () => {
    expect(SCORECARD.reduce((n, c) => n + c.weight, 0)).toBe(100);
    expect(SCORE_SCALE.map((s) => s.score)).toEqual([0, 1, 2, 3, 4]);
    expect(PASS_FAIL_GATES).toHaveLength(6);
    const all = (n: number) => Object.fromEntries(SCORECARD.map((c) => [c.dimension, n]));
    expect(weightedScore(all(4))).toBe(100);
    expect(weightedScore(all(0))).toBe(0);
    expect(weightedScore({ ...all(4), 'API breadth': 0 })).toBe(85);
    expect(() => weightedScore({ ...all(4), 'API breadth': 5 })).toThrow(/0–4/);
    const missing = all(4);
    delete missing['Grade integration'];
    expect(() => weightedScore(missing)).toThrow(/no score/);
  });

  it('publishes one rate-limit row per platform, and is confident only where a mechanism is published', () => {
    expect(RATE_LIMITS.map((r) => r.platform)).toEqual([...PLATFORMS]);
    expect(RATE_LIMITS.filter((r) => r.confidence === 'high').map((r) => r.platform)).toEqual(['canvas', 'brightspace']);
    expect(RATE_LIMITS.find((r) => r.platform === 'blackboard')!.published).toMatch(/technical-preview/);
    expect(CLIENT_BEHAVIOUR).toHaveLength(11);
    expect(DELIVERY_CONTRACT).toHaveLength(6);
    expect(DELIVERY_CONTRACT[0]).toBe('At-least-once delivery.');
    expect(PAGINATION_RULES).toHaveLength(10);
  });

  it('names the Canvas scopes the key module defines, and the roster scope it refuses', () => {
    const key = read(KEY_MODULE);
    expect(CANVAS_SCOPES).toHaveLength(6);
    const ags = CANVAS_SCOPES.filter((s) => s.scope.includes('/lti-ags/'));
    expect(ags).toHaveLength(4);
    for (const s of ags) expect(key, s.scope).toContain(`'${s.scope}'`);
    const nrps = CANVAS_SCOPES.find((s) => s.scope.includes('/lti-nrps/'))!;
    expect(key).not.toContain(nrps.scope);
    expect(key).toMatch(/contextmembership/);
    expect(CANVAS_ADMIN_PERMISSIONS).toEqual(['manage_lti_add', 'manage_developer_keys', 'manage_grades']);
    expect(TOKEN_FLOW).toHaveLength(10);
  });

  it('reads the registration record against the lti_platform columns the migrations create', () => {
    const cols = platformColumns();
    expect(cols.has('issuer')).toBe(true);
    expect(cols.has('token_url')).toBe(true);
    expect(cols.has('tenant_id')).toBe(true);
    expect(cols.has('redirect_uris'), 'the control: a column that does not exist').toBe(false);
    expect(REGISTRATION).toHaveLength(24);
    for (const f of REGISTRATION) {
      if (f.column) expect(cols.has(f.column), `${f.field} → ${f.column}`).toBe(true);
      expect(f.note.trim().length, f.field).toBeGreaterThan(10);
    }
    expect(new Set(REGISTRATION.filter((f) => f.column).map((f) => f.field)).size).toBe(8);
  });

  it('has the eleven processor steps, nine client behaviours and seven grade-write steps, ids once', () => {
    expect(PROCESSOR).toHaveLength(11);
    expect(CLIENT).toHaveLength(9);
    expect(GRADE_WRITE).toHaveLength(7);
    expect(new Set(ALL_STEPS.map((s) => s.id)).size).toBe(ALL_STEPS.length);
    expect(GRADE_WRITE.map((s) => s.status)).toContain('not-started');
  });

  it('can tell a missing file from a present one', () => {
    expect(existsSync(join(root, 'README.md'))).toBe(true);
    expect(existsSync(join(root, 'docs/no-such-lms-evidence.md'))).toBe(false);
  });

  it('cites only files that exist, and holds each status to the kind of file it claims', () => {
    for (const s of ALL_STEPS) {
      const paths = s.evidence.map((e) => e.path);
      expect(paths.length, s.id).toBeGreaterThan(0);
      for (const p of paths) expect(existsSync(join(root, p)), `${s.id} cites ${p}`).toBe(true);
      expect(STATUSES, s.id).toContain(s.status);
      if (s.status === 'designed') expect(paths.some(isDoc), `${s.id} is designed and cites no document`).toBe(true);
      if (s.status === 'building') expect(paths.some(isCode), `${s.id} is building and cites no code`).toBe(true);
      if (s.status === 'tested') expect(paths.some(isTest), `${s.id} is tested and cites no test`).toBe(true);
      if (s.status === 'not-started') expect(paths.every(isDoc), `${s.id} is not started yet cites code`).toBe(true);
      expect(s.gap.trim().length, s.id).toBeGreaterThan(3);
    }
  });

  it('keeps the Blackboard and Moodle checklists, the sandbox test and the decision rule', () => {
    expect(BLACKBOARD_CHECKLIST).toHaveLength(9);
    expect(BLACKBOARD_API_USES).toHaveLength(8);
    expect(BLACKBOARD_NEVER).toHaveLength(7);
    expect(MOODLE_CHECKLIST).toHaveLength(10);
    expect(MOODLE_PRINCIPLES).toHaveLength(9);
    expect(PLUGIN_RISK_REVIEW).toHaveLength(11);
    expect(DISCOVERY_FLOW).toHaveLength(8);
    expect(SANDBOX_TEST.map((s) => s.area)).toEqual(['Authentication', 'Pagination', 'Throttle', 'Write', 'Reconciliation']);
    expect(SUCCESS).toHaveLength(5);
    expect(API_TARGET).toHaveLength(7);
    expect(DECISION_RULE).toHaveLength(5);
    expect(FOUND).toHaveLength(0);
    expect(read('supabase/functions/lti/index.ts')).not.toMatch(/removes the guard and watches this go through/);
    expect(read('supabase/functions/lti/index.ts')).toMatch(/spends a live state once, then asserts the same state/);
    expect(read('docs/LTI-1.3-LAUNCH-RUNBOOK.md')).toMatch(/spends the launch state \(`lti_nonce`\) first, atomically/);
    expect(read('docs/LTI-1.3-LAUNCH-RUNBOOK.md')).not.toMatch(/only after `checkLaunch` returns ok/);
    expect(read('docs/INTEGRATION-DATA-PIPELINE-AUDIT.md')).toMatch(/The worker exists and has nothing to run/);
    expect(read('docs/INTEGRATION-DATA-PIPELINE-AUDIT.md')).not.toMatch(/\*\*No worker exists\*\*/);
  });

  it(`is what ${DOC} says`, () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
    expect(read(DOC), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

// ── rendering ────────────────────────────────────────────────────────────────

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const list = (xs: readonly string[]) => xs.map((x) => `- ${x}`);
const numbered = (xs: readonly string[]) => xs.map((x, i) => `${i + 1}. ${x}`);

function steps(title: string, intro: string, rows: readonly Step[]): string[] {
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const out = [`### ${title}`, '', intro, '', '| ID | Step | Status | Evidence | Gap |', '| --- | --- | --- | --- | --- |'];
  for (const r of rows) {
    const ev = r.evidence.map((e) => `\`${e.path}\`: ${cell(e.shows)}`).join('<br>');
    out.push(`| ${r.id} | ${cell(r.step)} | ${r.status} | ${ev} | ${cell(r.gap)} |`);
  }
  out.push(`| **total** | | ${STATUSES.map((s) => `${s} ${count(s)}`).join(', ')} | | |`, '');
  return out;
}

function render(): string {
  const carried = REGISTRATION.filter((f) => f.column).length;
  const out: string[] = [
    '# LMS Interoperability Matrix',
    '',
    '<!-- Rendered from app/src/lib/integration/lmsmatrix.ts by lmsmatrix.test.ts. Edit the data, then run `npm run registers` from app/. -->',
    '',
    '> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).',
    '',
    'Canvas, Blackboard Learn, Moodle and D2L Brightspace compared across LTI 1.3,',
    'gradebook exchange, API extensibility, rate limits, pagination and events, and',
    'what Semester’s own integration layer promises against each — from five',
    'documents of 28 September 2026, held to what the tree already has. The',
    '[LTI runbook](LTI-1.3-LAUNCH-RUNBOOK.md) is how a launch works today; the',
    '[operator runbook](INTEGRATION-OPERATOR-RUNBOOK.md) is how a connection is run;',
    '[GRADESCOPE-TURNITIN.md](../GRADESCOPE-TURNITIN.md) settled why Semester cannot',
    'submit into Gradescope.',
    '',
    `**${STANDARD}** Never infer a capability from a vendor name: test in the customer sandbox.`,
    '',
    '| Supplied document | What it holds |',
    '| --- | --- |',
    ...SOURCES.map((s) => `| [${s.title}](${s.path.replace(/^docs\//, '')}) | ${cell(s.what)} |`),
    '',
    '## The comparison',
    '',
    'All four platforms can take an LTI 1.3 launch. Registration, the Advantage',
    'services a tenant has enabled, administrative permissions, throttling and',
    'event delivery differ per tenant, not per vendor, so every column below is a',
    'claim about a vendor’s published mechanism and never about a customer’s tenant.',
    '',
    `| Dimension | ${PLATFORMS.map((p) => PLATFORM_NAME[p]).join(' | ')} | Semester standard |`,
    `| --- | ${PLATFORMS.map(() => '---').join(' | ')} | --- |`,
    ...MATRIX.map((d) => `| **${cell(d.title)}** | ${PLATFORMS.map((p) => cell(d.cells[p])).join(' | ')} | ${cell(d.semester)} |`),
    '',
    '## The scorecard',
    '',
    'Score a platform, or Semester, with evidence rather than vendor claims. The',
    'gates come first: any one failing stops the comparison before a total.',
    '',
    ...list(PASS_FAIL_GATES),
    '',
    '| Dimension | What to test | Evidence required | Weight |',
    '| --- | --- | --- | ---: |',
    ...SCORECARD.map((c) => `| ${cell(c.dimension)} | ${cell(c.test)} | ${cell(c.evidence)} | ${c.weight}% |`),
    '',
    '| Score | Meaning |',
    '| ---: | --- |',
    ...SCORE_SCALE.map((s) => `| ${s.score} | ${cell(s.meaning)} |`),
    '',
    'Weighted total = Σ (score × weight) ÷ (4 × Σ weight), as a percentage;',
    '`weightedScore` in the module calculates it and refuses a missing or',
    'out-of-range score.',
    '',
    '## Rate limits',
    '',
    'A fixed, comparable requests-per-minute number is not publicly established',
    'across the four platforms. Canvas and Brightspace publish a mechanism;',
    'Blackboard and Moodle are deployment- and configuration-dependent, so their',
    'limits are confirmed in the customer’s tenant and contract.',
    '',
    '| LMS | Auth model | Published behaviour | Design implication | Confidence |',
    '| --- | --- | --- | --- | --- |',
    ...RATE_LIMITS.map((r) => `| ${PLATFORM_NAME[r.platform]} | ${cell(r.auth)} | ${cell(r.published)} | ${cell(r.implication)} | ${r.confidence}: ${cell(r.why)} |`),
    '',
    '### The client, whichever platform',
    '',
    ...list(CLIENT_BEHAVIOUR),
    '',
    '### The delivery contract',
    '',
    'Do not design grade or roster sync around an assumption that an external LMS',
    'webhook is exactly-once or ordered. Internally, the integration assumes:',
    '',
    ...list(DELIVERY_CONTRACT),
    '',
    '### Pagination',
    '',
    'A connector never depends on page count alone.',
    '',
    ...numbered(PAGINATION_RULES),
    '',
    '## LTI 1.3: endpoints, scopes and the registration record',
    '',
    'LTI 1.3 uses the same kinds of endpoint on every platform, but the URLs, the',
    'enabled services, the claims released, the registration process and the',
    'permissions differ per tenant. Launches are validated from the signed claims,',
    'never from an expected URL shape, and no vendor endpoint pattern is hardcoded.',
    '',
    '### The Canvas LTI Advantage scopes',
    '',
    'Canvas has two authorization concepts that are not mixed: REST API scopes tied',
    'to a Developer Key, and LTI Advantage service scopes used through a',
    'JWT-authenticated client-credentials token for the endpoints released in the',
    'launch. The key module (`supabase/functions/_shared/ltikey.ts`) defines the',
    'four AGS scopes and deliberately excludes the roster scope; the test holds this',
    'table to it.',
    '',
    '| Semester use case | Canvas LTI scope | Use only when |',
    '| --- | --- | --- |',
    ...CANVAS_SCOPES.map((s) => `| ${cell(s.use)} | \`${s.scope}\` | ${cell(s.when)} |`),
    '',
    `Administrators, not instructors, hold ${CANVAS_ADMIN_PERMISSIONS.map((p) => `\`${p}\``).join(', ')}; Semester never assumes an instructor can install or authorize an enterprise integration.`,
    '',
    '### The token flow',
    '',
    ...numbered(TOKEN_FLOW),
    '',
    '### The registration record, against `lti_platform`',
    '',
    `The documents ask for a separate encrypted registration object per customer with twenty-four fields. ${carried} have a column on \`public.lti_platform\`; the test reads the migrations and holds each one to a column that exists. The AGS and Deep Linking endpoints arrive in the launch claim and are never stored on the platform row, which is the documents’ own rule, so their absence is a design and not a gap. The rest is the gap.`,
    '',
    '| Field | Column | Note |',
    '| --- | --- | --- |',
    ...REGISTRATION.map((f) => `| \`${f.field}\` | ${f.column ? `\`${f.column}\`` : '—'} | ${cell(f.note)} |`),
    '',
    '## Where Semester stands',
    '',
    'Each step at what the tree has. A status is a claim about the best piece of a',
    'step: `tested` cites a test that runs on every change, `building` code,',
    '`designed` a document, `not-started` at most a document naming the gap. Two',
    'facts frame the processor: there is no inbound webhook endpoint, so sync is',
    'pull-based on a fifteen-minute tick; and the adapter registry is empty, so',
    'nothing syncs yet. What exists is the pipeline the tick would run.',
    '',
    ...steps('The event processor', 'The eleven steps the documents ask of every integration processor.', PROCESSOR),
    ...steps('The adaptive client', 'The behaviours every connector has, whichever platform it talks to.', CLIENT),
    ...steps('The grade write', 'Preview → confirmation → idempotent delivery → acknowledgment → reconciliation → exception queue → audit, at what the AGS score post has today.', GRADE_WRITE),
    '### The sandbox test before any production connector',
    '',
    ...SANDBOX_TEST.flatMap((s) => [`**${s.area}.**`, ...list(s.steps), '']),
    'Success means:',
    '',
    ...list(SUCCESS),
    '',
    '## Blackboard and Moodle: the cautious two',
    '',
    'Both can support LTI 1.3, but their API behaviour, enabled services, identity',
    'configuration, paging, quotas and hosting vary more than Canvas or Brightspace.',
    'Each is onboarded as a capability-discovery integration:',
    '',
    DISCOVERY_FLOW.join(' → '),
    '',
    '### Blackboard Learn',
    '',
    ...list(BLACKBOARD_CHECKLIST),
    '',
    'Use the REST APIs only when LTI does not cover the need.',
    '',
    '| Need | Prefer | REST API only when |',
    '| --- | --- | --- |',
    ...BLACKBOARD_API_USES.map((u) => `| ${cell(u.need)} | ${cell(u.prefer)} | ${cell(u.apiOnlyWhen)} |`),
    '',
    'Never:',
    '',
    ...list(BLACKBOARD_NEVER),
    '',
    '### Moodle',
    '',
    ...list(MOODLE_CHECKLIST),
    '',
    'Web Services principles:',
    '',
    ...list(MOODLE_PRINCIPLES),
    '',
    'A plugin can become a hidden integration liability. Before depending on one,',
    'review:',
    '',
    ...list(PLUGIN_RISK_REVIEW),
    '',
    'Prefer, in order: LTI 1.3 → standard Moodle Web Services → an approved',
    'reporting or export path → a custom plugin only as a last resort.',
    '',
    '## Semester’s own developer contract',
    '',
    'To outperform integration-heavy LMS stacks, publish a precise contract.',
    '',
    '| Area | Promise |',
    '| --- | --- |',
    ...API_TARGET.map((a) => `| ${cell(a.area)} | ${cell(a.promise)} |`),
    '',
    'The decision rule: choose an LMS or assessment integration on whether the',
    'system can prove these, never on who claims the most AI.',
    '',
    ...numbered(DECISION_RULE),
    '',
    '## Found on the way',
    '',
    ...(FOUND.length ? list(FOUND) : ['Three faults found on 28 September — the LTI runbook’s line on when the nonce is spent, the pipeline audit’s line that no worker existed, and the LTI function’s own comment on what the check proves — were fixed since, and the test holds all three to the corrected wording. Nothing is open.']),
    '',
  ];
  return out.join('\n');
}
