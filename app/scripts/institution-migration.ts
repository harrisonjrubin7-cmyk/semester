/**
 * Run the migration checks from a terminal, against a working directory.
 *
 *     node scripts/institution-migration.ts init <dir> --tenant T --wave W --domains a,b --retain-until DATE --actor NAME
 *     node scripts/institution-migration.ts validate <dir> <domain> --actor NAME --independent-source-read
 *     node scripts/institution-migration.ts queue <dir> [domain]
 *     node scripts/institution-migration.ts exception <dir> <key> triage|resolve|waive|descope|close --actor NAME …
 *     node scripts/institution-migration.ts sign <dir> <gate> <domain> <role> --actor NAME --decision approve|reject
 *     node scripts/institution-migration.ts signoffs <dir> <gate> <domain>
 *     node scripts/institution-migration.ts plan <plan.json>
 *     node scripts/institution-migration.ts verify <dir>
 *
 * The method is `docs/migration/`; this is its hands. It does not replace the
 * Migration Center, which holds the project, the stage and the approvals
 * (`lib/migration/center.ts`): `validate` prints the counts to record there, in
 * a form the Center's own pass rule cannot read as a pass when the evidence was
 * not there.
 *
 * ## What it never does
 *
 * Connect to a source system or write to production. An institution extracts to
 * files and this reads them. The one-time load is a reviewed, owner-approved
 * act; a tool that could also do it would make that approval a formality.
 *
 * ## What lives where
 *
 * `ledger.jsonl` is the hash-chained record (`evidence.ts`): digests, opaque
 * references and short sanitized text, never a row. `exceptions.json` is the
 * queue, `signoffs.json` the signatures. Reports carry salted references and
 * field names. A student's value never reaches any of them.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { executableCoverage, runChecks, thresholdsFor } from '../src/lib/migration/adapter.ts';
import { toRunCounts } from '../src/lib/migration/bridge.ts';
import { DOMAIN_SPECS, specOf } from '../src/lib/migration/domain-specs.ts';
import type { Crosswalk, Dataset, DomainSpec, Pair } from '../src/lib/migration/engine-types.ts';
import { append, digestOf, evidenceHead, verifyChain, type EvidenceEntry, type EvidenceKind } from '../src/lib/migration/evidence.ts';
import { applyRun, assignOwner, close, dispositioned, markOutOfScope, resolve, waive, type ExceptionRow } from '../src/lib/migration/exceptions.ts';
import { evaluateGate } from '../src/lib/migration/gate.ts';
import { cutoverPlanProblems, type CutoverPlan } from '../src/lib/migration/rehearsal.ts';
import { GATES, evaluateSignoffs, type Gate, type Role, type Signoff } from '../src/lib/migration/signoff.ts';
import { templates } from '../src/lib/migration/templates.ts';
import type { CheckResult } from '../src/lib/migration/types.ts';

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

interface RunFile {
  tenant: string;
  wave: string;
  domains: string[];
  /** From the institution's records schedule; the ledger refuses an entry without one. */
  retainUntil: string;
}

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;
const writeJson = (path: string, value: unknown) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
const optional = <T>(path: string, fallback: T): T => (existsSync(path) ? readJson<T>(path) : fallback);

function readLedger(dir: string): EvidenceEntry[] {
  const path = join(dir, 'ledger.jsonl');
  return existsSync(path) ? readFileSync(path, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as EvidenceEntry) : [];
}

async function file(dir: string, run: RunFile, entry: { at: string; actor: string; kind: EvidenceKind; subject: string; artifact: unknown; summary: string }): Promise<void> {
  const ledger = readLedger(dir);
  const ok = await verifyChain(ledger);
  if (!ok.ok) throw new Error(`The ledger is broken at entry ${ok.at} (${ok.reason}). Nothing was written.`);
  const next = await append(ledger, { ...entry, retainUntil: run.retainUntil });
  writeFileSync(join(dir, 'ledger.jsonl'), next.map((e) => JSON.stringify(e)).join('\n') + '\n');
}

const need = (flags: Parsed['flags'], k: string): string => {
  const v = flags[k];
  if (typeof v !== 'string' || !v.trim()) throw new Error(`--${k} is required.`);
  return v;
};
const opt = (flags: Parsed['flags'], k: string) => (typeof flags[k] === 'string' ? (flags[k] as string) : undefined);

function specFor(id: string | undefined): DomainSpec {
  const s = id ? specOf(id) : undefined;
  if (!s) throw new Error(`Unknown domain "${id ?? ''}". Known: ${DOMAIN_SPECS.map((x) => x.id).join(', ')}.`);
  return s;
}

/** The pair for one domain, with the rows of any entity it only references taken from the domain that owns it. */
function loadPair(dir: string, d: DomainSpec): Pair {
  const get = (domain: string, name: string) => {
    const path = join(dir, domain, name);
    if (!existsSync(path)) throw new Error(`${join(domain, name)} is missing.`);
    return readJson<Record<string, unknown>>(path);
  };
  const source: Record<string, unknown> = { ...(get(d.id, 'source.json') as Dataset) };
  const target: Record<string, unknown> = { ...(get(d.id, 'target.json') as Dataset) };
  const crosswalk: Record<string, unknown> = { ...(get(d.id, 'crosswalk.json') as Crosswalk) };
  for (const ref of d.references) {
    const owner = DOMAIN_SPECS.find((x) => x.entities.some((e) => e.name === ref.name));
    if (!owner) throw new Error(`No domain owns ${ref.name}.`);
    source[ref.name] = (get(owner.id, 'source.json') as Dataset)[ref.name] ?? [];
    target[ref.name] = (get(owner.id, 'target.json') as Dataset)[ref.name] ?? [];
    crosswalk[ref.name] = (get(owner.id, 'crosswalk.json') as Crosswalk)[ref.name] ?? {};
  }
  const excluded = optional<Record<string, Record<string, string>> | undefined>(join(dir, d.id, 'excluded.json'), undefined);
  for (const [entity, rows] of Object.entries(excluded ?? {})) {
    for (const reason of Object.values(rows)) {
      if (reason.trim().length < 20) throw new Error(`excluded.json: an exclusion in ${entity} needs a reason that says why (20 characters at least).`);
    }
  }
  return {
    source: source as Dataset, target: target as Dataset, crosswalk: crosswalk as Crosswalk, excluded,
    approvedMerges: optional<Record<string, string[]> | undefined>(join(dir, d.id, 'merges.json'), undefined),
  };
}

/** Results from outside the two extracts (a sign-in sample, a retrieval test), for the classes the engine cannot derive. */
function loadExternal(dir: string, d: DomainSpec, taken: ReadonlySet<string>): CheckResult[] {
  const rows = optional<CheckResult[]>(join(dir, d.id, 'external-checks.json'), []);
  for (const r of rows) {
    if (r.domain !== d.id) throw new Error(`external-checks.json: ${r.id} is for ${r.domain}, not ${d.id}.`);
    if (taken.has(r.id)) throw new Error(`external-checks.json: ${r.id} is already a check the engine runs.`);
    if (!Array.isArray(r.failures) || !Number.isFinite(r.examined)) throw new Error(`external-checks.json: ${r.id} is not a check result.`);
  }
  return rows;
}

const loadQueue = (dir: string): ExceptionRow[] => optional<ExceptionRow[]>(join(dir, 'exceptions.json'), []);

/** The unique row whose key starts with what was typed. A key is long; the start of it is enough. */
function findRow(queue: readonly ExceptionRow[], typed: string): ExceptionRow {
  const hits = queue.filter((q) => q.key.startsWith(typed));
  if (hits.length === 0) throw new Error(`No exception starts with "${typed}". See \`queue\`.`);
  if (hits.length > 1) throw new Error(`"${typed}" matches ${hits.length} exceptions; type more of the key.`);
  return hits[0];
}

export async function run(argv: readonly string[], io: Io): Promise<number> {
  const { positional, flags } = parse(argv);
  const [cmd, dir, a, b, c] = positional;
  try {
    if (cmd === 'plan') {
      const problems = cutoverPlanProblems(readJson<CutoverPlan>(dir));
      if (!problems.length) { io.out('The plan has no problems.'); return 0; }
      for (const p of problems) io.out(`  ${p.code}${p.detail ? ` (${p.detail})` : ''}`);
      return 1;
    }
    if (!cmd || !dir) { io.out('Usage: node scripts/institution-migration.ts <init|validate|queue|exception|sign|signoffs|plan|verify> <dir> ...'); return 2; }

    if (cmd === 'init') {
      if (existsSync(join(dir, 'run.json'))) throw new Error(`${dir} is already a migration directory.`);
      const ids = need(flags, 'domains').split(',').map((s) => s.trim());
      for (const id of ids) specFor(id);
      const retainUntil = need(flags, 'retain-until');
      if (!Number.isFinite(Date.parse(retainUntil))) throw new Error('--retain-until must be a date from the institution\'s records schedule.');
      mkdirSync(dir, { recursive: true });
      for (const id of ids) {
        mkdirSync(join(dir, id), { recursive: true });
        for (const [name, text] of Object.entries(templates(specFor(id)))) writeFileSync(join(dir, id, name), text);
      }
      writeJson(join(dir, 'run.json'), { tenant: need(flags, 'tenant'), wave: need(flags, 'wave'), domains: ids, retainUntil } satisfies RunFile);
      io.out(`Opened ${dir} for ${ids.join(', ')}. Workbook templates are in each domain folder.`);
      return 0;
    }

    if (!existsSync(join(dir, 'run.json'))) throw new Error(`${dir} is not a migration directory. Run init first.`);
    const runFile = readJson<RunFile>(join(dir, 'run.json'));

    if (cmd === 'verify') {
      const v = await verifyChain(readLedger(dir));
      if (!v.ok) { io.out(`BROKEN at entry ${v.at}: ${v.reason}`); return 1; }
      io.out(`Ledger intact: ${readLedger(dir).length} entries.`);
      return 0;
    }

    if (cmd === 'queue') {
      const rows = loadQueue(dir).filter((q) => !a || q.domain === a);
      for (const q of rows) io.out(`${q.state.padEnd(12)} ${q.severity.padEnd(8)} ${(q.origin ?? '-').padEnd(9)} ${q.key}${q.owner ? `  owner ${q.owner}` : ''}`);
      io.out(`${rows.length} exception${rows.length === 1 ? '' : 's'}.`);
      return 0;
    }

    if (cmd === 'signoffs') {
      if (!(GATES as readonly string[]).includes(a)) throw new Error(`Unknown gate "${a}". Known: ${GATES.join(', ')}.`);
      const d = specFor(b);
      const ledger = readLedger(dir);
      const preparers = new Set(ledger.filter((e) => e.kind !== 'signoff').map((e) => e.actor));
      const status = evaluateSignoffs(a as Gate, d.id, optional<Signoff[]>(join(dir, 'signoffs.json'), []), evidenceHead(ledger), preparers, io.now());
      io.out(status.open ? `${a} is open for ${d.id}.` : `${a} is closed for ${d.id}:`);
      for (const p of status.problems) io.out(`  - ${p.role}: ${p.code}`);
      return status.open ? 0 : 1;
    }

    const actor = need(flags, 'actor');
    const now = io.now();

    if (cmd === 'validate') {
      const d = specFor(a);
      if (flags['independent-source-read'] !== true) throw new Error('Pass --independent-source-read to attest that the source side was read by a path other than the transform. A validation that shares the transform\'s read cannot catch the transform\'s mistakes.');
      const attested = optional<{ emptyChecks?: string[] }>(join(dir, d.id, 'attest.json'), {}).emptyChecks ?? [];
      const ev = await runChecks(d, loadPair(dir, d), runFile.tenant, attested);
      const results = [...ev.results, ...loadExternal(dir, d, new Set(ev.results.map((r) => r.id)))];
      const artifact = { domain: d.id, results, proofs: ev.proofs.map((p) => ({ check: p.invariant, status: p.status, injected: p.injected, caught: p.caught })), unproven: ev.unproven };
      const evidenceId = await digestOf(artifact);
      const queue = applyRun(loadQueue(dir), results, evidenceId, now);
      const dispo = dispositioned(queue, now);
      const gate = evaluateGate(d.id, results, thresholdsFor(d.stakes), dispo, { attestedEmpty: ev.attestedResultIds, unproven: ev.unproven });
      writeJson(join(dir, 'exceptions.json'), queue);
      writeJson(join(dir, d.id, 'check-run.json'), { ...artifact, gate });
      await file(dir, runFile, { at: now, actor, kind: 'check_run', subject: d.id, artifact, summary: `${results.length} checks, ${results.reduce((n, r) => n + r.failures.length, 0)} failing cases` });
      await file(dir, runFile, { at: now, actor, kind: 'gate_result', subject: d.id, artifact: gate, summary: gate.passed ? 'gate passed' : `gate held: ${gate.reasons.map((r) => r.code).join(', ')}` });
      io.out(`${d.id}: ${gate.passed ? 'PASS' : 'DOES NOT PASS'}`);
      for (const r of gate.reasons) io.out(`  - ${r.code}: ${r.detail}`);
      io.out(`  evidence covered by the engine: ${executableCoverage(d).join(', ')}`);
      io.out(`  open: ${gate.open.critical} critical, ${gate.open.high} high, ${gate.open.medium} medium, ${gate.open.low} low`);
      for (const kind of ['validation', 'reconciliation'] as const) io.out(`  record in the Migration Center as ${kind}: ${JSON.stringify(toRunCounts(kind, results, gate, dispo))}`);
      return gate.passed ? 0 : 1;
    }

    if (cmd === 'exception') {
      const queue = loadQueue(dir);
      const row = findRow(queue, a);
      const act = b;
      let next: ExceptionRow;
      if (act === 'triage') next = assignOwner(row, need(flags, 'owner'), actor, now);
      else if (act === 'resolve') next = resolve(row, need(flags, 'note'), actor, now);
      else if (act === 'waive') next = waive(row, need(flags, 'approver'), need(flags, 'reason'), need(flags, 'expires'), now);
      else if (act === 'descope') next = markOutOfScope(row, need(flags, 'approver'), need(flags, 'reason'), now);
      else if (act === 'close') next = close(row, actor, now);
      else throw new Error('An action is triage, resolve, waive, descope or close. A fix is verified by the next `validate`, not by a command.');
      writeJson(join(dir, 'exceptions.json'), queue.map((q) => (q.key === row.key ? next : q)));
      await file(dir, runFile, { at: now, actor, kind: 'exception_event', subject: row.domain, artifact: next.history.at(-1), summary: `${act}: ${row.checkId}` });
      io.out(`${row.key}: ${act} → ${next.state}`);
      return 0;
    }

    if (cmd === 'sign') {
      if (!(GATES as readonly string[]).includes(a)) throw new Error(`Unknown gate "${a}". Known: ${GATES.join(', ')}.`);
      const d = specFor(b);
      const decision = need(flags, 'decision');
      if (decision !== 'approve' && decision !== 'reject') throw new Error('--decision is approve or reject.');
      const ledger = readLedger(dir);
      const signoff: Signoff = { gate: a as Gate, domain: d.id, role: c as Role, person: actor, at: now, evidenceHead: evidenceHead(ledger), decision };
      writeJson(join(dir, 'signoffs.json'), [...optional<Signoff[]>(join(dir, 'signoffs.json'), []), signoff]);
      await file(dir, runFile, { at: now, actor, kind: 'signoff', subject: d.id, artifact: signoff, summary: `${c} ${decision} ${a}` });
      io.out(`${actor} ${decision}d ${a} for ${d.id} as ${c}. Any evidence filed after this makes the signature stale.`);
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
