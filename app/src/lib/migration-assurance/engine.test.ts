import { describe, expect, it } from 'vitest';
import { DEPENDS_ON, DOMAINS, DOMAIN_IDS } from './domains';
import { countParity, proveProbes, runDomain, same } from './engine';
import { syntheticPair } from './fixtures';
import { INVARIANT_KINDS, type DomainSpec, type InvariantSpec, type Pair, type Row } from './types';
import { namesNeverIngest } from '../integration/adapter';

const academic = DOMAINS.find((d) => d.id === 'academic_records')!;
const finance = DOMAINS.find((d) => d.id === 'finance')!;
const family = DOMAINS.find((d) => d.id === 'family')!;
const identity = DOMAINS.find((d) => d.id === 'identity')!;
const enrollments = DOMAINS.find((d) => d.id === 'enrollments')!;

const find = (d: DomainSpec, pair: Pair, id: string) => runDomain(d, pair).find((r) => r.invariant === id)!;
const edit = (pair: Pair, side: 'source' | 'target', entity: string, change: (rows: Row[]) => Row[]): Pair => ({
  ...pair,
  [side]: { ...pair[side], [entity]: change([...(pair[side][entity] ?? [])]) },
});
const set = (rows: Row[], i: number, patch: Record<string, unknown>) => rows.map((r, n) => (n === i ? { ...r, ...patch } : r));

describe('the declarations describe themselves consistently', () => {
  const entityNames = (d: DomainSpec) => new Set([...d.entities, ...d.references].map((e) => e.name));
  const fieldsOf = (d: DomainSpec, entity: string) => new Set([...d.entities, ...d.references].find((e) => e.name === entity)!.fields.map((f) => f.name));

  /** Every (entity, field) an invariant reads, so a typo in a spec is a red test and not a silent no-op. */
  function reads(s: InvariantSpec): [string, string][] {
    switch (s.kind) {
      case 'crosswalk': return [];
      case 'unique': return s.fields.map((f) => [s.entity, f]);
      case 'reference': return [[s.entity, s.field]];
      case 'preserved': return [...s.fields, ...(s.links ?? []).map((l) => l.field)].map((f) => [s.entity, f]);
      case 'derived': return [[s.child, s.childSubject], [s.child, s.value], ...(s.weight ? [[s.child, s.weight] as [string, string]] : []), ...(s.filter ? [[s.child, s.filter.field] as [string, string]] : []), ...(s.stated ? [[s.entity, s.stated] as [string, string]] : [])];
      case 'history': return [[s.entity, s.subject], [s.entity, s.seq], [s.entity, s.value], ...(s.current ? [[s.subjectEntity, s.current] as [string, string]] : [])];
      case 'permission': return [[s.entity, s.principal], [s.entity, s.resource], ...(s.requires ? [[s.requires.entity, s.requires.principal], [s.requires.entity, s.requires.resource]] as [string, string][] : [])];
      case 'order': return [[s.entity, s.group], [s.entity, s.position]];
      case 'bounded': return [[s.entity, s.group], [s.groupEntity, s.capacity], ...(s.filter ? [[s.entity, s.filter.field] as [string, string]] : [])];
      case 'temporal': return [[s.entity, s.start], [s.entity, s.end]];
    }
  }

  it.each(DOMAINS.map((d) => [d.id, d] as const))('%s: every invariant names real entities and fields', (_id, d) => {
    const names = entityNames(d);
    const bad: string[] = [];
    for (const s of d.invariants) {
      for (const [e, f] of reads(s)) {
        if (!names.has(e)) bad.push(`${s.id}: no entity ${e}`);
        else if (!fieldsOf(d, e).has(f)) bad.push(`${s.id}: ${e} has no field ${f}`);
      }
      for (const e of [s.entity, 'to' in s ? s.to : s.entity, 'groupEntity' in s && s.groupEntity ? s.groupEntity : s.entity]) if (!names.has(e)) bad.push(`${s.id}: no entity ${e}`);
    }
    expect(bad).toEqual([]);
  });

  it('numbers its invariants uniquely and prefixes each with its domain', () => {
    const ids = DOMAINS.flatMap((d) => d.invariants.map((s) => s.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of DOMAINS) for (const s of d.invariants) expect(s.id.startsWith(`${d.id}.`)).toBe(true);
  });

  it('gives every owned entity a crosswalk check, so nothing can be silently dropped', () => {
    for (const d of DOMAINS) {
      const checked = new Set(d.invariants.filter((s) => s.kind === 'crosswalk').map((s) => s.entity));
      expect(d.entities.filter((e) => !checked.has(e.name)).map((e) => `${d.id}.${e.name}`)).toEqual([]);
    }
  });

  it('uses every kind of check somewhere, and lists ten domains in a load order that respects references', () => {
    const used = new Set(DOMAINS.flatMap((d) => d.invariants.map((s) => s.kind)));
    expect(INVARIANT_KINDS.filter((k) => !used.has(k))).toEqual([]);
    expect(DOMAIN_IDS).toHaveLength(10);
    const seen = new Set<string>();
    for (const id of DOMAIN_IDS) {
      expect(DEPENDS_ON[id].filter((dep) => !seen.has(dep))).toEqual([]);
      seen.add(id);
    }
  });

  it('keeps every domain with high stakes strict about who owns the answer', () => {
    for (const d of DOMAINS) {
      expect(d.owner.length).toBeGreaterThan(5);
      expect(d.acceptance.length).toBeGreaterThanOrEqual(3);
      if (d.stakes === 'high') expect(d.invariants.some((s) => s.severity === 'critical')).toBe(true);
    }
  });

  it('never lets a T4 or higher field be a migrated field', () => {
    for (const d of DOMAINS) {
      for (const e of d.entities) for (const f of e.fields) expect(['T4', 'T5', 'T6'], `${d.id}.${e.name}.${f.name}`).not.toContain(f.class);
      for (const x of d.excluded) if (x.class >= 'T4') expect(x.handling.length).toBeGreaterThan(20);
    }
  });

  it('names grades and money fields the platform never ingests by default, so scope.ts has something to gate', () => {
    expect(namesNeverIngest('grade')).toBe(true);
    expect(academic.entities.flatMap((e) => e.fields).some((f) => namesNeverIngest(f.name))).toBe(true);
  });
});

describe('clean data is clean, and the checks looked at something', () => {
  it.each(DOMAINS.map((d) => [d.id, d] as const))('%s: no findings, every check examined rows, counts agree', (_id, d) => {
    const pair = syntheticPair(d);
    const results = runDomain(d, pair);
    expect(results.flatMap((r) => r.findings.map((f) => `${r.invariant}: ${f.what}`))).toEqual([]);
    expect(results.filter((r) => r.examined === 0).map((r) => r.invariant)).toEqual([]);
    expect(countParity(d, pair).filter((c) => !c.ok)).toEqual([]);
  });
});

describe('every check is proven to notice its own kind of defect (the control)', () => {
  it.each(DOMAINS.map((d) => [d.id, d] as const))('%s: every invariant detects an injected defect', (_id, d) => {
    const proofs = proveProbes(d, syntheticPair(d));
    expect(proofs.filter((p) => p.status !== 'detected').map((p) => `${p.invariant}: ${p.status} ${p.caught}/${p.injected}`)).toEqual([]);
  });

  it('reports a check with nothing to look at as vacuous rather than as passing', () => {
    const pair = syntheticPair(finance);
    const empty: Pair = { ...pair, source: { ...pair.source, payment_plan: [] }, target: { ...pair.target, payment_plan: [] } };
    expect(proveProbes(finance, empty).find((p) => p.invariant === 'finance.plan.preserved')!.status).toBe('vacuous');
  });
});

describe('what row counts cannot see', () => {
  it('swaps two students\' grades: counts equal, and the checks that look at meaning fail', () => {
    const pair = syntheticPair(academic);
    const [a, b] = [pair.target.course_result[0], pair.target.course_result[1]];
    const swapped = edit(pair, 'target', 'course_result', (rows) => set(set(rows, 0, { grade: b.grade, grade_points: 1 }), 1, { grade: a.grade, grade_points: 0 }));
    expect(countParity(academic, swapped).every((c) => c.ok)).toBe(true);
    expect(find(academic, swapped, 'academic_records.result.preserved').findings.length).toBeGreaterThan(0);
    expect(find(academic, swapped, 'academic_records.student.gpa').findings.length).toBeGreaterThan(0);
  });

  it('moves a grade to the wrong student with a perfectly valid key: reference passes, the link check does not', () => {
    const pair = syntheticPair(academic);
    const other = pair.target.student_record[3].student_id;
    const wrong = edit(pair, 'target', 'course_result', (rows) => set(rows, 0, { student_id: other }));
    expect(find(academic, wrong, 'academic_records.result.student').findings).toEqual([]);
    expect(find(academic, wrong, 'academic_records.result.preserved').findings.map((f) => f.what)).toContain('course_result.student_id now points at a different student_record');
  });

  it('loads a revoked guardian consent as active and refuses the access it would grant', () => {
    const pair = syntheticPair(family);
    const revived = edit(pair, 'target', 'consent_record', (rows) => set(rows, 0, { revoked_on: null, active: 'true' }));
    expect(find(family, revived, 'family.consent.dates').findings.length).toBeGreaterThan(0);
    const widened = edit(pair, 'target', 'consent_record', (rows) => set(rows, 0, { active: 'false' }));
    expect(find(family, widened, 'family.proxy.access').findings.map((f) => f.what)).toContain('proxy_access grant has no active consent_record record');
  });

  it('refuses a balance that was recomputed through a float', () => {
    const pair = syntheticPair(finance);
    const floaty = edit(pair, 'target', 'ledger_entry', (rows) => set(rows, 0, { amount_cents: Number(rows[0].amount_cents) + 0.4 }));
    const found = find(finance, floaty, 'finance.account.balance').findings.map((f) => f.what);
    expect(found).toContain('ledger_entry.amount_cents is not a whole number');
  });

  it('refuses two people collapsing into one, unless the registrar approved that exact merge', () => {
    const pair = syntheticPair(identity);
    const [a, b] = [Object.keys(pair.crosswalk.person)[0], Object.keys(pair.crosswalk.person)[1]];
    const merged: Pair = { ...pair, crosswalk: { ...pair.crosswalk, person: { ...pair.crosswalk.person, [b]: pair.crosswalk.person[a] } } };
    expect(find(identity, merged, 'identity.person.crosswalk').findings.map((f) => f.what)).toContain('two source rows share one target row');
    const approved: Pair = { ...merged, approvedMerges: { person: [pair.crosswalk.person[a]] } };
    expect(find(identity, approved, 'identity.person.crosswalk').findings.map((f) => f.what)).not.toContain('two source rows share one target row');
  });

  it('attributes a defect to the source when the source already had it', () => {
    const pair = syntheticPair(academic);
    const dirty = edit(edit(pair, 'source', 'student_record', (r) => set(r, 0, { gpa: 0.1 })), 'target', 'student_record', (r) => set(r, 0, { gpa: 0.1 }));
    const gpa = find(academic, dirty, 'academic_records.student.gpa').findings;
    expect(gpa.map((f) => f.origin)).toEqual(['source']);
  });

  it('does not count an excluded row as lost, and does count one that was excluded but moved anyway', () => {
    const pair = syntheticPair(enrollments);
    const key = pair.source.registration_hold[0].hold_id as string;
    const gone = edit(pair, 'target', 'registration_hold', (rows) => rows.slice(1));
    expect(find(enrollments, gone, 'enrollments.hold.crosswalk').findings.length).toBeGreaterThan(0);
    const excluded: Pair = { ...gone, excluded: { registration_hold: { [key]: 'released before the extract date, approved by the registrar' } }, crosswalk: { ...gone.crosswalk, registration_hold: Object.fromEntries(Object.entries(gone.crosswalk.registration_hold).filter(([k]) => k !== key)) } };
    expect(find(enrollments, excluded, 'enrollments.hold.crosswalk').findings).toEqual([]);
    expect(countParity(enrollments, excluded).find((c) => c.entity === 'registration_hold')).toMatchObject({ excluded: 1, ok: true });
    const movedAnyway: Pair = { ...excluded, crosswalk: gone.crosswalk };
    expect(find(enrollments, movedAnyway, 'enrollments.hold.crosswalk').findings.map((f) => f.what)).toContain('a row the institution excluded was migrated');
  });

  it('reports lost access as narrowing and gained access as widening', () => {
    const pair = syntheticPair(identity);
    const wider = edit(pair, 'target', 'role_grant', (rows) => [...rows, { ...rows[0], role_scope: 'registrar:all' }]);
    const w = find(identity, wider, 'identity.role_grant.access').findings;
    expect(w[0]).toMatchObject({ severity: 'critical', origin: 'migration' });
    const narrower = edit(pair, 'target', 'role_grant', (rows) => rows.slice(1));
    expect(find(identity, narrower, 'identity.role_grant.access').findings.map((f) => f.severity)).toContain('major');
  });
});

describe('comparison is by meaning, not by spelling', () => {
  it('treats absent and empty as the same, and numbers and dates as what they are', () => {
    expect(same(null, '')).toBe(true);
    expect(same(undefined, null)).toBe(true);
    expect(same(null, 'x')).toBe(false);
    expect(same('3', 3)).toBe(true);
    expect(same('007', 7)).toBe(false);
    expect(same('3.0', 3, 'number')).toBe(true);
    expect(same('2026-09-01', '2026-09-01T00:00:00Z', 'date')).toBe(true);
    expect(same('2026-09-01', '2026-09-02', 'date')).toBe(false);
    expect(same('not a date', 'not a date', 'date')).toBe(false);
  });
});
