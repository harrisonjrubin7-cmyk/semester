import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FLAGS } from '../flags';
import { SEATS } from '../launchreadiness';
import { cell, controlLine, link, renderedFrom, table } from '../ops/render';
import {
  CHECKS, COUNCIL, DOMAINS, GATE_SECTIONS, GO_GATE, LADDER, PILOT_OBJECTIVES,
  ceiling, counts, gateCounts, goDecision, rank, type Domain, type GateSection, type Rung,
} from './certification';

/**
 * The release-certification register is only worth having if nothing on it
 * can claim more than the tree shows:
 *
 *   - every cited spec, code path and evidence file exists, and every flag is
 *     one `flags.ts` knows;
 *   - no domain's status passes the ceiling its evidence supports;
 *   - GO is computed from the gate, the domains and the council, and the
 *     blockers are stated here, so each one closing is a line in a diff.
 *
 * `docs/operating-model/RELEASE-CERTIFICATION.md` is rendered from the data;
 * run `npm run registers` from app/ to rewrite it. The last test fails while
 * it is stale.
 */

const root = join(import.meta.dirname, '../../../..');
const exists = (p: string) => existsSync(join(root, p));
const DOC = 'docs/operating-model/RELEASE-CERTIFICATION.md';
const verified: Domain = {
  ...DOMAINS[0],
  checks: Object.fromEntries(CHECKS.map((c) => [c.key, { state: 'passed', evidence: 'README.md', note: 'x' }])) as Domain['checks'],
};

describe('the release-certification register', () => {
  it('can tell a missing file from a present one', () => {
    expect(exists('README.md')).toBe(true);
    expect(exists('app/src/lib/governance/no-such-evidence.md')).toBe(false);
  });

  it('names each domain once, and cites only files that exist', () => {
    const keys = DOMAINS.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const d of DOMAINS) {
      if (d.spec) expect(exists(d.spec), `${d.key} spec ${d.spec}`).toBe(true);
      for (const p of d.code) expect(exists(p), `${d.key} code ${p}`).toBe(true);
      for (const c of CHECKS) {
        const x = d.checks[c.key];
        if (x.state === 'owed') expect(x.evidence, `${d.key}.${c.key} is owed and cites ${x.evidence}`).toBeNull();
        else expect(x.evidence && exists(x.evidence), `${d.key}.${c.key} cites ${x.evidence}`).toBe(true);
      }
      if (d.pilotEvidence) expect(exists(d.pilotEvidence), d.key).toBe(true);
      expect(SEATS, d.key).toContain(d.owner);
      expect(d.toComplete.length, d.key).toBeGreaterThan(12);
    }
  });

  it('gates every domain only with flags the registry defines', () => {
    const known = new Set(FLAGS.map((f) => f.key));
    for (const d of DOMAINS) for (const f of d.flags) expect(known.has(f), `${d.key} cites unknown flag ${f}`).toBe(true);
  });

  it('never lets a status pass what its evidence supports', () => {
    for (const d of DOMAINS) {
      expect(d.status, d.key).not.toBe('deprecated');
      const c = ceiling(d);
      expect(c, `${d.key} has neither spec nor code`).not.toBeNull();
      expect(rank(d.status as Rung), `${d.key} claims ${d.status} but its evidence supports ${c}`).toBeLessThanOrEqual(rank(c!));
    }
  });

  it('climbs one rung at a time: no GO without verification, no pilot without GO', () => {
    expect(ceiling({ ...DOMAINS[0], spec: null, code: [] })).toBeNull();
    expect(ceiling({ ...DOMAINS[0], code: [] })).toBe('designed');
    expect(ceiling(DOMAINS[0], { go: true, pilot: null })).toBe('built');
    expect(ceiling(verified, { go: false, pilot: { sponsor: 's', cohort: 'c' } })).toBe('internally_verified');
    expect(ceiling(verified, { go: true, pilot: null })).toBe('go_certified');
    expect(ceiling({ ...verified, activation: 'off' }, { go: true, pilot: { sponsor: 's', cohort: 'c' } })).toBe('go_certified');
    expect(ceiling(verified, { go: true, pilot: { sponsor: 's', cohort: 'c' } })).toBe('pilot_deployed');
    expect(ceiling({ ...verified, pilotEvidence: 'README.md' }, { go: true, pilot: { sponsor: 's', cohort: 'c' } })).toBe('pilot_refined');
  });

  it('gives every high-risk domain a condition before a pilot may activate it', () => {
    for (const d of DOMAINS.filter((x) => x.highRisk)) {
      expect(d.activation, d.key).not.toBe('on');
      expect(d.activationCondition.length, d.key).toBeGreaterThan(12);
    }
    expect(DOMAINS.filter((d) => d.highRisk).map((d) => d.key)).toEqual(['housing', 'registration_transaction', 'gradebook', 'student_accounts', 'dining']);
  });

  it('holds every gate item to a file, and nothing for what is owed', () => {
    const ids = GO_GATE.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const x of GO_GATE) {
      if (x.state === 'owed') expect(x.evidence, x.id).toBeNull();
      else expect(x.evidence && exists(x.evidence), `${x.id} cites ${x.evidence}`).toBe(true);
    }
    for (const s of Object.keys(GATE_SECTIONS) as GateSection[]) expect(GO_GATE.some((x) => x.section === s), s).toBe(true);
  });

  it('has a council seat for every seat, and nobody has signed', () => {
    expect(Object.keys(COUNCIL).sort()).toEqual([...SEATS].sort());
    // Signatures are recorded only when given in writing. None has been.
    expect(Object.values(COUNCIL).every((v) => v === null)).toBe(true);
  });

  it('states the finding: NOT GO, and why', () => {
    const d = goDecision();
    expect(d.go).toBe(false);
    expect(counts()).toMatchObject({ designed: 0, built: 14, internally_verified: 0, go_certified: 0 });
    expect(gateCounts()).toEqual({ passed: 4, partial: 21, owed: 3 });
    // Twelve P0 gate items open, fourteen domains unverified, twelve seats unsigned.
    expect(d.blockers.filter((b) => /^[A-Z]-\d/.test(b))).toHaveLength(12);
    expect(d.blockers.filter((b) => b.endsWith('not internally verified.'))).toHaveLength(DOMAINS.length);
    expect(d.blockers.filter((b) => b.includes('seat'))).toHaveLength(SEATS.length);
    expect(d.blockers).toHaveLength(12 + DOMAINS.length + SEATS.length);
  });

  it('reaches GO only when every condition holds, and a refusal blocks it', () => {
    const passed = GO_GATE.map((x) => ({ ...x, state: 'passed' as const }));
    const signed = Object.fromEntries(SEATS.map((s) => [s, 'approved' as const])) as Record<(typeof SEATS)[number], 'approved'>;
    expect(goDecision([verified], passed, signed)).toEqual({ go: true, blockers: [] });
    expect(goDecision([verified], passed, { ...signed, security: 'not_approved' }).blockers).toEqual(['The security seat did not approve.']);
    expect(goDecision([verified], passed, { ...signed, privacy: 'approved_with_condition' }).go).toBe(true);
    expect(goDecision([DOMAINS[0]], passed, signed).go).toBe(false);
  });

  it(`is what ${DOC} says`, () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
    expect(readFileSync(join(root, DOC), 'utf8'), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

const label = (s: string) => LADDER.find((r) => r.key === s)?.label ?? s;
const ref = (p: string | null) => (p ? `[\`${p}\`](${link(DOC, p)})` : '—');

function render(): string {
  const d = goDecision();
  const g = gateCounts();
  const out: string[] = [
    '# Release certification',
    '',
    renderedFrom('app/src/lib/governance/certification.ts', 'certification.test.ts'),
    '',
    controlLine(DOC),
    '',
    'Semester’s release model: **build everything, certify GO internally, then',
    'pilot.** A pilot is a deployment and refinement programme — adoption,',
    'configuration, workflow fit, commercial evidence — never the first time a',
    'critical feature runs. Built does not mean enabled; GO does not mean every',
    'module is on for every school.',
    '',
    '```',
    LADDER.map((r) => r.label).join(' → '),
    '```',
    '',
    `## The decision: ${d.go ? 'GO' : 'NOT GO'}`,
    '',
    d.go
      ? 'Every gate item passed, every domain is internally verified, and every seat signed.'
      : `**${d.blockers.length} blockers.** GO is computed from the gate, the domains and the council below, never declared. Of the ${GO_GATE.length} gate items, ${g.passed} have passed, ${g.partial} are partial and ${g.owed} are owed.`,
    '',
    ...d.blockers.map((b) => `- ${cell(b)}`),
    '',
    '## The ladder',
    '',
    ...table(['Rung', 'Means', 'Domains here'], LADDER.map((r) => [r.label, r.meaning, String(counts()[r.key])]), ['left', 'left', 'right']),
    '',
    'A status may not pass the rung its evidence supports: a spec for',
    '*designed*, code for *built*, all four checks passed for *internally',
    'verified*, the platform’s GO for *production-certified*, a named pilot for',
    '*deployed*, and a file of real-user evidence for *refined*.',
    '',
    '## Domains',
    '',
    ...table(
      ['Domain', 'Status', ...CHECKS.map((c) => c.label), 'Pilot activation', 'To complete'],
      DOMAINS.map((x) => [
        x.name,
        label(x.status),
        ...CHECKS.map((c) => x.checks[c.key].state),
        cell(x.activation === 'conditional' ? `conditional: ${x.activationCondition}` : x.activation === 'off' ? `off: ${x.activationCondition}` : 'on'),
        cell(x.toComplete),
      ]),
    ),
    '',
  ];
  for (const x of DOMAINS) {
    out.push(`### ${x.name}`, '', `Status **${label(x.status)}** · owner \`${x.owner}\` · spec ${ref(x.spec)}${x.flags.length ? ` · flags ${x.flags.map((f) => `\`${f}\``).join(', ')}` : ''}`, '');
    if (x.code.length) out.push(`Code: ${x.code.map(ref).join(', ')}`, '');
    out.push(...table(['Check', 'State', 'Evidence', 'Note'], CHECKS.map((c) => [c.label, x.checks[c.key].state, ref(x.checks[c.key].evidence), cell(x.checks[c.key].note)])), '');
  }
  out.push('## The GO gate', '', 'Items marked **P0** are conditions of a full GO: while one is open the answer is NOT GO, whatever else passes.', '');
  for (const [s, title] of Object.entries(GATE_SECTIONS)) {
    out.push(`### ${title}`, '', ...table(['ID', 'Item', 'State', 'P0', 'Evidence', 'Note'], GO_GATE.filter((x) => x.section === s).map((x) => [x.id, cell(x.item), x.state, x.p0 ? 'P0' : '', ref(x.evidence), cell(x.note)])), '');
  }
  out.push(
    '## The Production Readiness Council',
    '',
    'Each seat signs *approved*, *approved with a documented non-P0 condition*,',
    'or *not approved*. A signature is recorded only when the seat’s holder',
    'gives it in writing.',
    '',
    ...table(['Seat', 'Signature'], SEATS.map((s) => [`\`${s}\``, COUNCIL[s] ?? 'unsigned'])),
    '',
    '## What a pilot is for, after GO',
    '',
    ...table(['Objective', 'What it learns'], PILOT_OBJECTIVES.map((p) => [p.objective, p.learns])),
    '',
  );
  return out.join('\n');
}
