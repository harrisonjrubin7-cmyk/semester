/**
 * Run an institutional migration from a terminal, against a working directory.
 *
 *     node scripts/institution-migration.ts init <dir> --tenant T --wave W --domains a,b --actor NAME
 *     node scripts/institution-migration.ts scope <dir> <domain> --actor NAME [--approvals k1,k2]
 *     node scripts/institution-migration.ts validate <dir> <domain> --actor NAME --independent-source-read
 *     node scripts/institution-migration.ts file <dir> <kind> --actor NAME [--domain D] [--body '{"k":1}']
 *     node scripts/institution-migration.ts sign <dir> <role> <kind> --actor NAME [--domain D]
 *     node scripts/institution-migration.ts decide <dir> go|no_go|rollback --actor NAME
 *     node scripts/institution-migration.ts exception <dir> <id> <disposition> --actor NAME [--approved-by N ...]
 *     node scripts/institution-migration.ts advance <dir> <stage> --actor NAME
 *     node scripts/institution-migration.ts status <dir>
 *     node scripts/institution-migration.ts verify <dir>
 *     node scripts/institution-migration.ts seal <dir> --retention retention.json --actor NAME
 *
 * The method is in `docs/migration/METHODOLOGY.md`; this is its hands.
 *
 * ## What it does not do
 *
 * It never connects to a source system or to a database. An institution
 * extracts to files; this reads them. Nothing here writes to production, which
 * is deliberate: the one-time load is a reviewed, owner-approved act, and a
 * tool that could also do it would make that approval a formality.
 *
 * ## What lives where
 *
 * `ledger.jsonl` is the only memory. Every command that changes state appends
 * to it after verifying the chain, and `status` and `advance` replay it, so
 * there is no file whose edit could move a stage forward. Reports and the
 * exception queue are working files; the ledger holds their hashes and counts.
 * Rows never enter the ledger or any report — only field names, counts and
 * salted references.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { DOMAINS, domainById } from '../src/lib/migration-assurance/domains.ts';
import { countParity, proveProbes, runDomain } from '../src/lib/migration-assurance/engine.ts';
import { append, defaultRetention, seal, verifyChain, type Body, type Entry, type EntryInput, type RetentionPolicy } from '../src/lib/migration-assurance/evidence.ts';
import { decide, ingest, snapshot, type Disposition, type Queue } from '../src/lib/migration-assurance/exceptions.ts';
import { EVIDENCE_KINDS, ROLES, STAGES, advance, charter, cutoverPlanProblems, replay, status, type EvidenceKind, type Role, type StageOrEnd } from '../src/lib/migration-assurance/lifecycle.ts';
import { evaluateDomain, toReport } from '../src/lib/migration-assurance/quality.ts';
import { approvalsNeeded, scopeProblems } from '../src/lib/migration-assurance/scope.ts';
import type { Crosswalk, Dataset, DomainSpec, Pair } from '../src/lib/migration-assurance/types.ts';
import { templates } from '../src/lib/migration-assurance/workbook.ts';

export interface Io {
  now: () => string;
  out: (line: string) => void;
}

interface Parsed {
  positional: string[];
  flags: Record<string, string | true>;
}

const BOOLEAN = new Set(['independent-source-read']);

export function parse(argv: readonly string[]): Parsed {
  const positional: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) { positional.push(a); continue; }
    const key = a.slice(2);
    if (BOOLEAN.has(key)) flags[key] = true;
    else flags[key] = argv[++i] ?? '';
  }
  return { positional, flags };
}

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;
const writeJson = (path: string, value: unknown) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);

function readLedger(dir: string): Entry[] {
  const path = join(dir, 'ledger.jsonl');
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Entry);
}

const writeLedger = (dir: string, entries: readonly Entry[]) => writeFileSync(join(dir, 'ledger.jsonl'), entries.map((e) => JSON.stringify(e)).join('\n') + '\n');

async function put(dir: string, input: EntryInput): Promise<Entry> {
  const chain = readLedger(dir);
  const ok = await verifyChain(chain);
  if (!ok.ok) throw new Error(`The ledger is broken at entry ${ok.at} (${ok.why}). Nothing was written.`);
  const r = await append(chain, input);
  if (!r.ok) throw new Error(r.problems.join('; '));
  writeLedger(dir, [...chain, r.entry]);
  return r.entry;
}

const need = (flags: Parsed['flags'], k: string): string => {
  const v = flags[k];
  if (typeof v !== 'string' || !v.trim()) throw new Error(`--${k} is required.`);
  return v;
};

const sha256File = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

function domainOf(id: string | undefined): DomainSpec {
  const d = id ? domainById(id) : undefined;
  if (!d) throw new Error(`Unknown domain "${id ?? ''}". Known: ${DOMAINS.map((x) => x.id).join(', ')}.`);
  return d;
}

/** The pair for one domain, with the rows of any entity it only references taken from the domain that owns it. */
function loadPair(dir: string, d: DomainSpec): Pair {
  const own = (domain: string, file: string) => join(dir, domain, file);
  const need1 = (domain: string, file: string) => {
    if (!existsSync(own(domain, file))) throw new Error(`${join(domain, file)} is missing.`);
    return readJson<Record<string, unknown>>(own(domain, file));
  };
  const source: Record<string, unknown> = { ...(need1(d.id, 'source.json') as Dataset) };
  const target: Record<string, unknown> = { ...(need1(d.id, 'target.json') as Dataset) };
  const crosswalk: Record<string, unknown> = { ...(need1(d.id, 'crosswalk.json') as Crosswalk) };
  for (const ref of d.references) {
    const owner = DOMAINS.find((x) => x.entities.some((e) => e.name === ref.name));
    if (!owner) throw new Error(`No domain owns ${ref.name}.`);
    source[ref.name] = (need1(owner.id, 'source.json') as Dataset)[ref.name] ?? [];
    target[ref.name] = (need1(owner.id, 'target.json') as Dataset)[ref.name] ?? [];
    crosswalk[ref.name] = (need1(owner.id, 'crosswalk.json') as Crosswalk)[ref.name] ?? {};
  }
  const extra = <T>(file: string): T | undefined => (existsSync(own(d.id, file)) ? readJson<T>(own(d.id, file)) : undefined);
  const excluded = extra<Record<string, Record<string, string>>>('excluded.json');
  for (const [entity, rows] of Object.entries(excluded ?? {})) {
    for (const reason of Object.values(rows)) {
      if (reason.trim().length < 20) throw new Error(`excluded.json: an exclusion in ${entity} needs a reason that says why (20 characters at least).`);
    }
  }
  return { source: source as Dataset, target: target as Dataset, crosswalk: crosswalk as Crosswalk, excluded, approvedMerges: extra<Record<string, string[]>>('merges.json') };
}

const loadQueue = (dir: string): Queue => (existsSync(join(dir, 'exceptions.json')) ? readJson<Queue>(join(dir, 'exceptions.json')) : []);

function requireRun(run: ReturnType<typeof replay>, dir: string) {
  if (run.stage === null) throw new Error(`${dir} has no ledger. Run init first.`);
}

/** Every command. Returns the exit code. */
export async function run(argv: readonly string[], io: Io): Promise<number> {
  const { positional, flags } = parse(argv);
  const [cmd, dir, a, b] = positional;
  try {
    if (!cmd || !dir) { io.out('Usage: node scripts/institution-migration.ts <init|scope|validate|file|sign|decide|exception|advance|status|verify|seal> <dir> ...'); return 2; }

    if (cmd === 'init') {
      if (existsSync(join(dir, 'ledger.jsonl'))) throw new Error(`${dir} already has a ledger.`);
      const ids = need(flags, 'domains').split(',').map((s) => s.trim());
      for (const id of ids) domainOf(id);
      mkdirSync(dir, { recursive: true });
      for (const id of ids) {
        mkdirSync(join(dir, id), { recursive: true });
        for (const [name, text] of Object.entries(templates(domainOf(id)))) writeFileSync(join(dir, id, name), text);
      }
      await put(dir, charter({ tenant: need(flags, 'tenant'), wave: need(flags, 'wave'), domains: ids, actor: need(flags, 'actor'), now: io.now() }));
      io.out(`Opened ${dir} for ${ids.join(', ')}. Workbook templates are in each domain folder.`);
      return 0;
    }

    const chain = readLedger(dir);
    const current = replay(chain);

    if (cmd === 'status') {
      requireRun(current, dir);
      const s = status(chain, io.now());
      io.out(`Stage: ${s.run.stage}${s.run.violations.length ? `  (${s.run.violations.length} VIOLATION${s.run.violations.length === 1 ? '' : 'S'})` : ''}`);
      for (const v of s.run.violations) io.out(`  violation at entry ${v.seq} (${v.to}): ${v.problems.join('; ')}`);
      if (s.next) { io.out(`Next: ${s.next}`); for (const p of s.problems) io.out(`  - ${p}`); } else io.out('The run has ended.');
      return s.run.violations.length ? 1 : 0;
    }

    if (cmd === 'verify') {
      const v = await verifyChain(chain);
      if (!v.ok) { io.out(`BROKEN at entry ${v.at}: ${v.why}`); return 1; }
      io.out(`Ledger intact: ${chain.length} entries, head ${v.head.slice(0, 16)}…`);
      if (current.violations.length) { for (const x of current.violations) io.out(`  violation at entry ${x.seq} (${x.to}): ${x.problems.join('; ')}`); return 1; }
      return 0;
    }

    requireRun(current, dir);
    const actor = need(flags, 'actor');

    if (cmd === 'scope') {
      const d = domainOf(a);
      const approvals = typeof flags.approvals === 'string' ? flags.approvals.split(',').map((s) => s.trim()).filter(Boolean) : [];
      const problems = scopeProblems(d, approvals);
      const blocked = problems.filter((p) => p.includes('platform floor')).length;
      await put(dir, { type: 'evidence', kind: 'scope_approval', domain: d.id, actor, at: io.now(), summary: `scope reviewed: ${problems.length} open`, body: { unapproved: problems.length - blocked, blocked, approvals }, retention: 'program_record' });
      io.out(problems.length ? `Scope has ${problems.length} open item(s):\n${problems.map((p) => `  - ${p}`).join('\n')}\nApprovals this domain needs: ${approvalsNeeded(d).join(', ') || 'none'}` : 'Scope is clear.');
      return problems.length ? 1 : 0;
    }

    if (cmd === 'validate') {
      const d = domainOf(a);
      if (flags['independent-source-read'] !== true) throw new Error('Pass --independent-source-read to attest that the source side was read by a path other than the transform. A validation that shares the transform\'s read cannot catch the transform\'s mistakes.');
      const pair = loadPair(dir, d);
      const attest = existsSync(join(dir, d.id, 'attest.json')) ? readJson<{ emptyInvariants?: string[] }>(join(dir, d.id, 'attest.json')).emptyInvariants ?? [] : [];
      const results = runDomain(d, pair);
      const probes = proveProbes(d, pair);
      const evaluation = evaluateDomain({ domain: d, results, parity: countParity(d, pair), probes, attestedEmpty: attest });
      const report = await toReport(current.tenant, evaluation, results);
      writeJson(join(dir, d.id, 'validation-report.json'), report);
      writeJson(join(dir, d.id, 'probe-proof.json'), probes);
      const now = io.now();
      const queue = ingest(loadQueue(dir), d.id, d.invariants.map((s) => s.id), report.invariants.flatMap((i) => i.findings.map((f) => ({ ...f, invariant: i.invariant }))), now);
      writeJson(join(dir, 'exceptions.json'), queue);
      const unproven = probes.filter((p) => p.status !== 'detected' && !attest.includes(p.invariant)).length;
      const reportHash = createHash('sha256').update(JSON.stringify(report)).digest('hex');
      await put(dir, { type: 'evidence', kind: 'validation_report', domain: d.id, actor, at: now, summary: `${evaluation.verdict}: ${evaluation.migration.critical} critical, ${evaluation.migration.major} major, ${evaluation.migration.minor} minor from the migration`, body: { verdict: evaluation.verdict, independentSourceRead: true, countParity: evaluation.countParity, critical: evaluation.migration.critical, major: evaluation.migration.major, minor: evaluation.migration.minor, inheritedCritical: evaluation.inherited.critical, inheritedMajor: evaluation.inherited.major, reportSha256: reportHash }, retention: 'program_record' });
      await put(dir, { type: 'evidence', kind: 'probe_proof', domain: d.id, actor, at: now, summary: `${probes.length - unproven} of ${probes.length} checks proven`, body: { unproven, checks: probes.length }, retention: 'program_record' });
      const snap = snapshot(queue, d.id, now);
      await put(dir, { type: 'exceptions', kind: 'snapshot', domain: d.id, actor, at: now, summary: `${snap.openCritical} critical, ${snap.openMajor} major open`, body: { ...snap }, retention: 'program_record' });
      io.out(`${d.id}: ${evaluation.verdict.toUpperCase()}`);
      for (const r of evaluation.reasons) io.out(`  - ${r}`);
      io.out(`  inherited from source: ${evaluation.inherited.critical} critical, ${evaluation.inherited.major} major, ${evaluation.inherited.minor} minor`);
      io.out(`  open exceptions: ${snap.openCritical} critical, ${snap.openMajor} major, ${snap.openMinor} minor`);
      return evaluation.verdict === 'pass' ? 0 : 1;
    }

    if (cmd === 'file') {
      if (!(EVIDENCE_KINDS as readonly string[]).includes(a)) throw new Error(`Unknown evidence kind "${a}". Known: ${EVIDENCE_KINDS.join(', ')}.`);
      const body = (typeof flags.body === 'string' ? JSON.parse(flags.body) : {}) as Body;
      const domain = typeof flags.domain === 'string' ? flags.domain : undefined;
      if (a === 'cutover_plan') {
        const problems = cutoverPlanProblems(body);
        for (const p of problems) io.out(`  plan: ${p}`);
        if (problems.length) io.out('Filed anyway so the gap is on the record; the gate will refuse it.');
      }
      const e = await put(dir, { type: 'evidence', kind: a, domain, actor, at: io.now(), summary: typeof flags.summary === 'string' ? flags.summary : `${a} filed`, body, retention: defaultRetention('evidence', a) });
      io.out(`Filed ${a}${domain ? ` (${domain})` : ''} as ${e.hash.slice(0, 16)}…`);
      return 0;
    }

    if (cmd === 'sign') {
      if (!(a in ROLES)) throw new Error(`Unknown role "${a}". Known: ${Object.keys(ROLES).join(', ')}.`);
      const domain = typeof flags.domain === 'string' ? flags.domain : undefined;
      const target = [...chain].reverse().find((e) => e.type === 'evidence' && e.kind === b && (domain === undefined || e.domain === domain || e.domain === undefined));
      if (!target) throw new Error(`No ${b} on the ledger${domain ? ` for ${domain}` : ''} to sign.`);
      const e = await put(dir, { type: 'signoff', kind: a, actor, domain, at: io.now(), summary: `${a} signed ${b}`, body: { side: ROLES[a as Role] }, retention: 'permanent_record', covers: [target.hash] });
      io.out(`${actor} signed ${b}${domain ? ` (${domain})` : ''} as ${a} (${e.hash.slice(0, 12)}…). A later ${b} voids this signature.`);
      return 0;
    }

    if (cmd === 'decide') {
      if (!['go', 'no_go', 'rollback'].includes(a)) throw new Error('A decision is go, no_go or rollback.');
      await put(dir, { type: 'decision', kind: a, actor, at: io.now(), summary: `decision: ${a}`, body: {}, retention: 'permanent_record' });
      io.out(`Recorded ${a}.`);
      return 0;
    }

    if (cmd === 'exception') {
      const queue = loadQueue(dir);
      const found = queue.find((e) => e.id === a);
      if (!found) throw new Error(`No exception ${a}. See exceptions.json.`);
      if (!['fix_source', 'fix_mapping', 'waive', 'exclude'].includes(b)) throw new Error('A disposition is fix_source, fix_mapping, waive or exclude.');
      const s = (k: string) => (typeof flags[k] === 'string' ? (flags[k] as string) : undefined);
      const r = decide(queue, a, { disposition: b as Disposition, by: actor, now: io.now(), approvedBy: s('approved-by'), countersignedBy: s('countersigned-by'), reason: s('reason'), expiresOn: s('expires'), highStakes: domainOf(found.domain).stakes === 'high' });
      if (!r.ok) { io.out(`Refused: ${r.why}`); return 1; }
      writeJson(join(dir, 'exceptions.json'), r.queue);
      const snap = snapshot(r.queue, found.domain, io.now());
      await put(dir, { type: 'exceptions', kind: 'snapshot', domain: found.domain, actor, at: io.now(), summary: `${b} on ${found.invariant}`, body: { ...snap }, retention: 'program_record' });
      io.out(`${a}: ${b}. A fix is proven only when the next validation no longer finds it.`);
      return 0;
    }

    if (cmd === 'advance') {
      if (![...STAGES, 'rolled_back'].includes(a as StageOrEnd)) throw new Error(`Unknown stage "${a}".`);
      const r = advance(chain, a as StageOrEnd, actor, io.now());
      if (!r.ok) { io.out(`Not yet — ${a} needs:`); for (const p of r.problems) io.out(`  - ${p}`); return 1; }
      await put(dir, r.entry);
      io.out(`Entered ${a}.`);
      return 0;
    }

    if (cmd === 'seal') {
      const retention = existsSync(String(flags.retention)) ? readJson<Partial<RetentionPolicy>>(String(flags.retention)) : undefined;
      const files: { name: string; sha256: string; bytes: number }[] = [];
      const walk = (p: string) => {
        for (const name of readdirSync(p)) {
          const full = join(p, name);
          if (statSync(full).isDirectory()) walk(full);
          else if (name !== 'ledger.jsonl' && name !== 'manifest.json') files.push({ name: relative(dir, full), sha256: sha256File(full), bytes: statSync(full).size });
        }
      };
      walk(dir);
      const sealed = await seal(chain, files, { tenant: current.tenant, wave: current.wave, now: io.now(), retention });
      if (!sealed.ok) { io.out('Not sealed:'); for (const p of sealed.problems) io.out(`  - ${p}`); return 1; }
      writeJson(join(dir, 'manifest.json'), sealed.manifest);
      io.out(`Sealed ${files.length} files and ${chain.length} ledger entries. manifest ${sealed.manifest.manifestHash.slice(0, 16)}…`);
      return 0;
    }

    throw new Error(`Unknown command "${cmd}".`);
  } catch (e) {
    io.out(`Error: ${(e as Error).message}`);
    return 1;
  }
}

// `node scripts/institution-migration.ts …` runs it; importing it for a test does not.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  run(process.argv.slice(2), { now: () => new Date().toISOString(), out: (l) => console.log(l) }).then((code) => { process.exitCode = code; });
}
