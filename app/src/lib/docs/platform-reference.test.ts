import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MARKS, PRUNE_DAYS } from '../activity';
import { EDGE_GUARDS } from '../edgeguards';
import { SEATS } from '../launchreadiness';
import { table } from '../ops/render';
import {
  EVENT_TYPES,
  EVENT_TYPE_PATTERN,
  RETENTION_CLASSES,
  makeEvent,
  validateEvent,
  type EventType,
} from '../../../../packages/institution/src/events';
import {
  ACTOR_TYPES,
  CORRELATION_ID_PATTERN,
  POLICY_ENVIRONMENTS,
  RESOURCE_CLASSIFICATIONS,
} from '../../../../packages/institution/src/policy';

/**
 * The platform reference pages, held to the code they describe.
 *
 *   docs/reference/EDGE-FUNCTIONS.md  held       the sixteen function directories, their
 *                                                verify_jwt, guard, environment names and
 *                                                RPCs, read from the source
 *   docs/reference/CONFIGURATION.md   held       every environment variable name read by
 *                                                the edge functions and the gateway
 *   docs/reference/ANALYTICS-MARKS.md held       the three marks, the telemetry events
 *                                                the code emits, and what is only defined
 *   docs/reference/EVENTS.md          generated  the event catalog, validateEvent's rules
 *                                                and the outbox contract
 *   docs/reference/schemas/events/    generated  one JSON Schema per event group
 *
 * `REGISTERS=write npx vitest run src/lib/docs/platform-reference.test.ts`
 * from app/ rewrites the generated files. Everything else only reads.
 *
 * Every guard below is shown a case it must accept before it is trusted to
 * refuse another. A probe that finds six problems in six places is also what
 * a broken probe looks like.
 */

const root = join(import.meta.dirname, '../../../..');
const at = (p: string) => join(root, p);
const read = (p: string) => readFileSync(at(p), 'utf8');
const WRITE = process.env.REGISTERS === 'write';
const THIS_TEST = 'app/src/lib/docs/platform-reference.test.ts';

const EDGE = 'docs/reference/EDGE-FUNCTIONS.md';
const CONFIG = 'docs/reference/CONFIGURATION.md';
const MARKS_DOC = 'docs/reference/ANALYTICS-MARKS.md';
const EVENTS = 'docs/reference/EVENTS.md';
const SCHEMA_DIR = 'docs/reference/schemas/events';

// ── Helpers shared by every page ───────────────────────────────────────────

/** Repository-relative paths of the files under `dir` that `keep` accepts. */
function walk(dir: string, keep: (rel: string) => boolean, out: string[] = []): string[] {
  for (const e of readdirSync(at(dir), { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(rel, keep, out);
    else if (keep(rel)) out.push(rel);
  }
  return out.sort();
}

const isTest = (rel: string) => /\.(test|check)\.[a-z]+$/.test(rel) || /\/(tests?|__tests__)\//.test(rel);
const isCode = (rel: string) => /\.(ts|tsx|mjs)$/.test(rel) && !isTest(rel);

/** The difference between two lists, so a failure says which side has the extra name. */
function diff(documented: readonly string[], actual: readonly string[]): { onlyDocumented: string[]; onlyInCode: string[] } {
  const d = new Set(documented);
  const a = new Set(actual);
  return {
    onlyDocumented: [...d].filter((x) => !a.has(x)).sort(),
    onlyInCode: [...a].filter((x) => !d.has(x)).sort(),
  };
}

const NONE = { onlyDocumented: [], onlyInCode: [] };

/** Every `` `token` `` in a table cell, in order. */
const tokens = (cellText: string): string[] => [...cellText.matchAll(/`([^`]+)`/g)].map((m) => m[1]);

/** The cells of one Markdown table row. */
const cellsOf = (row: string): string[] => row.split('|').slice(1, -1).map((c) => c.trim());

/** The lines of the first table under the heading `## <heading>`. */
function tableUnder(md: string, heading: string): string[] {
  const body = md.split(`\n## ${heading}\n`)[1]?.split('\n## ')[0];
  if (body === undefined) throw new Error(`no section "${heading}"`);
  return body.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| ---'));
}

const AUDIENCE = new Set([
  'students', 'families', 'faculty', 'institution-admins', 'implementers', 'partner-developers',
  'contributors', 'operators', 'support', 'buyers', 'security-reviewers',
]);
const STATUS = new Set(['LIVE', 'IMPLEMENTED_NOT_RELEASED', 'PARTIAL', 'MOCK_DEMO', 'PLANNED', 'BLOCKED']);

/** The card, as the documentation charter defines it. Returns what is wrong. */
function cardProblems(text: string, truth: 'held' | 'generated'): string[] {
  const lines = text.split('\n');
  const problems: string[] = [];
  if (!/^# \S/.test(lines[0] ?? '')) problems.push('line 1 is not a title');
  if (lines[1] !== '') problems.push('line 2 is not blank');
  const m =
    /^> \*\*Type:\*\* reference · \*\*Audience:\*\* ([a-z-]+(?:, [a-z-]+)?) · \*\*Owner:\*\* `([a-z]+)` · \*\*Truth:\*\* (generated|held) · \*\*Reviewed:\*\* (2026-10-04) · \*\*Held by:\*\* `([^`]+)`$/
      .exec(lines[2] ?? '');
  if (!m) return [...problems, 'line 3 is not a card line'];
  for (const a of m[1].split(', ')) if (!AUDIENCE.has(a)) problems.push(`audience "${a}" is not in the vocabulary`);
  if (!(SEATS as readonly string[]).includes(m[2])) problems.push(`owner "${m[2]}" is not a council seat`);
  if (m[3] !== truth) problems.push(`truth is ${m[3]}, expected ${truth}`);
  if (m[5] !== THIS_TEST) problems.push(`held by ${m[5]}`);
  if (!existsSync(at(m[5]))) problems.push('the test named in the card does not exist');
  if ((lines[3] ?? '') !== '' || !(lines[4] ?? '').length) problems.push('line 5 is not the one-sentence purpose');
  return problems;
}

/** Relative links that do not resolve, as written in `text` at repository path `file`. */
function linkProblems(file: string, text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = m[1];
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const path = decodeURI(target.split('#')[0]);
    if (!existsSync(resolve(dirname(at(file)), path))) out.push(target);
  }
  return out;
}

/** `NAME=value` assignments, which a names-only page must not hold. */
function assignments(text: string): string[] {
  return [...text.matchAll(/\b[A-Z][A-Z0-9_]{3,}=\S+/g)].map((m) => m[0]);
}

/** Strings shaped like a live credential, as opposed to a documented prefix. */
function credentialShapes(text: string): string[] {
  return [...text.matchAll(/\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{6,}|\bwhsec_[A-Za-z0-9]{6,}|\bsk-ant-[A-Za-z0-9-]{6,}|\beyJ[A-Za-z0-9_-]{10,}/g)].map((m) => m[0]);
}

/** The text that opens every rendered page's comment. */
const renderedComment = (module: string) =>
  `<!-- Rendered from ${module} by ${THIS_TEST}. Edit the code, then run \`REGISTERS=write npx vitest run src/lib/docs/platform-reference.test.ts\` from app/. -->`;

// ── Edge functions: what the source says ───────────────────────────────────

const FUNCTIONS = 'supabase/functions';

const functionDirs = (): string[] =>
  readdirSync(at(FUNCTIONS), { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('_'))
    .map((e) => e.name)
    .sort();

/** `index.ts` and every relative `.ts` module it reaches, as repository paths. */
function closure(fn: string): string[] {
  const seen = new Set<string>();
  const queue = [at(`${FUNCTIONS}/${fn}/index.ts`)];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const m of readFileSync(file, 'utf8').matchAll(/(?:from|import)\s+['"](\.[^'"]+)['"]/g)) {
      const target = resolve(dirname(file), m[1]);
      if (target.endsWith('.ts') && existsSync(target)) queue.push(target);
    }
  }
  return [...seen].map((f) => f.slice(root.length + 1)).sort();
}

/** Names read through `Deno.env.get`, including the one read through a named constant. */
function denoEnvNames(files: readonly string[]): string[] {
  const texts = files.map(read);
  const names = new Set<string>();
  for (const t of texts) {
    for (const m of t.matchAll(/Deno\.env\.get\(\s*'([A-Z][A-Z0-9_]*)'\s*\)/g)) names.add(m[1]);
    for (const m of t.matchAll(/Deno\.env\.get\(\s*([A-Za-z_]\w*)\s*\)/g)) {
      const def = texts.map((x) => new RegExp(`(?:const|let)\\s+${m[1]}\\s*=\\s*'([A-Z][A-Z0-9_]*)'`).exec(x)?.[1]).find(Boolean);
      if (def) { names.add(def); continue; }
      // The one other shape: a reader handed to a function that builds the name from a plan, `env(`PREFIX_${plan.toUpperCase()}`)`,
      // with the plans as the keys of PLAN_ALLOWANCE_MICROS (the shared key's dollar meter). Every name it can build is read.
      const family = texts.map((x) => /\benv\(`([A-Z][A-Z0-9_]*_)\$\{\w+\.toUpperCase\(\)\}`\)/.exec(x)?.[1]).find(Boolean);
      const plans = texts.map((x) => /const PLAN_ALLOWANCE_MICROS[^=]*=\s*\{([^}]*)\}/.exec(x)?.[1]).find(Boolean);
      if (!family || !plans) throw new Error(`Deno.env.get(${m[1]}) is read through a name this scan cannot resolve`);
      for (const p of plans.matchAll(/(\w+):/g)) names.add(family + p[1].toUpperCase());
    }
  }
  return [...names].sort();
}

/** Database functions called by literal name through `.rpc(...)` or the billing webhook's `call(...)`. */
function rpcNames(files: readonly string[]): string[] {
  const names = new Set<string>();
  for (const f of files) for (const m of read(f).matchAll(/(?:\.rpc|\bcall)(?:<[^>]*>)?\(\s*'([a-z_0-9]+)'/g)) names.add(m[1]);
  return [...names].sort();
}

const migrations = (): string => walk('supabase/migrations', (r) => r.endsWith('.sql')).map(read).join('\n');

const defined = (sql: string, fn: string): boolean => new RegExp(`function\\s+(?:public\\.|private\\.)?${fn}\\s*\\(`, 'i').test(sql);

interface EdgeRow {
  fn: string;
  status: string;
  methods: string[];
  guards: string[];
  verifyJwt: string;
  env: string[];
  rpcs: string[];
}

function edgeRows(md: string): EdgeRow[] {
  return tableUnder(md, 'Summary')
    .filter((l) => /^\| `[a-z-]+` \|/.test(l))
    .map((l) => {
      const c = cellsOf(l);
      const methodTokens = tokens(c[2]);
      const rpcTokens = tokens(c[6]);
      return {
        fn: tokens(c[0])[0],
        status: c[1],
        methods: methodTokens.length ? methodTokens : [c[2]],
        guards: tokens(c[3]),
        verifyJwt: tokens(c[4])[0] ?? c[4],
        env: tokens(c[5]),
        rpcs: rpcTokens,
      };
    });
}

function configToml(): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of read('supabase/config.toml').matchAll(/\[functions\.([a-z-]+)\]\s*\n\s*verify_jwt\s*=\s*(true|false)/g)) out.set(m[1], m[2]);
  return out;
}

// ── Environment variables: what the source reads ───────────────────────────

const GATEWAY_FILES = (): string[] => walk('app/server/institution', isCode).concat(walk('app/api', isCode));

/** `process.env.X`, `env.X` and `process.env['X']`, by name, with the files that read each. */
function gatewayEnv(files: readonly string[]): Map<string, string[]> {
  const out = new Map<string, Set<string>>();
  for (const f of files) {
    const t = read(f);
    const found = [
      ...t.matchAll(/\benv\.([A-Z][A-Z0-9_]+)\b/g),
      ...t.matchAll(/\bprocess\.env\[['"]([A-Z][A-Z0-9_]+)['"]\]/g),
    ].map((m) => m[1]);
    for (const n of found) out.set(n, (out.get(n) ?? new Set()).add(f.split('/').pop()!));
  }
  return new Map([...out].map(([k, v]) => [k, [...v].sort()]));
}

/** `NAME=` lines of an env template: uncommented, and commented-out examples. */
function envTemplate(text: string): { active: string[]; commented: string[] } {
  return {
    active: [...text.matchAll(/^([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]).sort(),
    commented: [...text.matchAll(/^#\s*([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]).sort(),
  };
}

// ── Events: the catalog as the source declares it ─────────────────────────

const EVENTS_SRC = 'packages/institution/src/events.ts';

interface Group {
  name: string;
  slug: string;
  types: EventType[];
}

/** The catalog's own grouping: the comment above each run of types in `EVENT_TYPES`. */
function eventGroups(source: string): Group[] {
  const block = /export const EVENT_TYPES = \{([\s\S]*?)\n\} as const satisfies/.exec(source)?.[1];
  if (!block) throw new Error('EVENT_TYPES block not found');
  const groups: Group[] = [];
  for (const line of block.split('\n')) {
    const comment = /^\s*\/\/\s*(.+)$/.exec(line)?.[1];
    // A comment straight after another comment, before any type, continues the same heading
    // (the tasks and calendar group explains itself over two lines); the name is its first sentence.
    if (comment && !(groups.length && groups[groups.length - 1].types.length === 0)) {
      const name = comment.trim().split(/\.(?:\s|$)/)[0].trim();
      groups.push({ name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), types: [] });
    }
    const type = /^\s*'([a-z_]+\.[a-z_]+)':/.exec(line)?.[1];
    if (type) groups[groups.length - 1].types.push(type as EventType);
  }
  return groups;
}

/** Fields of the `SemesterEvent` interface, in order, with whether each is optional. */
function envelopeFields(source: string): { name: string; optional: boolean; type: string }[] {
  const body = /export interface SemesterEvent<[^>]*(?:>[^>]*)?> \{([\s\S]*?)\n\}/.exec(source)?.[1];
  if (!body) throw new Error('SemesterEvent interface not found');
  return [...body.matchAll(/^ {2}(\w+)(\?)?: (.+);$/gm)].map((m) => ({ name: m[1], optional: m[2] === '?', type: m[3] }));
}

/** Every `reason: '…'` or ``reason: `…` `` in validateEvent, in source order. */
function validateReasons(source: string): string[] {
  const start = source.indexOf('export function validateEvent');
  const end = source.indexOf('export function makeEvent');
  if (start < 0 || end < start) throw new Error('validateEvent not found');
  return [...source.slice(start, end).matchAll(/reason:\s*(?:'([^']*)'|`([^`]*)`)/g)].map((m) => m[1] ?? m[2]);
}

const RANK = (c: string): number => (RESOURCE_CLASSIFICATIONS as readonly string[]).indexOf(c);

/** What each rejection means, keyed by the reason text exactly as the source spells it. */
const REASON_RULES: Record<string, string> = {
  'not an object': 'The value is `null`, an array, or anything that is not an object (including an empty string, `0` and `false`).',
  'eventId is not a UUID': 'Missing, empty, longer than 200 characters, or not a UUID with a version digit from 1 to 8 and a variant digit of 8, 9, a or b (any letter case).',
  'unknown event type ${JSON.stringify(e.eventType)}': 'eventType is not a key of the catalog.',
  '${e.eventType} is version ${expected}, not ${String(e.eventVersion)}': 'eventVersion is not exactly the catalog version for the type. An older and a newer version are both refused; a consumer does not guess.',
  'occurredAt is not a time': 'Not a string of 1 to 40 characters that `Date.parse` reads as a time. A date alone, such as `2026-10-04`, passes.',
  'producer missing': 'Not a string of 1 to 200 characters.',
  'environment unknown': `Not one of ${POLICY_ENVIRONMENTS.map((e) => `\`${e}\``).join(', ')}.`,
  'correlationId malformed': `Not a string of 1 to 128 characters matching \`${CORRELATION_ID_PATTERN.source}\`.`,
  'causationId is not a UUID': 'Present but not a UUID. Absent is allowed; `null` is not.',
  'idempotencyKey malformed': 'Present but not a string of 1 to 300 characters.',
  'tenantId malformed': 'Present but not a string of 1 to 200 characters.',
  'dataClassification unknown': `Not one of ${RESOURCE_CLASSIFICATIONS.map((e) => `\`${e}\``).join(', ')}.`,
  'retentionClass unknown': `Not one of ${RETENTION_CLASSES.map((e) => `\`${e}\``).join(', ')}.`,
  'payload is not an object': 'Missing, `null`, an array or not an object. An empty object passes.',
  'actor malformed': 'Present but `id` is not a string of 1 to 200 characters, or `type` is not a string of 1 to 20 characters.',
  'subject malformed': 'Present but `type` or `id` is not a string of 1 to 200 characters.',
  '${e.eventType} is at least ${EVENT_TYPES[e.eventType].classification}': 'dataClassification ranks below the catalog floor for the type. Raising it above the floor is allowed.',
};

const FIELD_RULES: Record<string, string> = {
  eventId: 'UUID, see rule 2.',
  eventType: 'A key of the catalog, see rule 3.',
  eventVersion: 'Exactly the catalog version, see rule 4.',
  occurredAt: 'A time `Date.parse` accepts, see rule 5.',
  producer: 'A string of 1 to 200 characters, see rule 6.',
  environment: 'One of the policy environments, see rule 7.',
  tenantId: 'A string of 1 to 200 characters when present, see rule 11. A consumer passed an expected tenant also refuses any other (`processOnce`).',
  customerAccountId: 'Not checked at all. Any value passes.',
  actor: '`{ id, type }` when present, see rule 15. `type` is typed as an actor type but only its length is checked.',
  subject: '`{ type, id }` when present, see rule 16.',
  correlationId: 'Matches the correlation pattern, see rule 8.',
  causationId: 'UUID when present, see rule 9.',
  idempotencyKey: 'A string of 1 to 300 characters when present, see rule 10. The database makes `(aggregate_type, aggregate_id, idempotency_key)` unique when it is set.',
  dataClassification: 'A known classification at or above the type floor, see rules 12 and 17.',
  retentionClass: 'A known retention class, see rule 13. It is not compared with the catalog value for the type.',
  payload: 'A non-null, non-array object, see rule 14. Its contents are the producer\'s business and are not validated per type.',
};

interface EventUse {
  file: string;
  why: string;
}

/**
 * Code that produces or consumes events: calls the library, builds its
 * in-memory stores, imports the module, or writes to its two tables. Prose
 * that merely names these things does not count, which is why it looks for
 * call syntax and `insert into` rather than the words.
 */
function findEventUses(files: readonly { path: string; text: string }[]): EventUse[] {
  const out: EventUse[] = [];
  for (const { path, text } of files) {
    if (path === EVENTS_SRC || path === THIS_TEST) continue;
    const why: string[] = [];
    if (/\b(?:makeEvent|drainOutbox|processOnce|validateEvent)\s*\(/.test(text)) why.push('calls the library');
    if (/new\s+Memory(?:Outbox|ReceiptLedger)\b/.test(text)) why.push('builds an in-memory store');
    if (/\bimplements\s+(?:OutboxStore|ReceiptLedger)\b/.test(text)) why.push('implements a store');
    if (/from\s+['"][^'"]*institution\/src\/events(?:\.ts)?['"]/.test(text) || (path.startsWith('packages/institution/src/') && /from\s+['"]\.\/events(?:\.ts)?['"]/.test(text) && !path.endsWith('/index.ts'))) why.push('imports events.ts');
    if (/insert\s+into\s+private\.domain_(?:outbox_events|event_receipts)/i.test(text)) why.push('inserts into the outbox tables');
    if (why.length) out.push({ file: path, why: why.join(', ') });
  }
  return out;
}

function repoEventUses(): EventUse[] {
  const code = repoCodeFiles();
  const sql = walk('supabase/migrations', (r) => r.endsWith('.sql')).map((path) => ({ path, text: read(path) }));
  return findEventUses([...code, ...sql]);
}

interface ProducerFacts {
  /** Directories holding TypeScript that produces events. */
  dirs: string[];
  /** Non-test code outside those directories that imports from them: a mount. Empty means nothing runs them. */
  mounts: string[];
  /** Non-test code, other than the library, that calls `drainOutbox(`: a publisher. */
  drainCallers: string[];
}

/**
 * Whether the producers the scan found are reachable from anything that runs,
 * and whether anything publishes what they write. Both are facts about imports
 * and calls, so they are read from the source rather than written down.
 */
const PLATFORM_NON_EVENT_IMPORTERS = [
  'app/server/institution/adapter.ts',
  'app/server/institution/context.ts',
  'app/server/institution/gateway.ts',
  'app/server/productivity/http.ts',
  'app/server/productivity/service.ts',
];

function producerFactsOf(uses: readonly EventUse[], files: readonly { path: string; text: string }[]): ProducerFacts {
  // A producer's root: the package (packages/x) or the server module (app/server/x) it lives in, not the folder of the file.
  const rootOf = (file: string): string => {
    const parts = file.split('/');
    return parts.slice(0, file.startsWith('packages/') ? 2 : file.startsWith('app/server/') ? 3 : parts.length - 1).join('/');
  };
  const dirs = [...new Set(uses.filter((u) => u.file.endsWith('.ts')).map((u) => rootOf(u.file)))].sort();
  const mounts = new Set<string>();
  for (const dir of dirs) {
    const base = dir.split('/').pop() as string;
    const importsIt = new RegExp(`from\\s+['"][^'"]*/${base}/[^'"]*['"]`);
    for (const f of files) {
      if (f.path.startsWith(`${dir}/`) || !importsIt.test(f.text)) continue;
      // The institution gateway takes the error envelope, correlation ids and request context from the platform package
      // (MIGRATION phase 1). That is the package's gateway half; it does not mount the event producer.
      if (dir === 'packages/platform' && PLATFORM_NON_EVENT_IMPORTERS.includes(f.path)) continue;
      mounts.add(f.path);
    }
  }
  const drainCallers = files.filter((f) => f.path !== EVENTS_SRC && f.path !== THIS_TEST && /\bdrainOutbox\s*\(/.test(f.text)).map((f) => f.path).sort();
  return { dirs, mounts: [...mounts].sort(), drainCallers };
}

function repoCodeFiles(): { path: string; text: string }[] {
  return ['app/src', 'app/server', 'app/api', 'app/scripts', 'packages', 'supabase/functions']
    .flatMap((d) => walk(d, isCode))
    .map((path) => ({ path, text: read(path) }));
}

function numberAfter(source: string, pattern: RegExp, what: string): number {
  const m = pattern.exec(source);
  if (!m) throw new Error(`could not find ${what} in events.ts`);
  return Number(m[1]);
}

// ── The generated events page ──────────────────────────────────────────────

const slugFile = (slug: string) => `${SCHEMA_DIR}/${slug}.schema.json`;

function renderEvents(): string {
  const source = read(EVENTS_SRC);
  const groups = eventGroups(source);
  const fields = envelopeFields(source);
  const reasons = validateReasons(source);
  const uses = repoEventUses();
  const maxAttempts = numberAfter(source, /options\.maxAttempts \?\? (\d+)/, 'the default maxAttempts');
  const batch = numberAfter(source, /options\.batch \?\? (\d+)/, 'the default batch size');
  const errorBytes = numberAfter(source, /\.slice\(0, (\d+)\);\s*\n\s*if \(attempts >= maxAttempts\)/, 'the error length bound');
  const total = Object.keys(EVENT_TYPES).length;
  const code = (s: string) => `\`${s}\``;

  const facts = producerFactsOf(uses, repoCodeFiles());
  const running = facts.mounts.length > 0;
  const list = (xs: readonly string[]) => xs.map(code).join(', ');
  const producers = uses.length === 0
    ? 'none. No code outside the library and its tests calls it, no store other than the in-memory ones implements it, and no migration inserts into the outbox tables.'
    : `${uses.map((u) => `${code(u.file)} (${u.why})`).join('; ')}. Mounted on a running entry point: ${running ? `${list(facts.mounts)}, which answers only when a deployment sets \`SEMESTER_PRODUCTIVITY\` to on` : `none; no code outside ${list(facts.dirs)} imports it`}. Callers of \`drainOutbox\` outside the library: ${facts.drainCallers.length ? list(facts.drainCallers) : 'none, so nothing publishes what is written'}.`;
  const out: string[] = [];
  out.push('# Event catalog and outbox');
  out.push('');
  out.push(`> **Type:** reference · **Audience:** implementers, partner-developers · **Owner:** \`data\` · **Truth:** generated · **Reviewed:** 2026-10-04 · **Held by:** \`${THIS_TEST}\``);
  out.push('');
  out.push(`This page lists the ${total} event types the platform's event envelope allows, the rules that decide whether a value is a valid event, and how the outbox and consumer receipts work; stop reading if you want events you can subscribe to today, because ${running ? 'producers are mounted, but nothing outside the repository can subscribe' : uses.length ? 'a producer exists in code but nothing runs it and nothing publishes what it writes' : 'no producer writes one yet'}.`);
  out.push('');
  out.push(`**Status:** PARTIAL — the envelope, the catalog, the validator, the publisher loop, the consumer rule and the two database tables are built and tested. Producers: ${producers}`);
  out.push('');
  out.push(renderedComment(EVENTS_SRC));
  out.push('');
  out.push('## What is built and what is not');
  out.push('');
  out.push(...table(['Piece', 'State', 'Where'], [
    ['`SemesterEvent` envelope and the `EVENT_TYPES` catalog', 'Built, unit-tested', '[`events.ts`](../../packages/institution/src/events.ts), [`events.test.ts`](../../packages/institution/src/events.test.ts)'],
    ['`validateEvent` and `makeEvent`', 'Built, unit-tested', 'the same files'],
    ['`drainOutbox` and `MemoryOutbox`', uses.length ? 'See the status line' : 'Built as library code. No job calls it.', 'the same files'],
    ['`processOnce` and `MemoryReceiptLedger`', uses.length ? 'See the status line' : 'Built as library code. No consumer uses it.', 'the same files'],
    ['`private.domain_outbox_events` and `private.domain_event_receipts`', 'Migration in the repository; service role only. Whether it is applied to any project is not verified here.', '[`20260928320000_audit_correlation_and_outbox.sql`](../../supabase/migrations/20260928320000_audit_correlation_and_outbox.sql), [`outbox.check.sql`](../../supabase/outbox.check.sql)'],
    ['A Postgres-backed `OutboxStore` or `ReceiptLedger`', uses.length ? 'See the status line' : 'None. Only the in-memory classes implement the interfaces.', 'the scan described below'],
    ['Producers', uses.length === 0 ? 'None found' : 'See the status line', 'the scan described below'],
    ['A retention sweep for the two tables', 'Owed. Not built.', '[`RETENTION.md`](../../RETENTION.md)'],
  ]));
  out.push('');
  out.push('The scan reads every non-test `.ts`, `.tsx` and `.mjs` file under `app/src`, `app/server`, `app/api`, `app/scripts`, `packages` and `supabase/functions`, and every migration, for calls to the four library functions, construction of the in-memory stores, store implementations, imports of `events.ts`, and inserts into the two tables. This page is regenerated by that scan, so a producer landing makes the test fail until the page is rewritten. The decision record is [ADR 0008](../architecture/0008-event-envelope-and-outbox.md).' + (uses.length === 0 ? ' It says the same: the envelope, catalog and two tables are accepted, and no producer writes to the outbox yet.' : ' It says no producer writes to the outbox yet, which was true when it was written; the scan above is the authority now.'));
  out.push('');
  out.push('`app/src/lib/plan-recovery.ts` exports its own `EVENT_TYPES`. It is a different list, for plan recovery, and unrelated to this catalog.');
  out.push('');
  out.push('## The envelope');
  out.push('');
  out.push('Every event is a `SemesterEvent`. `makeEvent` stamps `eventVersion`, `retentionClass` and a default `dataClassification` from the catalog and defaults `occurredAt` to the current time; the producer supplies the rest.');
  out.push('');
  out.push(...table(['Field', 'Required', 'Type', 'What `validateEvent` checks'], fields.map((f) => [
    code(f.name),
    f.optional ? 'no' : 'yes',
    code(f.type),
    FIELD_RULES[f.name] ?? '',
  ])));
  out.push('');
  out.push(`Classifications are ordered ${RESOURCE_CLASSIFICATIONS.map(code).join(' < ')}. Each type's classification below is a floor: a producer may raise it and may not lower it. Retention classes are ${RETENTION_CLASSES.map(code).join(', ')}; a row declares its class so a sweep can apply policy without reading the payload. The durations are policy, in [\`RETENTION.md\`](../../RETENTION.md), not code.`);
  out.push('');
  out.push(`## The catalog (${total} types, ${groups.length} groups)`);
  out.push('');
  out.push('Every type is at version 1. A consumer refuses a type that is not listed. A producer adds its type here in the same change as its first consumer.');
  for (const g of groups) {
    out.push('');
    out.push(`### ${g.name}`);
    out.push('');
    out.push(`Schema: [\`${g.slug}.schema.json\`](schemas/events/${g.slug}.schema.json)`);
    out.push('');
    out.push(...table(['Type', 'Version', 'Classification floor', 'Retention class'], g.types.map((t) => [
      code(t), String(EVENT_TYPES[t].version), code(EVENT_TYPES[t].classification), code(EVENT_TYPES[t].retention),
    ])));
  }
  out.push('');
  out.push('## What `validateEvent` rejects');
  out.push('');
  out.push('A consumer runs `validateEvent` before it reads the payload. The rules run in this order and the first one that fails is the reason returned. `${…}` in a reason marks a value the validator fills in. Unknown extra fields on the event pass.');
  out.push('');
  out.push(...table(['#', 'Reason returned', 'Fails when'], [
    ...reasons.map((r, i) => [String(i + 1), code(r), REASON_RULES[r] ?? ''] as string[]),
  ]));
  out.push('');
  out.push('Checks the validator does not make, stated so nobody assumes them:');
  out.push('');
  out.push('- `retentionClass` is not compared with the catalog value for the type. `makeEvent` stamps the catalog value; a hand-built event with another known class passes.');
  out.push(`- \`actor.type\` is not compared with the actor types (${ACTOR_TYPES.map(code).join(', ')}).`);
  out.push('- `customerAccountId` is not checked.');
  out.push('- The payload is not validated per type.');
  out.push('- Lowering `dataClassification` is refused by `validateEvent`, not by `makeEvent`, and not by the database, whose check constraint accepts any known classification.');
  out.push('');
  out.push('## Outbox semantics');
  out.push('');
  out.push('The pattern is a transactional outbox. A producer writes the business record and its event row in one database transaction, so a grade is never posted without the event that tells everyone. A publisher reads rows that are neither published nor parked and sends them.');
  out.push('');
  out.push('### `drainOutbox(store, publish, options)`');
  out.push('');
  out.push(...table(['Behavior', 'Value'], [
    ['Default `maxAttempts`', String(maxAttempts)],
    ['Default batch size (`pending(limit)`)', String(batch)],
    ['Rows offered', 'The oldest pending rows first; a row that is published or parked is not pending.'],
    ['On success', '`markPublished(id, now)`; counted as `published`.'],
    ['On a throw', 'The attempt count is the stored count plus one. Below `maxAttempts`, `markFailed(id, message, attempts)`; counted as `failed`; the row is retried on a later pass.'],
    ['At `maxAttempts`', '`markDeadLettered(id, now, message)`; counted as `deadLettered`. The row stays, visible to an operator, and `drainOutbox` does not offer it again.'],
    ['What is kept of an error', `The message only, cut to ${errorBytes} characters. Never the payload.`],
    ['Report', '`{ published, failed, deadLettered }`.'],
  ]));
  out.push('');
  out.push('A row is never both published and parked: the table has a check constraint (`domain_outbox_one_outcome`) and `outbox.check.sql` proves it.');
  out.push('');
  out.push('### The table `private.domain_outbox_events`');
  out.push('');
  out.push('Columns: `id`, `aggregate_type`, `aggregate_id`, `event_type`, `event_version`, `environment`, `tenant_id`, `producer`, `correlation_id`, `causation_id`, `idempotency_key`, `payload`, `data_classification`, `retention_class`, `occurred_at`, `published_at`, `publish_attempts`, `last_error` (at most 500 characters), `dead_lettered_at`. The envelope has no `aggregate_type` or `aggregate_id`, and the table has no `customerAccountId`, `actor` or `subject` column: mapping between the two is a producer\'s job.' + (uses.some((u) => u.file.endsWith('.sql')) ? ' The one producer found does it in a SQL function: the envelope\'s `subject` becomes `aggregate_type` and `aggregate_id`, and `actor` is not stored.' : ' No producer exists yet.') + ' The table is service role only; no signed-in account can reach it.');
  out.push('');
  out.push('### `processOnce(ledger, consumer, value, handler, expectedTenant?)`');
  out.push('');
  out.push('At-least-once delivery means every consumer eventually sees an event twice. `processOnce` runs these steps in order:');
  out.push('');
  out.push('1. `validateEvent`. A failure returns `{ outcome: \'refused\', reason }`.');
  out.push('2. If `expectedTenant` is given and the event\'s `tenantId` differs, `refused` with `event is for another tenant`.');
  out.push('3. If the ledger has a receipt for (consumer, event) with outcome `processed` or `skipped`, return `{ outcome: \'duplicate\', earlier }` without calling the handler.');
  out.push(`4. Run the handler. A throw records a \`failed\` receipt with the message cut to ${errorBytes} characters and returns \`{ outcome: 'failed', error }\`. A \`failed\` receipt does not block a later delivery, so a handler's external writes must be idempotent in their own right.`);
  out.push('5. Otherwise record a `processed` receipt and return `{ outcome: \'processed\' }`.');
  out.push('');
  out.push('The receipts table `private.domain_event_receipts` has primary key `(consumer, event_id)` and outcomes `processed`, `skipped` and `failed`, so a second receipt for one event is refused by the database too.');
  out.push('');
  out.push('## JSON Schemas');
  out.push('');
  out.push('The schemas use draft 2020-12 and are generated from the catalog, one file per group plus the envelope and an index. They mirror `validateEvent`, not the TypeScript type: where the validator is looser than the type, the schema is as loose.');
  out.push('');
  out.push(...table(['File', 'Schema `$id`', 'Covers'], [
    ['[`envelope.schema.json`](schemas/events/envelope.schema.json)', '`urn:semester:events:envelope`', 'The envelope, and the catalog\'s type names.'],
    ...groups.map((g) => [`[\`${g.slug}.schema.json\`](schemas/events/${g.slug}.schema.json)`, `\`urn:semester:events:${g.slug}\``, `${g.types.length} type${g.types.length === 1 ? '' : 's'}: the envelope plus each type's constant name and version and the classifications at or above its floor.`]),
    ['[`catalog.schema.json`](schemas/events/catalog.schema.json)', '`urn:semester:events:catalog`', `Any one of the ${groups.length} groups.`],
  ]));
  out.push('');
  out.push('A group schema refers to the envelope by `$id`, so load the envelope first. A validator that treats `format` as an annotation will accept more `occurredAt` values than the tests do.');
  out.push('');
  out.push('Where the schema and `validateEvent` differ, the test pins the difference rather than hiding it:');
  out.push('');
  out.push('- `occurredAt`: the validator accepts anything `Date.parse` reads, including a bare date; the schema requires an RFC 3339 `date-time`. The schema is stricter.');
  out.push('- `retentionClass`: both accept any known class; neither compares it with the catalog value. The catalog value is carried in the schema as an annotation, `x-semesterCatalogRetention`.');
  out.push('- `actor.type` and `customerAccountId` are as loose in the schema as in the validator.');
  out.push('');
  return `${out.join('\n')}\n`;
}

// ── JSON Schema: generation, and a checker small enough to read ────────────

const SCHEMA_DRAFT = 'https://json-schema.org/draft/2020-12/schema';
const UUID_SCHEMA_PATTERN = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$';

type Schema = Record<string, unknown>;

function envelopeSchema(): Schema {
  const str = (min: number, max: number): Schema => ({ type: 'string', minLength: min, maxLength: max });
  return {
    $schema: SCHEMA_DRAFT,
    $id: 'urn:semester:events:envelope',
    title: 'SemesterEvent envelope',
    description: 'The envelope every event carries. Mirrors validateEvent in packages/institution/src/events.ts, rule for rule; generated by app/src/lib/docs/platform-reference.test.ts.',
    type: 'object',
    required: ['eventId', 'eventType', 'eventVersion', 'occurredAt', 'producer', 'environment', 'correlationId', 'dataClassification', 'retentionClass', 'payload'],
    properties: {
      eventId: { ...str(1, 200), pattern: UUID_SCHEMA_PATTERN },
      eventType: { type: 'string', pattern: EVENT_TYPE_PATTERN.source, enum: Object.keys(EVENT_TYPES) },
      eventVersion: { type: 'integer', minimum: 1 },
      occurredAt: { ...str(1, 40), format: 'date-time' },
      producer: str(1, 200),
      environment: { enum: [...POLICY_ENVIRONMENTS] },
      tenantId: str(1, 200),
      customerAccountId: { description: 'Typed as a string in SemesterEvent. validateEvent does not check it, so neither does this schema.' },
      actor: { type: 'object', required: ['id', 'type'], properties: { id: str(1, 200), type: { ...str(1, 20), description: 'Typed as an actor type in SemesterEvent. validateEvent checks only the length.' } } },
      subject: { type: 'object', required: ['type', 'id'], properties: { type: str(1, 200), id: str(1, 200) } },
      correlationId: { ...str(1, 128), pattern: CORRELATION_ID_PATTERN.source },
      causationId: { type: 'string', pattern: UUID_SCHEMA_PATTERN, maxLength: 200 },
      idempotencyKey: str(1, 300),
      dataClassification: { enum: [...RESOURCE_CLASSIFICATIONS] },
      retentionClass: { enum: [...RETENTION_CLASSES] },
      payload: { type: 'object' },
    },
  };
}

function groupSchema(g: Group): Schema {
  return {
    $schema: SCHEMA_DRAFT,
    $id: `urn:semester:events:${g.slug}`,
    title: `Semester events: ${g.name}`,
    description: `The ${g.types.length} ${g.name} event types. Each branch fixes the type name and version and allows the classifications at or above the type's floor. Generated from EVENT_TYPES in packages/institution/src/events.ts.`,
    allOf: [{ $ref: 'urn:semester:events:envelope' }],
    oneOf: g.types.map((t) => ({
      title: t,
      properties: {
        eventType: { const: t },
        eventVersion: { const: EVENT_TYPES[t].version },
        dataClassification: { enum: RESOURCE_CLASSIFICATIONS.slice(RANK(EVENT_TYPES[t].classification)) },
        retentionClass: { description: `The catalog declares ${EVENT_TYPES[t].retention} for this type. validateEvent does not compare it.`, 'x-semesterCatalogRetention': EVENT_TYPES[t].retention },
      },
    })),
  };
}

function catalogSchema(groups: Group[]): Schema {
  return {
    $schema: SCHEMA_DRAFT,
    $id: 'urn:semester:events:catalog',
    title: 'Any Semester event',
    description: 'An event valid under exactly one group schema. Load the envelope and every group schema first.',
    anyOf: groups.map((g) => ({ $ref: `urn:semester:events:${g.slug}` })),
  };
}

function renderSchemas(): Record<string, string> {
  const groups = eventGroups(read(EVENTS_SRC));
  const files: Record<string, Schema> = {
    [slugFile('envelope')]: envelopeSchema(),
    [slugFile('catalog')]: catalogSchema(groups),
  };
  for (const g of groups) files[slugFile(g.slug)] = groupSchema(g);
  return Object.fromEntries(Object.entries(files).map(([p, s]) => [p, `${JSON.stringify(s, null, 2)}\n`]));
}

const ANNOTATIONS = new Set(['$schema', '$id', 'title', 'description', '$comment']);
const DATE_TIME = /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[Zz]|[+-]\d{2}:\d{2})$/;

const jsonType = (v: unknown): string => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

/**
 * The part of JSON Schema these files use, and nothing else. A keyword it
 * does not know throws, so a schema cannot gain a constraint that this
 * checker silently ignores.
 */
function schemaErrors(schema: Schema, value: unknown, registry: Map<string, Schema>, path = '$'): string[] {
  const errs: string[] = [];
  for (const [keyword, arg] of Object.entries(schema)) {
    if (ANNOTATIONS.has(keyword) || keyword.startsWith('x-')) continue;
    switch (keyword) {
      case '$ref': {
        const target = registry.get(arg as string);
        if (!target) throw new Error(`unresolved $ref ${String(arg)}`);
        errs.push(...schemaErrors(target, value, registry, path));
        break;
      }
      case 'type': {
        const t = jsonType(value);
        const ok = arg === 'integer' ? Number.isInteger(value) : arg === 'number' ? t === 'number' : arg === t;
        if (!ok) errs.push(`${path}: expected ${String(arg)}, got ${t}`);
        break;
      }
      case 'const':
        if (JSON.stringify(value) !== JSON.stringify(arg)) errs.push(`${path}: not the constant ${JSON.stringify(arg)}`);
        break;
      case 'enum':
        if (!(arg as unknown[]).some((x) => JSON.stringify(x) === JSON.stringify(value))) errs.push(`${path}: not in the enum`);
        break;
      case 'pattern':
        if (typeof value === 'string' && !new RegExp(arg as string).test(value)) errs.push(`${path}: does not match ${String(arg)}`);
        break;
      case 'minLength':
        if (typeof value === 'string' && [...value].length < (arg as number)) errs.push(`${path}: shorter than ${String(arg)}`);
        break;
      case 'maxLength':
        if (typeof value === 'string' && [...value].length > (arg as number)) errs.push(`${path}: longer than ${String(arg)}`);
        break;
      case 'minimum':
        if (typeof value === 'number' && value < (arg as number)) errs.push(`${path}: below ${String(arg)}`);
        break;
      case 'format':
        if (arg !== 'date-time') throw new Error(`unsupported format ${String(arg)}`);
        if (typeof value === 'string' && !(DATE_TIME.test(value) && Number.isFinite(Date.parse(value)))) errs.push(`${path}: not an RFC 3339 date-time`);
        break;
      case 'required':
        if (jsonType(value) === 'object') for (const k of arg as string[]) if (!(k in (value as object))) errs.push(`${path}: missing ${k}`);
        break;
      case 'properties':
        if (jsonType(value) === 'object') {
          for (const [k, sub] of Object.entries(arg as Record<string, Schema>)) {
            if (k in (value as object)) errs.push(...schemaErrors(sub, (value as Record<string, unknown>)[k], registry, `${path}.${k}`));
          }
        }
        break;
      case 'allOf':
        for (const sub of arg as Schema[]) errs.push(...schemaErrors(sub, value, registry, path));
        break;
      case 'anyOf':
        if (!(arg as Schema[]).some((sub) => schemaErrors(sub, value, registry, path).length === 0)) errs.push(`${path}: matches none of anyOf`);
        break;
      case 'oneOf': {
        const hits = (arg as Schema[]).filter((sub) => schemaErrors(sub, value, registry, path).length === 0).length;
        if (hits !== 1) errs.push(`${path}: matches ${hits} of oneOf, needs exactly 1`);
        break;
      }
      default:
        throw new Error(`the checker does not support the keyword "${keyword}"`);
    }
  }
  return errs;
}

/** The schemas as they sit on disk, keyed by `$id`. */
function diskRegistry(): Map<string, Schema> {
  const registry = new Map<string, Schema>();
  for (const f of readdirSync(at(SCHEMA_DIR)).filter((n) => n.endsWith('.schema.json'))) {
    const s = JSON.parse(read(`${SCHEMA_DIR}/${f}`)) as Schema;
    registry.set(s.$id as string, s);
  }
  return registry;
}

// ── Sample events ──────────────────────────────────────────────────────────

const SAMPLE_ID = '0b9f3a52-6d1e-4c7a-9a40-3f2e8d1c5b77';

function sample(type: EventType): Record<string, unknown> {
  return JSON.parse(JSON.stringify(makeEvent({
    eventType: type,
    eventId: SAMPLE_ID,
    occurredAt: '2026-10-04T12:00:00.000Z',
    producer: 'docs-test',
    environment: 'demo',
    correlationId: 'corr-00000001',
    payload: {},
  }))) as Record<string, unknown>;
}

const without = (e: Record<string, unknown>, key: string): Record<string, unknown> => {
  const copy = { ...e };
  delete copy[key];
  return copy;
};

const schemaAccepts = (event: unknown, registry = diskRegistry()): boolean =>
  schemaErrors(registry.get('urn:semester:events:catalog')!, event, registry).length === 0;

interface Agreement {
  name: string;
  value: () => unknown;
  /** What both should say. */
  ok: boolean;
  /** Set where they are known to differ: what each says. */
  differs?: { validator: boolean; schema: boolean };
}

const GRADE = 'grade.posted' as const; // floor education_record
const COURSE = 'course.published' as const; // floor internal

const CASES: Agreement[] = [
  // Controls: these must pass, or the probe is not measuring what it claims.
  { name: 'control: a catalog-stamped event at its floor', value: () => sample(GRADE), ok: true },
  { name: 'control: every optional field present and well formed', value: () => ({ ...sample(GRADE), tenantId: 't-1', customerAccountId: 'c-1', actor: { id: 'u-1', type: 'user' }, subject: { type: 'x', id: 'y' }, causationId: SAMPLE_ID, idempotencyKey: 'k-1' }), ok: true },
  { name: 'control: an unknown extra top-level field passes', value: () => ({ ...sample(GRADE), extra: 1 }), ok: true },
  // Shape
  { name: 'null is not an event', value: () => null, ok: false },
  { name: 'an array is not an event', value: () => [], ok: false },
  { name: 'a string is not an event', value: () => 'event', ok: false },
  // eventId
  { name: 'eventId missing', value: () => without(sample(GRADE), 'eventId'), ok: false },
  { name: 'eventId not a UUID', value: () => ({ ...sample(GRADE), eventId: 'evt-1' }), ok: false },
  { name: 'eventId in upper case', value: () => ({ ...sample(GRADE), eventId: SAMPLE_ID.toUpperCase() }), ok: true },
  { name: 'eventId with version digit 9', value: () => ({ ...sample(GRADE), eventId: '0b9f3a52-6d1e-9c7a-9a40-3f2e8d1c5b77' }), ok: false },
  { name: 'eventId with variant digit c', value: () => ({ ...sample(GRADE), eventId: '0b9f3a52-6d1e-4c7a-ca40-3f2e8d1c5b77' }), ok: false },
  // eventType and eventVersion
  { name: 'eventType not in the catalog', value: () => ({ ...sample(GRADE), eventType: 'grade.deleted' }), ok: false },
  { name: 'eventType not shaped domain.name', value: () => ({ ...sample(GRADE), eventType: 'Grade Posted' }), ok: false },
  { name: 'eventVersion one too high', value: () => ({ ...sample(GRADE), eventVersion: 2 }), ok: false },
  { name: 'eventVersion as text', value: () => ({ ...sample(GRADE), eventVersion: '1' }), ok: false },
  { name: 'eventVersion missing', value: () => without(sample(GRADE), 'eventVersion'), ok: false },
  // occurredAt
  { name: 'occurredAt a full RFC 3339 time with an offset', value: () => ({ ...sample(GRADE), occurredAt: '2026-10-04T08:00:00-04:00' }), ok: true },
  { name: 'occurredAt not a time', value: () => ({ ...sample(GRADE), occurredAt: 'tomorrow' }), ok: false },
  { name: 'occurredAt a number', value: () => ({ ...sample(GRADE), occurredAt: 1760000000000 }), ok: false },
  { name: 'occurredAt a bare date (known difference)', value: () => ({ ...sample(GRADE), occurredAt: '2026-10-04' }), ok: true, differs: { validator: true, schema: false } },
  { name: 'occurredAt in a long form Date.parse reads (known difference)', value: () => ({ ...sample(GRADE), occurredAt: 'Oct 4, 2026' }), ok: true, differs: { validator: true, schema: false } },
  // producer
  { name: 'producer empty', value: () => ({ ...sample(GRADE), producer: '' }), ok: false },
  { name: 'producer 200 characters', value: () => ({ ...sample(GRADE), producer: 'p'.repeat(200) }), ok: true },
  { name: 'producer 201 characters', value: () => ({ ...sample(GRADE), producer: 'p'.repeat(201) }), ok: false },
  // environment
  { name: 'environment unknown', value: () => ({ ...sample(GRADE), environment: 'prod' }), ok: false },
  { name: 'environment production', value: () => ({ ...sample(GRADE), environment: 'production' }), ok: true },
  // correlationId
  { name: 'correlationId 7 characters', value: () => ({ ...sample(GRADE), correlationId: 'abcdefg' }), ok: false },
  { name: 'correlationId 8 characters', value: () => ({ ...sample(GRADE), correlationId: 'abcdefgh' }), ok: true },
  { name: 'correlationId with a space', value: () => ({ ...sample(GRADE), correlationId: 'corr 0000001' }), ok: false },
  { name: 'correlationId 128 characters', value: () => ({ ...sample(GRADE), correlationId: 'c'.repeat(128) }), ok: true },
  { name: 'correlationId 129 characters', value: () => ({ ...sample(GRADE), correlationId: 'c'.repeat(129) }), ok: false },
  // causationId, idempotencyKey, tenantId
  { name: 'causationId not a UUID', value: () => ({ ...sample(GRADE), causationId: 'cause-1' }), ok: false },
  { name: 'causationId null', value: () => ({ ...sample(GRADE), causationId: null }), ok: false },
  { name: 'idempotencyKey 300 characters', value: () => ({ ...sample(GRADE), idempotencyKey: 'k'.repeat(300) }), ok: true },
  { name: 'idempotencyKey 301 characters', value: () => ({ ...sample(GRADE), idempotencyKey: 'k'.repeat(301) }), ok: false },
  { name: 'tenantId empty', value: () => ({ ...sample(GRADE), tenantId: '' }), ok: false },
  { name: 'tenantId a number', value: () => ({ ...sample(GRADE), tenantId: 7 }), ok: false },
  // classification: the floor
  { name: 'dataClassification unknown', value: () => ({ ...sample(GRADE), dataClassification: 'secret' }), ok: false },
  { name: 'education_record type stamped public', value: () => ({ ...sample(GRADE), dataClassification: 'public' }), ok: false },
  { name: 'education_record type stamped student_private', value: () => ({ ...sample(GRADE), dataClassification: 'student_private' }), ok: false },
  { name: 'internal type stamped public', value: () => ({ ...sample(COURSE), dataClassification: 'public' }), ok: false },
  { name: 'internal type at its floor', value: () => sample(COURSE), ok: true },
  { name: 'internal type raised to education_record', value: () => ({ ...sample(COURSE), dataClassification: 'education_record' }), ok: true },
  // retention
  { name: 'retentionClass unknown', value: () => ({ ...sample(GRADE), retentionClass: 'forever' }), ok: false },
  { name: 'retentionClass known but not the catalog value (both accept)', value: () => ({ ...sample(GRADE), retentionClass: 'operational' }), ok: true },
  // payload
  { name: 'payload an array', value: () => ({ ...sample(GRADE), payload: [] }), ok: false },
  { name: 'payload null', value: () => ({ ...sample(GRADE), payload: null }), ok: false },
  { name: 'payload a string', value: () => ({ ...sample(GRADE), payload: 'x' }), ok: false },
  { name: 'payload missing', value: () => without(sample(GRADE), 'payload'), ok: false },
  { name: 'payload an object with fields', value: () => ({ ...sample(GRADE), payload: { a: [1, 2], b: { c: null } } }), ok: true },
  // actor and subject
  { name: 'actor without an id', value: () => ({ ...sample(GRADE), actor: { type: 'user' } }), ok: false },
  { name: 'actor type of 21 characters', value: () => ({ ...sample(GRADE), actor: { id: 'u', type: 'a'.repeat(21) } }), ok: false },
  { name: 'actor type that is not an actor type (both accept)', value: () => ({ ...sample(GRADE), actor: { id: 'u', type: 'robot' } }), ok: true },
  { name: 'actor null', value: () => ({ ...sample(GRADE), actor: null }), ok: false },
  { name: 'subject without an id', value: () => ({ ...sample(GRADE), subject: { type: 'x' } }), ok: false },
  { name: 'subject a string', value: () => ({ ...sample(GRADE), subject: 'x' }), ok: false },
  // customerAccountId is not checked by either
  { name: 'customerAccountId a number (both accept)', value: () => ({ ...sample(GRADE), customerAccountId: 5 }), ok: true },
];

// ── The tests ──────────────────────────────────────────────────────────────

describe('the reference pages', () => {
  it('each opens with a title, one card line and a one-sentence purpose', () => {
    expect(cardProblems(read(EDGE), 'held')).toEqual([]);
    expect(cardProblems(read(CONFIG), 'held')).toEqual([]);
    expect(cardProblems(read(MARKS_DOC), 'held')).toEqual([]);
    expect(cardProblems(read(EVENTS), 'generated')).toEqual([]);
  });

  it('the card check refuses a card that is wrong (control)', () => {
    const good = read(EDGE);
    expect(cardProblems(good.replace('**Truth:** held', '**Truth:** reviewed'), 'held')).not.toEqual([]);
    expect(cardProblems(good.replace('`engineering`', '`a person`'), 'held')).not.toEqual([]);
    expect(cardProblems(good.replace('**Type:** reference', '**Type:** how-to'), 'held')).not.toEqual([]);
    expect(cardProblems(good.replace(THIS_TEST, 'app/src/lib/docs/nothing.test.ts'), 'held')).not.toEqual([]);
  });

  it('every relative link resolves', () => {
    for (const f of [EDGE, CONFIG, MARKS_DOC, EVENTS]) expect(linkProblems(f, read(f)), f).toEqual([]);
  });

  it('the link check finds a broken link and passes a good one (control)', () => {
    expect(linkProblems(EDGE, '[a](../../supabase/config.toml) [b](#here) [c](https://example.com)')).toEqual([]);
    expect(linkProblems(EDGE, '[a](../../supabase/nothing.toml)')).toEqual(['../../supabase/nothing.toml']);
  });

  it('a page that claims status uses the truth table vocabulary', () => {
    for (const f of [EDGE, CONFIG, MARKS_DOC, EVENTS]) {
      const status = /^\*\*Status:\*\* ([A-Z_]+)/m.exec(read(f))?.[1];
      expect(STATUS.has(status ?? ''), `${f} status ${String(status)}`).toBe(true);
    }
  });

  it('no page holds a credential-shaped string or a NAME=value assignment', () => {
    for (const f of [EDGE, CONFIG, MARKS_DOC, EVENTS]) {
      expect(credentialShapes(read(f)), f).toEqual([]);
      expect(assignments(read(f).replace(/<!--[\s\S]*?-->/g, '')), f).toEqual([]);
    }
  });

  it('the value detectors fire on what they exist for (control)', () => {
    expect(assignments('Set STRIPE_SECRET_KEY=abc now')).toEqual(['STRIPE_SECRET_KEY=abc']);
    expect(assignments('the name `STRIPE_SECRET_KEY` alone, and key=value in lower case')).toEqual([]);
    // Assembled at run time: a literal here is shaped like a live Stripe key and the repository's secret scanner would (rightly) flag it.
    const sample = `${['sk', 'live'].join('_')}_abcdef123456 and ${['whsec'].join('_')}_abcdef123456`;
    expect(credentialShapes(sample)).toHaveLength(2);
    expect(credentialShapes('the prefixes sk_ and rk_live_ and txcd_ and bpc_')).toEqual([]);
  });
});

describe('EDGE-FUNCTIONS.md', () => {
  const md = read(EDGE);
  const rows = edgeRows(md);
  const dirs = functionDirs();

  it('has 16 functions to be right or wrong about, and the parser reads every row (control)', () => {
    expect(dirs).toHaveLength(16);
    expect(rows).toHaveLength(16);
    for (const r of rows) {
      expect(r.env.length, r.fn).toBeGreaterThan(0);
      expect(r.methods.length, r.fn).toBeGreaterThan(0);
    }
  });

  it('documents exactly the function directories on disk, each with a section', () => {
    expect(diff(rows.map((r) => r.fn), dirs)).toEqual(NONE);
    const sections = [...md.matchAll(/^## `([a-z-]+)`$/gm)].map((m) => m[1]);
    expect(diff(sections, dirs)).toEqual(NONE);
    expect(md).toContain('16 Supabase edge functions');
  });

  it('gives every function a status word from the vocabulary', () => {
    for (const r of rows) expect(STATUS.has(r.status), `${r.fn}: ${r.status}`).toBe(true);
  });

  it('matches verify_jwt in supabase/config.toml, and every function has an entry', () => {
    const toml = configToml();
    expect(diff([...toml.keys()], dirs)).toEqual(NONE);
    for (const r of rows) expect(r.verifyJwt, r.fn).toBe(toml.get(r.fn));
  });

  it('matches the guard register in edgeguards.ts', () => {
    expect(diff(EDGE_GUARDS.map((g) => g.fn), dirs)).toEqual(NONE);
    for (const r of rows) {
      const guard = EDGE_GUARDS.find((g) => g.fn === r.fn)!;
      expect(r.guards, r.fn).toEqual([...guard.guards]);
    }
  });

  it('names every environment variable the function reads, and none it does not', () => {
    for (const r of rows) expect(diff(r.env, denoEnvNames(closure(r.fn))), r.fn).toEqual(NONE);
  });

  it('names every database function the function calls, and each exists in a migration', () => {
    const sql = migrations();
    for (const r of rows) {
      expect(diff(r.rpcs.filter((x) => x !== 'none'), rpcNames(closure(r.fn))), r.fn).toEqual(NONE);
      for (const rpc of r.rpcs.filter((x) => x !== 'none')) expect(defined(sql, rpc), `${r.fn}: ${rpc} has no migration`).toBe(true);
    }
  });

  it('states a method only the source supports, and "any" only where there is no method check', () => {
    for (const r of rows) {
      const text = closure(r.fn).map(read).join('\n');
      if (r.methods[0] === 'any') {
        expect(/req\.method/.test(text), `${r.fn} checks the method`).toBe(false);
      } else {
        for (const m of r.methods) expect(new RegExp(`\\b${m}\\b`).test(text), `${r.fn} never mentions ${m}`).toBe(true);
      }
    }
  });

  it('keeps the numbers it quotes in step with the source', () => {
    const lit = (fn: string, s: string) => expect(closure(fn).map(read).join('\n'), `${fn}: ${s}`).toContain(s);
    lit('billing-cancel', 'MAX_CANCEL_BODY_BYTES = 512');
    lit('billing-checkout', 'MAX_CHECKOUT_BODY_BYTES = 2048');
    lit('billing-checkout', "TAX_CONSENT_VERSION = 'plus-v2'");
    lit('billing-webhook', 'MAX_WEBHOOK_BYTES = 256 * 1024');
    lit('billing-webhook', 'SIGNATURE_TOLERANCE_SECONDS = 300');
    lit('canvas', 'MAX_BYTES = 1_000_000');
    lit('canvas', 'TIMEOUT_MS = 15_000');
    lit('fetchcal', 'MAX_BYTES = 1_000_000');
    lit('fetchcal', 'TIMEOUT_MS = 15_000');
    lit('claude', "?? '60'");
    lit('claude', 'MAX_OUTPUT_TOKENS = 16_000');
    lit('claude', 'MAX_SEARCHES = 5');
    lit('claude', 'MAX_BODY_BYTES = 24 * 1024 * 1024');
    lit('lead-intake', 'MAX_LEAD_BODY_BYTES = 16 * 1024');
    expect(migrations(), 'the hourly limit in submit_site_lead').toContain(") >= 5 then");
    lit('lti', 'FLIGHT_SECONDS = 300');
    lit('productivity-sourcecheck', 'raw.length>5000');
    lit('productivity-sourcecheck', 'AbortSignal.timeout(8000)');
    lit('productivity-sourcecheck', 'bytes>512000');
    lit('push', 'PER_RUN = 500');
    lit('trust-room', 'MAX_BODY_BYTES = 2048');
    lit('trust-room', 'SIGNED_URL_SECONDS = 60');
    for (const c of ['claude-opus-5', 'claude-sonnet-5', 'claude-fable-5-1', 'claude-haiku-4-5']) expect(md).toContain(c);
  });

  it('catches a stale row (control: each mutation must show up)', () => {
    const claude = rows.find((r) => r.fn === 'claude')!;
    const actual = denoEnvNames(closure('claude'));
    expect(diff(claude.env, actual)).toEqual(NONE);
    expect(diff(claude.env.filter((n) => n !== 'MONTHLY_CALL_LIMIT'), actual).onlyInCode).toEqual(['MONTHLY_CALL_LIMIT']);
    expect(diff([...claude.env, 'INVENTED_NAME'], actual).onlyDocumented).toEqual(['INVENTED_NAME']);
    expect(diff(dirs.slice(1), dirs).onlyInCode).toEqual([dirs[0]]);
  });
});

describe('CONFIGURATION.md', () => {
  const md = read(CONFIG);
  const edgeTable = tableUnder(md, 'Edge functions').filter((l) => /^\| `[A-Z]/.test(l)).map(cellsOf);
  const gatewayTable = tableUnder(md, 'University gateway').filter((l) => /^\| `[A-Z]/.test(l)).map(cellsOf);

  const dirs = functionDirs();
  const perFunction = new Map(dirs.map((fn) => [fn, denoEnvNames(closure(fn))]));
  const edgeReaders = (name: string): string[] => dirs.filter((fn) => perFunction.get(fn)!.includes(name));

  it('has variables to be right or wrong about (control)', () => {
    expect(edgeTable.length).toBeGreaterThan(20);
    expect(gatewayTable.length).toBeGreaterThan(20);
  });

  it('documents every environment variable the edge functions read, and no other', () => {
    const scanned = [...new Set(dirs.flatMap((fn) => perFunction.get(fn)!))];
    const whole = denoEnvNames(walk(FUNCTIONS, (r) => r.endsWith('.ts') && !isTest(r)));
    expect(diff(whole, scanned)).toEqual(NONE); // no shared module reads a name no function reaches
    expect(diff(edgeTable.map((c) => tokens(c[0])[0]), scanned)).toEqual(NONE);
  });

  it('names, for each edge variable, exactly the functions that read it', () => {
    for (const c of edgeTable) expect(diff(tokens(c[5]), edgeReaders(tokens(c[0])[0])), tokens(c[0])[0]).toEqual(NONE);
  });

  it('quotes a default only if the reading code contains it', () => {
    for (const c of edgeTable) {
      const name = tokens(c[0])[0];
      const text = edgeReaders(name).flatMap(closure).map(read).join('\n');
      for (const lit of tokens(c[4]).filter((t) => !/\.ts$/.test(t) && t !== 'none' && !dirs.includes(t))) expect(text, `${name} default ${lit}`).toContain(lit);
    }
  });

  it('documents every variable the gateway reads, and no other', () => {
    const scanned = gatewayEnv(GATEWAY_FILES());
    expect(diff(gatewayTable.map((c) => tokens(c[0])[0]), [...scanned.keys()])).toEqual(NONE);
  });

  it('names, for each gateway variable, exactly the files that read it', () => {
    const scanned = gatewayEnv(GATEWAY_FILES());
    for (const c of gatewayTable) {
      const name = tokens(c[0])[0];
      expect(diff(tokens(c[4]), scanned.get(name) ?? []), name).toEqual(NONE);
    }
  });

  it('quotes a gateway default only if the reading file contains it', () => {
    for (const c of gatewayTable) {
      const name = tokens(c[0])[0];
      const text = tokens(c[4]).map((f) => GATEWAY_FILES().find((p) => p.endsWith(`/${f}`))).filter(Boolean).map((p) => read(p!)).join('\n');
      for (const lit of tokens(c[3]).filter((t) => !/\.ts$/.test(t) && t !== 'none')) expect(text, `${name} default ${lit}`).toContain(lit);
    }
  });

  it('states for each gateway variable whether the template has it, and is right', () => {
    const tpl = envTemplate(read('app/server/institution/.env.example'));
    for (const c of gatewayTable) {
      const name = tokens(c[0])[0];
      const stated = c[5];
      const actual = tpl.active.includes(name) ? 'yes' : tpl.commented.includes(name) ? 'comment' : 'no';
      expect(stated, name).toBe(actual);
    }
    // Every name the template offers is a name the gateway reads.
    expect(diff(gatewayTable.map((c) => tokens(c[0])[0]), [...tpl.active, ...tpl.commented].filter((n) => !n.startsWith('VITE_'))).onlyInCode).toEqual([]);
  });

  it('the integration worker reads no environment variable', () => {
    const files = walk('app/server/integration', isCode);
    expect(files.length).toBeGreaterThan(3);
    for (const f of files) expect(/\bprocess\.env\b|\bDeno\.env\b|\benv\.[A-Z]/.test(read(f)), f).toBe(false);
  });

  it('the flag registry still registers the read-only switch this page names', () => {
    expect(read('docs/FEATURE-FLAG-REGISTRY.md')).toContain('SEMESTER_READ_ONLY');
    expect(read('docs/trust/SHARED-PROVIDER-ACTIVATION.md')).toContain('SHARED_AI_PROVIDER');
    expect(read('supabase/functions/claude/index.ts')).toContain('aiGenerationKilled');
    expect(read('app/server/integration/worker.ts')).toContain('kill.integration_sync');
  });

  it('the scans find a new read and a removed one (control)', () => {
    const before = denoEnvNames(closure('push'));
    expect(before).toContain('CRON_SECRET');
    const tpl = envTemplate('A_NAME=1\n# B_NAME=2\nnot a name=3\n');
    expect(tpl).toEqual({ active: ['A_NAME'], commented: ['B_NAME'] });
    expect(diff(tokens(edgeTable.find((c) => tokens(c[0])[0] === 'CRON_SECRET')![5]), ['push'])).toEqual({ onlyDocumented: ['support-reply-notify'], onlyInCode: [] });
  });
});

describe('ANALYTICS-MARKS.md', () => {
  const md = read(MARKS_DOC);
  const migration = read('supabase/migrations/20260921151000_activity.sql');
  const marksTable = tableUnder(md, 'Sent to a server today').map(cellsOf);

  it('lists exactly the marks the client sends and the database accepts', () => {
    const check = /mark\s+text not null check \(mark in \(([^)]*)\)\)/.exec(migration)?.[1];
    expect(check).toBeDefined();
    const inMigration = [...check!.matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
    expect(inMigration).toEqual([...MARKS]);
    const documented = marksTable.filter((c) => /^`(?:opened|course|studied)`$/.test(c[0])).map((c) => tokens(c[0])[0]);
    expect(documented).toEqual([...MARKS]);
    expect(md).toContain("`mark in ('opened', 'course', 'studied')`");
  });

  it('states the retention the client and the migration agree on', () => {
    expect(PRUNE_DAYS).toBe(400);
    expect(migration).toContain('- 400');
    expect(md).toContain('400 days');
  });

  it('describes the write path as the migration defines it', () => {
    expect(migration).toContain('create or replace function public.note_activity(marks text[])');
    expect(migration).toContain('security definer');
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain('grant execute on function public.note_activity(text[]) to authenticated');
    expect(migration).toContain('revoke all on function public.note_activity(text[]) from public, anon');
    expect(migration).toContain('grant select, delete on public.activity to authenticated');
    expect(migration).not.toMatch(/create policy "[^"]*" on public\.activity\s+for (insert|update|all)/);
    expect(read('app/src/lib/activity.ts')).toContain("rpc('note_activity', { marks })");
    expect(read('app/src/lib/activity.ts')).toContain("SAID_KEY = 'semester.activity'");
  });

  it('has exactly one call site for the marks, in the store', () => {
    const callers = ['app/src'].flatMap((d) => walk(d, isCode)).filter((f) => f !== 'app/src/lib/activity.ts' && /\bnoteToday\(/.test(read(f)));
    expect(callers).toEqual(['app/src/state/store.tsx']);
  });

  it('lists exactly the telemetry events the code emits', () => {
    const emitting = ['app/server', 'app/api', 'supabase/functions', 'packages'].flatMap((d) => walk(d, isCode));
    const emitted = new Set<string>();
    for (const f of emitting) // An object literal that is sent (`event: 'x',`), not a type that names the audit events a vault may write (`event: 'a' | 'b';`).
    for (const m of read(f).matchAll(/\bevent:\s*'([a-z][a-z0-9_.]*)'\s*,/g)) emitted.add(m[1]);
    const gatewayRows = tableUnder(md, 'Sent to a server today').map(cellsOf).filter((c) => /^`(?:institution|productivity)\./.test(c[0]));
    expect(diff(gatewayRows.map((c) => tokens(c[0])[0]), [...emitted])).toEqual(NONE);
    expect(emitted.size).toBe(5);
  });

  it('gives productivity.request and productivity.error the fields the productivity code writes', () => {
    const telemetry = /export interface ApiTelemetry \{([\s\S]*?)\n\}/.exec(read('app/server/productivity/http.ts'))![1];
    const fields = ['event', ...[...telemetry.matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1])];
    const request = marksTable.find((c) => tokens(c[0])[0] === 'productivity.request')!;
    expect(diff(tokens(request[3]), fields)).toEqual(NONE);
    const logged = /event: 'productivity\.error',([\s\S]*?)\}\)\);/.exec(read('app/server/productivity/runtime.ts'))![1];
    const errorFields = ['event', ...[...logged.matchAll(/^ {4}(\w+)[,:]|\.\.\.\(context\.(\w+)/gm)].map((m) => m[1] ?? m[2])];
    const error = marksTable.find((c) => tokens(c[0])[0] === 'productivity.error')!;
    expect(diff(tokens(error[3]), errorFields)).toEqual(NONE);
    // Neither carries a message, a title or a body: the class name and ids that find the request again.
    expect(logged).not.toMatch(/message|title|body/);
  });

  it('gives institution.request the fields and routes the gateway has', () => {
    const gateway = read('app/server/institution/gateway.ts');
    const iface = /export interface GatewayTelemetryEvent \{([\s\S]*?)\n\}/.exec(gateway)![1];
    const fields = [...iface.matchAll(/^ {2}(\w+):/gm)].map((m) => m[1]);
    const row = marksTable.find((c) => tokens(c[0])[0] === 'institution.request')!;
    expect(diff(tokens(row[3]), fields)).toEqual(NONE);
    const routes = /const TELEMETRY_ROUTES = new Set\(\[([\s\S]*?)\]\)/.exec(gateway)![1];
    const sent = [...routes.matchAll(/'(\/[^']*)'/g)].map((m) => m[1]);
    const bullet = md.split('\n').find((l) => l.startsWith('- The matched routes are'))!;
    expect(diff(tokens(bullet), sent)).toEqual(NONE);
    expect(md).toContain('/v1/intelligence/actions/:id/confirm');
    expect(gateway).toContain("'/v1/intelligence/actions/:id/confirm'");
    expect(gateway).toContain("return TELEMETRY_ROUTES.has(pathname) ? pathname : '/unmatched'");
  });

  it('gives institution.authorization and institution.scim.audit_unrecorded the fields the code writes', () => {
    const rec = /export interface AuthorizationAuditRecord \{([\s\S]*?)\n\}/.exec(read('app/server/institution/membership.ts'))![1];
    const fields = ['event', ...[...rec.matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1])];
    const auth = marksTable.find((c) => tokens(c[0])[0] === 'institution.authorization')!;
    expect(diff(tokens(auth[3]), fields)).toEqual(NONE);
    const scimBlock = /event: 'institution\.scim\.audit_unrecorded',([\s\S]*?)\}\)\)/.exec(read('app/server/institution/postgres-scim.ts'))![1];
    const scimFields = ['event', ...[...scimBlock.matchAll(/(\w+):\s*event\./g)].map((m) => m[1])];
    const scim = marksTable.find((c) => tokens(c[0])[0] === 'institution.scim.audit_unrecorded')!;
    expect(diff(tokens(scim[3]), scimFields)).toEqual(NONE);
  });

  it('puts the request telemetry sink where the page says: the production runtime, not the standalone process', () => {
    expect(read('app/server/institution/runtime.ts')).toContain('telemetry: async (event) => console.info(JSON.stringify(event))');
    expect(read('app/server/institution/start.ts')).not.toContain('telemetry');
    expect(read('app/server/institution/runtime.ts')).toContain("event: 'institution.authorization'");
    expect(read('app/server/institution/start.ts')).toContain("event: 'institution.authorization'");
  });

  it('says the integration worker emits nothing, and the code agrees', () => {
    for (const f of walk('app/server/integration', isCode)) {
      expect(/\bconsole\./.test(read(f)), `${f} writes to the console`).toBe(false);
      expect(/\bevent:\s*'/.test(read(f)), `${f} builds an event object`).toBe(false);
    }
    for (const t of ['integration_sync_runs', 'integration_sync_errors', 'integration_dead_letter_events', 'integration_webhook_events']) {
      expect(read('app/server/integration/worker.ts'), t).toContain(t);
      expect(md).toContain(t);
    }
  });

  it('keeps the defined-only list equal to docs/ANALYTICS-EVENTS.md, and none of it is a mark', () => {
    const defs = read('docs/ANALYTICS-EVENTS.md');
    const defined = [...defs.matchAll(/^\| `([a-z_]+)` \|/gm)].map((m) => m[1]);
    const section = md.split('\n## Defined only\n')[1];
    const documented = section.split('\n').filter((l) => /^\| `[a-z_]+` \|/.test(l)).map((l) => tokens(cellsOf(l)[0])[0]);
    expect(defined.length).toBe(8);
    expect(diff(documented, defined)).toEqual(NONE);
    const wouldBe = [...defs.matchAll(/Mark `([a-z]+)`/g)].map((m) => m[1]);
    expect(wouldBe.length).toBeGreaterThan(3);
    for (const m of wouldBe) {
      expect(MARKS as readonly string[], `${m} is already a mark`).not.toContain(m);
      expect(migration, `${m} is already allowed by the check`).not.toContain(`'${m}'`);
    }
    expect(defs.replace(/\s+/g, ' ')).toContain('Nothing on this page is sent to a server');
  });

  it('the parsers read the real files, and a mark outside the list would be seen (control)', () => {
    expect(MARKS).toEqual(['opened', 'course', 'studied']);
    expect(migration).toContain("'opened'");
    expect(diff([...MARKS, 'path'], [...MARKS]).onlyDocumented).toEqual(['path']);
  });
});

describe('EVENTS.md and its schemas (generated)', () => {
  const source = read(EVENTS_SRC);
  const groups = eventGroups(source);

  it('the catalog reads as 10 groups holding every type exactly once', () => {
    expect(groups.map((g) => g.name)).toEqual(['Identity', 'Student and action', 'Tasks and calendar', 'LMS', 'Integration', 'AI', 'Registration', 'Support and security', 'Commercial', 'Credential']);
    const all = groups.flatMap((g) => g.types);
    expect(new Set(all).size).toBe(all.length);
    expect(diff(all, Object.keys(EVENT_TYPES))).toEqual(NONE);
    expect(all.length).toBe(61);
  });

  it('every extracted rejection reason has a stated rule, and no rule is orphaned', () => {
    const reasons = validateReasons(source);
    expect(reasons).toHaveLength(17);
    expect(diff(Object.keys(REASON_RULES), reasons)).toEqual(NONE);
    expect(diff(envelopeFields(source).map((f) => f.name), Object.keys(FIELD_RULES))).toEqual(NONE);
  });

  it('the page is the render of the catalog', () => {
    const rendered = renderEvents();
    if (WRITE) writeFileSync(at(EVENTS), rendered);
    expect(read(EVENTS)).toBe(rendered);
  });

  it('the schemas are the render of the catalog', () => {
    const rendered = renderSchemas();
    if (WRITE) {
      mkdirSync(at(SCHEMA_DIR), { recursive: true });
      for (const [p, text] of Object.entries(rendered)) writeFileSync(at(p), text);
    }
    expect(readdirSync(at(SCHEMA_DIR)).sort()).toEqual(Object.keys(rendered).map((p) => p.split('/').pop()!).sort());
    for (const [p, text] of Object.entries(rendered)) expect(read(p), p).toBe(text);
  });

  it('every schema is draft 2020-12 with a unique urn id, and every $ref resolves', () => {
    const registry = diskRegistry();
    expect(registry.size).toBe(groups.length + 2);
    for (const s of registry.values()) {
      expect(s.$schema).toBe(SCHEMA_DRAFT);
      expect(String(s.$id)).toMatch(/^urn:semester:events:[a-z-]+$/);
    }
    for (const s of registry.values()) {
      for (const m of JSON.stringify(s).matchAll(/"\$ref":\s*"([^"]+)"/g)) expect(registry.has(m[1]), m[1]).toBe(true);
    }
  });

  it('a sample event from makeEvent() for each type in the catalog validates under the validator and its own group schema', () => {
    const registry = diskRegistry();
    for (const g of groups) {
      const group = registry.get(`urn:semester:events:${g.slug}`)!;
      for (const t of g.types) {
        const e = sample(t);
        expect(validateEvent(e).ok, t).toBe(true);
        expect(schemaErrors(group, e, registry), t).toEqual([]);
        expect(schemaAccepts(e, registry), t).toBe(true);
      }
    }
  });

  it('for every type, a version of 0, one too high, or a class below the floor is refused by both', () => {
    const registry = diskRegistry();
    let belowFloor = 0;
    for (const t of Object.keys(EVENT_TYPES) as EventType[]) {
      for (const bad of [{ eventVersion: 0 }, { eventVersion: EVENT_TYPES[t].version + 1 }]) {
        const e = { ...sample(t), ...bad };
        expect(validateEvent(e).ok, `${t} ${JSON.stringify(bad)}`).toBe(false);
        expect(schemaAccepts(e, registry), `${t} ${JSON.stringify(bad)}`).toBe(false);
      }
      const rank = RANK(EVENT_TYPES[t].classification);
      for (const [i, below] of RESOURCE_CLASSIFICATIONS.entries()) {
        const e = { ...sample(t), dataClassification: below };
        const expected = i >= rank;
        if (!expected) belowFloor += 1;
        expect(validateEvent(e).ok, `${t} at ${below}`).toBe(expected);
        expect(schemaAccepts(e, registry), `${t} at ${below}`).toBe(expected);
      }
    }
    expect(belowFloor).toBeGreaterThan(40); // the loop did refuse something
  });

  it('a group schema refuses a type from another group (the groups are not interchangeable)', () => {
    const registry = diskRegistry();
    const identity = registry.get('urn:semester:events:identity')!;
    const lms = registry.get('urn:semester:events:lms')!;
    expect(schemaErrors(identity, sample('identity.role_granted'), registry)).toEqual([]);
    expect(schemaErrors(lms, sample('identity.role_granted'), registry)).not.toEqual([]);
    expect(schemaErrors(identity, sample('grade.posted'), registry)).not.toEqual([]);
  });

  it('validateEvent and the catalog schema agree on accept and reject across the case table', () => {
    const registry = diskRegistry();
    const disagreements: string[] = [];
    for (const c of CASES) {
      const value = c.value();
      const v = validateEvent(value).ok;
      const s = schemaAccepts(value === undefined ? undefined : JSON.parse(JSON.stringify(value)), registry);
      const wantV = c.differs ? c.differs.validator : c.ok;
      const wantS = c.differs ? c.differs.schema : c.ok;
      if (v !== wantV) disagreements.push(`${c.name}: validateEvent said ${v}, expected ${wantV}`);
      if (s !== wantS) disagreements.push(`${c.name}: the schema said ${s}, expected ${wantS}`);
    }
    expect(disagreements).toEqual([]);
    expect(CASES.length).toBeGreaterThan(50);
    expect(CASES.filter((c) => c.ok && !c.differs).length).toBeGreaterThan(10); // accepts, not only rejects
    expect(CASES.filter((c) => c.differs)).toHaveLength(2);
  });

  it('the checker refuses what it should and passes what it should (control)', () => {
    const registry = diskRegistry();
    const env = registry.get('urn:semester:events:envelope')!;
    expect(schemaErrors(env, sample('grade.posted'), registry)).toEqual([]);
    expect(schemaErrors(env, { ...sample('grade.posted'), producer: '' }, registry)).not.toEqual([]);
    expect(() => schemaErrors({ not: {} }, 1, registry)).toThrow(/does not support/);
    expect(() => schemaErrors({ $ref: 'urn:nothing' }, 1, registry)).toThrow(/unresolved/);
    expect(schemaErrors({ oneOf: [{ const: 1 }, { const: 1 }] }, 1, registry)).not.toEqual([]);
    expect(schemaErrors({ type: 'integer' }, 1.5, registry)).not.toEqual([]);
  });

  it('the producer scan sees a producer and ignores prose (control)', () => {
    expect(findEventUses([{ path: 'a.ts', text: 'const e = makeEvent({})' }])).toHaveLength(1);
    expect(findEventUses([{ path: 'b.ts', text: "import { x } from '../../packages/institution/src/events.ts'" }])).toHaveLength(1);
    expect(findEventUses([{ path: 'c.sql', text: 'insert into private.domain_outbox_events (id) values (1)' }])).toHaveLength(1);
    expect(findEventUses([{ path: 'd.ts', text: 'class A implements OutboxStore {}' }])).toHaveLength(1);
    expect(findEventUses([{ path: 'e.ts', text: 'the domain outbox and drainOutbox exist, and makeEvent is a function' }])).toEqual([]);
    expect(findEventUses([{ path: 'packages/institution/src/index.ts', text: "export * from './events.ts'" }])).toEqual([]);
  });

  it('the repository has exactly the producers the page lists, none mounted and none published', () => {
    // The productivity command service (PR 1175) is the one producer: it builds events, and a migration function
    // writes them to the outbox in the command's transaction. One route imports it, switched off unless a deployment
    // sets SEMESTER_PRODUCTIVITY=on, and nothing calls drainOutbox.
    // When that changes this goes red, and the page's status, the event-consumer guide and the example's README
    // (all of which say "no running code writes to the outbox") are revisited in the same change.
    const uses = repoEventUses();
    expect(uses.map((u) => u.file)).toEqual([
      'app/server/productivity/memory.ts',
      'app/server/productivity/service.ts',
      'packages/platform/src/events/emit.ts',
      'packages/platform/src/isolation/layers.ts',
      'packages/platform/src/testing/memory.ts',
      'supabase/migrations/20261004123000_productivity_commands.sql',
      // The same producer again: the reads migration redefines private.productivity_commit (same signature) to hold
      // the sequence prediction, so the outbox insert appears in both files. It is not a second producer.
      'supabase/migrations/20261004180000_productivity_reads.sql',
      'supabase/migrations/20261004191000_productivity_task_carries_the_apps_task.sql',
      // Not a producer: private.emit_domain_event is the helper a SQL producer will call (backlog P1-02). Nothing calls it,
      // so the claims above (one producer, nothing published) still hold; the page lists it because it inserts.
      'supabase/migrations/20261008183934_emit_domain_event.sql',
    ]);
    const facts = producerFactsOf(uses, repoCodeFiles());
    expect(facts.dirs).toEqual(['app/server/productivity', 'packages/platform']);
    expect(facts.mounts, 'something else now imports the producer').toEqual(['app/api/productivity/[...path].ts']);
    expect(read('app/api/productivity/[...path].ts')).toContain('if (!productivityEnabled(process.env)) throw');
    expect(facts.drainCallers, 'something now publishes the outbox').toEqual([]);
  });

  it('the mount and publisher probes see a mount and a caller, and ignore the producer itself (control)', () => {
    const uses = [{ file: 'app/server/thing/service.ts', why: 'calls the library' }];
    const files = [
      { path: 'app/server/thing/service.ts', text: "import { x } from './repo.ts'" },
      { path: 'app/api/thing.ts', text: "import { svc } from '../server/thing/service.ts'" },
      { path: 'app/server/publisher.ts', text: 'await drainOutbox(store, send)' },
      { path: 'app/server/other.ts', text: "import { y } from '../thing-other/y.ts'" },
    ];
    expect(producerFactsOf(uses, files)).toEqual({ dirs: ['app/server/thing'], mounts: ['app/api/thing.ts'], drainCallers: ['app/server/publisher.ts'] });
    // A package is one root however deep the file sits, and a folder name shared with unrelated code is not a mount.
    const pkg = [{ file: 'packages/kit/src/events/emit.ts', why: 'calls the library' }];
    const near = [{ path: 'app/src/lib/events/x.ts', text: "import { y } from '../events/z.ts'" }, { path: 'app/src/a.ts', text: "import { k } from '../../packages/kit/src/index.ts'" }];
    expect(producerFactsOf(pkg, near)).toEqual({ dirs: ['packages/kit'], mounts: ['app/src/a.ts'], drainCallers: [] });
    expect(producerFactsOf(uses, files.slice(0, 1))).toEqual({ dirs: ['app/server/thing'], mounts: [], drainCallers: [] });
  });

  it('the outbox numbers the page quotes are the ones in the source', () => {
    const page = read(EVENTS);
    expect(page).toContain('| Default `maxAttempts` | 5 |');
    expect(page).toContain('| Default batch size (`pending(limit)`) | 100 |');
    expect(page).toContain('cut to 500 characters');
    expect(source).toContain('options.maxAttempts ?? 5');
    expect(source).toContain('options.batch ?? 100');
    expect(read('supabase/migrations/20260928320000_audit_correlation_and_outbox.sql')).toContain('domain_outbox_one_outcome');
    expect(EVENT_TYPE_PATTERN.source).toBe('^[a-z_]+\\.[a-z_]+$');
  });
});
