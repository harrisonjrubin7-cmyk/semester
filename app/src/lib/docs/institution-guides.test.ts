import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SEATS } from '../launchreadiness';

/**
 * The guides for institutions (docs/guides/institution/), held to the code and
 * the registers they describe.
 *
 * A guide for an administrator is a set of claims: that a tab is called what it
 * is called, that a role holds a capability, that an endpoint is at a path,
 * that a capability is built or is not. Each claim is written on the page in a
 * form this file can read (a backticked name in prose, or a machine-readable
 * comment), and each is checked against the thing it names. Nothing here reads
 * the clock, the network or a random source.
 *
 * Every checker is a pure function of a page's text and a `Ctx`, so that each
 * can be shown a page it must refuse and a page it must pass before it is
 * trusted about the real ones (the "controls" in the last block).
 */

const ROOT = join(import.meta.dirname, '../../../..');
const GUIDES = 'docs/guides/institution';
const THIS_TEST = 'app/src/lib/docs/institution-guides.test.ts';

interface Ctx {
  read(path: string): string;
  exists(path: string): boolean;
}

const real: Ctx = {
  read: (p) => readFileSync(join(ROOT, p), 'utf8'),
  exists: (p) => existsSync(join(ROOT, p)),
};

const flat = (s: string) => norm(s).replace(/\s+/g, ' ');
const norm = (s: string) => s.replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').toLowerCase();

// ── What the pages promise they are ────────────────────────────────────────

/** Types and values mirror docs/documentation/README.md. */
const TYPES = ['tutorial', 'how-to', 'reference', 'explanation', 'runbook', 'help', 'release'];
const AUDIENCES = [
  'students', 'families', 'faculty', 'institution-admins', 'implementers',
  'partner-developers', 'contributors', 'operators', 'support', 'buyers', 'security-reviewers',
];
const TRUTHS = ['generated', 'held', 'reviewed'];
const FIELD = /\*\*([A-Za-z ]+):\*\*\s*([^·]+?)\s*(?:·|$)/g;

export function cardProblems(text: string, ctx: Ctx): string[] {
  const lines = text.split('\n');
  const out: string[] = [];
  if (!/^# \S/.test(lines[0] ?? '')) out.push('line 1 is not a `# Title`');
  if ((lines[1] ?? '') !== '') out.push('line 2 is not blank');
  const raw = lines[2] ?? '';
  if (!raw.startsWith('> **Type:**')) return [...out, 'line 3 is not the card'];
  const f = new Map<string, string>();
  for (const m of raw.slice(2).matchAll(FIELD)) f.set(m[1].trim().toLowerCase(), m[2].trim());
  for (const k of ['type', 'audience', 'owner', 'truth', 'reviewed', 'held by']) if (!f.has(k)) out.push(`card has no ${k}`);
  const type = f.get('type') ?? '';
  if (type && !TYPES.includes(type)) out.push(`type "${type}" is not a page type`);
  const audience = (f.get('audience') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (audience.length === 0 || audience.length > 2) out.push('audience must name one or two audiences');
  for (const a of audience) if (!AUDIENCES.includes(a)) out.push(`audience "${a}" is not a controlled value`);
  const owner = (f.get('owner') ?? '').replace(/`/g, '');
  if (!(SEATS as readonly string[]).includes(owner)) out.push(`owner "${owner}" is not a council seat`);
  const truth = f.get('truth') ?? '';
  if (!TRUTHS.includes(truth)) out.push(`truth "${truth}" is not generated, held or reviewed`);
  if (type === 'reference' && truth === 'reviewed') out.push('a reference page may not be merely reviewed');
  if (/^(how-to|tutorial)$/.test(type) && truth === 'reviewed') out.push('a how-to or tutorial that quotes identifiers must be held');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.get('reviewed') ?? '')) out.push('reviewed is not a YYYY-MM-DD date');
  const held = (f.get('held by') ?? '').replace(/`/g, '');
  if (truth !== 'reviewed') {
    if (!held || held === '\u2014') out.push('a held or generated page must name its test');
    else if (!ctx.exists(held)) out.push(`held by "${held}", which does not exist`);
  }
  if ((lines[3] ?? '') !== '') out.push('line 4 is not blank');
  const lead = lines[4] ?? '';
  if (!/stop reading/i.test(lead)) out.push('the sentence after the card must say who should stop reading');
  if (!lines.some((l) => l.startsWith('**Status:**'))) out.push('no **Status:** line');
  return out;
}

// ── Machine-readable comments ──────────────────────────────────────────────

/** `<!-- kind: body -->`, one per comment, in order. */
export function comments(text: string, kind: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/<!--\s*([a-z-]+):\s*([\s\S]*?)\s*-->/g)) if (m[1] === kind) out.push(m[2].trim());
  return out;
}

const list = (s: string, sep = ',') => s.split(sep).map((x) => x.trim()).filter(Boolean);

/** Prose with fenced blocks and HTML comments removed: what a reader reads. */
const prose = (text: string) => text.replace(/```[\s\S]*?```/g, '').replace(/<!--[\s\S]*?-->/g, '');
const backticked = (text: string) => [...prose(text).matchAll(/`([^`\n]+)`/g)].map((m) => m[1]);

// ── Links and named documents ──────────────────────────────────────────────

/** Documents another author or the lead writes. A page may link them by path before they land. */
const PENDING_ALLOWED = new Set(['docs/reference/SCIM-API.md', 'docs/releases/README.md']);

export function linkProblems(text: string, page: string, ctx: Ctx): string[] {
  const out: string[] = [];
  const pending = new Set(comments(text, 'pending-links').flatMap((c) => list(c)));
  for (const p of pending) if (!PENDING_ALLOWED.has(p)) out.push(`pending link ${p} is not on the allowed list`);
  const body = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  for (const m of body.matchAll(/(?<!!)\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const target = m[1];
    if (/^(https?:|mailto:|tel:)/.test(target)) continue;
    const [path, fragment] = target.split('#');
    const resolved = normalize(join(dirname(page), path || '.')).split('\\').join('/');
    if (path === '') continue;
    if (ctx.exists(resolved)) {
      if (fragment && resolved.endsWith('.md')) {
        const slugs = headingSlugs(ctx.read(resolved));
        if (!slugs.has(fragment)) out.push(`${target}: no heading "${fragment}" in ${resolved}`);
      }
      continue;
    }
    if (PENDING_ALLOWED.has(resolved) && pending.has(resolved)) continue;
    out.push(`${target}: ${resolved} does not exist`);
  }
  return out;
}

const slug = (h: string) => h.trim().toLowerCase().replace(/`/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s/g, '-');
function headingSlugs(text: string): Set<string> {
  const seen = new Map<string, number>();
  const out = new Set<string>();
  for (const m of text.replace(/```[\s\S]*?```/g, '').matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
    const base = slug(m[1]);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    out.add(n === 0 ? base : `${base}-${n}`);
  }
  return out;
}

/** Every path in a `paths` comment exists, and the page names it. */
export function pathProblems(text: string, ctx: Ctx): string[] {
  const out: string[] = [];
  for (const c of comments(text, 'paths')) {
    for (const p of list(c)) {
      if (!ctx.exists(p)) out.push(`named path ${p} does not exist`);
      else if (!text.includes(p.split('/').pop()!)) out.push(`path ${p} is declared but never named in the page`);
    }
  }
  return out;
}

// ── Roles, capabilities, labels ────────────────────────────────────────────

let migrationsCache: string | null = null;
const migrations = () => (migrationsCache ??= readdirSync(join(ROOT, 'supabase/migrations'))
  .filter((f) => f.endsWith('.sql'))
  .map((f) => readFileSync(join(ROOT, 'supabase/migrations', f), 'utf8'))
  .join('\n'));

/** The role code: the client roles, and the roles the migrations create. */
export function roleExists(name: string, ctx: Ctx, sql: string = migrations()): boolean {
  if (ctx.read('app/src/lib/role.ts').includes(`id: '${name}'`)) return true;
  return definedIn(name, sql);
}

export function capabilityExists(name: string, sql: string = migrations()): boolean {
  return definedIn(name, sql);
}

/**
 * A name is defined when a migration lists it as the first value of a tuple
 * (`('tenant:configure', 'Change one…')`, `('university_admin', 'tenant:configure')`).
 * A mention inside a policy (`has_capability('x', …)`) is a use, not a definition,
 * and would still read as present after the definition was removed.
 */
function definedIn(name: string, sql: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![A-Za-z0-9_.])\\(\\s*'${escaped}'\\s*,`).test(sql);
}

function matrixRoles(ctx: Ctx): Set<string> {
  const out = new Set<string>();
  for (const m of ctx.read('docs/ROLE-PERMISSION-MATRIX.md').matchAll(/^\| `([a-z_]+)` \| (?:global|resource) \|/gm)) out.add(m[1]);
  return out;
}

const CAP = /^[a-z_]+:[a-z_]+$/;

export function roleProblems(text: string, ctx: Ctx, sql?: string): string[] {
  const out: string[] = [];
  const declaredRoles = new Set(comments(text, 'roles').flatMap((c) => list(c)));
  const declaredCaps = new Set(comments(text, 'capabilities').flatMap((c) => list(c)));
  const used = new Set(backticked(text));
  for (const r of declaredRoles) {
    if (!roleExists(r, ctx, sql)) out.push(`role ${r} is not in the role code`);
    if (!used.has(r)) out.push(`role ${r} is declared but not used in the prose`);
  }
  for (const c of declaredCaps) {
    if (!capabilityExists(c, sql)) out.push(`capability ${c} is not in the migrations`);
    if (!used.has(c)) out.push(`capability ${c} is declared but not used in the prose`);
  }
  // Anything in the prose that looks like a role the matrix knows, or a capability, must be declared.
  const known = matrixRoles(ctx);
  for (const t of used) {
    if (known.has(t) && !declaredRoles.has(t)) out.push(`role ${t} is used in the prose but not declared`);
    if (CAP.test(t) && !declaredCaps.has(t)) out.push(`capability ${t} is used in the prose but not declared`);
  }
  return out;
}

/** `<!-- labels: path :: A, B -->`: each label is in the source and on the page. */
export function labelProblems(text: string, ctx: Ctx): string[] {
  const out: string[] = [];
  for (const c of comments(text, 'labels')) {
    const [path, rest] = c.split('::').map((s) => s.trim());
    if (!path || !rest) { out.push(`malformed labels comment: ${c}`); continue; }
    if (!ctx.exists(path)) { out.push(`labels source ${path} does not exist`); continue; }
    const src = ctx.read(path);
    for (const label of list(rest)) {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const inSource = [`'${label}'`, `"${label}"`, `\`${label}\``].some((n) => src.includes(n)) || new RegExp(`>\\s*${escaped}\\s*<`).test(src);
      if (!inSource) out.push(`label "${label}" is not in ${path}`);
      if (!prose(text).includes(label)) out.push(`label "${label}" is declared but not on the page`);
    }
  }
  return out;
}

// ── Status words ───────────────────────────────────────────────────────────

const VOCAB = ['LIVE', 'IMPLEMENTED_NOT_RELEASED', 'PARTIAL', 'MOCK_DEMO', 'PLANNED', 'BLOCKED', 'IN_PROGRESS'];
const VOCAB_RE = new RegExp(`\\b(${VOCAB.join('|')})\\b`);

/** The first status word in the truth-table row whose first cell is `name`. */
export function truthTableWord(name: string, table: string): string | null {
  for (const line of table.split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    if (cells[1] === name) return VOCAB_RE.exec(cells[2] ?? '')?.[1] ?? null;
  }
  return null;
}

export function statusProblems(text: string, ctx: Ctx): string[] {
  const out: string[] = [];
  const statusLine = text.split('\n').find((l) => l.startsWith('**Status:**')) ?? '';
  const declared = new Set<string>();
  const decls = comments(text, 'status');
  if (decls.length === 0) out.push('no <!-- status: --> declaration');
  for (const d of decls) {
    const m = /^(.+?) = ([A-Z_]+)(?: @ (\S+) :: (.+))?$/.exec(d);
    if (!m) { out.push(`malformed status declaration: ${d}`); continue; }
    const [, name, word, src, needle] = m;
    declared.add(word);
    if (!VOCAB.includes(word)) out.push(`${word} is not a status word`);
    if (src) {
      if (!ctx.exists(src)) out.push(`status source ${src} does not exist`);
      else if (!ctx.read(src).includes(needle)) out.push(`${src} no longer says "${needle}"`);
    } else {
      const actual = truthTableWord(name, ctx.read('docs/FEATURE-TRUTH-TABLE.md'));
      if (actual === null) out.push(`the truth table has no row "${name}"`);
      else if (actual !== word) out.push(`"${name}": the page says ${word}, the truth table says ${actual}`);
    }
    if (!statusLine.includes(`\`${word}\``)) out.push(`the Status line does not carry ${word}`);
  }
  for (const w of VOCAB) {
    if (statusLine.includes(`\`${w}\``) && !declared.has(w)) out.push(`the Status line uses ${w}, which no declaration backs`);
  }
  return out;
}

/** The decision register's word and date, and the council's verdict, as the page states them. */
export function verdictProblems(text: string, ctx: Ctx): string[] {
  const out: string[] = [];
  for (const d of comments(text, 'verdict')) {
    const council = /council=(\S+)/.exec(d)?.[1] ?? '';
    const date = /decision=(\S+)/.exec(d)?.[1] ?? '';
    const councilDoc = ctx.read('docs/LAUNCH-READINESS-COUNCIL.md');
    const decisionDoc = ctx.read('GO-NO-GO-DECISION.md');
    if (!councilDoc.includes(`**Current verdict: \`${council}\`.**`)) out.push(`the council page does not say the verdict is ${council}`);
    if (!new RegExp(`Decision date \\| ${date}\\b`).test(decisionDoc)) out.push(`GO-NO-GO-DECISION.md is not dated ${date}`);
    if (!/Paid institutional pilot \| \*\*NO-GO \/ RED\*\*/.test(decisionDoc)) out.push('the paid institutional pilot is no longer NO-GO / RED');
    if (!decisionDoc.includes('GO / GREEN')) out.push('GO-NO-GO-DECISION.md no longer carries GO / GREEN');
    if (![`Current verdict: ${council}`, `Current verdict: \`${council}\``].some((n) => prose(text).includes(n))) out.push('the page does not state the council verdict as written');
    if (!prose(text).includes(date)) out.push(`the page does not carry the decision date ${date}`);
  }
  return out;
}

// ── Claims and statuses in the public registers ────────────────────────────

export function claimProblems(text: string, ctx: Ctx): string[] {
  const out: string[] = [];
  for (const d of comments(text, 'claim')) {
    const [id, ...rest] = d.split(/\s+/);
    const word = rest.join(' ');
    if (/^CLM-\d+$/.test(id)) {
      const row = ctx.read('PUBLIC-CLAIMS-APPROVAL-REGISTER.md').split('\n').find((l) => l.startsWith(`| ${id} |`));
      if (!row) out.push(`${id} is not in the claims register`);
      else if (!row.includes(`**${word}`)) out.push(`${id} is no longer ${word} in the claims register`);
    } else {
      const row = ctx.read('ops/claims/README.md').split('\n').find((l) => l.startsWith(`| \`${id}\` |`));
      if (!row) out.push(`claim ${id} is not in ops/claims/README.md`);
      else if (!row.includes(`| ${word} |`)) out.push(`claim ${id} is not "${word}" in ops/claims/README.md`);
    }
    if (!prose(text).includes(word)) out.push(`the page does not carry the claim status "${word}"`);
  }
  return out;
}

const BANNED = /\b(replace[sd]?|replacing|replacement|compliant|certified|conformant)\b/i;
const NEGATION = /\b(not|no|never|cannot|without|nor|neither)\b|n't/i;
const QUOTES_REGISTER = /\bCLM-\d+\b|claims register/i;

/** Sentences that make an unearned claim: a banned word, no negation, no quotation of the claims register. */
export function claimsLanguageProblems(text: string): string[] {
  const out: string[] = [];
  const body = prose(text).split('\n').filter((l) => !l.startsWith('> **Type:**'));
  for (const line of body) {
    for (const sentence of line.split(/(?<=[.!?])\s+/)) {
      if (BANNED.test(sentence) && !NEGATION.test(sentence) && !QUOTES_REGISTER.test(sentence)) out.push(sentence.trim().slice(0, 120));
    }
  }
  return out;
}

// ── Facts read from code ───────────────────────────────────────────────────

export function routeProblems(text: string, ctx: Ctx): string[] {
  const out: string[] = [];
  const scimRoute = ctx.read('app/server/institution/scim-route.ts');
  const scim = ctx.read('app/server/institution/scim.ts');
  const lti = ctx.read('supabase/functions/lti/index.ts');
  const has = (r: string) => {
    if (r.startsWith('/lti/')) return lti.includes(`endsWith('/${r.split('/').pop()}')`);
    if (r === '/score') return lti.includes("endsWith('/score')");
    if (r.startsWith('/scim/')) return scimRoute.includes(`export const SCIM_PATH = '${r}'`);
    return scim.includes(`path === '${r}'`);
  };
  const declared = comments(text, 'routes').flatMap((c) => list(c));
  for (const r of declared) {
    if (!has(r)) out.push(`route ${r} is not in the code`);
    if (!text.includes(`\`${r}\``) && !text.includes(`\`${r.replace('/lti', '…/lti')}\``) && !prose(text).includes(r)) out.push(`route ${r} is declared but not on the page`);
  }
  for (const t of backticked(text)) {
    if (/^\/(scim|lti)\//.test(t) && !has(t.replace(/\/\{.*$/, ''))) out.push(`route ${t} is on the page but not in the code`);
  }
  return out;
}

export function retainedProblems(text: string, ctx: Ctx): string[] {
  const out: string[] = [];
  const retention = norm(ctx.read('RETENTION.md')).split('\n');
  const pageLines = norm(text).split('\n');
  for (const d of comments(text, 'retained')) {
    const [table, period] = d.split('|').map((s) => s.trim());
    const t = `\`${table}\``;
    if (!retention.some((l) => l.includes(t) && l.includes(norm(period)))) out.push(`RETENTION.md has no ${table} row saying "${period}"`);
    if (!pageLines.some((l) => l.includes(t) && l.includes(norm(period)))) out.push(`the page has no ${table} row saying "${period}"`);
  }
  for (const d of comments(text, 'inventory')) {
    const [a, b, c] = d.split('|').map((s) => s.trim());
    const [label, n] = [a.replace(/ in `public`$/, ''), c];
    const doc = ctx.read('docs/DATA-INVENTORY-AND-LINEAGE.md');
    const count = a.split(' ')[0];
    if (!doc.includes(`| Tables in \`public\` | ${count} |`)) out.push(`the inventory no longer counts ${count} tables`);
    if (!doc.includes(`| ${b} | ${n} |`)) out.push(`the inventory no longer says "${b}" is ${n}`);
    if (!text.includes(`${count} tables`) || !text.includes(label.split(' ')[0])) out.push('the page does not carry the inventory counts');
  }
  return out;
}

export function artefactProblems(text: string, ctx: Ctx): string[] {
  const out: string[] = [];
  for (const d of comments(text, 'artefact')) {
    const [path, needle] = d.split('|').map((s) => s.trim());
    if (!ctx.exists(path)) { out.push(`artefact ${path} does not exist`); continue; }
    if (!flat(ctx.read(path)).includes(flat(needle))) out.push(`${path} no longer says "${needle}"`);
    if (!flat(prose(text)).includes(flat(needle))) out.push(`the page does not carry "${needle}" for ${path}`);
  }
  return out;
}

const ROLLOUT = 'app/src/lib/governance/rollout.ts';

export function rolloutProblems(text: string, ctx: Ctx): string[] {
  const out: string[] = [];
  const src = ctx.read(ROLLOUT);
  const block = (name: string) => new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\]`).exec(src)?.[1] ?? '';
  const quoted = (s: string) => [...s.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  for (const d of comments(text, 'states')) {
    const declared = list(d);
    const actual = [...quoted(block('CHAIN')), ...quoted(block('HOLDS')), ...quoted(block('EXITS'))];
    if (declared.join() !== actual.join()) out.push(`states differ from rollout.ts: ${declared.join()} vs ${actual.join()}`);
    const chain = quoted(block('CHAIN')).map((s) => `\`${s}\``).join(' \u2192 ');
    if (!text.includes(chain)) out.push('the page does not give the ladder in the code\'s order');
  }
  for (const d of comments(text, 'phases')) {
    for (const name of list(d, '|')) {
      if (!src.includes(`name: '${name}'`)) out.push(`phase "${name}" is not in rollout.ts`);
      if (!text.includes(name)) out.push(`phase "${name}" is not on the page`);
    }
    const inCode = [...src.matchAll(/number: \d+, name: '([^']+)'/g)].map((m) => m[1]);
    if (list(d, '|').join() !== inCode.join()) out.push('phases differ from rollout.ts');
  }
  for (const d of comments(text, 'workstreams')) {
    const declared = list(d, '|');
    const inCode = [...src.matchAll(/workstream: '([^']+)'/g)].map((m) => m[1]);
    if (declared.join() !== inCode.join()) out.push(`workstreams differ from rollout.ts RACI: ${declared.join('|')}`);
    for (const w of declared) if (!text.includes(`| ${w} |`)) out.push(`workstream "${w}" has no row on the page`);
  }
  return out;
}

export function functionProblems(text: string, ctx: Ctx): string[] {
  const out: string[] = [];
  const sql = ctx.read('supabase/migrations/20260930200000_school_offboarding.sql');
  const runbook = ctx.read('docs/SCHOOL-OFFBOARDING.md');
  for (const d of comments(text, 'functions')) {
    for (const f of list(d)) {
      if (!new RegExp(`function (public|private)\\.${f}\\b`).test(sql)) out.push(`function ${f} is not in the offboarding migration`);
      if (!runbook.includes(f)) out.push(`function ${f} is not in docs/SCHOOL-OFFBOARDING.md`);
      if (!text.includes(`\`${f}\``)) out.push(`function ${f} is declared but not on the page`);
    }
  }
  return out;
}

/** Console duties named on the page are in the console's matrix with the same requester. */
export function dutyProblems(text: string, ctx: Ctx): string[] {
  const out: string[] = [];
  const src = ctx.read('app/src/lib/ops/console.ts');
  for (const m of text.matchAll(/^\| `([a-z-]+)` \| `([a-z_]+)` \| ([^|]+)\|/gm)) {
    const [, id, role] = m;
    const at = src.indexOf(`id: '${id}',`);
    if (at < 0) { out.push(`duty ${id} is not in console.ts`); continue; }
    const block = src.slice(at, src.indexOf('\n  },', at));
    if (!block.includes(`requester: 'role:${role}'`)) out.push(`duty ${id} is not requested by role ${role}`);
  }
  return out;
}

/** Build flags named on the page exist, and gate the tab the page says they gate. */
export function flagProblems(text: string, ctx: Ctx): string[] {
  const out: string[] = [];
  const flags = ctx.read('app/src/lib/experience-flags.ts');
  for (const t of backticked(text)) {
    if (/^VITE_[A-Z_]+$/.test(t) && !flags.includes(`'${t}'`)) out.push(`flag ${t} is not in experience-flags.ts`);
  }
  const screen = ctx.read('app/src/screens/University.tsx');
  const start = screen.indexOf('const tabsFor');
  const end = screen.indexOf('type Tab =', start);
  const tabs = start >= 0 && end > start ? screen.slice(start, end) : '';
  for (const row of text.split('\n')) {
    const m = /^\| `([^`]+)`(?:, `([^`]+)`)? \| `(VITE_[A-Z_]+)`/.exec(row);
    if (!m) continue;
    const flag = m[3];
    const key = new RegExp(`(\\w+): featureState\\(env, '${flag}'`).exec(flags)?.[1]
      ?? new RegExp(`(\\w+): '${flag}'`).exec(flags)?.[1];
    if (!key) { out.push(`flag ${flag} has no key`); continue; }
    for (const label of [m[1], m[2]].filter(Boolean) as string[]) {
      const at = tabs.indexOf(`label: '${label}'`);
      if (at < 0) { out.push(`tab ${label} is not in the University tab list`); continue; }
      if (!tabs.slice(Math.max(0, at - 420), at).includes(key)) out.push(`tab ${label} is not gated by ${key} (${flag})`);
    }
  }
  return out;
}

/** The University tabs and Console tabs in the code are all on the admin page, and no others. */
export function tabCompletenessProblems(text: string, ctx: Ctx): string[] {
  const out: string[] = [];
  const screen = ctx.read('app/src/screens/University.tsx');
  const start = screen.indexOf('const tabsFor');
  const end = screen.indexOf('type Tab =', start);
  const uni = [...screen.slice(start, end).matchAll(/label: '([^']+)'/g)].map((m) => m[1]);
  for (const l of uni) if (!text.includes(`\`${l}\``)) out.push(`University tab ${l} is not on the admin guide`);
  const con = ctx.read('app/src/screens/Console.tsx');
  const consoleTabs = [...con.matchAll(/label: '([^']+)'/g)].map((m) => m[1]);
  for (const l of consoleTabs) if (!text.includes(`\`${l}\``)) out.push(`Console tab ${l} is not on the admin guide`);
  return out;
}

export function migrationCenterProblems(text: string, ctx: Ctx): string[] {
  const out: string[] = [];
  const src = ctx.read('app/src/lib/migration/center.ts');
  const stages = [...(/export const STAGES = \[([\s\S]*?)\] as const/.exec(src)?.[1] ?? '').matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  for (const d of comments(text, 'stages')) if (list(d).join() !== stages.join()) out.push(`stages differ from center.ts: ${list(d).join()}`);
  const sql = ctx.read('supabase/migrations/20260929200000_migration_center.sql');
  if (!/parallel_runs_required smallint\s+not null default 2 check \(parallel_runs_required between 1 and 52\)/.test(sql)) out.push('the parallel-run default or range changed in the migration');
  if (!text.includes('defaults to 2') || !text.includes('1 to 52')) out.push('the page does not state the default of 2 and the range 1 to 52');
  return out;
}

// ── The set of pages ───────────────────────────────────────────────────────

const pageFiles = () => readdirSync(join(ROOT, GUIDES)).filter((f) => f.endsWith('.md')).sort();
const text = (f: string) => readFileSync(join(ROOT, GUIDES, f), 'utf8');

const ALL_CHECKS: [string, (t: string, page: string, ctx: Ctx) => string[]][] = [
  ['card', (t, _p, c) => cardProblems(t, c)],
  ['links', (t, p, c) => linkProblems(t, p, c)],
  ['paths', (t, _p, c) => pathProblems(t, c)],
  ['roles and capabilities', (t, _p, c) => roleProblems(t, c)],
  ['labels', (t, _p, c) => labelProblems(t, c)],
  ['status', (t, _p, c) => statusProblems(t, c)],
  ['verdict', (t, _p, c) => verdictProblems(t, c)],
  ['claims register', (t, _p, c) => claimProblems(t, c)],
  ['claims language', (t) => claimsLanguageProblems(t)],
  ['routes', (t, _p, c) => routeProblems(t, c)],
  ['retention', (t, _p, c) => retainedProblems(t, c)],
  ['artefacts', (t, _p, c) => artefactProblems(t, c)],
  ['rollout', (t, _p, c) => rolloutProblems(t, c)],
  ['offboarding functions', (t, _p, c) => functionProblems(t, c)],
  ['console duties', (t, _p, c) => dutyProblems(t, c)],
  ['flags', (t, _p, c) => flagProblems(t, c)],
  ['migration center', (t, _p, c) => (comments(t, 'stages').length > 0 ? migrationCenterProblems(t, c) : [])],
];

describe('the institution guides', () => {
  it('are between ten and fourteen pages, and the index links every one', () => {
    const files = pageFiles();
    expect(files.length).toBeGreaterThanOrEqual(10);
    expect(files.length).toBeLessThanOrEqual(14);
    expect(files).toContain('README.md');
    expect(files).toContain('ADMIN-GUIDE.md');
    expect(files).toContain('IMPLEMENTATION-GUIDE.md');
    const index = text('README.md');
    for (const f of files.filter((x) => x !== 'README.md')) expect(index, `README.md links ${f}`).toContain(`](${f})`);
  });

  for (const f of pageFiles()) {
    describe(f, () => {
      for (const [name, check] of ALL_CHECKS) {
        it(`passes the ${name} check`, () => {
          expect(check(text(f), `${GUIDES}/${f}`, real)).toEqual([]);
        });
      }
    });
  }

  it('declares what the Status line must use on each page that names a capability', () => {
    for (const f of pageFiles()) expect(comments(text(f), 'status').length, f).toBeGreaterThan(0);
  });

  it('keeps the admin guide in step with every University and Console tab', () => {
    expect(tabCompletenessProblems(text('ADMIN-GUIDE.md'), real)).toEqual([]);
  });

  it('links the SCIM reference and the release notes by path', () => {
    expect(text('SCIM-PROVISIONING.md')).toContain('](../../reference/SCIM-API.md)');
    expect(text('CHANGE-MANAGEMENT.md')).toContain('](../../releases/README.md)');
    expect(comments(text('CHANGE-MANAGEMENT.md'), 'pending-links').join()).toContain('docs/releases/README.md');
  });

  it('quotes the activation register and the council as they are written', () => {
    const register = real.read('docs/CAPABILITY-ACTIVATION-REGISTER.md');
    expect(register).toContain('No tenant is activated by this register.');
    expect(text('README.md')).toContain('No tenant is activated by this register.');
    expect(text('PARALLEL-RUN-EVIDENCE.md')).toContain('No tenant is activated by this register.');
    expect(text('IMPLEMENTATION-GUIDE.md')).toMatch(/no institution has been activated/i);
    expect(text('IMPLEMENTATION-GUIDE.md')).toMatch(/gateway runs against a sandbox adapter/);
  });

  it('names the vacant council seats the implementation guide says are vacant', () => {
    const council = real.read('docs/LAUNCH-READINESS-COUNCIL.md');
    const vacant = [...council.matchAll(/^\| `([a-z]+)` [^|]*\| [^|]*\| ([^|]+) \|$/gm)]
      .filter((m) => m[2].trim().startsWith('Vacant')).map((m) => m[1]);
    const sentence = /Seats ([^.]*?) are vacant on the council page/.exec(text('IMPLEMENTATION-GUIDE.md'))?.[1] ?? '';
    const named = [...sentence.matchAll(/`([a-z]+)`/g)].map((m) => m[1]);
    expect(named.sort()).toEqual(vacant.sort());
  });
});

// ── Controls: each checker is shown a page it must refuse and a page it must pass ──

const CARD = '> **Type:** how-to \u00b7 **Audience:** institution-admins \u00b7 **Owner:** `success` \u00b7 **Truth:** held \u00b7 **Reviewed:** 2026-10-04 \u00b7 **Held by:** `' + THIS_TEST + '`';
const goodPage = (extra = '') => `# T\n\n${CARD}\n\nThis page is for X; stop reading if you want Y.\n\n**Status:** \`PLANNED\`.\n${extra}\n`;

describe('the checkers, shown a page they must pass and a page they must refuse', () => {
  it('card: passes a good card; refuses a missing seat, a bad type, a missing test file and a missing Status', () => {
    expect(cardProblems(goodPage(), real)).toEqual([]);
    expect(cardProblems(goodPage().replace('`success`', '`nobody`'), real).join()).toMatch(/not a council seat/);
    expect(cardProblems(goodPage().replace('how-to', 'essay'), real).join()).toMatch(/not a page type/);
    expect(cardProblems(goodPage().replace(THIS_TEST, 'app/src/lib/docs/missing.test.ts'), real).join()).toMatch(/does not exist/);
    expect(cardProblems(goodPage().replace('**Status:**', 'Status:'), real).join()).toMatch(/no \*\*Status:\*\*/);
    expect(cardProblems(goodPage().replace('Truth:** held', 'Truth:** reviewed').replace('how-to', 'reference'), real).join()).toMatch(/reference page may not be merely reviewed/);
  });

  it('links: passes a real link and an allowed pending one; refuses a dead link and an undeclared pending one', () => {
    const page = `${GUIDES}/X.md`;
    expect(linkProblems(goodPage('[a](ADMIN-GUIDE.md)'), page, real)).toEqual([]);
    expect(linkProblems(goodPage('[a](ADMIN-GUIDE.md#admin-guide)'), page, real)).toEqual([]);
    expect(linkProblems(goodPage('[a](NOPE.md)'), page, real).join()).toMatch(/does not exist/);
    expect(linkProblems(goodPage('[a](ADMIN-GUIDE.md#nope)'), page, real).join()).toMatch(/no heading/);
    const pendingLink = '[a](../../releases/README.md)';
    const fake: Ctx = { read: real.read, exists: (p) => p !== 'docs/releases/README.md' && real.exists(p) };
    expect(linkProblems(goodPage(pendingLink), page, fake).join()).toMatch(/does not exist/);
    expect(linkProblems(goodPage(`${pendingLink}\n<!-- pending-links: docs/releases/README.md -->`), page, fake)).toEqual([]);
    expect(linkProblems(goodPage('[a](../../reference/OTHER.md)\n<!-- pending-links: docs/reference/OTHER.md -->'), page, fake).join()).toMatch(/not on the allowed list/);
  });

  it('roles and capabilities: passes real names; refuses an invented role, an invented capability and an undeclared use', () => {
    const ok = goodPage('Use `university_admin` with `tenant:configure`.\n<!-- roles: university_admin -->\n<!-- capabilities: tenant:configure -->');
    expect(roleProblems(ok, real)).toEqual([]);
    expect(roleProblems(ok.replaceAll('university_admin', 'university_overlord'), real).join()).toMatch(/not in the role code/);
    expect(roleProblems(ok.replaceAll('tenant:configure', 'tenant:rule'), real).join()).toMatch(/not in the migrations/);
    expect(roleProblems(goodPage('Use `registrar`.'), real).join()).toMatch(/used in the prose but not declared/);
    expect(roleProblems(goodPage('Hold `config:publish`.'), real).join()).toMatch(/capability config:publish is used in the prose but not declared/);
  });

  it('definitions: a capability is defined by a migration tuple, not by being used in a policy', () => {
    const defined = "insert into capabilities (name, about) values\n  ('x:y', 'Does a thing'),\n  ('p:q', 'Another');";
    const usedOnly = "create policy p on t using (private.has_capability('x:y', 'school', tenant_id));";
    expect(capabilityExists('x:y', defined)).toBe(true);
    expect(capabilityExists('x:y', usedOnly)).toBe(false);
    expect(capabilityExists('z:z', defined)).toBe(false);
    expect(roleExists('registrar', real, "('registrar', 'config:publish')")).toBe(true);
    expect(roleExists('registrar', real, usedOnly)).toBe(false);
    expect(roleExists('student', real, '')).toBe(true); // the client roles count, from role.ts
  });

  it('labels: passes a label in the source; refuses a renamed one', () => {
    const ok = goodPage('Open `Configuration`.\n<!-- labels: app/src/screens/University.tsx :: Configuration -->');
    expect(labelProblems(ok, real)).toEqual([]);
    expect(labelProblems(ok.replaceAll('Configuration', 'Configure'), real).join()).toMatch(/not in app\/src\/screens\/University.tsx/);
    expect(labelProblems(ok.replace('Open `Configuration`.', 'Open it.'), real).join()).toMatch(/declared but not on the page/);
  });

  it('status: passes the truth-table word; refuses a stronger word, a missing row and a Status line the declaration does not back', () => {
    const ok = goodPage('<!-- status: SAML SSO = IMPLEMENTED_NOT_RELEASED -->').replace('`PLANNED`', '`IMPLEMENTED_NOT_RELEASED`');
    expect(statusProblems(ok, real)).toEqual([]);
    expect(statusProblems(ok.replaceAll('IMPLEMENTED_NOT_RELEASED', 'LIVE'), real).join()).toMatch(/the page says LIVE, the truth table says IMPLEMENTED_NOT_RELEASED/);
    expect(statusProblems(ok.replace('SAML SSO', 'Quantum SSO'), real).join()).toMatch(/no row "Quantum SSO"/);
    expect(statusProblems(ok.replace('`IMPLEMENTED_NOT_RELEASED`.', '`IMPLEMENTED_NOT_RELEASED` and `LIVE`.'), real).join()).toMatch(/uses LIVE/);
    expect(truthTableWord('OIDC SSO', real.read('docs/FEATURE-TRUTH-TABLE.md'))).toBe('PLANNED');
    expect(truthTableWord('Retention', real.read('docs/FEATURE-TRUTH-TABLE.md'))).toBe('LIVE');
    expect(statusProblems(goodPage('<!-- status: Retention = LIVE @ docs/FEATURE-TRUTH-TABLE.md :: nothing like this -->').replace('`PLANNED`', '`LIVE`'), real).join()).toMatch(/no longer says/);
  });

  it('verdict: passes the written verdict and date; refuses a different verdict or date', () => {
    const body = (council: string, date: string) => goodPage(`Current verdict: \`${council}\` ... ${date}\n<!-- verdict: council=${council} decision=${date} -->`);
    expect(verdictProblems(body('NO-GO', '2026-10-03'), real)).toEqual([]);
    expect(verdictProblems(body('GO', '2026-10-03'), real).join()).toMatch(/does not say the verdict is GO/);
    expect(verdictProblems(body('NO-GO', '2026-10-05'), real).join()).toMatch(/is not dated 2026-10-05/);
  });

  it('claims register: passes the registered statuses; refuses a changed one', () => {
    expect(claimProblems(goodPage('In preparation\n<!-- claim: sso In preparation -->'), real)).toEqual([]);
    expect(claimProblems(goodPage('Planned\n<!-- claim: sso Planned -->'), real).join()).toMatch(/not "Planned"/);
    expect(claimProblems(goodPage('PROHIBITED\n<!-- claim: CLM-006 PROHIBITED -->'), real)).toEqual([]);
    expect(claimProblems(goodPage('ALLOWED\n<!-- claim: CLM-006 ALLOWED -->'), real).join()).toMatch(/no longer ALLOWED/);
  });

  it('claims language: refuses unearned claims; passes negations and quotations of the claims register', () => {
    expect(claimsLanguageProblems('Semester replaces your LMS.')).toHaveLength(1);
    expect(claimsLanguageProblems('Our controls are certified. Fine here.')).toHaveLength(1);
    expect(claimsLanguageProblems('We are FERPA compliant.')).toHaveLength(1);
    expect(claimsLanguageProblems('Accessible and WCAG conformant.')).toHaveLength(1);
    expect(claimsLanguageProblems('Semester does not replace your LMS.')).toEqual([]);
    expect(claimsLanguageProblems('Semester is not 1EdTech-certified.')).toEqual([]);
    expect(claimsLanguageProblems('CLM-006 rejects the claim that Semester replaces the registrar.')).toEqual([]);
    expect(claimsLanguageProblems('The claims register prohibits "certified".')).toEqual([]);
    expect(claimsLanguageProblems('Replace the draft and save.')).toHaveLength(1);
    expect(claimsLanguageProblems('```\nreplaces\n```\n<!-- replaces -->')).toEqual([]);
  });

  it('routes: passes real routes; refuses an invented one', () => {
    const ok = goodPage('Use `/scim/v2` and `/Users`.\n<!-- routes: /scim/v2, /Users -->');
    expect(routeProblems(ok, real)).toEqual([]);
    expect(routeProblems(ok.replaceAll('/scim/v2', '/scim/v3'), real).join()).toMatch(/route \/scim\/v3 is not in the code/);
    expect(routeProblems(goodPage('See `/scim/v9/Users`.'), real).join()).toMatch(/on the page but not in the code/);
    expect(routeProblems(goodPage('See `/lti/launch`.\n<!-- routes: /lti/launch -->'), real)).toEqual([]);
    expect(routeProblems(goodPage('See `/lti/fly`.\n<!-- routes: /lti/fly -->'), real).join()).toMatch(/not in the code/);
  });

  it('retention: passes a row RETENTION.md states; refuses a changed period', () => {
    const ok = goodPage('| `access_log` | 90 days |\n<!-- retained: access_log | 90 days -->');
    expect(retainedProblems(ok, real)).toEqual([]);
    expect(retainedProblems(ok.replaceAll('90 days', '30 days'), real).join()).toMatch(/RETENTION.md has no access_log row saying "30 days"/);
    expect(retainedProblems(ok.replace('| `access_log` | 90 days |', '| `access_log` | 30 days |'), real).join()).toMatch(/the page has no access_log row/);
  });

  it('artefacts: passes a status the document gives; refuses one it does not', () => {
    const ok = goodPage('No formal ACR has been issued\n<!-- artefact: docs/compliance/VPAT-ACR-SELF-ASSESSMENT.md | no formal ACR has been issued -->');
    expect(artefactProblems(ok, real)).toEqual([]);
    expect(artefactProblems(ok.replaceAll('no formal ACR has been issued', 'a formal ACR has been issued').replace('No formal ACR has been issued', 'a formal ACR has been issued'), real).join()).toMatch(/no longer says/);
    expect(artefactProblems(goodPage('x\n<!-- artefact: docs/missing.md | x -->'), real).join()).toMatch(/does not exist/);
  });

  it('rollout: passes the code\'s states, phases and workstreams; refuses a reordered or invented one', () => {
    const src = real.read(ROLLOUT);
    const chain = [...(/export const CHAIN = \[([\s\S]*?)\]/.exec(src)?.[1] ?? '').matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    const states = [...chain, 'paused', 'suspended', 'offboarding', 'archived'];
    const ladder = chain.map((s) => `\`${s}\``).join(' \u2192 ');
    const ok = goodPage(`${ladder}\n<!-- states: ${states.join(', ')} -->`);
    expect(rolloutProblems(ok, real)).toEqual([]);
    const swapped = [states[1], states[0], ...states.slice(2)];
    expect(rolloutProblems(ok.replace(`<!-- states: ${states.join(', ')} -->`, `<!-- states: ${swapped.join(', ')} -->`), real).join()).toMatch(/states differ/);
    expect(rolloutProblems(goodPage('<!-- workstreams: Contract/DPA | Invented workstream -->'), real).join()).toMatch(/workstreams differ/);
    expect(rolloutProblems(goodPage('<!-- phases: Commercial and governance readiness -->'), real).join()).toMatch(/phases differ/);
  });

  it('offboarding functions: passes real functions; refuses an invented one', () => {
    expect(functionProblems(goodPage('`restore_school`\n<!-- functions: restore_school -->'), real)).toEqual([]);
    expect(functionProblems(goodPage('`purge_school_now`\n<!-- functions: purge_school_now -->'), real).join()).toMatch(/not in the offboarding migration/);
  });

  it('console duties: passes a real requester; refuses a wrong one', () => {
    expect(dutyProblems('| `role-grant` | `university_admin` | `security` seat |', real)).toEqual([]);
    expect(dutyProblems('| `role-grant` | `registrar` | `security` seat |', real).join()).toMatch(/not requested by role registrar/);
    expect(dutyProblems('| `make-coffee` | `registrar` | `x` |', real).join()).toMatch(/not in console.ts/);
  });

  it('flags: passes a flag that gates the tab; refuses an invented flag and a mismatched tab', () => {
    expect(flagProblems('| `Configuration` | `VITE_CONFIGURATION_STUDIO` is not `off` | x |', real)).toEqual([]);
    expect(flagProblems('| `Control`, `Trust` | `VITE_UNIVERSITY_CONTROL_PLANE` is not `off` | x |', real)).toEqual([]);
    expect(flagProblems('| `Demand` | `VITE_DEMAND_FORECASTING` is not `off` | x |', real)).toEqual([]);
    expect(flagProblems('| `Configuration` | `VITE_INVENTED` is not `off` | x |', real).join()).toMatch(/not in experience-flags.ts/);
    expect(flagProblems('| `Configuration` | `VITE_WORKFLOW_BUILDER` is not `off` | x |', real).join()).toMatch(/is not gated by workflowBuilder/);
    expect(flagProblems('| `Nonexistent tab` | `VITE_WORKFLOW_BUILDER` is not `off` | x |', real).join()).toMatch(/not in the University tab list/);
  });

  it('tab completeness: passes the full list; refuses a page that omits a tab', () => {
    const labels = [...real.read('app/src/screens/University.tsx').slice(real.read('app/src/screens/University.tsx').indexOf('const tabsFor')).matchAll(/label: '([^']+)'/g)];
    expect(labels.length).toBeGreaterThan(15);
    const full = text('ADMIN-GUIDE.md');
    expect(tabCompletenessProblems(full, real)).toEqual([]);
    expect(tabCompletenessProblems(full.replaceAll('`Student accounts`', '`Accounts`'), real).join()).toMatch(/University tab Student accounts/);
    expect(tabCompletenessProblems(full.replaceAll('`Break-glass`', '`Glass`'), real).join()).toMatch(/Console tab Break-glass/);
  });

  it('migration center: passes the code\'s stages; refuses a reordered list', () => {
    const stages = 'inventory, classification, mapping, cleaning, preview, sample_import, validation, reconciliation, parallel_run, cutover, archive, monitoring';
    const ok = goodPage(`The default is that it defaults to 2 and the database accepts 1 to 52.\n<!-- stages: ${stages} -->`);
    expect(migrationCenterProblems(ok, real)).toEqual([]);
    expect(migrationCenterProblems(ok.replace('inventory, classification', 'classification, inventory'), real).join()).toMatch(/stages differ/);
    expect(migrationCenterProblems(ok.replace('defaults to 2', 'defaults to 3'), real).join()).toMatch(/default of 2/);
  });

  it('paths: passes real paths; refuses a missing one', () => {
    expect(pathProblems(goodPage('See ADMIN-GUIDE.md.\n<!-- paths: docs/guides/institution/ADMIN-GUIDE.md -->'), real)).toEqual([]);
    expect(pathProblems(goodPage('See GONE.md.\n<!-- paths: docs/GONE.md -->'), real).join()).toMatch(/does not exist/);
    expect(relative(ROOT, join(ROOT, THIS_TEST))).toBe(THIS_TEST);
  });
});
