import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JOURNEYS } from '../governance/error-budgets';
import { SEATS } from '../launchreadiness';
import { PLAYBOOKS } from './incidentplaybooks';
import { cell, controlLine, link, renderedFrom, table } from './render';
import {
  CONTROLS,
  DOMAINS,
  DOMAIN_TITLE,
  FAILS_A_BUILD,
  FAMILIES,
  FAMILY_PREFIX,
  FAMILY_TITLE,
  MECHANISMS,
  PROOF_SHAPE,
  STATES,
  byFamily,
  coversDomain,
  tally,
  type Control,
} from './trustcontrols';
import { COLUMNS, COLUMN_TITLE, REQUIREMENTS, requirement, standings } from './trustdomains';

/**
 * The control register and the domain matrix, held to the tree.
 *
 * What is checked is whether a claim could be false in a way the build would
 * not notice. A control may say `enforced` only if it names a test, a
 * database check or a workflow that exists, is of the kind that fails a build,
 * and is not a document. A control that is `documented` or `absent` may not
 * name proof, because proof it does not use would let it read as stronger than
 * it is. Every control that is anything short of enforced must say what is
 * missing. The matrix is held the same way: a cell that says `held` must point
 * at something that exists.
 *
 * `CONTROL-FRAMEWORK.md` and `DOMAIN-REQUIREMENTS.md` are rendered from the
 * data; `npm run registers` from app/ rewrites them, and the last tests fail
 * while they are stale.
 */

const root = join(import.meta.dirname, '../../../..');
const at = (p: string) => join(root, p);
const exists = (p: string) => existsSync(at(p));
const CONTROL_DOC = 'docs/integrated-trust/CONTROL-FRAMEWORK.md';
const DOMAIN_DOC = 'docs/integrated-trust/DOMAIN-REQUIREMENTS.md';

/** Everything wrong with one control, as sentences; empty when it is sound. */
export function problems(c: Control, fileExists: (p: string) => boolean = exists): string[] {
  const out: string[] = [];
  const say = (s: string) => out.push(`${c.id}: ${s}`);

  if (!new RegExp(`^TC-${FAMILY_PREFIX[c.family]}-\\d{2}$`).test(c.id)) say('id does not carry its family');
  if (!FAMILIES.includes(c.family)) say('unknown family');
  if (!STATES.includes(c.state)) say('unknown state');
  if (!MECHANISMS.includes(c.mechanism)) say('unknown mechanism');
  if (!SEATS.includes(c.owner)) say('owner is not a seat');

  for (const p of [...c.proof, ...(c.described ?? [])]) if (!fileExists(p)) say(`${p} does not exist`);

  if (c.state === 'enforced') {
    if (!FAILS_A_BUILD.includes(c.mechanism)) say(`enforced, but ${c.mechanism} cannot fail a build`);
    if (c.proof.length === 0) say('enforced with no proof');
    for (const p of c.proof) if (!PROOF_SHAPE.test(p)) say(`${p} is not a test, check or workflow`);
  }
  if (c.state === 'partial') {
    if (c.proof.length === 0) say('partial with no proof of the part that holds');
    for (const p of c.proof) if (!PROOF_SHAPE.test(p)) say(`${p} is not a test, check or workflow`);
  }
  if ((c.state === 'documented' || c.state === 'absent') && c.proof.length > 0) say(`${c.state} but names proof`);
  if (c.state !== 'enforced' && !c.gap) say('no statement of what is missing');
  if (c.state === 'documented' && (c.described ?? []).length === 0) say('documented with nothing described');
  if (c.state === 'absent' && c.mechanism !== 'process' && c.mechanism !== 'document') say('absent, but a build-failing mechanism is claimed');
  if (c.state === 'partial' && !FAILS_A_BUILD.includes(c.mechanism)) say(`partial, but ${c.mechanism} cannot fail a build`);
  if (c.does.length < 40) say('does not say what it does');
  return out;
}

describe('the control register', () => {
  it('is sound, control by control', () => {
    expect(CONTROLS.flatMap((c) => problems(c))).toEqual([]);
  });

  it('has unique ids and every family', () => {
    expect(new Set(CONTROLS.map((c) => c.id)).size).toBe(CONTROLS.length);
    for (const f of FAMILIES) expect(byFamily(f).length, f).toBeGreaterThan(0);
  });

  it('covers every product domain with at least one control, and names only real domains', () => {
    for (const d of DOMAINS) expect(CONTROLS.filter((c) => coversDomain(c, d)).length, d).toBeGreaterThan(0);
    for (const c of CONTROLS) if (c.domains !== 'all') for (const d of c.domains) expect(DOMAINS, `${c.id} ${d}`).toContain(d);
  });

  it('does not let a domain look better than it is: no domain reads all-enforced', () => {
    for (const d of DOMAINS) {
      const t = tally(d);
      expect(t.partial + t.documented + t.absent, d).toBeGreaterThan(0);
    }
  });

  // Controls: the checker is shown each way a claim can be false.
  const base: Control = {
    id: 'TC-SEC-99', family: 'security', does: 'A control that does something a reader could quote to a buyer.', domains: 'all',
    mechanism: 'database-check', state: 'enforced', proof: ['supabase/rls-coverage.check.sql'], owner: 'security',
  };

  it('accepts a sound enforced control', () => {
    expect(problems(base)).toEqual([]);
  });

  it('refuses enforced with a document, with no proof, or with a mechanism that cannot fail a build', () => {
    expect(problems({ ...base, proof: ['docs/trust/THREAT-MODEL.md'] }).join('\n')).toMatch(/not a test, check or workflow/);
    expect(problems({ ...base, proof: [] }).join('\n')).toMatch(/no proof/);
    expect(problems({ ...base, mechanism: 'document' }).join('\n')).toMatch(/cannot fail a build/);
  });

  it('refuses proof that does not exist, and proof on a control that is documented or absent', () => {
    expect(problems({ ...base, proof: ['supabase/not-a-real.check.sql'] }).join('\n')).toMatch(/does not exist/);
    expect(problems({ ...base, state: 'documented', mechanism: 'document', gap: 'x', described: ['SECURITY.md'] }).join('\n')).toMatch(/names proof/);
  });

  it('refuses a control short of enforced that does not say what is missing', () => {
    expect(problems({ ...base, state: 'partial' }).join('\n')).toMatch(/no statement of what is missing/);
    expect(problems({ ...base, state: 'absent', proof: [], mechanism: 'process' }).join('\n')).toMatch(/no statement of what is missing/);
  });

  it('renders the framework from the data', () => {
    const rendered = renderControls();
    if (process.env.REGISTERS === 'write') writeFileSync(at(CONTROL_DOC), rendered);
    expect(readFileSync(at(CONTROL_DOC), 'utf8'), `${CONTROL_DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

describe('the domain requirements', () => {
  const journeyIds = new Set(JOURNEYS.map((j) => j.id));
  const playbookIds = new Set(PLAYBOOKS.map((p) => p.id));

  it('has a row for every domain, once, with every column', () => {
    expect(REQUIREMENTS.map((r) => r.domain).sort()).toEqual([...DOMAINS].sort());
    for (const r of REQUIREMENTS) for (const c of COLUMNS) expect(r.cells[c], `${r.domain} ${c}`).toBeDefined();
  });

  it('points every cell at something real', () => {
    const bad: string[] = [];
    for (const r of REQUIREMENTS) {
      for (const col of COLUMNS) {
        const c = r.cells[col];
        const where = `${r.domain}/${col}`;
        if (c.standing === 'absent' && c.ref) bad.push(`${where}: absent but cites ${c.ref}`);
        if (c.standing !== 'absent' && !c.ref) bad.push(`${where}: ${c.standing} cites nothing`);
        if (c.standing !== 'held' && !c.note && c.standing !== 'drafted') bad.push(`${where}: ${c.standing} with no note`);
        if (c.ref) {
          const ok = col === 'reliability' && journeyIds.has(c.ref) ? true : col === 'incident' && playbookIds.has(c.ref) ? true : exists(c.ref);
          if (!ok) bad.push(`${where}: ${c.ref} is not a file, journey or playbook`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('keeps the reliability and incident cells consistent with the journeys and playbooks listed', () => {
    for (const r of REQUIREMENTS) {
      for (const j of r.journeys) expect(journeyIds.has(j), `${r.domain} ${j}`).toBe(true);
      for (const p of r.playbooks) expect(playbookIds.has(p), `${r.domain} ${p}`).toBe(true);
      const rel = r.cells.reliability;
      if (rel.standing === 'held') expect(r.journeys, `${r.domain} claims an objective with no journey`).toContain(rel.ref);
      const inc = r.cells.incident;
      if (inc.ref && inc.standing !== 'absent') expect(r.playbooks, `${r.domain} incident ref`).toContain(inc.ref);
    }
  });

  it('never calls a cell held that a draft in this package is the only support for', () => {
    for (const r of REQUIREMENTS) {
      for (const col of COLUMNS) {
        const c = r.cells[col];
        if (c.standing === 'held' && c.ref?.startsWith('docs/integrated-trust/')) throw new Error(`${r.domain}/${col} is held on a draft`);
      }
    }
  });

  it('renders the matrix from the data', () => {
    const rendered = renderDomains();
    if (process.env.REGISTERS === 'write') writeFileSync(at(DOMAIN_DOC), rendered);
    expect(readFileSync(at(DOMAIN_DOC), 'utf8'), `${DOMAIN_DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

// ── Rendering ──

function renderControls(): string {
  const lines: string[] = [];
  const total = CONTROLS.length;
  const by = Object.fromEntries(STATES.map((s) => [s, CONTROLS.filter((c) => c.state === s).length])) as Record<(typeof STATES)[number], number>;

  lines.push('# Control framework', '');
  lines.push(renderedFrom('app/src/lib/ops/trustcontrols.ts', 'trustcontrols.test.ts'), '');
  lines.push(controlLine(CONTROL_DOC), '');
  lines.push(
    `${total} controls across ${FAMILIES.length} families, each mapped to the product domains it covers. ` +
      `${by.enforced} are enforced, ${by.partial} partial, ${by.documented} documented and ${by.absent} absent.`,
    '',
    '**What the states mean.** They describe the repository and nothing else. *Enforced* means a test, a database check or a workflow fails when the control is removed. ' +
      '*Partial* means that is true for part of the surface, or true in the tree and not switched on where it matters; the gap says which. ' +
      '*Documented* means it is written down and nothing fails if it is ignored. *Absent* means neither. There is no state for "operating in production": ' +
      'the master register lets no row past `tested` without a file under `docs/evidence/`, and this register follows it. ' +
      'An enforced control is not evidence that the thing was done, only that a build would notice if it were undone.',
    '',
    'Every control that is not enforced has an item in the [remediation sequence](REMEDIATION-SEQUENCE.md), held by a test. ' +
      'Owners are seats from the launch council, not people; a seat with no holder cannot sign a review ([combined risk review](COMBINED-RISK-REVIEW.md)).',
    '',
  );

  lines.push('## Coverage by product domain', '');
  lines.push(
    ...table(
      ['Domain', 'Enforced', 'Partial', 'Documented', 'Absent'],
      DOMAINS.map((d) => {
        const t = tally(d);
        return [DOMAIN_TITLE[d], String(t.enforced), String(t.partial), String(t.documented), String(t.absent)];
      }),
      ['left', 'right', 'right', 'right', 'right'],
    ),
    '',
    'Controls that apply to all domains count in every row. No domain reads as fully enforced; the next page, [domain requirements](DOMAIN-REQUIREMENTS.md), says what each domain still needs.',
    '',
  );

  for (const f of FAMILIES) {
    lines.push(`## ${FAMILY_TITLE[f]}`, '');
    lines.push(
      ...table(
        ['ID', 'Control', 'Domains', 'Mechanism', 'State', 'Proof', 'What is missing', 'Owner'],
        byFamily(f).map((c) => [
          c.id,
          cell(c.does),
          c.domains === 'all' ? 'all' : cell(c.domains.map((d) => DOMAIN_TITLE[d]).join(', ')),
          c.mechanism,
          c.state,
          cell([...c.proof.map((p) => `[${p.split('/').pop()}](${link(CONTROL_DOC, p)})`), ...(c.described ?? []).map((p) => `see [${p.split('/').pop()}](${link(CONTROL_DOC, p)})`)].join('<br>') || '—'),
          cell(c.gap ?? '—'),
          c.owner,
        ]),
      ),
      '',
    );
  }
  return lines.join('\n') + '\n';
}

function renderDomains(): string {
  const lines: string[] = [];
  const s = standings();
  lines.push('# Domain requirements', '');
  lines.push(renderedFrom('app/src/lib/ops/trustdomains.ts', 'trustcontrols.test.ts'), '');
  lines.push(controlLine(DOMAIN_DOC), '');
  lines.push(
    'What each of the thirteen product domains must have before it carries real students — a threat model, a privacy review, an accessibility review, a reliability objective, a support route and an incident playbook — and what it has now.',
    '',
    `Across the ${REQUIREMENTS.length * COLUMNS.length} cells: ${s.held} held, ${s.partial} partial, ${s.drafted} drafted in this package and ${s.absent} absent.`,
    '',
    '**Standings.** *Held*: a document or register in the tree covers this domain and says so; the file exists. *Partial*: something covers part of it, or the platform in general. ' +
      '*Drafted*: written in this package and not yet reviewed by the seat that owns it; a draft is not a review, and the cell does not become held until that seat signs and a file records it. *Absent*: nothing.',
    '',
  );

  lines.push('## Matrix', '');
  lines.push(
    ...table(
      ['Domain', 'Reviewer', ...COLUMNS.map((c) => COLUMN_TITLE[c])],
      REQUIREMENTS.map((r) => [DOMAIN_TITLE[r.domain], r.reviewer, ...COLUMNS.map((c) => r.cells[c].standing)]),
    ),
    '',
  );

  lines.push('## Domain by domain', '');
  for (const d of DOMAINS) {
    const r = requirement(d)!;
    lines.push(`### ${DOMAIN_TITLE[d]}`, '');
    lines.push(`Reviewing seat: **${r.reviewer}**. Playbooks: ${r.playbooks.join(', ')}. Objectives: ${r.journeys.length ? r.journeys.join(', ') : 'none defined'}.`, '');
    lines.push(
      ...table(
        ['Requirement', 'Standing', 'Backed by', 'What is missing'],
        COLUMNS.map((c) => {
          const cellValue = r.cells[c];
          const ref = cellValue.ref ? (exists(cellValue.ref) ? `[${cellValue.ref}](${link(DOMAIN_DOC, cellValue.ref)})` : cellValue.ref) : '—';
          return [COLUMN_TITLE[c], cellValue.standing, cell(ref), cell(cellValue.note ?? '—')];
        }),
      ),
      '',
    );
  }
  return lines.join('\n') + '\n';
}
