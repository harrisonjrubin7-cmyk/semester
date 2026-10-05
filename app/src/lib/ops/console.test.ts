import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SEATS } from '../launchreadiness';
import { REGISTER } from '../masterregister';
import { ROLES } from '../rolelaunch';
import {
  ACCESS_BASIS,
  CAPABILITIES,
  CLASSIFICATIONS,
  CLASSIFICATION_MEANING,
  CONTEXT_BAR,
  CONTROLS,
  CONTROL_MEANING,
  CONVERSION,
  CUSTOMER_IMPACT,
  DUTIES,
  ESCALATION,
  FIGURE_PROVENANCE,
  PARTY_MEANING,
  PRODUCTION_RULES,
  PRODUCTION_WRITE_NOTICE,
  RECORD_KINDS,
  VIEWS,
  escalation,
  type Party,
} from './console';
import { cell, controlLine, link, renderedFrom, table } from './render';

/**
 * The console controls, held to the tree.
 *
 * A duties matrix is worth what its checks are: a requester who is also an
 * approver, a two-person action with one approver, or a party that is neither
 * a council seat nor a role in `public.app_roles` would each make the page a
 * drawing of a control rather than one. Each is refused here. The escalation
 * ladder is shown a day count on each side of each step before it is trusted.
 *
 * The fourteen capabilities are held the same way the production rules are: a
 * `done` row needs a test or a check among its holders, and every holder must
 * be in the tree, so a row cannot be done by assertion.
 *
 * `ops/operations-console/README.md` and `docs/OPERATIONS-CONSOLE-MAP.md` are
 * rendered from the data; `npm run registers` from app/ rewrites them, and the
 * last tests fail while either is stale.
 */

const root = join(import.meta.dirname, '../../../..');
const at = (p: string) => join(root, p);
const read = (p: string) => readFileSync(at(p), 'utf8');
const DOC = 'ops/operations-console/README.md';
const MAP = 'docs/OPERATIONS-CONSOLE-MAP.md';

const roles = new Set(ROLES.map((r) => r.role));
const isParty = (p: Party): boolean => p === 'student' || (SEATS as readonly string[]).includes(p) || (p.startsWith('role:') && roles.has(p.slice(5)));
const rowExists = (id: string) => REGISTER.some((r) => r.id === id);
const isTest = (p: string) => /\.test\.tsx?$/.test(p) || /\.check\.sql$/.test(p);

describe('segregation of duties', () => {
  it('names each action once, with a requester who cannot approve it', () => {
    expect(new Set(DUTIES.map((d) => d.id)).size).toBe(DUTIES.length);
    for (const d of DUTIES) {
      expect(d.approvers.length, `${d.id} has no approver`).toBeGreaterThan(0);
      expect(d.approvers, `${d.id}: the requester approves itself`).not.toContain(d.requester);
      expect(new Set(d.approvers).size, `${d.id} lists an approver twice`).toBe(d.approvers.length);
      if (d.twoPerson) expect(d.approvers.length, `${d.id} needs two people and names one`).toBeGreaterThanOrEqual(2);
      expect(d.evidence.length, `${d.id} attaches nothing`).toBeGreaterThan(0);
    }
  });

  it('knows every party as a seat, a role of public.app_roles, or the student', () => {
    for (const d of DUTIES) for (const p of [d.requester, ...d.approvers]) expect(isParty(p), `${d.id}: ${p}`).toBe(true);
    // The check would catch a role that is not in the table.
    expect(isParty('role:no_such_role')).toBe(false);
    expect(isParty('role:support_agent')).toBe(true);
  });

  it('touches rows that are in the master register', () => {
    for (const d of DUTIES) {
      expect(d.rows.length, `${d.id} touches no row`).toBeGreaterThan(0);
      for (const r of d.rows) expect(rowExists(r), `${d.id} names ${r}`).toBe(true);
    }
  });

  it('covers the actions the prototype’s dialog was for', () => {
    const actions = DUTIES.map((d) => d.action.toLowerCase()).join(' ');
    for (const word of ['role', 'tenant', 'feature', 'connector', 'support', 'release', 'delete', 'refund', 'ai', 'evidence', 'break-glass']) expect(actions, word).toContain(word);
  });
});

describe('data classification', () => {
  it('gives every class a meaning and controls on every surface', () => {
    for (const c of CLASSIFICATIONS) {
      expect(CLASSIFICATION_MEANING[c]).toBeTruthy();
      for (const k of Object.keys(CONTROL_MEANING) as (keyof typeof CONTROL_MEANING)[]) expect(CONTROLS[c][k], `${c}.${k}`).toBeTruthy();
    }
  });

  it('never indexes, exports or retrieves a credential, and never lets AI read restricted records', () => {
    expect(CONTROLS.credential).toEqual({ search: 'never', export: 'never', ai: 'never', support: 'never' });
    expect(CONTROLS.restricted.ai).toBe('never');
    expect(CONTROLS['student-private'].search).toBe('never');
    expect(CONTROLS['education-record'].search).toBe('never');
  });

  it('ties every record kind to a file that exists', () => {
    for (const k of RECORD_KINDS) {
      expect(CLASSIFICATIONS).toContain(k.classification);
      expect(existsSync(at(k.source)), `${k.kind} cites ${k.source}`).toBe(true);
    }
    expect(new Set(RECORD_KINDS.map((k) => k.classification)).size, 'every class has at least one record kind').toBe(CLASSIFICATIONS.length);
  });
});

describe('what every page shows', () => {
  it('puts the environment, the operator and any support access in the bar, as words', () => {
    const fields = CONTEXT_BAR.map((f) => f.field);
    expect(fields).toEqual(expect.arrayContaining(['Environment', 'Operator', 'Role', 'MFA', 'Session', 'Support access']));
    expect(CONTEXT_BAR.find((f) => f.field === 'Environment')!.shows).toMatch(/word/);
    expect(PRODUCTION_WRITE_NOTICE).toMatch(/live customer/);
  });

  it('tells an operator why they can see a record, and what a failure costs a customer', () => {
    expect(ACCESS_BASIS.map((f) => f.field)).toEqual(['Basis', 'Tenant', 'Scope', 'Purpose', 'Expires']);
    expect(CUSTOMER_IMPACT.length).toBeGreaterThanOrEqual(5);
    expect(FIGURE_PROVENANCE).toEqual(['Source', 'Time window', 'Environment', 'Owner', 'Last refresh', 'Evidence', 'Known limitation']);
  });
});

describe('evidence freshness', () => {
  it('steps at thirty days, seven days and expiry', () => {
    expect(ESCALATION.map((e) => e.daysLeft)).toEqual([30, 7, 0]);
  });

  it('applies the nearest step, on each side of each boundary', () => {
    expect(escalation(31)).toBeNull();
    expect(escalation(30)?.daysLeft).toBe(30);
    expect(escalation(8)?.daysLeft).toBe(30);
    expect(escalation(7)?.daysLeft).toBe(7);
    expect(escalation(1)?.daysLeft).toBe(7);
    expect(escalation(0)?.daysLeft).toBe(0);
    expect(escalation(-3)?.daysLeft).toBe(0);
  });

  it('flags the public claims when evidence expires', () => {
    expect(escalation(0)!.action).toMatch(/public claim/);
  });
});

describe('production rules and the conversion', () => {
  it('holds each rule with files that exist, and calls it held only when a test or check is among them', () => {
    for (const r of PRODUCTION_RULES) {
      expect(r.holders.length, `${r.id} has no holder`).toBeGreaterThan(0);
      for (const h of r.holders) expect(existsSync(at(h.path)), `${r.id} cites ${h.path}`).toBe(true);
      expect(r.holders.some((h) => isTest(h.path)), `${r.id} is ${r.status}`).toBe(r.status === 'held');
    }
  });

  it('names the five steps, each against rows in the register', () => {
    expect(CONVERSION).toHaveLength(5);
    for (const s of CONVERSION) for (const r of s.rows) expect(rowExists(r), `${s.step}: ${r}`).toBe(true);
  });

  it(`is what ${DOC} says`, () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(at(DOC), rendered);
    expect(read(DOC), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

describe('the fourteen capabilities', () => {
  it('names the fourteen the prototype faked, each once, with what replaced it', () => {
    expect(CAPABILITIES).toHaveLength(14);
    expect(new Set(CAPABILITIES.map((c) => c.id)).size).toBe(14);
    expect(CAPABILITIES.map((c) => c.id)).toEqual([
      'saved-views', 'operator-identity', 'roles', 'authorization', 'audit-log', 'fail-closed', 'two-person',
      'commercial-core', 'figures', 'support-access', 'break-glass', 'evidence', 'command-center', 'environment',
    ]);
    for (const c of CAPABILITIES) {
      expect(/^[a-z0-9-]+$/.test(c.id), c.id).toBe(true);
      expect(c.prototype.length, `${c.id}: what the prototype did`).toBeGreaterThan(20);
      expect(c.replacement.length, `${c.id}: what replaced it`).toBeGreaterThan(20);
    }
  });

  it('holds every row with files that exist, and calls it done only when a test or check is among them', () => {
    // Every fault at once, so a missing holder cannot hide a row that is done by assertion.
    const faults: string[] = [];
    for (const c of CAPABILITIES) {
      if (c.holders.length === 0) faults.push(`${c.id} has no holder.`);
      if (new Set(c.holders.map((h) => h.path)).size !== c.holders.length) faults.push(`${c.id} names a holder twice.`);
      for (const h of c.holders) if (!existsSync(at(h.path))) faults.push(`${c.id} cites ${h.path}, which does not exist.`);
      if (c.status === 'done' && !c.holders.some((h) => isTest(h.path))) faults.push(`${c.id} is done with no test among its holders.`);
    }
    expect(faults).toEqual([]);
  });

  it('can tell a test from a document', () => {
    expect(isTest('supabase/console-approvals.check.sql')).toBe(true);
    expect(isTest('app/src/screens/console.test.tsx')).toBe(true);
    expect(isTest('supabase/migrations/20260929100000_console_control_plane.sql')).toBe(false);
    expect(isTest('docs/EVIDENCE-REGISTER.md')).toBe(false);
  });

  it('says billing is not a number, and the audit is not in a browser', () => {
    expect(CAPABILITIES.find((c) => c.id === 'figures')!.replacement).toMatch(/D-009/);
    expect(CAPABILITIES.find((c) => c.id === 'audit-log')!.replacement).toMatch(/insert-only/);
    expect(CAPABILITIES.find((c) => c.id === 'roles')!.replacement).toMatch(/no role switching/);
  });

  it('lists the views the screen offers, each once, and each in the map', () => {
    expect(new Set(VIEWS.map((v) => v.id)).size).toBe(VIEWS.length);
    expect(VIEWS.map((v) => v.view)).toEqual(['Command center', 'Approvals', 'Break-glass', 'Audit', 'Customers', 'Figures', 'Evidence', 'Views']);
    for (const v of VIEWS) expect(v.shows.length, v.id).toBeGreaterThan(40);
  });

  it(`is what ${MAP} says`, () => {
    const rendered = renderMap();
    if (process.env.REGISTERS === 'write') writeFileSync(at(MAP), rendered);
    expect(read(MAP), `${MAP} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

// ── rendering ──────────────────────────────────────────────────────────────

function render(): string {
  const ref = (p: string) => `[\`${p}\`](${link(DOC, p)})`;
  const party = (p: Party) => (p === 'student' ? 'the student' : p.startsWith('role:') ? `role \`${p.slice(5)}\`` : `seat \`${p}\``);
  const status = (id: string) => REGISTER.find((r) => r.id === id)?.status ?? '?';
  const out: string[] = [
    '# Operations console controls',
    '',
    renderedFrom('app/src/lib/ops/console.ts', 'console.test.ts'),
    '',
    controlLine(DOC),
    '',
    'The policy the operations console reads: who may approve what, which',
    'records carry which class, what every page shows, what happens when evidence',
    'goes stale, and the lines a prototype in a browser could not hold. Written',
    'as data first (D-110) so that a test holds it and a screen cannot quietly',
    're-decide it; the console (`app/src/screens/Console.tsx`) and the',
    'migrations behind it now read it, and the last two sections say which file',
    `holds each of the fourteen things the prototype faked. ${ref(MAP)} is the`,
    'map of the console’s views.',
    '',
    `Parties: ${Object.entries(PARTY_MEANING).map(([k, v]) => `**${k}** — ${v}`).join('; ')}.`,
    '',
    '## Segregation of duties',
    '',
    'For each high-risk action: who asks, who approves, whether two approvers are',
    'needed, and what is attached. A requester is never among the approvers, a',
    'two-person action names at least two, and every party is a council seat, a',
    'row of `public.app_roles`, or the student. The test refuses anything else.',
    '',
    ...table(
      ['Action', 'Requester', 'Approver', 'Two-person', 'Evidence attached', 'Rows'],
      DUTIES.map((d) => [
        `**${cell(d.action)}**${d.note ? `<br>${cell(d.note)}` : ''}`,
        party(d.requester),
        d.approvers.map(party).join(d.twoPerson ? ' **and** ' : ' or '),
        d.twoPerson ? 'yes' : 'no',
        cell(d.evidence),
        d.rows.map((r) => `\`${r}\` (${status(r)})`).join(', '),
      ]),
    ),
    '',
    '## Data classification',
    '',
    ...table(
      ['Class', 'Means', 'Search', 'Export', 'AI retrieval', 'Support access'],
      CLASSIFICATIONS.map((c) => [`**${c}**`, CLASSIFICATION_MEANING[c], CONTROLS[c].search, CONTROLS[c].export, CONTROLS[c].ai, CONTROLS[c].support]),
    ),
    '',
    ...Object.entries(CONTROL_MEANING).map(([k, v]) => `- **${k}**: ${v}.`),
    '',
    '### The records the platform holds',
    '',
    ...table(
      ['Record', 'Class', 'Defined or governed by', 'Note'],
      RECORD_KINDS.map((k) => [cell(k.kind), `\`${k.classification}\``, ref(k.source), k.note ? cell(k.note) : '—']),
    ),
    '',
    '## What every page shows',
    '',
    'The context bar, on every console page. The environment is a word and a',
    'shape, never colour alone.',
    '',
    ...table(['Field', 'Shows'], CONTEXT_BAR.map((f) => [`**${f.field}**`, cell(f.shows)])),
    '',
    `Under any production write: *${PRODUCTION_WRITE_NOTICE}*`,
    '',
    '### Why can I see this?',
    '',
    'Every sensitive record answers, beside the data:',
    '',
    ...table(['Field', 'Shows'], ACCESS_BASIS.map((f) => [`**${f.field}**`, cell(f.shows)])),
    '',
    '### Customer impact first',
    '',
    'Every incident, stale feed, failed sync, flag change and data-quality issue',
    'answers these before its technical diagnosis:',
    '',
    ...CUSTOMER_IMPACT.map((q) => `- ${q}`),
    '',
    '### Every figure carries its provenance',
    '',
    `A health or status figure shows: ${FIGURE_PROVENANCE.map((f) => `**${f}**`).join(', ')}. A figure typed into a file is a claim, not a measurement; the master register and the claims register are where claims live, with the file that shows each.`,
    '',
    '## Evidence freshness',
    '',
    'The proof calendar says when each artifact is produced. This is what happens',
    'as one approaches its expiry:',
    '',
    ...table(['Days before expiry', 'Action'], ESCALATION.map((e) => [e.daysLeft === 0 ? 'Expiry' : String(e.daysLeft), cell(e.action)])),
    '',
    `It applies to every record of ${ref('docs/EVIDENCE-REGISTER.md')} today,`,
    'and to every artifact under `docs/evidence/` once one is filed: HECVAT,',
    'VPAT/ACR, penetration test, SOC report, access review, restore drill, AI',
    'evaluation, vendor review, insurance certificate, subprocessor review,',
    'policy review. The last step is the claim-to-evidence control: an expired',
    `artifact takes the public claims resting on it with it, per ${ref('ops/claims/README.md')},`,
    'and `claims.test.ts` refuses an “available” that rests on an expired record.',
    '',
    '## Production rules',
    '',
    'What the prototype could not hold, and what holds each now. `held` means a',
    'test or check fails the build; `stated` means only this page does, yet.',
    '',
  ];
  for (const r of PRODUCTION_RULES) {
    out.push(`### ${r.rule}`, '', `*${r.status}.*`, '');
    for (const h of r.holders) out.push(`- ${ref(h.path)} — ${h.how}.`);
    out.push('');
  }
  out.push(
    '## The conversion',
    '',
    'From prototype to control plane, in five steps, each against the rows it',
    'would move. The register status is the one at the last re-read.',
    '',
    ...table(
      ['Step', 'Today', 'Rows'],
      CONVERSION.map((s, i) => [`**${i + 1}. ${cell(s.step)}**`, cell(s.today), s.rows.map((r) => `\`${r}\` (${status(r)})`).join(', ')]),
    ),
    '',
    '## From prototype to control plane',
    '',
    'The fourteen things the prototype faked, what production needed instead, and',
    'the files that hold each. `done` needs a test or a check among the holders',
    'and every holder in the tree; the test refuses a row that is done by',
    'assertion.',
    '',
    ...table(
      ['Capability', 'In the prototype', 'Production replacement', 'Status', 'Held by'],
      CAPABILITIES.map((c) => [
        `**${cell(c.capability)}**${c.note ? `<br>${cell(c.note)}` : ''}`,
        cell(c.prototype),
        cell(c.replacement),
        c.status,
        c.holders.map((h) => `${ref(h.path)} — ${cell(h.how)}`).join('<br>'),
      ]),
    ),
    '',
    '## Console views',
    '',
    `What the console shows, one line each; ${ref(MAP)} is the map.`,
    '',
    ...table(['View', 'Shows'], VIEWS.map((v) => [`**${v.view}**`, cell(v.shows)])),
    '',
  );
  return out.join('\n');
}

function renderMap(): string {
  const ref = (p: string) => `[\`${p}\`](${link(MAP, p)})`;
  const holds = (id: string) => CAPABILITIES.find((c) => c.id === id)!;
  const out: string[] = [
    '# Operations console map',
    '',
    renderedFrom('app/src/lib/ops/console.ts', 'console.test.ts'),
    '',
    controlLine(MAP),
    '',
    `The operations console is ${ref('app/src/screens/Console.tsx')}, at \`#/console\`,`,
    'opened only by a signed-in account holding `console:operate` at platform',
    'scope; without it the screen is a notice, never a demo. Every view reads the',
    `controls in ${ref('ops/operations-console/README.md')} and the control plane`,
    `in ${ref(holds('audit-log').holders[0].path)} and`,
    `${ref(holds('two-person').holders[0].path)}.`,
    '',
    '## The context bar',
    '',
    'On every view. The environment is a word and a shape, never colour alone.',
    '',
    ...table(['Field', 'Shows'], CONTEXT_BAR.map((f) => [`**${f.field}**`, cell(f.shows)])),
    '',
    `Under any production write: *${PRODUCTION_WRITE_NOTICE}*`,
    '',
    '## The views',
    '',
    ...table(['View', 'Shows'], VIEWS.map((v) => [`**${v.view}**`, cell(v.shows)])),
    '',
    '## What holds each view',
    '',
    'The capability behind each view, and its holders, from the same file.',
    '',
  ];
  const behind: Record<string, string[]> = {
    command: ['command-center'],
    approvals: ['two-person', 'fail-closed'],
    'break-glass': ['break-glass'],
    audit: ['audit-log'],
    customers: ['commercial-core'],
    figures: ['figures'],
    evidence: ['evidence'],
    views: ['saved-views'],
  };
  for (const v of VIEWS) {
    out.push(`### ${v.view}`, '');
    for (const id of behind[v.id]) {
      const c = holds(id);
      out.push(`**${c.capability}** (${c.status}) — ${c.replacement}.`, '');
      for (const h of c.holders) out.push(`- ${ref(h.path)} — ${h.how}.`);
      out.push('');
    }
  }
  out.push(
    '## Everywhere',
    '',
    'The bar and the gate rest on these, whichever view is open.',
    '',
  );
  for (const id of ['operator-identity', 'roles', 'authorization', 'support-access', 'environment']) {
    const c = holds(id);
    out.push(`**${c.capability}** (${c.status}) — ${c.replacement}.`, '');
    for (const h of c.holders) out.push(`- ${ref(h.path)} — ${h.how}.`);
    out.push('');
  }
  return out.join('\n');
}
