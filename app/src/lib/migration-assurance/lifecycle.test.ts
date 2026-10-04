import { beforeEach, describe, expect, it } from 'vitest';
import { GENESIS, append, canonical, defaultRetention, entryProblems, retentionProblems, seal, verifyChain, verifyManifest, type Body, type Entry, type EntryInput } from './evidence';
import { ROLES, STAGES, advance, charter, cutoverPlanProblems, gateProblems, replay, status, type Role, type StageOrEnd } from './lifecycle';

/*
 * A driver that does what an institution and Semester would do, one stage at a
 * time, against the real ledger and the real gates. Two domains: identity (high
 * stakes) and courses (standard), so both paths through the gates are walked.
 */
const DOMAINS = ['identity', 'courses'];
const PLAN: Body = {
  windowMinutes: 240, rollbackMinutes: 90, rollbackWindowHours: 96, snapshotRef: 'snap-2026-12-01', deltaCapture: true,
  triggers: ['sign-in failure over 2%', 'any critical reconciliation difference', 'registration unavailable over 30 minutes'],
  decisionOwner: 'registrar', freezeStart: '2026-12-05T00:00:00Z', freezeEnd: '2026-12-05T06:00:00Z', incumbentReadOnlyUntil: '2026-12-20T00:00:00Z',
  commsApproved: true, supportStaffed: true,
};

let chain: Entry[];
let clock: number;
const iso = () => new Date(clock).toISOString();

async function put(input: Omit<EntryInput, 'at' | 'summary' | 'body' | 'retention'> & { body?: Body; summary?: string }): Promise<Entry> {
  clock += 60_000;
  const r = await append(chain, { summary: `${input.kind}`, body: {}, retention: defaultRetention(input.type, input.kind), at: iso(), ...input });
  if (!r.ok) throw new Error(r.problems.join('; '));
  chain = [...chain, r.entry];
  return r.entry;
}
const file = (kind: string, domain: string | undefined, body: Body = {}, actor = 'ana') => put({ type: 'evidence', kind, domain, actor, body });
const sign = (role: Role, who: string, ev: Entry, domain?: string, side: string = ROLES[role]) => put({ type: 'signoff', kind: role, actor: who, domain, body: { side }, covers: [ev.hash] });
const snapshot = (domain: string, over: Body = {}) => put({ type: 'exceptions', kind: 'snapshot', domain, actor: 'ana', body: { openCritical: 0, openMajor: 0, overdue: 0, ...over } });
async function enter(to: StageOrEnd) {
  const r = advance(chain, to, 'lead', iso());
  if (!r.ok) throw new Error(`${to}: ${r.problems.join('; ')}`);
  await put({ ...r.entry, body: r.entry.body });
}
const refuse = (to: StageOrEnd) => {
  const r = advance(chain, to, 'lead', iso());
  if (r.ok) throw new Error(`${to} should have been refused`);
  return r.problems.join(' | ');
};
const hash = (kind: string, domain: string) => [...chain].reverse().find((e) => e.kind === kind && e.domain === domain)!.hash;
const jump = (hours: number) => { clock += hours * 3_600_000; };

/** Everything the gate into `to` needs, filed and signed, without entering it. */
async function prepare(to: StageOrEnd) {
  switch (to) {
    case 'extract':
      for (const d of DOMAINS) await sign('data_owner', 'reg', await file('source_inventory', d), d);
      break;
    case 'map':
      for (const d of DOMAINS) {
        await file('extract_manifest', d, { independentRead: true, sourceFrozen: true });
        const s = await file('scope_approval', d, { unapproved: 0, blocked: 0 });
        await sign('data_owner', 'reg', s, d);
        await sign('privacy_security', 'sec', s, d);
      }
      break;
    case 'cleanse':
      for (const d of DOMAINS) {
        const m = await file('mapping_spec', d, { status: 'approved' });
        await sign('data_owner', 'reg', m, d);
        await sign('migration_lead', 'lead', m, d);
      }
      break;
    case 'transform':
      for (const d of DOMAINS) await sign('data_owner', 'reg', await file('cleansing_report', d, { unmapped: 0 }), d);
      break;
    case 'validate':
      for (const d of DOMAINS) await file('transform_run', d, { crosswalkHash: 'cw1' });
      break;
    case 'rehearse':
      for (const d of DOMAINS) {
        await file('validation_report', d, { verdict: 'pass', independentSourceRead: true });
        await file('probe_proof', d, { unproven: 0 });
        await snapshot(d);
      }
      break;
    case 'parallel_run': {
      const plan = await file('cutover_plan', undefined, PLAN);
      const mappings = DOMAINS.map((d) => hash('mapping_spec', d));
      await file('rehearsal_report', undefined, { clean: true, durationMinutes: 80, mappings });
      await file('rehearsal_report', undefined, { clean: true, durationMinutes: 70, mappings });
      await file('rollback_rehearsal', undefined, { restoredMinutes: 60 });
      await sign('migration_lead', 'lead', plan);
      await sign('privacy_security', 'sec', plan);
      break;
    }
    case 'cutover': {
      await file('parallel_run_report', 'identity', { accepted: true });
      for (const d of DOMAINS) await snapshot(d);
      const plan = chain.find((e) => e.kind === 'cutover_plan')!;
      await sign('executive_sponsor', 'cio', plan);
      await sign('data_owner', 'reg', chain.find((e) => e.hash === hash('parallel_run_report', 'identity'))!, 'identity');
      await sign('data_owner', 'reg', chain.find((e) => e.hash === hash('validation_report', 'courses'))!, 'courses');
      await put({ type: 'decision', kind: 'go', actor: 'cio', body: {} });
      break;
    }
    case 'stabilize':
      await file('cutover_report', undefined, { reconciled: true, rollbackWindowHours: 96 });
      break;
    case 'archive': {
      await file('final_reconciliation', undefined, { clean: true });
      const m = await file('archive_manifest', undefined, { sealed: true, retentionPolicyConfirmed: true, counselReviewed: true, legalHoldsOpen: 0 });
      for (const d of DOMAINS) await sign('data_owner', 'reg', m, d);
      await sign('executive_sponsor', 'cio', m);
      await sign('privacy_security', 'sec', m);
      break;
    }
    default:
  }
}

async function driveTo(target: StageOrEnd) {
  for (const stage of STAGES.slice(1)) {
    await prepare(stage);
    if (stage === 'archive') jump(97);
    await enter(stage);
    if (stage === target) return;
  }
}

beforeEach(async () => {
  chain = [];
  clock = Date.parse('2026-11-01T09:00:00Z');
  await put(charter({ tenant: 'tenant-a', wave: 'wave-1', domains: DOMAINS, actor: 'lead', now: iso() }));
});

describe('a migration that does everything', () => {
  it('walks every stage in order, and the ledger replays with nothing to report', async () => {
    await driveTo('archive');
    const run = replay(chain);
    expect(run.violations).toEqual([]);
    expect(run.stage).toBe('archive');
    expect(Object.keys(run.stageAt)).toEqual([...STAGES]);
    expect(await verifyChain(chain)).toMatchObject({ ok: true });
    expect(status(chain, iso())).toMatchObject({ next: null, problems: [] });
  });

  it('says what the next stage still needs', async () => {
    const s = status(chain, iso());
    expect(s.next).toBe('extract');
    expect(s.problems.join(' ')).toContain('identity: no source_inventory');
  });
});

describe('the order of stages', () => {
  it('refuses to skip a stage', () => {
    expect(refuse('validate')).toContain('does not follow inventory');
  });
});

describe('sign-offs mean something', () => {
  it('refuses a stage whose evidence nobody has signed', async () => {
    for (const d of DOMAINS) await file('source_inventory', d);
    expect(refuse('extract')).toContain('data_owner (identity) has not signed the current source_inventory');
  });

  it('voids an old signature the moment new evidence replaces what it signed', async () => {
    await prepare('extract');
    await file('source_inventory', 'identity');
    expect(refuse('extract')).toContain('data_owner (identity) has not signed the current source_inventory');
  });

  it('does not accept a signature from the person who produced the evidence', async () => {
    for (const d of DOMAINS) await sign('data_owner', 'ana', await file('source_inventory', d, {}, 'ana'), d);
    expect(refuse('extract')).toContain('has not signed');
  });

  it('does not accept a signature from the wrong side', async () => {
    for (const d of DOMAINS) await sign('data_owner', 'reg', await file('source_inventory', d), d, 'semester');
    expect(refuse('extract')).toContain('has not signed');
  });

  it('refuses one person holding two roles at the same gate', async () => {
    await driveTo('map');
    for (const d of DOMAINS) {
      const m = await file('mapping_spec', d, { status: 'approved' });
      await sign('data_owner', 'reg', m, d);
      await sign('migration_lead', 'reg', m, d);
    }
    expect(refuse('cleanse')).toContain('one person signed as both data_owner and migration_lead');
  });
});

describe('gates that depend on the evidence being true', () => {
  it('will not map a domain whose extract was not read independently from a frozen source', async () => {
    await driveTo('extract');
    for (const d of DOMAINS) {
      await file('extract_manifest', d, { independentRead: d !== 'courses', sourceFrozen: true });
      const s = await file('scope_approval', d, { unapproved: 0, blocked: 0 });
      await sign('data_owner', 'reg', s, d);
      await sign('privacy_security', 'sec', s, d);
    }
    expect(refuse('map')).toContain('courses: the extract was not read independently from a frozen source');
  });

  it('will not map while a field still needs approval or is blocked by the platform floor', async () => {
    await driveTo('extract');
    for (const d of DOMAINS) {
      await file('extract_manifest', d, { independentRead: true, sourceFrozen: true });
      const s = await file('scope_approval', d, { unapproved: d === 'identity' ? 2 : 0, blocked: 0 });
      await sign('data_owner', 'reg', s, d);
      await sign('privacy_security', 'sec', s, d);
    }
    expect(refuse('map')).toContain('identity: fields still need approval');
  });

  it('will not cleanse an unapproved mapping, or transform while values are unmapped', async () => {
    await driveTo('map');
    for (const d of DOMAINS) {
      const m = await file('mapping_spec', d, { status: d === 'courses' ? 'proposed' : 'approved' });
      await sign('data_owner', 'reg', m, d);
      await sign('migration_lead', 'lead', m, d);
    }
    expect(refuse('cleanse')).toContain('courses: the mapping is not approved');
  });

  it('will not rehearse on validation that predates the last transform', async () => {
    await driveTo('validate');
    for (const d of DOMAINS) {
      await file('validation_report', d, { verdict: 'pass', independentSourceRead: true });
      await file('probe_proof', d, { unproven: 0 });
      await snapshot(d);
    }
    await file('transform_run', 'identity', { crosswalkHash: 'cw2' });
    expect(refuse('rehearse')).toContain('identity: no validation_report newer than the last transform');
  });

  it('will not rehearse on a failed validation, one that read through the transform\'s own path, or unproven checks', async () => {
    await driveTo('validate');
    await file('validation_report', 'identity', { verdict: 'fail', independentSourceRead: false });
    await file('validation_report', 'courses', { verdict: 'pass', independentSourceRead: true });
    await file('probe_proof', 'identity', { unproven: 3 });
    await file('probe_proof', 'courses', { unproven: 0 });
    for (const d of DOMAINS) await snapshot(d);
    const why = refuse('rehearse');
    expect(why).toContain('identity: validation did not pass');
    expect(why).toContain("identity: validation read the source through the transform's own path");
    expect(why).toContain('identity: some checks are not proven to detect defects');
    expect(why).not.toContain('courses:');
  });

  it('will not rehearse with a critical exception open or overdue', async () => {
    await driveTo('validate');
    for (const d of DOMAINS) {
      await file('validation_report', d, { verdict: 'pass', independentSourceRead: true });
      await file('probe_proof', d, { unproven: 0 });
      await snapshot(d, d === 'courses' ? { openMajor: 1 } : { overdue: 2 });
    }
    const why = refuse('rehearse');
    expect(why).toContain('courses: critical or major exceptions are still open');
    expect(why).toContain('identity: exceptions are overdue');
  });

  it('will not rehearse on a snapshot taken before the validation it must agree with', async () => {
    await driveTo('validate');
    for (const d of DOMAINS) await snapshot(d);
    for (const d of DOMAINS) {
      await file('validation_report', d, { verdict: 'pass', independentSourceRead: true });
      await file('probe_proof', d, { unproven: 0 });
    }
    expect(refuse('rehearse')).toContain('has not been snapshotted since the evidence it must agree with');
  });
});

describe('the cutover plan and the rehearsals behind it', () => {
  it('names every way a plan can be unsafe', () => {
    expect(cutoverPlanProblems(PLAN)).toEqual([]);
    const without = (k: string): Body => Object.fromEntries(Object.entries(PLAN).filter(([key]) => key !== k));
    expect(cutoverPlanProblems({ ...PLAN, rollbackMinutes: 300 })).toContain('rolling back takes longer than the cutover window');
    expect(cutoverPlanProblems({ ...PLAN, rollbackWindowHours: 24 }).join()).toContain('under 72 hours');
    expect(cutoverPlanProblems(without('snapshotRef')).join()).toContain('no pre-cutover snapshot');
    expect(cutoverPlanProblems({ ...PLAN, deltaCapture: false }).join()).toContain('would lose it');
    expect(cutoverPlanProblems({ ...PLAN, triggers: ['one'] }).join()).toContain('fewer than three');
    expect(cutoverPlanProblems({ ...PLAN, incumbentReadOnlyUntil: '2026-12-06T00:00:00Z' }).join()).toContain('whole rollback window');
    expect(cutoverPlanProblems({ ...PLAN, freezeEnd: '2026-12-04T00:00:00Z' }).join()).toContain('not a valid interval');
    expect(cutoverPlanProblems({ ...PLAN, commsApproved: false }).join()).toContain('communications');
    expect(cutoverPlanProblems({ ...PLAN, supportStaffed: false }).join()).toContain('support');
  });

  async function toRehearse(rehearsals: Body[], rollback: Body | null = { restoredMinutes: 60 }, plan: Body = PLAN) {
    await driveTo('rehearse');
    const p = await file('cutover_plan', undefined, plan);
    for (const r of rehearsals) await file('rehearsal_report', undefined, r.mappings === 'APPROVED' ? { ...r, mappings: mappings() } : r);
    if (rollback) await file('rollback_rehearsal', undefined, rollback);
    await sign('migration_lead', 'lead', p);
    await sign('privacy_security', 'sec', p);
  }
  const mappings = () => DOMAINS.map((d) => hash('mapping_spec', d));

  it('needs two clean rehearsals in a row', async () => {
    await toRehearse([{ clean: true, durationMinutes: 60, mappings: 'APPROVED' }]);
    expect(refuse('parallel_run')).toContain('fewer than two rehearsals');
  });

  it('refuses when the most recent rehearsal was not clean, even after earlier good ones', async () => {
    await toRehearse([{ clean: true, durationMinutes: 60, mappings: 'APPROVED' }, { clean: true, durationMinutes: 60, mappings: 'APPROVED' }, { clean: false, durationMinutes: 60, mappings: 'APPROVED' }]);
    expect(refuse('parallel_run')).toContain('two clean rehearsals in a row are required');
  });

  it('refuses a rehearsal too slow for the window, with the margin it needs', async () => {
    await toRehearse([{ clean: true, durationMinutes: 170, mappings: 'APPROVED' }, { clean: true, durationMinutes: 60, mappings: 'APPROVED' }]);
    expect(refuse('parallel_run')).toContain('a rehearsal took 170 minutes');
  });

  it('refuses rehearsals that ran on something other than the approved mappings', async () => {
    await toRehearse([{ clean: true, durationMinutes: 60, mappings: ['stale'] }, { clean: true, durationMinutes: 60, mappings: 'APPROVED' }]);
    expect(refuse('parallel_run')).toContain('did not run on the currently approved mappings');
  });

  it('refuses a plan that was never rolled back in rehearsal, or whose rollback ran long', async () => {
    await toRehearse([{ clean: true, durationMinutes: 60, mappings: 'APPROVED' }, { clean: true, durationMinutes: 60, mappings: 'APPROVED' }], null);
    expect(refuse('parallel_run')).toContain('rollback has not been rehearsed against this plan');
    await file('rollback_rehearsal', undefined, { restoredMinutes: 200 });
    expect(refuse('parallel_run')).toContain('took longer than the plan allows');
  });

  it('refuses a rollback rehearsal that predates the plan it claims to prove', async () => {
    await driveTo('rehearse');
    await file('rollback_rehearsal', undefined, { restoredMinutes: 10 });
    const p = await file('cutover_plan', undefined, PLAN);
    for (let i = 0; i < 2; i += 1) await file('rehearsal_report', undefined, { clean: true, durationMinutes: 60, mappings: mappings() });
    await sign('migration_lead', 'lead', p);
    await sign('privacy_security', 'sec', p);
    expect(refuse('parallel_run')).toContain('rollback has not been rehearsed against this plan');
  });
});

describe('the decision to cut over', () => {
  it('needs an accepted parallel run for a high-stakes domain', async () => {
    await driveTo('parallel_run');
    await file('parallel_run_report', 'identity', { accepted: false });
    for (const d of DOMAINS) await snapshot(d);
    expect(refuse('cutover')).toContain('identity: the parallel run was not accepted');
  });

  it('will not go while a critical exception is open', async () => {
    await driveTo('parallel_run');
    await prepare('cutover');
    await snapshot('identity', { openCritical: 1 });
    expect(refuse('cutover')).toContain('identity: critical or major exceptions are still open');
  });

  it('needs the go decision, and the decision has to come after every signature', async () => {
    await driveTo('parallel_run');
    await file('parallel_run_report', 'identity', { accepted: true });
    for (const d of DOMAINS) await snapshot(d);
    const plan = chain.find((e) => e.kind === 'cutover_plan')!;
    await sign('executive_sponsor', 'cio', plan);
    await sign('data_owner', 'reg', chain.find((e) => e.hash === hash('parallel_run_report', 'identity'))!, 'identity');
    await sign('data_owner', 'reg', chain.find((e) => e.hash === hash('validation_report', 'courses'))!, 'courses');
    expect(refuse('cutover')).toContain('no go decision');
    await put({ type: 'decision', kind: 'go', actor: 'cio', body: {} });
    await sign('executive_sponsor', 'cio', plan); // a late signature
    expect(refuse('cutover')).toContain('a sign-off came after the go decision');
  });

  it('will not cut over without the executive sponsor, whoever else has signed', async () => {
    await driveTo('parallel_run');
    await file('parallel_run_report', 'identity', { accepted: true });
    for (const d of DOMAINS) await snapshot(d);
    await sign('data_owner', 'reg', chain.find((e) => e.hash === hash('parallel_run_report', 'identity'))!, 'identity');
    await sign('data_owner', 'reg', chain.find((e) => e.hash === hash('validation_report', 'courses'))!, 'courses');
    await put({ type: 'decision', kind: 'go', actor: 'cio', body: {} });
    expect(refuse('cutover')).toContain('executive_sponsor has not signed the current cutover_plan');
  });
});

describe('rollback', () => {
  const decideRollback = () => put({ type: 'decision', kind: 'rollback', actor: 'cio', body: {} });

  it('is refused before cutover, where there is nothing to roll back', async () => {
    await driveTo('validate');
    expect(refuse('rolled_back')).toContain('only possible from cutover or stabilize');
  });

  it('needs the decision and a report that the incumbent was restored and what was written since was reconciled', async () => {
    await driveTo('stabilize');
    expect(refuse('rolled_back')).toContain('no rollback decision');
    await decideRollback();
    expect(refuse('rolled_back')).toContain('no rollback_report after the decision');
    await file('rollback_report', undefined, { restored: true, deltaReconciled: false });
    expect(refuse('rolled_back')).toContain('did not restore the incumbent or did not reconcile');
    await file('rollback_report', undefined, { restored: true, deltaReconciled: true });
    await enter('rolled_back');
    expect(replay(chain)).toMatchObject({ stage: 'rolled_back', violations: [] });
    expect(refuse('archive')).toContain('does not follow rolled_back');
  });

  it('closes when the window does: after that the only direction is forward', async () => {
    await driveTo('stabilize');
    await decideRollback();
    await file('rollback_report', undefined, { restored: true, deltaReconciled: true });
    jump(100);
    expect(refuse('rolled_back')).toContain('the rollback window has closed');
  });
});

describe('archive', () => {
  it('waits for the rollback window, with the time it closes', async () => {
    await driveTo('stabilize');
    await prepare('archive');
    expect(refuse('archive')).toMatch(/the rollback window is open until 2026-/);
    jump(97);
    await enter('archive');
  });

  it('will not seal without retention confirmed by counsel, or with a legal hold open or unchecked', async () => {
    await driveTo('stabilize');
    await file('final_reconciliation', undefined, { clean: true });
    const m = await file('archive_manifest', undefined, { sealed: true, retentionPolicyConfirmed: false, counselReviewed: false, legalHoldsOpen: 2 });
    for (const d of DOMAINS) await sign('data_owner', 'reg', m, d);
    await sign('executive_sponsor', 'cio', m);
    await sign('privacy_security', 'sec', m);
    jump(97);
    const why = refuse('archive');
    expect(why).toContain('retention policy has not been confirmed with counsel review');
    expect(why).toContain('a legal hold is open or unchecked');
  });
});

describe('the ledger cannot be talked around', () => {
  it('reports a stage entry written by hand to skip a gate', async () => {
    await put({ type: 'stage', kind: 'extract', actor: 'lead', body: {} });
    await put({ type: 'stage', kind: 'map', actor: 'lead', body: {} });
    const run = replay(chain);
    expect(run.violations.map((v) => v.to)).toEqual(['extract', 'map']);
    expect(run.violations[0].problems.join()).toContain('no source_inventory');
    expect(advance(chain, 'cleanse', 'lead', iso())).toMatchObject({ ok: false });
  });

  it('refuses a ledger that does not open with a charter naming known domains', async () => {
    const bad = await append([], { ...charter({ tenant: 't', wave: 'w', domains: ['not_a_domain'], actor: 'a', now: iso() }) });
    if (!bad.ok) throw new Error('append failed');
    expect(replay([bad.entry]).violations[0].problems.join()).toContain('known domains');
  });

  it('detects an entry edited after the fact, one removed, and one reordered', async () => {
    await driveTo('map');
    expect(await verifyChain(chain)).toMatchObject({ ok: true });
    const edited = chain.map((e, i) => (i === 4 ? { ...e, body: { ...e.body, independentRead: false } } : e));
    expect(await verifyChain(edited)).toMatchObject({ ok: false, at: 4, why: 'the entry was changed after it was written' });
    expect(await verifyChain(chain.filter((_, i) => i !== 3))).toMatchObject({ ok: false, at: 3 });
    const swapped = [...chain];
    [swapped[2], swapped[3]] = [swapped[3], swapped[2]];
    expect(await verifyChain(swapped)).toMatchObject({ ok: false, at: 2 });
  });

  it('detects an entry replaced by a different, perfectly well-formed one', async () => {
    await driveTo('extract');
    // Same position, valid hash of its own, but not the entry the next one was written after.
    const forged = await append(chain.slice(0, 3), { type: 'evidence', kind: 'source_inventory', domain: 'identity', actor: 'someone', at: chain[3].at, summary: 'forged', body: {}, retention: 'working' });
    if (!forged.ok) throw new Error('append failed');
    const swapped = chain.map((e, i) => (i === 3 ? forged.entry : e));
    expect(await verifyChain(swapped)).toMatchObject({ ok: false, at: 4, why: 'does not follow the entry before it' });
  });

  it('refuses personal data, long free text, an unsigned sign-off and a clock that runs backwards', async () => {
    const base: EntryInput = { type: 'evidence', kind: 'x', actor: 'a', at: '2026-11-01T10:00:00Z', summary: 'ok', body: {}, retention: 'working' };
    expect(entryProblems({ ...base, summary: 'student jane.doe@university.edu failed' }).join()).toContain('personal or secret');
    expect(entryProblems({ ...base, body: { note: 'id 20261234567' } }).join()).toContain('personal or secret');
    expect(entryProblems({ ...base, body: { note: 'x'.repeat(130) } }).join()).toContain('long free text');
    expect(entryProblems({ ...base, type: 'signoff' }).join()).toContain('must name the entries it signs');
    expect(entryProblems({ ...base, summary: '' }).join()).toContain('one-line summary');
    expect(entryProblems({ ...base, actor: ' ' }).join()).toContain('needs the person');
    const first = await append([], base);
    if (!first.ok) throw new Error('append failed');
    expect(entryProblems({ ...base, at: '2026-11-01T09:00:00Z' }, first.entry).join()).toContain('precedes');
  });
});

describe('sealing the evidence', () => {
  const policy = { permanent_record: 'permanent', program_record: 10, working: 2, counselReviewed: true } as const;
  const meta = { tenant: 't', wave: 'w', now: '2026-12-30T00:00:00Z', retention: policy };
  const files = [{ name: 'identity/validation-report.json', sha256: 'a'.repeat(64), bytes: 120 }];

  it('refuses to seal without a complete retention policy that counsel reviewed', async () => {
    expect(retentionProblems(undefined)[0]).toContain('counsel approves');
    expect(retentionProblems({ permanent_record: 'permanent', counselReviewed: false }).join()).toContain('program_record is not set');
    expect(retentionProblems({ ...policy, working: 1.5 }).join()).toContain('whole years');
    const r = await seal(chain, files, { ...meta, retention: { ...policy, counselReviewed: false } });
    expect(r).toMatchObject({ ok: false });
  });

  it('seals a sound ledger and then notices anything that changed afterwards', async () => {
    await driveTo('map');
    const sealed = await seal(chain, files, meta);
    if (!sealed.ok) throw new Error(sealed.problems.join());
    expect(await verifyManifest(sealed.manifest, chain, files)).toEqual([]);
    expect((await verifyManifest(sealed.manifest, chain, [{ ...files[0], sha256: 'b'.repeat(64) }])).join()).toContain('has changed since it was sealed');
    expect((await verifyManifest(sealed.manifest, chain, [])).join()).toContain('is missing');
    await put({ type: 'evidence', kind: 'late', actor: 'a', body: {} });
    expect((await verifyManifest(sealed.manifest, chain, files)).join()).toContain('entries added or removed since');
    expect((await verifyManifest({ ...sealed.manifest, wave: 'other' }, chain.slice(0, sealed.manifest.entries), files)).join()).toContain('manifest was changed');
  });

  it('refuses to seal a broken ledger or a file listed twice', async () => {
    await driveTo('extract');
    const broken = chain.map((e, i) => (i === 1 ? { ...e, summary: 'edited' } : e));
    expect(await seal(broken, files, meta)).toMatchObject({ ok: false });
    expect(await seal(chain, [...files, ...files], meta)).toMatchObject({ ok: false });
  });

  it('hashes the same entry the same way however its keys are ordered', () => {
    expect(canonical({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe(canonical({ a: [2, { c: 2, d: 1 }], b: 1 }));
    expect(GENESIS).toHaveLength(64);
    expect(gateProblems({ entries: [], domains: [], stage: null }, 'inventory', iso())).toEqual([]);
  });
});
