/**
 * The migration as a state machine whose only memory is the ledger.
 *
 * Stages run in one order — inventory, extract, map, cleanse, transform,
 * validate, rehearse, parallel run, cutover, stabilize, archive — and a
 * stage is entered only when its gate passes: the evidence it needs is on the
 * ledger, is newer than the thing it vouches for, and is signed by people who
 * are who the gate says, did not produce the evidence, and are not each other.
 *
 * `replay` rebuilds a run from the ledger and re-checks every transition at the
 * moment it happened. A stage entry that its own gate would have refused is
 * reported as a violation, so a ledger edited or appended by hand to skip a
 * step does not merely look odd; it fails verification. The run has no state
 * of its own to drift from the evidence.
 *
 * Rollback is a way out of cutover and stabilize only, and only while the
 * rollback window is open. After it closes the incumbent may be retired and
 * the only direction left is forward, which is why archive waits for it.
 */
import { domainById } from './domains.ts';
import type { Entry, EntryInput } from './evidence.ts';

export const STAGES = ['inventory', 'extract', 'map', 'cleanse', 'transform', 'validate', 'rehearse', 'parallel_run', 'cutover', 'stabilize', 'archive'] as const;
export type Stage = (typeof STAGES)[number];
export type StageOrEnd = Stage | 'rolled_back';

export const EVIDENCE_KINDS = [
  'source_inventory', 'extract_manifest', 'scope_approval', 'mapping_spec', 'cleansing_report', 'transform_run',
  'validation_report', 'probe_proof', 'rehearsal_report', 'rollback_rehearsal', 'cutover_plan', 'parallel_run_report',
  'cutover_report', 'final_reconciliation', 'archive_manifest', 'rollback_report',
] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

/** Who signs, and on which side. A sign-off from the wrong side does not count. */
export const ROLES = {
  data_owner: 'institution',
  executive_sponsor: 'institution',
  migration_lead: 'semester',
  privacy_security: 'semester',
} as const;
export type Role = keyof typeof ROLES;

export const MIN_ROLLBACK_WINDOW_HOURS = 72;
/** A rehearsal must finish in this fraction of the cutover window, or the window is a hope. */
export const REHEARSAL_MARGIN = 1.5;

export interface Violation {
  seq: number;
  to: string;
  problems: string[];
}

export interface Run {
  tenant: string;
  wave: string;
  domains: string[];
  stage: StageOrEnd | null;
  stageAt: Partial<Record<StageOrEnd, string>>;
  violations: Violation[];
}

/* ── Reading the ledger ────────────────────────────────────────────────── */

type Entries = readonly Entry[];

const last = (es: Entries, pred: (e: Entry) => boolean): Entry | undefined => {
  for (let i = es.length - 1; i >= 0; i -= 1) if (pred(es[i])) return es[i];
  return undefined;
};
const evidence = (es: Entries, kind: EvidenceKind, domain?: string) => last(es, (e) => e.type === 'evidence' && e.kind === kind && (domain === undefined || e.domain === domain));
/** Evidence about one domain, or evidence about the whole run that covers it. */
const evidenceFor = (es: Entries, kind: EvidenceKind, domain?: string) => last(es, (e) => e.type === 'evidence' && e.kind === kind && (domain === undefined || e.domain === domain || e.domain === undefined));
const bool = (e: Entry | undefined, k: string) => e?.body[k] === true;
const num = (e: Entry | undefined, k: string) => (typeof e?.body[k] === 'number' ? (e!.body[k] as number) : null);
const text = (e: Entry | undefined, k: string) => (typeof e?.body[k] === 'string' ? (e!.body[k] as string) : null);
const iso = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));

const high = (domain: string) => domainById(domain)?.stakes === 'high';

/* ── Sign-offs ─────────────────────────────────────────────────────────── */

interface SignoffReq {
  role: Role;
  /** What the signature must cover, by domain when `each`. */
  covers: (domain?: string) => EvidenceKind;
  each?: boolean;
}

/**
 * Whether each required person has signed the *current* evidence.
 *
 * Qualifying means: the right role, on the right side, covering the latest
 * entry of the kind (so new evidence voids an old signature), by someone who
 * did not produce that evidence. No person may hold two different roles at
 * one gate. The qualifying signatures come back so a decision can be required
 * to come after all of them.
 */
function signoffs(es: Entries, reqs: readonly SignoffReq[], domains: readonly string[]): { problems: string[]; seqs: number[] } {
  const problems: string[] = [];
  const seqs: number[] = [];
  const byRole = new Map<Role, Set<string>>();
  for (const req of reqs) {
    for (const d of req.each ? domains : [undefined]) {
      const kind = req.covers(d);
      const ev = evidenceFor(es, kind, req.each ? d : undefined);
      const who = `${req.role}${d ? ` (${d})` : ''}`;
      if (!ev) { problems.push(`${who} cannot sign: no ${kind} on the ledger`); continue; }
      const sig = es.filter((s) => s.type === 'signoff' && s.kind === req.role && s.body.side === ROLES[req.role] && (!req.each || s.domain === d) && s.covers?.includes(ev.hash) && s.actor !== ev.actor);
      if (!sig.length) { problems.push(`${who} has not signed the current ${kind}`); continue; }
      for (const s of sig) {
        seqs.push(s.seq);
        byRole.set(req.role, (byRole.get(req.role) ?? new Set()).add(s.actor));
      }
    }
  }
  const roles = [...byRole.keys()];
  for (let i = 0; i < roles.length; i += 1) {
    for (let j = i + 1; j < roles.length; j += 1) {
      for (const person of byRole.get(roles[i])!) if (byRole.get(roles[j])!.has(person)) problems.push(`one person signed as both ${roles[i]} and ${roles[j]}; the roles must be held by different people`);
    }
  }
  return { problems, seqs };
}

/* ── The cutover plan ──────────────────────────────────────────────────── */

export function cutoverPlanProblems(b: Entry['body']): string[] {
  const out: string[] = [];
  const n = (k: string) => (typeof b[k] === 'number' ? (b[k] as number) : NaN);
  if (!(n('windowMinutes') > 0)) out.push('the cutover window is not set');
  if (!(n('rollbackMinutes') > 0)) out.push('the time to roll back is not set');
  else if (n('rollbackMinutes') > n('windowMinutes')) out.push('rolling back takes longer than the cutover window');
  if (!(n('rollbackWindowHours') >= MIN_ROLLBACK_WINDOW_HOURS)) out.push(`the rollback window is under ${MIN_ROLLBACK_WINDOW_HOURS} hours`);
  if (typeof b.snapshotRef !== 'string' || !b.snapshotRef) out.push('there is no pre-cutover snapshot to roll back to');
  if (b.deltaCapture !== true) out.push('nothing captures what is written in Semester after cutover, so a rollback would lose it');
  if (!Array.isArray(b.triggers) || b.triggers.length < 3) out.push('fewer than three explicit rollback triggers');
  if (typeof b.decisionOwner !== 'string' || !b.decisionOwner) out.push('nobody owns the rollback decision');
  if (!iso(b.freezeStart) || !iso(b.freezeEnd) || Date.parse(b.freezeEnd as string) <= Date.parse(b.freezeStart as string)) out.push('the change freeze is not a valid interval');
  else if (!iso(b.incumbentReadOnlyUntil) || Date.parse(b.incumbentReadOnlyUntil as string) < Date.parse(b.freezeEnd as string) + n('rollbackWindowHours') * 3_600_000) out.push('the incumbent is not kept available for the whole rollback window');
  if (b.commsApproved !== true) out.push('communications to students and staff are not approved');
  if (b.supportStaffed !== true) out.push('support is not staffed for the cutover window');
  return out;
}

/* ── Gates ─────────────────────────────────────────────────────────────── */

interface State {
  entries: Entries;
  domains: readonly string[];
  stage: StageOrEnd | null;
}

const perDomain = (s: State, kind: EvidenceKind, ok: (e: Entry) => string | null): string[] =>
  s.domains.flatMap((d) => {
    const e = evidence(s.entries, kind, d);
    if (!e) return [`${d}: no ${kind}`];
    const why = ok(e);
    return why ? [`${d}: ${why}`] : [];
  });

const sign = (s: State, reqs: SignoffReq[]) => signoffs(s.entries, reqs, s.domains);

function latestSnapshotOk(s: State, domain: string, after: number): string | null {
  const snap = last(s.entries, (e) => e.type === 'exceptions' && e.domain === domain);
  if (!snap || snap.seq < after) return 'the exception queue has not been snapshotted since the evidence it must agree with';
  if (num(snap, 'openCritical') !== 0 || num(snap, 'openMajor') !== 0) return 'critical or major exceptions are still open';
  if (num(snap, 'overdue') !== 0) return 'exceptions are overdue';
  return null;
}

/** Everything that must be true to enter `to`, as of `now`. Empty means the gate is open. */
export function gateProblems(s: State, to: StageOrEnd, now: string): string[] {
  const es = s.entries;
  switch (to) {
    case 'inventory': return [];
    case 'extract': return [...perDomain(s, 'source_inventory', () => null), ...sign(s, [{ role: 'data_owner', covers: () => 'source_inventory', each: true }]).problems];
    case 'map':
      return [
        ...perDomain(s, 'extract_manifest', (e) => (bool(e, 'independentRead') && bool(e, 'sourceFrozen') ? null : 'the extract was not read independently from a frozen source')),
        ...perDomain(s, 'scope_approval', (e) => (num(e, 'unapproved') === 0 && num(e, 'blocked') === 0 ? null : 'fields still need approval or are blocked by the platform floor')),
        ...sign(s, [{ role: 'data_owner', covers: () => 'scope_approval', each: true }, { role: 'privacy_security', covers: () => 'scope_approval', each: true }]).problems,
      ];
    case 'cleanse':
      return [
        ...perDomain(s, 'mapping_spec', (e) => (text(e, 'status') === 'approved' ? null : 'the mapping is not approved')),
        ...sign(s, [{ role: 'data_owner', covers: () => 'mapping_spec', each: true }, { role: 'migration_lead', covers: () => 'mapping_spec', each: true }]).problems,
      ];
    case 'transform':
      return [
        ...perDomain(s, 'cleansing_report', (e) => (num(e, 'unmapped') === 0 ? null : 'values are still unmapped')),
        ...sign(s, [{ role: 'data_owner', covers: () => 'cleansing_report', each: true }]).problems,
      ];
    case 'validate': return perDomain(s, 'transform_run', (e) => (text(e, 'crosswalkHash') ? null : 'the transform wrote no crosswalk'));
    case 'rehearse':
      return s.domains.flatMap((d) => {
        const t = evidence(es, 'transform_run', d);
        const v = evidence(es, 'validation_report', d);
        const p = evidence(es, 'probe_proof', d);
        if (!t) return [`${d}: no transform_run`];
        if (!v || v.seq < t.seq) return [`${d}: no validation_report newer than the last transform`];
        const out: string[] = [];
        if (text(v, 'verdict') !== 'pass') out.push(`${d}: validation did not pass`);
        if (!bool(v, 'independentSourceRead')) out.push(`${d}: validation read the source through the transform's own path`);
        if (!p || p.seq < t.seq) out.push(`${d}: the checks were not proven against the current data`);
        else if (num(p, 'unproven') !== 0) out.push(`${d}: some checks are not proven to detect defects`);
        const q = latestSnapshotOk(s, d, v.seq);
        if (q) out.push(`${d}: ${q}`);
        return out;
      });
    case 'parallel_run': {
      const plan = evidence(es, 'cutover_plan');
      if (!plan) return ['no cutover_plan'];
      const out = cutoverPlanProblems(plan.body).map((p) => `cutover plan: ${p}`);
      const rehearsals = es.filter((e) => e.type === 'evidence' && e.kind === 'rehearsal_report').slice(-2);
      const mappings = s.domains.map((d) => evidence(es, 'mapping_spec', d)?.hash ?? '').sort();
      if (rehearsals.length < 2) out.push('fewer than two rehearsals');
      for (const r of rehearsals) {
        if (!bool(r, 'clean')) out.push('a recent rehearsal was not clean; two clean rehearsals in a row are required');
        const window = num(plan, 'windowMinutes');
        const took = num(r, 'durationMinutes');
        if (window !== null && (took === null || took * REHEARSAL_MARGIN > window)) out.push(`a rehearsal took ${took ?? 'an unknown number of'} minutes; ${REHEARSAL_MARGIN}× that does not fit the ${window}-minute window`);
        const ran = Array.isArray(r.body.mappings) ? [...(r.body.mappings as string[])].sort() : null;
        if (!ran || ran.join() !== mappings.join()) out.push('a rehearsal did not run on the currently approved mappings');
      }
      const rb = evidence(es, 'rollback_rehearsal');
      if (!rb || rb.seq < plan.seq) out.push('rollback has not been rehearsed against this plan');
      else if ((num(rb, 'restoredMinutes') ?? Infinity) > (num(plan, 'rollbackMinutes') ?? 0)) out.push('the rehearsed rollback took longer than the plan allows');
      return [...out, ...sign(s, [{ role: 'migration_lead', covers: () => 'cutover_plan' }, { role: 'privacy_security', covers: () => 'cutover_plan' }]).problems];
    }
    case 'cutover': {
      const out: string[] = [];
      for (const d of s.domains) {
        const pr = evidence(es, 'parallel_run_report', d);
        if (high(d) && !pr) out.push(`${d}: a high-stakes domain needs an accepted parallel run`);
        else if (pr && !bool(pr, 'accepted')) out.push(`${d}: the parallel run was not accepted`);
        const anchor = pr ?? evidence(es, 'validation_report', d);
        const q = anchor ? latestSnapshotOk(s, d, anchor.seq) : 'nothing to anchor the exception snapshot to';
        if (q) out.push(`${d}: ${q}`);
      }
      const sg = sign(s, [
        { role: 'executive_sponsor', covers: () => 'cutover_plan' },
        { role: 'migration_lead', covers: () => 'cutover_plan' },
        { role: 'privacy_security', covers: () => 'cutover_plan' },
        { role: 'data_owner', covers: (d) => (d && evidence(es, 'parallel_run_report', d) ? 'parallel_run_report' : 'validation_report'), each: true },
      ]);
      const go = last(es, (e) => e.type === 'decision');
      if (!go || go.kind !== 'go') out.push('no go decision is on the ledger');
      else if (sg.seqs.some((q) => q > go.seq)) out.push('a sign-off came after the go decision; the decision must follow every signature');
      return [...out, ...sg.problems];
    }
    case 'stabilize': {
      const r = evidence(es, 'cutover_report');
      if (!r) return ['no cutover_report'];
      return [...(bool(r, 'reconciled') ? [] : ['post-cutover reconciliation did not pass']), ...((num(r, 'rollbackWindowHours') ?? 0) >= MIN_ROLLBACK_WINDOW_HOURS ? [] : ['the rollback window is not recorded'])];
    }
    case 'archive': {
      const r = evidence(es, 'cutover_report');
      const fin = evidence(es, 'final_reconciliation');
      const man = evidence(es, 'archive_manifest');
      const out: string[] = [];
      if (!r) return ['no cutover_report'];
      const closes = Date.parse(r.at) + (num(r, 'rollbackWindowHours') ?? Infinity) * 3_600_000;
      if (Date.parse(now) < closes) out.push(`the rollback window is open until ${new Date(closes).toISOString()}`);
      if (!fin || fin.seq < r.seq || !bool(fin, 'clean')) out.push('no clean final reconciliation after cutover');
      if (!man) out.push('no archive_manifest');
      else {
        if (!bool(man, 'sealed')) out.push('the archive is not sealed');
        if (!bool(man, 'retentionPolicyConfirmed') || !bool(man, 'counselReviewed')) out.push('the retention policy has not been confirmed with counsel review');
        if (num(man, 'legalHoldsOpen') !== 0) out.push('a legal hold is open or unchecked');
      }
      return [...out, ...sign(s, [{ role: 'data_owner', covers: () => 'archive_manifest', each: true }, { role: 'executive_sponsor', covers: () => 'archive_manifest' }, { role: 'privacy_security', covers: () => 'archive_manifest' }]).problems];
    }
    case 'rolled_back': {
      const out: string[] = [];
      if (s.stage !== 'cutover' && s.stage !== 'stabilize') return ['rollback is only possible from cutover or stabilize'];
      const dec = last(es, (e) => e.type === 'decision');
      if (!dec || dec.kind !== 'rollback') out.push('no rollback decision is on the ledger');
      const r = evidence(es, 'cutover_report');
      if (r && Date.parse(now) > Date.parse(r.at) + (num(r, 'rollbackWindowHours') ?? 0) * 3_600_000) out.push('the rollback window has closed; the only direction left is forward');
      const rr = evidence(es, 'rollback_report');
      if (!rr || (dec && rr.seq < dec.seq)) out.push('no rollback_report after the decision');
      else if (!bool(rr, 'restored') || !bool(rr, 'deltaReconciled')) out.push('the rollback did not restore the incumbent or did not reconcile what was written after cutover');
      return out;
    }
  }
}

/* ── Replay and advance ────────────────────────────────────────────────── */

const next = (s: StageOrEnd | null): Stage | null => (s === null ? 'inventory' : s === 'rolled_back' ? null : STAGES[STAGES.indexOf(s) + 1] ?? null);

/**
 * Rebuild the run from the ledger, re-checking each stage entry against its
 * gate as of the moment it was written. Any violation means the ledger records
 * a transition that should not have been allowed.
 */
export function replay(entries: Entries): Run {
  const run: Run = { tenant: '', wave: '', domains: [], stage: null, stageAt: {}, violations: [] };
  entries.forEach((e, i) => {
    if (e.type !== 'stage') return;
    const to = e.kind as StageOrEnd;
    if (i === 0 || run.stage === null) {
      const domains = Array.isArray(e.body.domains) ? (e.body.domains as string[]) : [];
      const problems: string[] = [];
      if (i !== 0 || to !== 'inventory') problems.push('the ledger must open with the inventory stage');
      if (!domains.length || domains.some((d) => !domainById(d))) problems.push('the charter must name known domains');
      if (typeof e.body.tenant !== 'string' || typeof e.body.wave !== 'string') problems.push('the charter must name a tenant and a wave');
      if (problems.length) run.violations.push({ seq: e.seq, to, problems });
      run.tenant = String(e.body.tenant ?? '');
      run.wave = String(e.body.wave ?? '');
      run.domains = domains;
      run.stage = 'inventory';
      run.stageAt.inventory = e.at;
      return;
    }
    const expected = next(run.stage);
    const problems: string[] = [];
    if (to !== 'rolled_back' && to !== expected) problems.push(`${to} does not follow ${run.stage}`);
    else problems.push(...gateProblems({ entries: entries.slice(0, i), domains: run.domains, stage: run.stage }, to, e.at));
    if (problems.length) run.violations.push({ seq: e.seq, to, problems });
    run.stage = to;
    run.stageAt[to] = e.at;
  });
  return run;
}

export type Advance = { ok: true; entry: EntryInput } | { ok: false; problems: string[] };

/** The stage entry to append, if the gate is open. The caller appends it; nothing changes here. */
export function advance(entries: Entries, to: StageOrEnd, actor: string, now: string): Advance {
  const run = replay(entries);
  if (run.violations.length) return { ok: false, problems: ['the ledger already contains a transition its gate would have refused; fix that first'] };
  if (run.stage === null) return { ok: false, problems: ['no run: open the ledger with a charter'] };
  const expected = next(run.stage);
  if (to !== 'rolled_back' && to !== expected) return { ok: false, problems: [`${to} does not follow ${run.stage}; the next stage is ${expected ?? 'none (the run has ended)'}`] };
  const problems = gateProblems({ entries, domains: run.domains, stage: run.stage }, to, now);
  if (problems.length) return { ok: false, problems };
  return { ok: true, entry: { type: 'stage', kind: to, actor, at: now, summary: `entered ${to}`, body: {}, retention: 'permanent_record' } };
}

/** The charter that opens a ledger. */
export function charter(input: { tenant: string; wave: string; domains: readonly string[]; actor: string; now: string }): EntryInput {
  return { type: 'stage', kind: 'inventory', actor: input.actor, at: input.now, summary: 'migration run opened', body: { tenant: input.tenant, wave: input.wave, domains: [...input.domains] }, retention: 'permanent_record' };
}

/** What the next stage still needs: the answer to "where are we, and what is missing". */
export function status(entries: Entries, now: string): { run: Run; next: StageOrEnd | null; problems: string[] } {
  const run = replay(entries);
  const to = next(run.stage);
  return { run, next: to, problems: to ? gateProblems({ entries, domains: run.domains, stage: run.stage }, to, now) : [] };
}
