import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { controlLine } from '../ops/render';
import {
  APPETITE,
  BOARD_REPORT,
  BODIES,
  DECISION_QUESTIONS,
  DECISION_RULE,
  EXCEPTIONS,
  EXCEPTION_FIELDS,
  EXCEPTION_RULES,
  GAME_DAYS,
  GAME_DAY_RECORD,
  MATURITY,
  MAX_EXCEPTION_DAYS,
  RISKS,
  RISK_CATEGORIES,
  RISK_FIELDS,
  band,
  escalates,
  inherent,
  reviewException,
  type Risk,
  type RiskException,
} from './risk';

/**
 * The risk register is only worth having if a row cannot claim more than the
 * repository shows, and an exception cannot be quieter than the rules allow.
 *
 *   - every control, charter, runbook and coverage path exists, with a control
 *     that a missing one reads missing;
 *   - a `missing` maturity system cites nothing, and the rest cite something;
 *   - `reviewException` refuses from a state that would otherwise pass, one
 *     rule at a time, and an expired exception re-opens rather than closes;
 *   - no game day has been held, said directly so the day one is filed under
 *     `docs/evidence/` this test says which line to change.
 *
 * `docs/operating-model/RISK-GOVERNANCE.md` is rendered from the data; run
 * `npm run registers` from app/ to rewrite it. The last test fails while stale.
 */

const root = join(import.meta.dirname, '../../../..');
const exists = (p: string) => existsSync(join(root, p));
const DOC = 'docs/operating-model/RISK-GOVERNANCE.md';

const ids = (xs: readonly { id: string }[]) => xs.map((x) => x.id);

describe('the risk register', () => {
  it('can tell a missing file from a present one', () => {
    expect(exists('README.md')).toBe(true);
    expect(exists('app/src/lib/governance/no-such-control.ts')).toBe(false);
  });

  it('names each risk once, in a known category, with a control that exists', () => {
    expect(new Set(ids(RISKS)).size).toBe(RISKS.length);
    for (const r of RISKS) {
      expect(RISK_CATEGORIES, r.id).toContain(r.category);
      expect(r.controls.length, `${r.id} cites no control`).toBeGreaterThan(0);
      for (const c of r.controls) expect(exists(c.path), `${r.id} cites ${c.path}, which is missing`).toBe(true);
      expect(r.owner, r.id).not.toMatch(/@/);
      expect(r.mitigation.trim().length, r.id).toBeGreaterThan(20);
      expect(r.residual, `${r.id} cannot be worse after its controls`).toBeLessThanOrEqual(Math.max(r.likelihood, r.impact));
    }
  });

  it('holds R-07 to what D-109 built: the kill switch is a control the runtimes are tested on, not a gap', () => {
    // D-111 found this row still describing the gap D-109 had closed. The row
    // may say what is still open (no injection suite, no drill); it may not say
    // the runtimes do not read the switch, and it must cite the tests that
    // hold them to reading it.
    const r = RISKS.find((x) => x.id === 'R-07')!;
    expect(r.description).not.toMatch(/do not consult|does not stop generation/);
    const paths = r.controls.map((c) => c.path);
    expect(paths).toContain('app/src/lib/aikillswitch.test.ts');
    expect(paths).toContain('app/server/institution/intelligence.test.ts');
    expect(r.residual, 'with both runtimes held to the switch, R-07 does not escalate on residual alone').toBeLessThan(4);
  });

  it('closes nothing: a closed risk needs evidence under docs/evidence/, and none is closed yet', () => {
    expect(RISKS.filter((r) => r.status === 'closed')).toEqual([]);
  });

  it('scores inherent risk as likelihood × impact and bands it the same for everyone', () => {
    expect(inherent({ likelihood: 5, impact: 5 })).toBe(25);
    expect(inherent({ likelihood: 1, impact: 4 })).toBe(4);
    expect(band(25)).toBe('critical');
    expect(band(16)).toBe('critical');
    expect(band(15)).toBe('high');
    expect(band(10)).toBe('high');
    expect(band(9)).toBe('medium');
    expect(band(5)).toBe('medium');
    expect(band(4)).toBe('low');
  });

  it('escalates every zero-tolerance risk, every critical one, and every residual of 4 or more', () => {
    const base: Risk = { ...RISKS[0], tolerance: 'managed', likelihood: 1, impact: 1, residual: 1 };
    expect(escalates(base)).toBe(false);
    expect(escalates({ ...base, tolerance: 'zero' })).toBe(true);
    expect(escalates({ ...base, likelihood: 4, impact: 4 })).toBe(true);
    expect(escalates({ ...base, residual: 4 })).toBe(true);
    expect(escalates({ ...base, likelihood: 3, impact: 5, residual: 3 })).toBe(false);
  });

  it('covers the appetite examples the plan gives, three tiers', () => {
    expect(Object.keys(APPETITE)).toEqual(['zero', 'low', 'managed']);
    for (const t of Object.values(APPETITE)) expect(t.examples.length).toBeGreaterThanOrEqual(3);
    expect(RISKS.some((r) => r.tolerance === 'zero')).toBe(true);
    expect(RISKS.some((r) => r.tolerance === 'low')).toBe(true);
    expect(RISKS.some((r) => r.tolerance === 'managed')).toBe(true);
  });

  it('lists the seventeen register fields and the fifteen categories', () => {
    expect(RISK_FIELDS).toHaveLength(17);
    expect(RISK_CATEGORIES).toHaveLength(15);
  });
});

describe('the bodies', () => {
  it('are the eight the plan names, each with a charter that exists or none', () => {
    expect(BODIES).toHaveLength(8);
    expect(new Set(ids(BODIES)).size).toBe(8);
    for (const b of BODIES) {
      if (b.charter) expect(exists(b.charter), `${b.id} → ${b.charter}`).toBe(true);
      expect(b.members).toBe('none named');
    }
  });
});

describe('exceptions', () => {
  const ok: RiskException = {
    id: 'EX-test',
    control: 'MFA for privileged roles',
    why: 'No MFA enrolment exists yet',
    risk: 'An admin credential alone opens the console',
    affects: 'platform_admin accounts',
    severity: 'P1',
    riskId: 'R-13',
    compensating: 'Two named admins, console access from known devices, weekly access review',
    owner: 'Security lead',
    approvers: ['executive', 'security'],
    granted: '2026-10-01',
    expires: '2026-12-01',
    remediation: 'Enforce aal2 for the two roles',
    customerImpact: false,
    notification: 'not required',
    conflictsWithContract: false,
    review: '2026-11-01',
    closure: null,
  };

  it('admits a well-formed exception and reports its days left', () => {
    const v = reviewException(ok, '2026-10-15');
    expect(v).toEqual({ admissible: true, refusals: [], state: 'open', daysLeft: 47 });
  });

  it('refuses an indefinite one', () => {
    const v = reviewException({ ...ok, expires: null }, '2026-10-15');
    expect(v.admissible).toBe(false);
    expect(v.refusals).toEqual(['No indefinite exception.']);
    expect(v.daysLeft).toBeNull();
  });

  it(`refuses one longer than ${MAX_EXCEPTION_DAYS} days, and allows exactly ${MAX_EXCEPTION_DAYS}`, () => {
    expect(reviewException({ ...ok, expires: '2026-12-31' }, '2026-10-15').refusals).toEqual([`Expires more than ${MAX_EXCEPTION_DAYS} days after it was granted.`]);
    expect(reviewException({ ...ok, expires: '2026-12-30' }, '2026-10-15').admissible).toBe(true);
    expect(reviewException({ ...ok, expires: '2026-09-30' }, '2026-10-15').refusals).toEqual(['Expires before it was granted.']);
  });

  it('refuses a P0 without executive, security and legal approval, naming each missing one', () => {
    const v = reviewException({ ...ok, severity: 'P0', approvers: ['executive'] }, '2026-10-15');
    expect(v.refusals).toEqual(['P0 needs security approval.', 'P0 needs legal approval.']);
    expect(reviewException({ ...ok, severity: 'P0', approvers: ['executive', 'security', 'legal'] }, '2026-10-15').admissible).toBe(true);
  });

  it('refuses one with no approver, one that conflicts with a contract, and a customer-impacting one with no notification decision', () => {
    expect(reviewException({ ...ok, approvers: [] }, '2026-10-15').refusals).toEqual(['No approver.']);
    expect(reviewException({ ...ok, conflictsWithContract: true }, '2026-10-15').refusals).toEqual(['Conflicts with a customer contract.']);
    expect(reviewException({ ...ok, customerImpact: true, notification: 'undecided' }, '2026-10-15').refusals).toEqual([
      'Customer-impacting, and the notification decision is not made.',
    ]);
    expect(reviewException({ ...ok, customerImpact: true, notification: 'required' }, '2026-10-15').admissible).toBe(true);
  });

  it('refuses an exception to a zero-tolerance risk, or to a risk that is not in the register', () => {
    expect(reviewException({ ...ok, riskId: 'R-01' }, '2026-10-15').refusals).toEqual(['R-01 is zero tolerance and admits no exception.']);
    expect(reviewException({ ...ok, riskId: 'R-99' }, '2026-10-15').refusals).toEqual(['Names R-99, which is not in the register.']);
    expect(reviewException({ ...ok, riskId: null }, '2026-10-15').admissible).toBe(true);
  });

  it('re-opens an expired exception rather than closing it, and closes only with closure evidence', () => {
    expect(reviewException(ok, '2026-12-02')).toMatchObject({ state: 'expired-reopened', daysLeft: -1 });
    expect(reviewException(ok, '2026-12-01').state).toBe('open');
    expect(reviewException({ ...ok, closure: 'docs/evidence/mfa-enforced.md' }, '2026-12-02').state).toBe('closed');
  });

  it('holds no approved exception today, because nobody with the authority has approved one', () => {
    expect(EXCEPTIONS).toEqual([]);
    expect(EXCEPTION_FIELDS).toHaveLength(14);
    expect(EXCEPTION_RULES).toHaveLength(6);
  });
});

describe('game days', () => {
  it('are the sixteen minimum scenarios, none held, each runbook a file that exists', () => {
    expect(GAME_DAYS).toHaveLength(16);
    expect(new Set(ids(GAME_DAYS)).size).toBe(16);
    for (const g of GAME_DAYS) {
      expect(g.held, `${g.id} claims a run; file it under docs/evidence/ and change this test`).toBeNull();
      if (g.runbook) expect(exists(g.runbook), `${g.id} → ${g.runbook}`).toBe(true);
    }
    // docs/evidence/ holds the AI drills of 29 September; none is a game day.
    const filedHere = (dir: string): string[] =>
      readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? filedHere(`${dir}/${e.name}`) : [e.name]));
    expect(filedHere('docs/evidence').filter((f) => /game-?day|GD-\d/i.test(f))).toEqual([]);
    expect(GAME_DAY_RECORD).toHaveLength(12);
  });
});

describe('the maturity systems', () => {
  it('are eighteen, numbered in order, citing only files that exist, and a missing one cites nothing', () => {
    expect(MATURITY).toHaveLength(18);
    MATURITY.forEach((m, i) => expect(m.n, m.system).toBe(i + 1));
    for (const m of MATURITY) {
      for (const p of m.covered) expect(exists(p), `${m.system} → ${p}`).toBe(true);
      if (m.state === 'missing') expect(m.covered, m.system).toEqual([]);
      else expect(m.covered.length, m.system).toBeGreaterThan(0);
      expect(m.note.trim().length, m.system).toBeGreaterThan(20);
    }
  });
});

describe('board reporting and the decision rule', () => {
  it('are the ten items and the nine questions', () => {
    expect(BOARD_REPORT).toHaveLength(10);
    expect(DECISION_QUESTIONS).toHaveLength(9);
    expect(DECISION_RULE).toContain('not launch-ready');
  });
});

it(`is what ${DOC} says`, () => {
  const rendered = render();
  if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
  expect(readFileSync(join(root, DOC), 'utf8'), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
});

// ── rendering ────────────────────────────────────────────────────────────────

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

function render(): string {
  const out: string[] = [
    '# Risk governance',
    '',
    '<!-- Rendered from app/src/lib/governance/risk.ts by risk.test.ts. Edit the data, then run `npm run registers` from app/. -->',
    '',
    controlLine(DOC),
    '',
    'The bodies that decide, the register of what could go wrong, the appetite',
    'for each kind of risk, the rules an exception has to meet, the game days that',
    'would prove the runbooks, and what the board is told. Written as data in',
    '`app/src/lib/governance/risk.ts` so a review computes the answer; a test holds',
    'every cited control, charter and runbook to a file that exists.',
    '',
    '**Nobody is named for any seat, no exception has been approved, and no game',
    'day has been held.** The register says what is open, not what is handled.',
    '',
    '## Governance bodies',
    '',
    '| Body | Cadence | Responsibility | Charter | Members |',
    '| --- | --- | --- | --- | --- |',
    ...BODIES.map((b) => `| ${b.name} | ${b.cadence} | ${b.responsibility} | ${b.charter ? `\`${b.charter}\`` : 'this page'} | ${b.members} |`),
    '',
    '## Risk appetite',
    '',
  ];
  for (const t of Object.values(APPETITE)) {
    out.push(`### ${t.label}`, '', t.meaning, '');
    for (const e of t.examples) out.push(`- ${e}`);
    out.push('');
  }
  out.push(
    '## The register',
    '',
    `Inherent risk is likelihood × impact on 1–5 scales: 16+ critical, 10–15 high, 5–9 medium, under 5 low. A risk escalates to the executive risk committee on its own when it is zero tolerance, critical, or its residual after controls is 4 or more. Every row records: ${RISK_FIELDS.join('; ')}.`,
    '',
    '| ID | Category | Risk | Affects | L | I | Inherent | Tolerance | Controls | Residual | Owner | Status | Escalates |',
    '| --- | --- | --- | --- | ---: | ---: | --- | --- | --- | ---: | --- | --- | --- |',
  );
  for (const r of RISKS) {
    const controls = r.controls.map((c) => `\`${c.path}\` — ${cell(c.shows)}`).join('<br>');
    out.push(
      `| ${r.id} | ${r.category} | ${cell(r.description)} | ${cell(r.affects)} | ${r.likelihood} | ${r.impact} | ${inherent(r)} (${band(inherent(r))}) | ${r.tolerance} | ${controls} | ${r.residual} | ${r.owner} | ${r.status} | ${escalates(r) ? 'yes' : 'no'} |`,
    );
  }
  out.push('', '### Mitigation, escalation threshold and customer notification', '', '| ID | Mitigation | Escalation threshold | Notify |', '| --- | --- | --- | --- |');
  for (const r of RISKS) out.push(`| ${r.id} | ${cell(r.mitigation)} | ${cell(r.escalation)} | ${r.notify} |`);
  out.push(
    '',
    '## Exceptions',
    '',
    `Every exception records: ${EXCEPTION_FIELDS.join('; ')}. \`reviewException()\` applies these rules and refuses anything that breaks one:`,
    '',
  );
  for (const r of EXCEPTION_RULES) out.push(`- ${r}`);
  out.push(
    '',
    `**Open exceptions: ${EXCEPTIONS.length}.** The register starts empty on purpose. The gaps the risks above describe — no MFA, one person on call, no restore drill — are open risks, not accepted exceptions, until someone with the authority approves one with an expiry.`,
    '',
    '## Game days',
    '',
    `The minimum scenarios. None has been held; a run files its record under \`docs/evidence/\` and records: ${GAME_DAY_RECORD.join('; ')}.`,
    '',
    '| ID | Scenario | Hypothesis | Runbook | Last held |',
    '| --- | --- | --- | --- | --- |',
  );
  for (const g of GAME_DAYS) out.push(`| ${g.id} | ${cell(g.scenario)} | ${cell(g.hypothesis)} | ${g.runbook ? `\`${g.runbook}\`` : 'none'} | never |`);
  out.push('', '## Board-level reporting', '', 'The quarterly report to the executive risk committee covers:', '');
  BOARD_REPORT.forEach((b, i) => out.push(`${i + 1}. ${b}`));
  out.push('', '## The decision rule', '', 'Before approving a feature, integration, policy, marketing claim or customer launch, answer:', '');
  for (const q of DECISION_QUESTIONS) out.push(`- ${q}`);
  out.push('', DECISION_RULE, '');
  out.push(
    '## The enterprise maturity systems',
    '',
    'The eighteen systems the maturity brief asks for, and where each stands. Where',
    'the repository already answers one, this points there rather than copying it.',
    '',
    '| # | System | State | Where it is answered | Note |',
    '| --- | --- | --- | --- | --- |',
  );
  for (const m of MATURITY) out.push(`| ${m.n} | ${m.system} | ${m.state} | ${m.covered.length ? m.covered.map((p) => `\`${p}\``).join('<br>') : '—'} | ${cell(m.note)} |`);
  out.push(
    '',
    `Covered: ${MATURITY.filter((m) => m.state === 'covered').length}. Partly: ${MATURITY.filter((m) => m.state === 'partly').length}. Missing: ${MATURITY.filter((m) => m.state === 'missing').length}.`,
    '',
  );
  return out.join('\n');
}
