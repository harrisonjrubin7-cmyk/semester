import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cell, controlLine, renderedFrom, table } from '../ops/render';
import {
  ADMISSION,
  CAPABILITIES,
  DEPARTMENTS,
  OPERATING_AREAS,
  PRIMITIVES,
  PRIMITIVE_IDS,
  PRIORITIES,
  PRIORITY_IDS,
  PRINCIPLES,
  ROLES,
  ROLE_FIELDS,
  byPrimitive,
  coverage,
  roleCount,
  type Capability,
} from './constitution';

/**
 * The constitution is only worth having if a capability cannot claim more
 * than the tree shows:
 *
 *   - every primitive has a home that exists, and every capability names one
 *     of the eight and one of P0–P5;
 *   - a `partial` capability cites a file that exists, an `absent` one cites
 *     nothing;
 *   - the counts are stated here, so a change either way is a line in a diff;
 *   - the admission questions, departments and roles are the briefs’ own
 *     numbers, so one cannot be dropped quietly.
 *
 * `docs/PLATFORM-CONSTITUTION.md` is rendered from the data; run
 * `REGISTERS=write pnpm exec vitest run src/lib/governance/constitution.test.ts`
 * from app/ to rewrite it.
 */

const root = join(import.meta.dirname, '../../../..');
const exists = (p: string) => existsSync(join(root, p));
const DOC = 'docs/PLATFORM-CONSTITUTION.md';

describe('the platform constitution', () => {
  it('can tell a missing file from a present one', () => {
    expect(exists('README.md')).toBe(true);
    expect(exists('app/src/lib/governance/no-such-thing.ts')).toBe(false);
  });

  it('has eight primitives, each at home in a file that exists', () => {
    expect(PRIMITIVE_IDS).toEqual([
      'identity-tenancy',
      'permission-consent-authority',
      'data-provenance',
      'policy-rules',
      'action-workflow',
      'integration-gateway',
      'trust-evidence',
      'experience-accessibility',
    ]);
    expect(PRIMITIVES.map((p) => p.id)).toEqual([...PRIMITIVE_IDS]);
    expect(PRIMITIVES).toHaveLength(8);
    for (const p of PRIMITIVES) {
      expect(p.one.length, p.id).toBeGreaterThan(30);
      expect(exists(p.home), `${p.id} lives in ${p.home}, which is missing`).toBe(true);
    }
  });

  it('holds the principles to something that exists', () => {
    expect(PRINCIPLES).toHaveLength(12);
    expect(PRINCIPLES.map((x) => x.principle)).toEqual([
      'Students control personal plans, drafts, sharing, and exports.',
      'Official institutional systems remain authoritative unless an institution explicitly approves Semester for a bounded workflow.',
      'Meaningful facts carry source, provenance, freshness, and correction paths.',
      'High-impact actions are explained, previewed, confirmed, and audited.',
      'AI cites authorized sources, follows institutional and course policy, and does not silently make high-impact decisions.',
      'No person, integration, or agent receives unrestricted student-data access by default.',
      'Tenant data is isolated and sensitive requests are purpose-bound.',
      'Accessibility is a release criterion.',
      'Failures preserve data, expose honest status, and retain an official or human fallback.',
      'Public claims cannot exceed verified maturity and current evidence.',
      'Tenant activation requires the applicable policy, approval, data map, support ownership, monitoring, and rollback path.',
      'Semester builds the smallest safe solution that improves a defined student decision or institutional workflow.',
    ]);
    for (const x of PRINCIPLES) {
      expect(x.principle.length, x.id).toBeGreaterThan(20);
      expect(exists(x.heldBy), `${x.id} is held by ${x.heldBy}, which is missing`).toBe(true);
      if (x.heldBy === DOC) expect(['constitution', 'admission']).toContain(x.id);
    }
  });

  it('keeps the twelve admission questions and the six priorities', () => {
    expect(ADMISSION).toHaveLength(12);
    expect(ADMISSION.every((q) => q.endsWith('?'))).toBe(true);
    expect(ADMISSION[1]).toMatch(/eight primitives/);
    expect(PRIORITY_IDS.map((p) => PRIORITIES[p].length > 20)).toEqual([true, true, true, true, true, true]);
  });

  it('names each capability once, under a known primitive and priority', () => {
    const ids = CAPABILITIES.map((c) => c.id);
    expect(ids).toEqual([
      ...Array.from({ length: 15 }, (_, i) => `J-${String(i + 1).padStart(2, '0')}`),
      ...Array.from({ length: 12 }, (_, i) => `I-${String(i + 1).padStart(2, '0')}`),
      ...Array.from({ length: 10 }, (_, i) => `O-${String(i + 1).padStart(2, '0')}`),
    ]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CAPABILITIES) {
      expect(PRIMITIVE_IDS, c.id).toContain(c.primitive);
      expect(PRIORITY_IDS, c.id).toContain(c.priority);
      expect(c.note.trim().length, `${c.id} has no note`).toBeGreaterThan(40);
    }
  });

  it('cites evidence that exists, and nothing for what is absent', () => {
    for (const c of CAPABILITIES) {
      if (c.status === 'absent') expect(c.evidence, `${c.id} is absent and cites ${c.evidence}`).toBeNull();
      else {
        expect(c.evidence, `${c.id} is partial and cites nothing`).not.toBeNull();
        expect(exists(c.evidence!), `${c.id} cites ${c.evidence}, which is missing`).toBe(true);
      }
    }
  });

  it('states the finding: 37 capabilities, none complete, 10 absent', () => {
    expect(CAPABILITIES).toHaveLength(37);
    expect(coverage()).toEqual({ partial: 27, absent: 10 });
    const one: Capability = { id: 'x', title: 't', source: 'operating', primitive: 'trust-evidence', priority: 'P0', status: 'absent', evidence: null, note: 'n' };
    expect(coverage([one])).toEqual({ partial: 0, absent: 1 });
  });

  it('says the two built in this change are partial, not built', () => {
    const by = (id: string) => CAPABILITIES.find((c) => c.id === id)!;
    expect(by('J-02').evidence).toBe('app/src/lib/lifeevents.ts');
    expect(by('I-11').evidence).toBe('packages/institution/src/automation.ts');
    expect(by('J-02').status).toBe('partial');
    expect(by('I-11').status).toBe('partial');
    expect(by('J-04').evidence).toBe('app/src/lib/momentfeedback.ts');
    // Wired means wired behind a flag that is off, on the device only: the register says so rather than "built".
    for (const id of ['J-02', 'J-04']) {
      expect(by(id).note, id).toMatch(/off by default/);
      expect(by(id).note, id).toMatch(/device/);
    }
    expect(by('J-04').status).toBe('partial');
  });

  it('says which primitives none of the briefs found a gap under, rather than inventing one', () => {
    const b = byPrimitive();
    expect(PRIMITIVE_IDS.filter((p) => b[p].length === 0)).toEqual(['identity-tenancy']);
  });

  it('keeps the thirty-three departments, each with the line it does not cross', () => {
    expect(DEPARTMENTS).toHaveLength(33);
    expect(new Set(DEPARTMENTS.map((d) => d.name)).size).toBe(33);
    for (const d of DEPARTMENTS) expect(d.boundary.length, d.name).toBeGreaterThan(20);
    const b = (n: string) => DEPARTMENTS.find((d) => d.name === n)!.boundary;
    expect(b('Financial aid')).toMatch(/aid data/);
    expect(b('Career services')).toMatch(/opt-in/);
    expect(b('Facilities / transportation')).toMatch(/location tracking/);
  });

  it('keeps the roles and the ten things every role is defined by', () => {
    expect(ROLE_FIELDS).toHaveLength(10);
    expect(roleCount()).toBe(56);
    const all = Object.values(ROLES).flat();
    expect(new Set(all).size).toBe(all.length);
    expect(exists('docs/ROLE_REQUIREMENTS.md')).toBe(true);
    expect(OPERATING_AREAS).toHaveLength(14);
  });

  it(`is what ${DOC} says`, () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
    expect(readFileSync(join(root, DOC), 'utf8'), `${DOC} is stale; run \`REGISTERS=write pnpm exec vitest run src/lib/governance/constitution.test.ts\` from app/`).toBe(rendered);
  });
});

function render(): string {
  const c = coverage();
  const b = byPrimitive();
  const out: string[] = [
    '# Platform constitution and capability map',
    '',
    renderedFrom('app/src/lib/governance/constitution.ts', 'constitution.test.ts'),
    '',
    controlLine(DOC),
    '',
    'Semester has covered the product domains a university runs on. What remains',
    'is not another module; it is keeping the ones there coherent. Every capability',
    'belongs to one of eight primitives, and a proposed feature that strengthens',
    'none of them is deferred, merged or rejected.',
    '',
    `**${CAPABILITIES.length} capabilities named by the four briefs: none complete, ${c.partial} partial, ${c.absent} absent.** A partial row cites the file that holds part of it; an absent row cites nothing. The test states these counts, so a change either way is a line in a diff.`,
    '',
    '## The eight primitives',
    '',
    ...table(
      ['Primitive', 'One shared system', 'Lives in', 'Capabilities'],
      PRIMITIVES.map((p) => [p.name, cell(p.one), `\`${p.home}\``, String(b[p.id].length)]),
      ['left', 'left', 'left', 'right'],
    ),
    '',
    '## The constitution',
    '',
    ...table(['Part', 'The product is held to', 'Held by'], PRINCIPLES.map((x) => [x.name, cell(x.principle), `\`${x.heldBy}\``])),
    '',
    '## Feature admission',
    '',
    'Answered before work starts on any feature, workflow, screen, integration or',
    'system. The answers are the first section of the pull request.',
    '',
    ...ADMISSION.map((q, i) => `${i + 1}. ${q}`),
    '',
    '## Priority order',
    '',
    ...table(['', 'Complete'], PRIORITY_IDS.map((p) => [p, PRIORITIES[p]])),
    '',
    '## Capability map',
    '',
    ...table(
      ['Id', 'Capability', 'Primitive', 'Priority', 'Status', 'Evidence file', 'What exists, what would close it'],
      CAPABILITIES.map((x) => [x.id, cell(x.title), x.primitive, x.priority, x.status, x.evidence ? `\`${x.evidence}\`` : '—', cell(x.note)]),
    ),
    '',
    'Owner, data classification, permission model, contracts, SLO, fallback,',
    'migration state and release status are held for the shipped modules by',
    '[`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md),',
    '[`CAPABILITY-PARITY-MATRIX.md`](CAPABILITY-PARITY-MATRIX.md) and',
    '[`ROLE-LAUNCH-REGISTER.md`](ROLE-LAUNCH-REGISTER.md); this map adds the primitive,',
    'the priority and the evidence, and does not duplicate them.',
    '',
    '## Departments and the line each does not cross',
    '',
    'Semester serves every department by centralising the experience, workflow,',
    'explanation and action layer, not by giving departments broad student-data',
    'access: need → minimum data → role and purpose check → consent where the',
    'student is the source → approved workflow or official handoff → audit and',
    'retention.',
    '',
    ...table(['Department', 'Boundary'], DEPARTMENTS.map((d) => [d.name, cell(d.boundary)])),
    '',
    `## Roles (${roleCount()})`,
    '',
    `Every role is defined by ${ROLE_FIELDS.length} things before it exists: ${ROLE_FIELDS.map((f) => f.toLowerCase()).join('; ')}.`,
    '',
    ...Object.entries(ROLES).map(([g, r]) => `- **${g}.** ${r.join(', ')}.`),
    '',
    '## The fourteen operating areas',
    '',
    OPERATING_AREAS.join(' · '),
    '',
  ];
  return out.join('\n');
}
