// @vitest-environment node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MAX_BODY, createGateway } from '../../../server/institution/gateway.ts';
import { ActionJournal } from '../../../server/institution/journal.ts';
import { DEFAULT_RATE_LIMIT, MemoryRateLimiter } from '../../../server/institution/rate-limit.ts';
import { institutionReadiness } from '../../../server/institution/readiness.ts';
import { adapters as shippedAdapters } from '../../../server/institution/adapters.ts';
import { createIntelligenceService } from '../../../server/institution/intelligence.ts';
import { SANDBOX_INSTITUTION, SANDBOX_NAME, SandboxStore, sandboxAdapters } from '../../../server/institution/sandbox.ts';
import type { InstitutionAdapter } from '../../../server/institution/adapter.ts';
import {
  CORRELATION_ID_PATTERN,
  Refusal,
  UNIVERSITY_AREAS,
  UNIVERSITY_ROLES,
  type ProvisioningResult,
  type ScimFilter,
  type ScimGroup,
  type ScimMember,
  type ScimUser,
  type UniversityIdentity,
} from '../../../../packages/institution/src/index.ts';

/**
 * The institution gateway reference, held to the gateway.
 *
 * Four pages under docs/reference/ and one OpenAPI file describe the gateway's
 * routes, errors, authentication and limits. They are hand-written; this file
 * is what stops them drifting from the code, in five ways:
 *
 *  1. The route set. Read out of the source text, discovered by driving the
 *     real handler (documented routes answer, decoys 404), and compared with
 *     the OpenAPI file and with both route tables.
 *  2. The error vocabulary. Every code the source can emit is in ERRORS.md and
 *     every code in ERRORS.md can be emitted (or is marked as declared only).
 *  3. The OpenAPI file parses with a small reader written here (no
 *     dependency) and has no dangling, or wrongly typed, $ref.
 *  4. The constants a reader would copy: limits, timeouts, environment
 *     variable names, area ids, roles, telemetry routes and audit events.
 *  5. The examples. Each `<!-- example:ID -->` block in a page is the output
 *     of an actual call to the in-process handler with the sandbox adapters
 *     (or a named fixture), with the clock fixed and random ids renumbered.
 *     `REGISTERS=write npx vitest run src/lib/docs/gateway-reference.test.ts`
 *     from app/ rewrites them; otherwise a stale block fails.
 *
 * Every guard has a control: a case that must pass beside the case that must
 * not, so a probe that reads everything as clean is caught.
 */

const root = join(import.meta.dirname, '../../../..');
const at = (p: string) => join(root, p);
const read = (p: string) => readFileSync(at(p), 'utf8');
const TEST = 'app/src/lib/docs/gateway-reference.test.ts';
const WRITE = process.env.REGISTERS === 'write';

const PAGES = {
  gateway: 'docs/reference/API-GATEWAY.md',
  scim: 'docs/reference/SCIM-API.md',
  errors: 'docs/reference/ERRORS.md',
  auth: 'docs/reference/AUTH-AND-LIMITS.md',
} as const;
const PAGE_FILES = Object.values(PAGES);
const OPENAPI = 'docs/reference/openapi/institution-gateway.openapi.yaml';
const SRC = {
  gateway: 'app/server/institution/gateway.ts',
  scim: 'app/server/institution/scim.ts',
  postgresScim: 'app/server/institution/postgres-scim.ts',
  intelligence: 'app/server/institution/intelligence.ts',
  runtime: 'app/server/institution/runtime.ts',
  start: 'app/server/institution/start.ts',
  scimRoute: 'app/server/institution/scim-route.ts',
  entry: 'app/api/institution/[...path].ts',
  provisioning: 'packages/institution/src/provisioning.ts',
  journal: 'app/server/institution/journal.ts',
  vercel: 'app/vercel.json',
} as const;

/* ── Reading source text ─────────────────────────────────────────────────── */

/** The source with comments blanked, string and template literals left alone. */
function stripComments(src: string): string {
  let out = '';
  for (let i = 0; i < src.length; ) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '/' && n === '/') {
      while (i < src.length && src[i] !== '\n') i++;
    } else if (c === '/' && n === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
    } else if (c === "'" || c === '"' || c === '`') {
      const q = c;
      out += c;
      i++;
      while (i < src.length && src[i] !== q) {
        if (src[i] === '\\') { out += src[i++]; }
        out += src[i++];
      }
      out += q;
      i++;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/** The top-level arguments of every call to `name(`, as raw text. */
function callsOf(src: string, name: string): string[][] {
  const text = stripComments(src);
  const calls: string[][] = [];
  const re = new RegExp(`(?<![\\w.$])${name}\\(`, 'g');
  for (let m = re.exec(text); m; m = re.exec(text)) {
    let depth = 0;
    let i = m.index + m[0].length;
    let current = '';
    const args: string[] = [];
    for (; i < text.length; i++) {
      const c = text[i];
      if (c === "'" || c === '"' || c === '`') {
        const q = c;
        current += c;
        i++;
        while (i < text.length && text[i] !== q) {
          if (text[i] === '\\') current += text[i++];
          current += text[i++];
        }
        current += q;
        continue;
      }
      if ('([{'.includes(c)) depth++;
      if (')]}'.includes(c)) {
        if (depth === 0) break;
        depth--;
      }
      if (c === ',' && depth === 0) {
        args.push(current.trim());
        current = '';
        continue;
      }
      current += c;
    }
    if (current.trim()) args.push(current.trim());
    calls.push(args);
  }
  return calls;
}

const literal = (arg: string | undefined): string | null => {
  const m = arg ? /^'([^']*)'$/.exec(arg) : null;
  return m ? m[1] : null;
};

interface SourceCodes {
  /** code -> statuses, for codes named explicitly or by a call that gives only a status. */
  byCode: Map<string, Set<number>>;
  /** codes a CODE_BY_STATUS entry declares that no call can produce */
  declaredOnly: string[];
  unmapped: number[];
}

function envelopeCodes(gateway: string): SourceCodes {
  const body = /const CODE_BY_STATUS[^=]*=\s*\{([^}]*)\}/.exec(stripComments(gateway))?.[1] ?? '';
  const byStatus = new Map<number, string>();
  for (const m of body.matchAll(/(\d{3}):\s*'([a-z_-]+)'/g)) byStatus.set(Number(m[1]), m[2]);
  const byCode = new Map<string, Set<number>>();
  const unmapped: number[] = [];
  const add = (code: string, status: number) => byCode.set(code, (byCode.get(code) ?? new Set()).add(status));
  for (const args of callsOf(gateway, 'fail')) {
    if (!/^\d{3}$/.test(args[0] ?? '')) continue;
    const status = Number(args[0]);
    const explicit = literal(args[2]);
    if (explicit) add(explicit, status);
    else if (byStatus.has(status)) add(byStatus.get(status)!, status);
    else unmapped.push(status);
  }
  for (const args of callsOf(gateway, 'refuse')) {
    if (!/^\d{3}$/.test(args[0] ?? '')) continue;
    const code = literal(args[1]);
    if (code) add(code, Number(args[0]));
  }
  const declaredOnly = [...new Set(byStatus.values())].filter((c) => !byCode.has(c));
  return { byCode, declaredOnly, unmapped };
}

function intelligenceCodes(src: string): Map<string, Set<number>> {
  const out = new Map<string, Set<number>>();
  for (const m of stripComments(src).matchAll(/result\((\d{3}),\s*\{\s*code:\s*'([a-z-]+)'/g)) {
    out.set(m[2], (out.get(m[2]) ?? new Set()).add(Number(m[1])));
  }
  return out;
}

/** Messages the SCIM service can put in `detail`, from the source. */
function scimDetails(): { fixed: string[]; prefixes: string[] } {
  const fixed = new Set<string>();
  const prefixes = new Set<string>();
  for (const f of [SRC.scim, SRC.postgresScim]) {
    for (const args of callsOf(read(f), 'new ScimError')) {
      for (const m of (args[1] ?? '').matchAll(/'([^']*)'/g)) fixed.add(m[1]);
    }
  }
  for (const args of callsOf(read(SRC.scim), 'errorResponse')) {
    for (const m of (args[1] ?? '').matchAll(/'([^']*)'/g)) fixed.add(m[1]);
  }
  // provisioning.ts passes its sentences to helpers, so read every sentence in it that is one.
  const provisioning = stripComments(read(SRC.provisioning));
  for (const m of provisioning.matchAll(/'(Invalid SCIM[^']*)'/g)) fixed.add(m[1]);
  for (const m of provisioning.matchAll(/`(Invalid SCIM[^`]*)`/g)) prefixes.add(m[1].split('${')[0]);
  return { fixed: [...fixed].sort(), prefixes: [...prefixes].sort() };
}

/* ── Reading Markdown ───────────────────────────────────────────────────── */

const section = (md: string, heading: string): string => {
  const start = md.indexOf(`\n${heading}\n`);
  if (start < 0) return '';
  const rest = md.slice(start + heading.length + 2);
  const end = rest.search(/\n## /);
  return end < 0 ? rest : rest.slice(0, end);
};

const routeRows = (md: string): string[] =>
  [...md.matchAll(/^\| (GET|POST|PUT|PATCH|DELETE) \| `(\/[^`]+)` \|/gm)].map((m) => `${m[1]} ${m[2]}`).sort();

const CARD = /^> \*\*Type:\*\* reference · \*\*Audience:\*\* [a-z, -]+ · \*\*Owner:\*\* `[a-z]+` · \*\*Truth:\*\* held · \*\*Reviewed:\*\* 2026-10-04 · \*\*Held by:\*\* `app\/src\/lib\/docs\/gateway-reference\.test\.ts`$/;

/* ── A reader for the OpenAPI file ──────────────────────────────────────── */

type Yaml = string | number | boolean | null | Yaml[] | { [key: string]: Yaml };
interface Line { indent: number; text: string }

function splitFlow(inner: string): string[] {
  const parts: string[] = [];
  let current = '';
  let quote = '';
  for (const c of inner) {
    if (quote) {
      current += c;
      if (c === quote) quote = '';
    } else if (c === "'" || c === '"') {
      quote = c;
      current += c;
    } else if (c === ',') {
      parts.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function yamlScalar(raw: string): Yaml {
  const text = raw.trim();
  if (text.startsWith('"')) return JSON.parse(text) as string;
  if (text.startsWith("'")) {
    if (!text.endsWith("'") || text.length < 2) throw new Error(`unterminated string: ${text}`);
    return text.slice(1, -1).replace(/''/g, "'");
  }
  if (text === '[]') return [];
  if (text === '{}') return {};
  if (text.startsWith('[')) {
    if (!text.endsWith(']')) throw new Error(`unterminated list: ${text}`);
    return splitFlow(text.slice(1, -1)).map(yamlScalar);
  }
  if (text.startsWith('{')) throw new Error(`flow mappings other than {} are outside the subset: ${text}`);
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (text === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  return text;
}

/** `key: rest`, `'quoted': rest`, `key:` — or null when the line is not a mapping entry. */
function splitKey(text: string): [string, string] | null {
  const quoted = /^('(?:[^']|'')*'|"(?:[^"\\]|\\.)*")\s*:(?:\s+(.*))?$/.exec(text);
  if (quoted) return [String(yamlScalar(quoted[1])), (quoted[2] ?? '').trim()];
  if (/^['"[{]/.test(text)) return null;
  const idx = text.search(/:(\s|$)/);
  if (idx <= 0) return null;
  return [text.slice(0, idx), text.slice(idx + 1).trim()];
}

function parseYaml(source: string): Yaml {
  if (/\t/.test(source)) throw new Error('tabs are outside the subset');
  const lines: Line[] = source
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .map((l) => ({ indent: l.length - l.trimStart().length, text: l.trim() }));

  const node = (i: number, indent: number): [Yaml, number] =>
    lines[i].text === '-' || lines[i].text.startsWith('- ') ? seq(i, indent) : map(i, indent);

  const seq = (start: number, indent: number): [Yaml, number] => {
    const out: Yaml[] = [];
    let i = start;
    while (i < lines.length && lines[i].indent === indent && (lines[i].text === '-' || lines[i].text.startsWith('- '))) {
      const rest = lines[i].text.slice(1).trim();
      if (rest === '') {
        const [v, next] = node(i + 1, lines[i + 1].indent);
        out.push(v);
        i = next;
      } else if (splitKey(rest)) {
        lines[i] = { indent: indent + 2, text: rest };
        const [v, next] = map(i, indent + 2);
        out.push(v);
        i = next;
      } else {
        out.push(yamlScalar(rest));
        i++;
      }
    }
    return [out, i];
  };

  const map = (start: number, indent: number): [Yaml, number] => {
    const out: { [key: string]: Yaml } = {};
    let i = start;
    while (i < lines.length && lines[i].indent === indent && !lines[i].text.startsWith('- ')) {
      const entry = splitKey(lines[i].text);
      if (!entry) throw new Error(`not a mapping entry: ${lines[i].text}`);
      const [key, rest] = entry;
      if (key in out) throw new Error(`duplicate key: ${key}`);
      if (rest === '') {
        const next = lines[i + 1];
        if (next && next.indent > indent) {
          const [v, after] = node(i + 1, next.indent);
          out[key] = v;
          i = after;
        } else if (next && next.indent === indent && next.text.startsWith('- ')) {
          const [v, after] = seq(i + 1, indent);
          out[key] = v;
          i = after;
        } else {
          out[key] = null;
          i++;
        }
      } else {
        out[key] = yamlScalar(rest);
        i++;
      }
    }
    return [out, i];
  };

  const [value, end] = node(0, lines[0].indent);
  if (end !== lines.length) throw new Error(`unparsed content at: ${lines[end].text}`);
  return value;
}

/* ── A structural validator for the OpenAPI file ────────────────────────── */

type Obj = { [key: string]: Yaml };
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const METHODS = ['get', 'put', 'post', 'delete', 'patch'];

function resolvePointer(doc: Yaml, ref: string): Yaml | undefined {
  if (!ref.startsWith('#/')) return undefined;
  let cur: Yaml | undefined = doc;
  for (const raw of ref.slice(2).split('/')) {
    const key = raw.replace(/~1/g, '/').replace(/~0/g, '~');
    if (!isObj(cur) || !(key in cur)) return undefined;
    cur = cur[key];
  }
  return cur;
}

/** Problems in an OpenAPI 3.1 document, as sentences. Empty means structurally sound. */
function validateOpenApi(doc: Yaml): string[] {
  const problems: string[] = [];
  if (!isObj(doc)) return ['the document is not a mapping'];
  if (typeof doc.openapi !== 'string' || !/^3\.1\.\d+$/.test(doc.openapi)) problems.push('openapi must be 3.1.x');
  const info = doc.info;
  if (!isObj(info) || typeof info.title !== 'string' || typeof info.version !== 'string') problems.push('info.title and info.version are required');
  const paths = doc.paths;
  if (!isObj(paths) || Object.keys(paths).length === 0) return [...problems, 'paths is empty'];
  const components = isObj(doc.components) ? doc.components : {};
  const schemes = isObj(components.securitySchemes) ? components.securitySchemes : {};

  // Every $ref resolves, and resolves into the right kind of component.
  const kindOf = (parentKey: string, grand: string): string =>
    /^([1-5]\d\d|default)$/.test(parentKey) || grand === 'responses' ? 'responses'
      : grand === 'parameters' ? 'parameters'
        : 'schemas';
  const walk = (value: Yaml, parentKey: string, grand: string, where: string) => {
    if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, String(i), parentKey, `${where}[${i}]`));
    } else if (isObj(value)) {
      if (typeof value.$ref === 'string') {
        const target = resolvePointer(doc, value.$ref);
        if (target === undefined) problems.push(`${where}: dangling $ref ${value.$ref}`);
        else if (!value.$ref.startsWith(`#/components/${kindOf(parentKey, grand)}/`)) {
          problems.push(`${where}: $ref ${value.$ref} is the wrong kind of component here (expected ${kindOf(parentKey, grand)})`);
        }
      }
      for (const [k, v] of Object.entries(value)) {
        if (k !== '$ref') walk(v, k, parentKey, `${where}.${k}`);
      }
    }
  };
  walk(doc, '', '', '#');

  const ids = new Set<string>();
  const resolveMaybe = (v: Yaml): Yaml => (isObj(v) && typeof v.$ref === 'string' ? (resolvePointer(doc, v.$ref) ?? v) : v);
  for (const [path, item] of Object.entries(paths)) {
    if (!path.startsWith('/')) problems.push(`${path}: a path starts with /`);
    if (!isObj(item)) { problems.push(`${path}: not a mapping`); continue; }
    const shared = Array.isArray(item.parameters) ? item.parameters.map(resolveMaybe) : [];
    for (const key of Object.keys(item)) {
      if (!METHODS.includes(key) && !['parameters', 'summary', 'description'].includes(key)) problems.push(`${path}: unknown key ${key}`);
    }
    for (const method of METHODS) {
      const op = item[method];
      if (op === undefined) continue;
      const label = `${method.toUpperCase()} ${path}`;
      if (!isObj(op)) { problems.push(`${label}: not a mapping`); continue; }
      if (typeof op.operationId !== 'string') problems.push(`${label}: operationId is required`);
      else if (ids.has(op.operationId)) problems.push(`${label}: duplicate operationId ${op.operationId}`);
      else ids.add(op.operationId);
      const responses = op.responses;
      if (!isObj(responses) || Object.keys(responses).length === 0) problems.push(`${label}: responses is required`);
      else {
        for (const [code, r] of Object.entries(responses)) {
          if (!/^([1-5]\d\d|default)$/.test(code)) problems.push(`${label}: bad response code ${code}`);
          if (!isObj(r) || (typeof r.$ref !== 'string' && typeof r.description !== 'string')) problems.push(`${label}: response ${code} needs a description or a $ref`);
        }
      }
      const own = Array.isArray(op.parameters) ? op.parameters.map(resolveMaybe) : [];
      const declared = new Set([...shared, ...own].filter(isObj).filter((p) => p.in === 'path').map((p) => String(p.name)));
      for (const m of path.matchAll(/\{([^}]+)\}/g)) {
        if (!declared.has(m[1])) problems.push(`${label}: path parameter {${m[1]}} is not declared`);
      }
      const security = Array.isArray(op.security) ? op.security : [];
      for (const req of security) {
        for (const name of isObj(req) ? Object.keys(req) : []) if (!(name in schemes)) problems.push(`${label}: unknown security scheme ${name}`);
      }
    }
  }
  const top = Array.isArray(doc.security) ? doc.security : [];
  for (const req of top) {
    for (const name of isObj(req) ? Object.keys(req) : []) if (!(name in schemes)) problems.push(`security: unknown scheme ${name}`);
  }
  return problems;
}

function openApiOperations(doc: Yaml): string[] {
  const out: string[] = [];
  if (!isObj(doc) || !isObj(doc.paths)) return out;
  for (const [path, item] of Object.entries(doc.paths)) {
    if (!isObj(item)) continue;
    for (const m of METHODS) if (m in item) out.push(`${m.toUpperCase()} ${path}`);
  }
  return out.sort();
}

/* ── Harnesses that drive the real handlers ─────────────────────────────── */

const FIXED = '2026-10-04T12:00:00.000Z';
const ORIGIN = 'http://localhost:5173';
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

interface Capture {
  id: string;
  display: string;
  method: string;
  path: string;
  headers: [string, string][];
  body: string | null;
  bodyNote: string | null;
  status: number;
  responseHeaders: [string, string][] | null;
  responseBody: string;
  caption: string | null;
  scenario: string;
}
const captures = new Map<string, Capture>();

/**
 * The status each example is documented to show. A scenario that gets another
 * answer fails here with the call that broke, instead of failing later on an
 * excerpt that is missing its data.
 */
const WANT: Record<string, number> = {
  'health-live': 200, health: 200, 'auth-config': 200, status: 200, 'records-courses': 200, 'prepare-enrol': 200,
  'commit-unconfirmed': 400, 'commit-enrol': 200, 'commit-replay': 200, 'reconcile-completed': 200,
  'intelligence-unconfigured': 503, 'intelligence-health': 200, 'intelligence-policy': 200, 'intelligence-respond': 200,
  'intelligence-confirm': 502, 'no-token': 401, 'unknown-token': 403, 'wrong-origin': 403, preflight: 204, 'cors-simple': 200,
  'rate-limited': 429, 'rate-limit-health-exempt': 200, 'not-json-type': 415, 'read-only-prepare': 503, 'read-only-health': 200,
  'read-only-reconcile': 200, 'records-no-area': 400, 'prepare-bad-body': 400, 'prepare-unexpected-field': 400,
  'prepare-missing-field': 400, 'prepare-stale-version': 409, 'prepare-unknown-action': 403, 'prepare-other-students-record': 404,
  'records-adapter-missing': 503, 'wrong-method': 405, 'unknown-path': 404, 'invalid-json': 400, 'too-large': 413,
  'commit-uncertain': 502, 'commit-after-uncertain': 409, 'reconcile-unresolved': 409, 'reconcile-resolved': 200,
  'commit-refused': 400, 'commit-refused-again': 409, 'reconcile-not-submitted': 409, 'commit-review-changed': 409,
  'commit-expired': 410, 'prepare-connection-forbids': 403, 'intelligence-mode-refused': 403, 'intelligence-invalid': 400,
  'intelligence-confirm-again': 404,
  'scim-no-credential': 401, 'scim-bad-credential': 401, 'scim-rate-limited': 429, 'scim-no-idempotency-key': 400,
  'scim-service-provider-config': 200, 'scim-create-user': 201, 'scim-get-user': 200, 'scim-put-user': 200,
  'scim-put-external-id': 400, 'scim-delete-user': 204, 'scim-user-not-found': 404, 'scim-list-groups': 200,
  'scim-put-group': 200, 'scim-group-unmapped': 400, 'scim-delete-group': 204, 'scim-filter-user': 200, 'scim-bad-filter': 400,
  'scim-count-zero': 200, 'scim-patch-user': 200, 'scim-patch-without-path': 400, 'scim-bulk-not-implemented': 404, 'scim-not-json': 400,
};

function wanted(id: string, method: string, path: string, status: number): void {
  if (WANT[id] !== status) throw new Error(`example "${id}": ${method} ${path} answered ${status}, the documented status is ${WANT[id]}`);
}

interface Call {
  token?: string | null;
  origin?: string | null;
  correlation?: string;
  body?: unknown;
  raw?: string;
  contentType?: string | null;
  headers?: Record<string, string>;
  id?: string;
  headersShown?: boolean;
  excerpt?: (value: unknown) => unknown;
  caption?: string;
  bodyNote?: string;
}
interface Reply { status: number; text: string; json: unknown; headers: Headers }

function exchange(
  scenario: string,
  display: string,
  handle: (request: Request) => Promise<Response>,
  base: string,
) {
  return async (method: string, path: string, c: Call = {}): Promise<Reply> => {
    const headers = new Headers();
    const shown: [string, string][] = [];
    const put = (k: string, v: string, show = true) => {
      headers.set(k, v);
      if (show) shown.push([k, v]);
    };
    if (c.origin) put('Origin', c.origin);
    if (c.token) { headers.set('Authorization', `Bearer ${c.token}`); shown.push(['Authorization', 'Bearer $TOKEN']); }
    const hasBody = c.body !== undefined || c.raw !== undefined;
    const contentType = c.contentType === undefined ? (hasBody ? 'application/json' : null) : c.contentType;
    if (contentType && hasBody) put('Content-Type', contentType);
    if (c.correlation) put('X-Correlation-Id', c.correlation);
    for (const [k, v] of Object.entries(c.headers ?? {})) put(k, v);
    const text = c.raw ?? (c.body === undefined ? undefined : JSON.stringify(c.body));
    const response = await handle(new Request(`http://gateway.test${base}${path}`, { method, headers, body: text }));
    const out = await response.text();
    let json: unknown = null;
    try { json = out ? JSON.parse(out) : null; } catch { /* not JSON */ }
    if (c.id) {
      wanted(c.id, method, path, response.status);
      const shownBody = c.excerpt && json !== null ? JSON.stringify(c.excerpt(json)) : out;
      captures.set(c.id, {
        id: c.id,
        display,
        method,
        path: `${base}${path}`,
        headers: shown,
        body: c.bodyNote ? null : text ?? null,
        bodyNote: c.bodyNote ?? null,
        status: response.status,
        responseHeaders: c.headersShown ? [...response.headers.entries()].sort(([a], [b]) => a.localeCompare(b)) : null,
        responseBody: shownBody,
        caption: c.caption ?? null,
        scenario,
      });
    }
    return { status: response.status, text: out, json, headers: response.headers };
  };
}

type GatewayConfig = Parameters<typeof createGateway>[0];

const IDENTITIES: Record<string, UniversityIdentity> = {
  'student-token': { userId: 'student-1', institutionId: SANDBOX_INSTITUTION, roles: ['student'] },
  'faculty-token': { userId: 'prof-1', institutionId: SANDBOX_INSTITUTION, roles: ['faculty'] },
  'other-school-token': { userId: 'student-9', institutionId: 'other-school', roles: ['student'] },
  'school-a-token': { userId: 'student-a', institutionId: 'school-a', roles: ['student'] },
};
const KEY = Buffer.alloc(32, 7);
const open: { close(): void }[] = [];

function makeGateway(over: Partial<GatewayConfig> & { adapters: InstitutionAdapter[] }) {
  const journal = new ActionJournal(':memory:', KEY);
  open.push(journal);
  return createGateway({
    origin: ORIGIN,
    institutionName: SANDBOX_NAME,
    authenticate: async (token) => IDENTITIES[token] ?? null,
    journal,
    rateLimiter: { allow: () => true },
    ...over,
  });
}

function sandboxGateway(over: Partial<GatewayConfig> = {}) {
  const store = new SandboxStore(':memory:');
  open.push(store);
  return makeGateway({ adapters: sandboxAdapters(store), ...over });
}

/** The fixture adapter the refusal examples use: one record, one action, behaviour set per call. */
function fixtureAdapter() {
  const state = { version: '1', mode: 'ok', title: 'Submit coursework', reconcile: 'found', writable: true };
  const record = () => ({
    id: 'paper', area: 'assignments' as const, title: 'Paper', summary: '', status: 'Open',
    updatedAt: '2026-09-13T10:00:00Z', version: state.version, details: [],
    actions: [{ id: 'submit', label: 'Submit', fields: [{ id: 'response', label: 'Response', kind: 'textarea' as const, required: true }] }],
  });
  const adapter: InstitutionAdapter = {
    institutionId: 'school-a',
    area: 'assignments',
    status: async () => ({ area: 'assignments', provider: 'Fixture adapter', state: 'connected', canRead: true, canWrite: state.writable, lastSyncAt: null, permissions: ['self:assignments'], message: '' }),
    list: async () => ({ records: [record()], nextCursor: null, fetchedAt: '2026-09-13T10:00:00Z' }),
    get: async (_c, id) => (id === 'paper' ? record() : null),
    review: async () => ({ title: state.title, details: [{ label: 'Action', value: 'Submit coursework' }] }),
    execute: async () => {
      if (state.mode === 'timeout') throw new Error('Vendor secret must not be exposed');
      if (state.mode === 'refuse') throw new Refusal('The deadline has passed.');
      return { id: 'receipt-1', status: 'completed', message: 'Recorded by school', recordedAt: '2026-09-13T10:00:00Z' };
    },
    reconcile: async () => (state.reconcile === 'found'
      ? { id: 'receipt-1', status: 'completed', message: 'Confirmed by lookup', recordedAt: '2026-09-13T10:00:00Z' }
      : null),
  };
  return { adapter, state };
}

/* ── SCIM: an in-memory repository, named as such wherever it is shown ──── */

const SCIM_BASE = 'http://scim.internal/scim/v2';
const SCIM_PUBLIC = 'https://gateway.example/api/institution/scim/v2';
const SCIM_CREDENTIAL = '11111111-2222-4333-8444-555555555555';
const SCIM_SECRET = 'S'.repeat(43);
const SCIM_GROUP = 'aaaaaaaa-0000-4000-8000-000000000001';
const SCIM_SALT = new Uint8Array(16).fill(3);

/*
 * scim.ts is loaded at run time, not imported. It declares a class with a
 * parameter property (`constructor(readonly status: number, …)`), which the
 * app project's `erasableSyntaxOnly` refuses, so a static import from a file
 * under src/ would make `tsc -b` fail. Its own tests live in server/ for that
 * reason. The shapes below are the parts of its contract this file uses; if
 * the module drifts from them, the calls below fail rather than pass.
 */
interface CredentialMaterial { id: string; tenantId: string; salt: Uint8Array; hash: Uint8Array; status: 'active' | 'revoked' }
interface StoredScimGroup {
  tenantId: string; groupId: string; externalId?: string; displayName: string; members: ScimMember[];
  createdAt: string; updatedAt: string; location: string;
}
interface ScimRepository {
  credential(id: string): Promise<CredentialMaterial | null>;
  listUsers(tenantId: string, filter: ScimFilter | null): Promise<ProvisioningResult[]>;
  getUser(tenantId: string, id: string): Promise<ProvisioningResult | null>;
  putUser(tenantId: string, id: string | null, input: ScimUser, requestId: string, credentialId: string): Promise<ProvisioningResult>;
  listGroups(tenantId: string, filter: ScimFilter | null): Promise<StoredScimGroup[]>;
  getGroup(tenantId: string, id: string): Promise<StoredScimGroup | null>;
  putGroup(tenantId: string, id: string | null, input: ScimGroup, requestId: string, credentialId: string): Promise<StoredScimGroup>;
  deleteGroup(tenantId: string, id: string, requestId: string, credentialId: string): Promise<void>;
  audit(event: unknown): Promise<void>;
}
interface ScimModule {
  ScimError: new (status: number, message: string) => Error & { status: number };
  createScimService(config: {
    baseUrl: string;
    repository: ScimRepository;
    rateLimiter: { allow(tenantId: string, credentialId: string): Promise<boolean> };
    clock?: () => Date;
  }): (request: Request) => Promise<Response>;
}
let scim: ScimModule;
const loadScim = async (): Promise<ScimModule> =>
  (await import(/* @vite-ignore */ join(import.meta.dirname, '../../../server/institution/scim.ts'))) as ScimModule;

function memoryScimRepository(): ScimRepository {
  const { ScimError } = scim;
  let n = 0;
  const users = new Map<string, ProvisioningResult>();
  const groups = new Map<string, StoredScimGroup>([[SCIM_GROUP, {
    tenantId: 't1', groupId: SCIM_GROUP, externalId: 'semester-students', displayName: 'Semester students',
    members: [], createdAt: FIXED, updatedAt: FIXED, location: `${SCIM_PUBLIC}/Groups/${SCIM_GROUP}`,
  }]]);
  const credential: CredentialMaterial = {
    id: SCIM_CREDENTIAL,
    tenantId: 't1',
    salt: SCIM_SALT,
    hash: createHash('sha256').update(Buffer.concat([Buffer.from(SCIM_SALT), Buffer.from(SCIM_SECRET)])).digest(),
    status: 'active',
  };
  return {
    credential: async (id) => (id === SCIM_CREDENTIAL ? credential : null),
    listUsers: async (_t, f) => [...users.values()].filter((u) =>
      !f || (f.attribute === 'userName' ? u.userName === f.value.toLowerCase() : u.externalId === f.value)),
    getUser: async (_t, id) => users.get(id) ?? null,
    putUser: async (tenantId, id, input) => {
      const current = id ? users.get(id) : undefined;
      if (id && !current) throw new ScimError(404, 'SCIM user not found.');
      if (current && input.externalId !== undefined && input.externalId !== current.externalId) {
        throw new ScimError(400, 'A user’s externalId cannot change. Deactivate this user and create a new one.');
      }
      const externalId = current?.externalId ?? input.externalId;
      if (!externalId) throw new ScimError(400, 'A SCIM user needs an externalId: it is how the university identifies the person.');
      const userId = id ?? `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
      const saved: ProvisioningResult = {
        tenantId, userId, externalId, userName: input.userName.toLowerCase(),
        ...(input.displayName ? { displayName: input.displayName } : {}),
        active: input.active, roles: [], groupIds: [], auditId: '',
        createdAt: current?.createdAt ?? FIXED, updatedAt: FIXED, location: `${SCIM_PUBLIC}/Users/${userId}`,
      };
      users.set(userId, saved);
      return saved;
    },
    listGroups: async (_t, f) => [...groups.values()].filter((g) => !f || (f.attribute === 'externalId' && g.externalId === f.value)),
    getGroup: async (_t, id) => groups.get(id) ?? null,
    putGroup: async (_t, id, input) => {
      const found = [...groups.values()].find((g) => g.groupId === id || g.externalId === input.externalId);
      if (!found) {
        throw new ScimError(400, 'This group has not been mapped to any role by the university’s Semester administrator, so it grants nothing. Ask them to map it, then send it again.');
      }
      found.displayName = input.displayName;
      found.members = input.members;
      return found;
    },
    deleteGroup: async (_t, id) => { const g = groups.get(id); if (g) g.members = []; },
    audit: async () => undefined,
  };
}

function scimHarness(allow = () => true) {
  const handler = scim.createScimService({
    baseUrl: SCIM_BASE,
    repository: memoryScimRepository(),
    rateLimiter: { allow: async () => allow() },
    clock: () => new Date(FIXED),
  });
  return handler;
}

function scimExchange(handler: (request: Request) => Promise<Response>) {
  return async (method: string, path: string, c: Call & { auth?: string | null } = {}): Promise<Reply> => {
    const headers = new Headers();
    const shown: [string, string][] = [];
    const auth = c.auth === undefined ? `Bearer ${SCIM_CREDENTIAL}.${SCIM_SECRET}` : c.auth;
    if (auth) { headers.set('Authorization', auth); shown.push(['Authorization', 'Bearer $SCIM_CREDENTIAL']); }
    const hasBody = c.body !== undefined || c.raw !== undefined;
    if (hasBody) { headers.set('Content-Type', 'application/scim+json'); shown.push(['Content-Type', 'application/scim+json']); }
    for (const [k, v] of Object.entries(c.headers ?? {})) { headers.set(k, v); shown.push([k, v]); }
    const text = c.raw ?? (c.body === undefined ? undefined : JSON.stringify(c.body));
    const bodyless = method === 'GET' || method === 'HEAD';
    const response = await handler(new Request(`${SCIM_BASE}${path}`, { method, headers, body: bodyless ? undefined : text }));
    const out = await response.text();
    let json: unknown = null;
    try { json = out ? JSON.parse(out) : null; } catch { /* no body */ }
    if (c.id) {
      wanted(c.id, method, path, response.status);
      captures.set(c.id, {
        id: c.id, display: SCIM_PUBLIC, method, path, headers: shown, body: text ?? null, bodyNote: null,
        status: response.status, responseHeaders: null,
        responseBody: c.excerpt && json !== null ? JSON.stringify(c.excerpt(json)) : out,
        caption: c.caption ?? null, scenario: 'scim',
      });
    }
    return { status: response.status, text: out, json, headers: response.headers };
  };
}

/* ── The scenarios that produce every example ───────────────────────────── */

const U = 'urn:ietf:params:scim:schemas:core:2.0:User';
const G = 'urn:ietf:params:scim:schemas:core:2.0:Group';
const P = 'urn:ietf:params:scim:api:messages:2.0:PatchOp';

type Json = Record<string, unknown>;

async function sandboxScenario() {
  const handle = sandboxGateway();
  const call = exchange('sandbox', 'http://127.0.0.1:8787', handle, '');
  const S = 'student-token';
  await call('GET', '/health/live', { id: 'health-live', headersShown: true });
  await call('GET', '/health', { id: 'health' });
  await call('GET', '/v1/auth/config', { id: 'auth-config' });
  await call('GET', '/status', {
    id: 'status', token: S, correlation: 'docs-example-0001',
    caption: 'Excerpt: 2 of the 37 connections are shown (one connected, one with no adapter).',
    excerpt: (v) => {
      const s = v as { connections: { area: string }[] };
      return { ...s, connections: s.connections.filter((c) => c.area === 'courses' || c.area === 'assessments') };
    },
  });
  const listed = await call('GET', '/records?area=courses', {
    id: 'records-courses', token: S,
    caption: 'Excerpt: the first of the 2 records is shown.',
    excerpt: (v) => ({ ...(v as Json), records: (v as { records: unknown[] }).records.slice(0, 1) }),
  });
  const course = (listed.json as { records: { id: string; version: string }[] }).records[0];
  const enrol = { area: 'courses', recordId: course.id, version: course.version, actionId: 'enrol', fields: {} };
  const prepared = await call('POST', '/actions/prepare', { id: 'prepare-enrol', token: S, correlation: 'docs-example-0002', body: enrol });
  const reviewId = (prepared.json as { id: string }).id;
  await call('POST', '/actions/commit', { id: 'commit-unconfirmed', token: S, correlation: 'docs-example-0003', body: { reviewId } });
  await call('POST', '/actions/commit', { id: 'commit-enrol', token: S, correlation: 'docs-example-0004', body: { reviewId, confirmed: true } });
  await call('POST', '/actions/commit', { id: 'commit-replay', token: S, correlation: 'docs-example-0005', body: { reviewId, confirmed: true } });
  await call('POST', '/actions/reconcile', { id: 'reconcile-completed', token: S, correlation: 'docs-example-0006', body: { reviewId } });

  const moved = await call('GET', '/records?area=courses', { token: S });
  const now = (moved.json as { records: { id: string; version: string }[] }).records[0];
  await call('POST', '/actions/prepare', { id: 'prepare-stale-version', token: S, correlation: 'docs-example-0007', body: { ...enrol, version: '0' } });
  await call('POST', '/actions/prepare', { id: 'prepare-unknown-action', token: S, correlation: 'docs-example-0008', body: { ...enrol, version: now.version, actionId: 'nope' } });

  const work = await call('GET', '/records?area=assignments', { token: S });
  const paper = (work.json as { records: { id: string; version: string }[] }).records[1];
  const submit = { area: 'assignments', recordId: paper.id, version: paper.version, actionId: 'submit' };
  await call('POST', '/actions/prepare', { id: 'prepare-unexpected-field', token: S, correlation: 'docs-example-0009', body: { ...submit, fields: { work: 'x', admin: 'yes' } } });
  await call('POST', '/actions/prepare', { id: 'prepare-missing-field', token: S, correlation: 'docs-example-0010', body: { ...submit, fields: { note: 'hello' } } });
  await call('POST', '/actions/prepare', { id: 'prepare-other-students-record', token: S, correlation: 'docs-example-0011', body: { ...submit, recordId: 'student-2:a2', fields: { work: 'x' } } });
  await call('POST', '/actions/prepare', { id: 'prepare-bad-body', token: S, correlation: 'docs-example-0012', body: { area: 'courses' } });
  await call('GET', '/records', { id: 'records-no-area', token: S, correlation: 'docs-example-0013' });
  await call('GET', '/records?area=billing', { id: 'records-adapter-missing', token: 'other-school-token', correlation: 'docs-example-0014' });

  await call('GET', '/status', { id: 'no-token', correlation: 'docs-example-0015' });
  await call('GET', '/status', { id: 'unknown-token', token: 'expired-token', correlation: 'docs-example-0016' });
  await call('GET', '/status', { id: 'wrong-origin', origin: 'https://other.example', correlation: 'docs-example-0017', headersShown: true });
  await call('DELETE', '/status', { id: 'wrong-method', token: S, correlation: 'docs-example-0018' });
  await call('GET', '/nope', { id: 'unknown-path', token: S, correlation: 'docs-example-0019' });
  await call('POST', '/actions/prepare', { id: 'not-json-type', token: S, correlation: 'docs-example-0020', raw: '{}', contentType: 'text/plain' });
  await call('POST', '/actions/prepare', { id: 'invalid-json', token: S, correlation: 'docs-example-0021', raw: '{nope' });
  await call('POST', '/actions/prepare', {
    id: 'too-large', token: S, correlation: 'docs-example-0022',
    raw: JSON.stringify({ a: 'x'.repeat(MAX_BODY) }), bodyNote: `(a JSON body of ${MAX_BODY + 8} bytes)`,
  });
  await call('OPTIONS', '/records', { id: 'preflight', origin: ORIGIN, correlation: 'docs-example-0023', headersShown: true });
  await call('GET', '/health/live', { id: 'cors-simple', origin: ORIGIN, correlation: 'docs-example-0024', headersShown: true });
}

async function readOnlyScenario() {
  let on = false;
  const handle = sandboxGateway({ readOnly: () => on });
  const call = exchange('read-only', 'http://127.0.0.1:8787', handle, '');
  const S = 'student-token';
  const listed = await call('GET', '/records?area=courses', { token: S });
  const course = (listed.json as { records: { id: string; version: string }[] }).records[0];
  const enrol = { area: 'courses', recordId: course.id, version: course.version, actionId: 'enrol', fields: {} };
  const prepared = await call('POST', '/actions/prepare', { token: S, body: enrol });
  const reviewId = (prepared.json as { id: string }).id;
  await call('POST', '/actions/commit', { token: S, body: { reviewId, confirmed: true } });
  on = true;
  await call('POST', '/actions/prepare', { id: 'read-only-prepare', token: S, correlation: 'docs-example-0025', body: enrol });
  await call('GET', '/health', { id: 'read-only-health' });
  await call('POST', '/actions/reconcile', { id: 'read-only-reconcile', token: S, correlation: 'docs-example-0027', body: { reviewId } });
}

async function rateLimitScenario() {
  const limiter = new MemoryRateLimiter({ windowMs: 60_000, max: 2 });
  const handle = sandboxGateway({ rateLimiter: limiter });
  const call = exchange('rate-limit', 'http://127.0.0.1:8787', handle, '');
  await call('GET', '/health/live', {});
  await call('GET', '/status', { token: 'student-token', correlation: 'docs-example-0028' });
  await call('GET', '/status', { token: 'student-token', correlation: 'docs-example-0029' });
  await call('GET', '/status', { id: 'rate-limited', token: 'student-token', correlation: 'docs-example-0030', headersShown: true });
  await call('GET', '/health/live', { id: 'rate-limit-health-exempt', correlation: 'docs-example-0031' });
}

async function fixtureScenario() {
  const { adapter, state } = fixtureAdapter();
  const handle = makeGateway({ adapters: [adapter], institutionName: 'Fixture school' });
  const call = exchange('fixture', 'http://127.0.0.1:8787', handle, '');
  const T = 'school-a-token';
  const input = { area: 'assignments', recordId: 'paper', version: '1', actionId: 'submit', fields: { response: 'Private coursework response' } };
  const prepare = async (corr: string) => (await call('POST', '/actions/prepare', { token: T, correlation: corr, body: input })).json as { id: string };

  const first = await prepare('docs-example-0032');
  state.mode = 'timeout';
  await call('POST', '/actions/commit', { id: 'commit-uncertain', token: T, correlation: 'docs-example-0033', body: { reviewId: first.id, confirmed: true } });
  await call('POST', '/actions/commit', { id: 'commit-after-uncertain', token: T, correlation: 'docs-example-0034', body: { reviewId: first.id, confirmed: true } });
  state.reconcile = 'none';
  await call('POST', '/actions/reconcile', { id: 'reconcile-unresolved', token: T, correlation: 'docs-example-0035', body: { reviewId: first.id } });
  state.reconcile = 'found';
  await call('POST', '/actions/reconcile', { id: 'reconcile-resolved', token: T, correlation: 'docs-example-0036', body: { reviewId: first.id } });

  state.mode = 'refuse';
  const second = await prepare('docs-example-0037');
  await call('POST', '/actions/commit', { id: 'commit-refused', token: T, correlation: 'docs-example-0038', body: { reviewId: second.id, confirmed: true } });
  await call('POST', '/actions/commit', { id: 'commit-refused-again', token: T, correlation: 'docs-example-0039', body: { reviewId: second.id, confirmed: true } });
  state.mode = 'ok';

  const third = await prepare('docs-example-0040');
  await call('POST', '/actions/reconcile', { id: 'reconcile-not-submitted', token: T, correlation: 'docs-example-0041', body: { reviewId: third.id } });
  state.title = 'Different terms';
  await call('POST', '/actions/commit', { id: 'commit-review-changed', token: T, correlation: 'docs-example-0042', body: { reviewId: third.id, confirmed: true } });
  state.title = 'Submit coursework';

  const fourth = await prepare('docs-example-0043');
  vi.setSystemTime(new Date(Date.parse(FIXED) + 11 * 60_000));
  await call('POST', '/actions/commit', { id: 'commit-expired', token: T, correlation: 'docs-example-0044', body: { reviewId: fourth.id, confirmed: true } });
  vi.setSystemTime(new Date(FIXED));

  state.writable = false;
  await call('POST', '/actions/prepare', { id: 'prepare-connection-forbids', token: T, correlation: 'docs-example-0046', body: input });
  state.writable = true;
}

async function intelligenceScenario() {
  const off = makeGateway({ adapters: [] });
  const offCall = exchange('intelligence-off', 'http://127.0.0.1:8787', off, '');
  await offCall('GET', '/v1/intelligence/policy', { id: 'intelligence-unconfigured', token: 'school-a-token', correlation: 'docs-example-0047' });

  const service = createIntelligenceService({
    status: 'configured-sandbox',
    loadPolicy: async () => ({ state: 'sandbox', permittedRoles: ['student'], allowedModes: ['explain'], allowedModels: ['openai:stub'], maxRequestCents: 5, retentionDays: 30 }),
    loadApprovedSources: async (_i, ids) => ids.map((id) => ({ id, evidenceIds: ['e1'], body: 'Sandbox source text', origin: 'institution', policyScope: 'institution' })),
    modelTask: async () => ({ candidates: [{ model: 'openai:stub', provider: 'openai', estimatedCents: 1 }] }),
    generate: async (req) => ({ text: 'A stubbed answer.', citedSourceIds: req.sources.map((s) => s.id), inputTokens: 10, outputTokens: 5, providerRequestId: 'stub-1' }),
    execute: async () => ({ verified: false }),
  });
  const on = makeGateway({ adapters: [], intelligence: service });
  const call = exchange('intelligence-stub', 'http://127.0.0.1:8787', on, '');
  const T = 'school-a-token';
  const request = {
    version: 1, clientState: 'sandbox', tenantId: 'school-a', personId: 'student-a', question: 'What is a derivative?',
    mode: 'explain', category: 'study', sourceIds: ['s1'], evidenceIds: ['e1'],
    proposedActions: [{ id: 'a', label: 'Add a reminder', effect: 'Adds one reminder', target: 'plan', class: 'prepare', reversible: true, evidenceIds: ['e1'] }],
  };
  await call('GET', '/health', { id: 'intelligence-health' });
  await call('GET', '/v1/intelligence/policy', { id: 'intelligence-policy', token: T, correlation: 'docs-example-0048' });
  const answer = await call('POST', '/v1/intelligence/respond', { id: 'intelligence-respond', token: T, correlation: 'docs-example-0049', body: request });
  await call('POST', '/v1/intelligence/respond', { id: 'intelligence-mode-refused', token: T, correlation: 'docs-example-0050', body: { ...request, mode: 'draft' } });
  await call('POST', '/v1/intelligence/respond', { id: 'intelligence-invalid', token: T, correlation: 'docs-example-0051', body: { question: 'hi' } });
  const actionId = (answer.json as { actions: { id: string }[] }).actions[0].id;
  const confirmBody = { confirmed: true, at: FIXED };
  await call('POST', `/v1/intelligence/actions/${actionId}/confirm`, { id: 'intelligence-confirm', token: T, correlation: 'docs-example-0052', body: confirmBody });
  await call('POST', `/v1/intelligence/actions/${actionId}/confirm`, { id: 'intelligence-confirm-again', token: T, correlation: 'docs-example-0053', body: confirmBody });
}

async function scimScenario() {
  const call = scimExchange(scimHarness());
  await call('GET', '/ServiceProviderConfig', { id: 'scim-service-provider-config' });
  await call('GET', '/Users', { id: 'scim-no-credential', auth: null });
  await call('GET', '/Users', { id: 'scim-bad-credential', auth: `Bearer ${SCIM_CREDENTIAL}.${'x'.repeat(43)}` });
  const user = { schemas: [U], externalId: 'ext-1', userName: 'Ada@Example.edu', displayName: 'Ada L', active: true };
  await call('POST', '/Users', { id: 'scim-no-idempotency-key', body: user });
  const created = await call('POST', '/Users', { id: 'scim-create-user', body: user, headers: { 'Idempotency-Key': 'req-0001' } });
  const id = (created.json as { id: string }).id;
  await call('GET', `/Users?filter=${encodeURIComponent('userName eq "ada@example.edu"')}`, { id: 'scim-filter-user' });
  await call('GET', `/Users?filter=${encodeURIComponent('userName co "ada"')}`, { id: 'scim-bad-filter' });
  await call('GET', '/Users?startIndex=1&count=0', { id: 'scim-count-zero' });
  await call('GET', `/Users/${id}`, { id: 'scim-get-user' });
  await call('PATCH', `/Users/${id}`, { id: 'scim-patch-user', headers: { 'Idempotency-Key': 'req-0002' }, body: { schemas: [P], Operations: [{ op: 'replace', path: 'displayName', value: 'Ada Lovelace' }] } });
  await call('PATCH', `/Users/${id}`, { id: 'scim-patch-without-path', headers: { 'Idempotency-Key': 'req-0003' }, body: { schemas: [P], Operations: [{ op: 'replace', value: { active: false } }] } });
  await call('PUT', `/Users/${id}`, { id: 'scim-put-external-id', headers: { 'Idempotency-Key': 'req-0004' }, body: { schemas: [U], externalId: 'ext-2', userName: 'ada@example.edu' } });
  await call('PUT', `/Users/${id}`, { id: 'scim-put-user', headers: { 'Idempotency-Key': 'req-0005' }, body: { schemas: [U], externalId: 'ext-1', userName: 'ada@example.edu', active: false } });
  await call('DELETE', `/Users/${id}`, { id: 'scim-delete-user', headers: { 'Idempotency-Key': 'req-0006' } });
  await call('GET', '/Groups', { id: 'scim-list-groups' });
  await call('PUT', `/Groups/${SCIM_GROUP}`, {
    id: 'scim-put-group', headers: { 'Idempotency-Key': 'req-0007' },
    body: { schemas: [G], displayName: 'Semester students', members: [{ value: id, display: 'ada@example.edu' }] },
  });
  await call('POST', '/Groups', { id: 'scim-group-unmapped', headers: { 'Idempotency-Key': 'req-0008' }, body: { schemas: [G], externalId: 'unmapped', displayName: 'Nope' } });
  await call('DELETE', `/Groups/${SCIM_GROUP}`, { id: 'scim-delete-group', headers: { 'Idempotency-Key': 'req-0009' } });
  await call('GET', '/Users/does-not-exist', { id: 'scim-user-not-found' });
  await call('POST', '/Bulk', { id: 'scim-bulk-not-implemented', headers: { 'Idempotency-Key': 'req-0010' }, body: {} });
  await call('POST', '/Users', { id: 'scim-not-json', headers: { 'Idempotency-Key': 'req-0011' }, raw: '{nope' });
  const limited = scimExchange(scimHarness(() => false));
  await limited('GET', '/Users', { id: 'scim-rate-limited' });
}

/* ── Rendering an example ───────────────────────────────────────────────── */

const reasons: Record<number, string> = { 200: 'OK', 201: 'Created', 204: 'No Content' };

function renderCapture(c: Capture, canon: (s: string) => string): string {
  const url = `${c.display}${c.path}`;
  const parts = [`curl -s${c.method === 'GET' ? '' : ` -X ${c.method}`} '${url}'`];
  // The credential is a shell variable, so that header is double-quoted and the others are not.
  for (const [k, v] of c.headers) parts.push(v.includes('$') ? `  -H "${k}: ${v}"` : `  -H '${k}: ${v}'`);
  if (c.body !== null) parts.push(`  -d '${c.body}'`);
  const request = parts.join(' \\\n');
  const lines = ['**Request**', '', '```bash', canon(request), '```', ''];
  if (c.bodyNote) lines.push(`The request body is ${c.bodyNote.replace(/^\(|\)$/g, '')}.`, '');
  lines.push(`**Response** \`${c.status}\`${reasons[c.status] ? ` ${reasons[c.status]}` : ''}`, '');
  if (c.caption) lines.push(c.caption, '');
  if (c.responseHeaders) {
    lines.push('```http', ...c.responseHeaders.map(([k, v]) => canon(`${k}: ${v}`)), '```', '');
  }
  if (c.responseBody) {
    let pretty = c.responseBody;
    try { pretty = JSON.stringify(JSON.parse(c.responseBody), null, 2); } catch { /* leave as sent */ }
    lines.push('```json', canon(pretty), '```');
  } else {
    lines.push('No body.');
  }
  return lines.join('\n');
}

function renderAll(): Map<string, string> {
  const canonByScenario = new Map<string, (s: string) => string>();
  const forScenario = (name: string) => {
    let canon = canonByScenario.get(name);
    if (!canon) {
      const seen = new Map<string, string>();
      canon = (s: string) => s.replace(UUID_RE, (m) => {
        const key = m.toLowerCase();
        if (!seen.has(key)) seen.set(key, `00000000-0000-4000-8000-${String(seen.size + 1).padStart(12, '0')}`);
        return seen.get(key)!;
      });
      canonByScenario.set(name, canon);
    }
    return canon;
  };
  const out = new Map<string, string>();
  for (const c of captures.values()) out.set(c.id, renderCapture(c, forScenario(c.scenario)));
  return out;
}

const MARKER = /<!-- example:([a-z0-9-]+) -->\n[\s\S]*?<!-- \/example -->/g;

function spliceExamples(md: string, rendered: Map<string, string>): string {
  return md.replace(MARKER, (_all, id: string) => {
    const body = rendered.get(id);
    if (body === undefined) throw new Error(`the page has an example marker "${id}" with no captured call`);
    return `<!-- example:${id} -->\n${body}\n<!-- /example -->`;
  });
}

const markerIds = (md: string): string[] => [...md.matchAll(/<!-- example:([a-z0-9-]+) -->/g)].map((m) => m[1]);

/* ── Setup: run every scenario once, with the clock fixed ───────────────── */

let rendered = new Map<string, string>();

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(FIXED));
  scim = await loadScim();
  await sandboxScenario();
  await readOnlyScenario();
  await rateLimitScenario();
  await fixtureScenario();
  await intelligenceScenario();
  await scimScenario();
  rendered = renderAll();
});

afterAll(() => {
  vi.useRealTimers();
  for (const handle of open.splice(0)) {
    try { handle.close(); } catch { /* already closed */ }
  }
});

/* ── The tests ──────────────────────────────────────────────────────────── */

const gatewayDocs = () => read(PAGES.gateway);
const openApi = () => parseYaml(read(OPENAPI));

describe('the reference pages', () => {
  it('exist, open with the card, and say who should stop reading', () => {
    for (const file of PAGE_FILES) {
      expect(existsSync(at(file)), file).toBe(true);
      const lines = read(file).split('\n');
      expect(lines[0], file).toMatch(/^# \S/);
      expect(lines[1], file).toBe('');
      expect(lines[2], `${file} card`).toMatch(CARD);
      expect(lines[2]).toContain(`\`${TEST}\``);
      expect(lines[3]).toBe('');
      expect(lines[4], `${file} purpose sentence`).toMatch(/stop reading/i);
    }
  });

  it('carry a Status line that is not LIVE, because the gateway is not (pages whose subject is not live)', () => {
    for (const file of [PAGES.gateway, PAGES.scim]) {
      expect(read(file), file).toMatch(/^\*\*Status:\*\* (MOCK_DEMO|IMPLEMENTED_NOT_RELEASED)\b/m);
    }
    expect(read(PAGES.gateway)).toMatch(/^\*\*Status:\*\* MOCK_DEMO/m);
    expect(read(PAGES.scim)).toMatch(/^\*\*Status:\*\* IMPLEMENTED_NOT_RELEASED/m);
  });

  it('make no claim the registers do not make, and use no softening words', () => {
    const banned = /\b(compliant|compliance|certified|certification|FERPA|COPPA|GDPR|SOC ?2|HECVAT|WCAG)\b|replaces your (SIS|LMS)|\b(simply|just|easily)\b/i;
    for (const file of [...PAGE_FILES, OPENAPI]) expect(read(file).match(banned)?.[0] ?? null, file).toBeNull();
    // control: the pattern does catch what it is for
    expect(banned.test('This is FERPA compliant.')).toBe(true);
    expect(banned.test('You can just call it.')).toBe(true);
    expect(banned.test('The gateway refuses the request.')).toBe(false);
  });

  it('link only to files that exist', () => {
    const dead: string[] = [];
    for (const file of PAGE_FILES) {
      const prose = read(file).replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
      for (const m of prose.matchAll(/(?<!!)\[[^\]]*\]\(([^)\s]+)\)/g)) {
        if (/^(https?:|mailto:|#)/.test(m[1])) continue;
        const target = normalize(join(dirname(file), decodeURI(m[1].split('#')[0])));
        if (m[1].split('#')[0] && !existsSync(at(target))) dead.push(`${file} -> ${m[1]}`);
      }
    }
    expect(dead).toEqual([]);
  });
});

describe('the route set', () => {
  const gatewayUniverse = [
    '/health/live', '/health', '/health/ready', '/v1/auth/config', '/status', '/records',
    '/actions/prepare', '/actions/commit', '/actions/reconcile',
    '/v1/intelligence/policy', '/v1/intelligence/respond', '/v1/intelligence/actions/abc/confirm',
    // decoys: near misses that must not route
    '/', '/actions', '/actions/prepare/', '/actions/cancel', '/records/1', '/status/', '/health/x', '/healthz',
    '/v1', '/v1/auth', '/v1/intelligence', '/v1/intelligence/actions', '/v1/intelligence/actions/abc',
    '/v1/intelligence/actions/abc/cancel', '/v1/intelligence/actions//confirm', '/scim/v2/Users', '/api/institution/status',
  ];

  async function discoverGateway(): Promise<string[]> {
    const handle = sandboxGateway();
    const found: string[] = [];
    for (const path of gatewayUniverse) {
      for (const method of ['GET', 'POST']) {
        const response = await handle(new Request(`http://gateway.test${path}`, {
          method,
          headers: { authorization: 'Bearer student-token', 'content-type': 'application/json' },
          body: method === 'POST' ? '{}' : undefined,
        }));
        const body = await response.json() as { error?: { code?: string }; message?: string };
        const fallthrough = response.status === 404 && body.error?.code === 'not_found' && body.message === 'Endpoint not found.';
        if (!fallthrough) found.push(`${method} ${path.replace('/abc/', '/{id}/')}`);
      }
    }
    return found.sort();
  }

  async function discoverScim(): Promise<string[]> {
    const call = scimExchange(scimHarness());
    const universe = ['/ServiceProviderConfig', '/Schemas', '/ResourceTypes', '/Users', '/Users/abc', '/Groups', '/Groups/abc',
      '/', '/Users/', '/Users/a/b', '/Groups/a/b', '/Bulk', '/Me', '/ServiceProviderConfigs', '/Schemas/abc', '/ResourceTypes/User'];
    const found: string[] = [];
    for (const path of universe) {
      for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
        const reply = await call(method, path, { body: {}, headers: { 'Idempotency-Key': 'probe' } });
        const unrouted = reply.status === 404 && (reply.json as { detail?: string }).detail === 'SCIM endpoint not found.';
        if (!unrouted) found.push(`${method} ${path.replace('/abc', '/{id}')}`);
      }
    }
    return found.sort();
  }

  const scimPrefix = (rows: string[]) => rows.map((r) => r.replace(' /', ' /scim/v2/').replace('/scim/v2//', '/scim/v2/'));

  it('is the same in the source text, the live handler, the OpenAPI file and both route tables', async () => {
    const spec = openApiOperations(openApi());
    const gatewaySpec = spec.filter((r) => !r.includes(' /scim/v2/'));
    const scimSpec = spec.filter((r) => r.includes(' /scim/v2/'));
    expect(gatewaySpec).toHaveLength(12);
    expect(scimSpec).toHaveLength(15);

    // 1. discovered by driving the real handlers
    expect(await discoverGateway()).toEqual(gatewaySpec);
    expect(scimPrefix(await discoverScim())).toEqual(scimSpec);

    // 2. read out of the source text
    const gatewaySource = stripComments(read(SRC.gateway));
    const paths = new Set([...gatewaySource.matchAll(/path === '(\/[^']+)'/g)].map((m) => m[1]));
    for (const m of gatewaySource.matchAll(/const ACTIONS = \[([^\]]*)\]/g)) for (const p of m[1].matchAll(/'([^']+)'/g)) paths.add(p[1]);
    if (gatewaySource.includes('v1\\/intelligence\\/actions\\/([^/]+)\\/confirm$')) paths.add('/v1/intelligence/actions/{id}/confirm');
    expect([...paths].sort()).toEqual([...new Set(gatewaySpec.map((r) => r.split(' ')[1]))].sort());

    const scimSource = stripComments(read(SRC.scim));
    const scimRoutes = [...scimSource.matchAll(/request\.method === '([A-Z]+)' && (?:path === '(\/\w+)'|(userId)|(groupId))/g)]
      .map((m) => `${m[1]} /scim/v2${m[2] ?? (m[3] ? '/Users/{id}' : '/Groups/{id}')}`);
    expect([...new Set(scimRoutes)].sort()).toEqual(scimSpec);

    // 3. the tables in the pages
    expect(routeRows(gatewayDocs())).toEqual(spec);
    expect(routeRows(read(PAGES.scim))).toEqual(scimSpec);
  });

  it('answers OPTIONS on any path with 204, and every other method with 405 (documented behaviour)', async () => {
    const handle = sandboxGateway();
    for (const path of ['/status', '/nope']) {
      expect((await handle(new Request(`http://gateway.test${path}`, { method: 'OPTIONS' }))).status).toBe(204);
      for (const method of ['PUT', 'PATCH', 'DELETE', 'HEAD']) {
        const response = await handle(new Request(`http://gateway.test${path}`, { method }));
        expect(response.status, `${method} ${path}`).toBe(405);
      }
    }
    expect(gatewayDocs()).toContain('OPTIONS');
  });

  it('would notice a route that is missing from, or extra in, a table (control)', () => {
    const rows = routeRows(gatewayDocs());
    const without = rows.filter((r) => r !== 'GET /status');
    expect(without).not.toEqual(openApiOperations(openApi()));
    expect(routeRows('| GET | `/x` | none |\n| TRACE | `/y` | none |')).toEqual(['GET /x']);
  });
});

describe('the OpenAPI file', () => {
  it('parses and is structurally sound', () => {
    expect(validateOpenApi(openApi())).toEqual([]);
  });

  it('would notice each kind of defect it claims to check (controls)', () => {
    const base = [
      'openapi: 3.1.0', 'info:', '  title: t', '  version: 1x', 'paths:', '  /a/{id}:', '    get:', '      operationId: a',
      '      parameters:', '        - name: id', '          in: path', '          required: true', '          schema:',
      '            type: string', '      responses:', "        '200':", '          description: ok', '          content:',
      '            application/json:', '              schema:', "                $ref: '#/components/schemas/S'",
      'components:', '  schemas:', '    S:', '      type: object', '  responses:', '    R:', '      description: r', '',
    ].join('\n');
    const parsed = (patch: (s: string) => string) => parseYaml(patch(base));
    expect(validateOpenApi(parsed((s) => s))).toEqual([]);
    expect(validateOpenApi(parsed((s) => s.replace('schemas/S', 'schemas/Missing'))).join()).toContain('dangling $ref');
    expect(validateOpenApi(parsed((s) => s.replace("$ref: '#/components/schemas/S'", "$ref: '#/components/responses/R'"))).join()).toContain('wrong kind');
    expect(validateOpenApi(parsed((s) => s.replace('in: path', 'in: query'))).join()).toContain('path parameter {id} is not declared');
    expect(validateOpenApi(parsed((s) => s.replace('      operationId: a\n', ''))).join()).toContain('operationId is required');
    expect(validateOpenApi(parsed((s) => s.replace('openapi: 3.1.0', 'openapi: 3.0.3'))).join()).toContain('3.1');
    expect(validateOpenApi(parsed((s) => s.replace('  /a/{id}:', '  /a/{id}:\n    get2: {}')))).not.toEqual([]);
  });

  it('is read by a reader that handles the subset it is written in (controls)', () => {
    expect(parseYaml("a:\n  - b: 1\n    c: 'x''y'\n  - d\nl: [one, 'two, three', true]\ne: {}\n")).toEqual({
      a: [{ b: 1, c: "x'y" }, 'd'], l: ['one', 'two, three', true], e: {},
    });
    expect(() => parseYaml('a: 1\na: 2\n')).toThrow(/duplicate/);
    expect(() => parseYaml('a: {b: 1}\n')).toThrow(/outside the subset/);
  });

  it('lists the same areas and roles as the contract', () => {
    const schemas = ((openApi() as Obj).components as Obj).schemas as Obj;
    expect((schemas.UniversityArea as Obj).enum).toEqual(UNIVERSITY_AREAS.map(([id]) => id));
    expect((schemas.UniversityRole as Obj).enum).toEqual([...UNIVERSITY_ROLES]);
  });

  it('documents an error envelope with the fields the code writes', async () => {
    const schemas = ((openApi() as Obj).components as Obj).schemas as Obj;
    const envelope = schemas.ErrorEnvelope as Obj;
    expect(Object.keys(envelope.properties as Obj).sort()).toEqual(['error', 'message']);
    const inner = (envelope.properties as Obj).error as Obj;
    expect(Object.keys(inner.properties as Obj).sort()).toEqual(['code', 'correlation_id', 'message', 'retryable', 'user_action']);
    const reply = await exchange('probe', '', sandboxGateway(), '')('GET', '/status', {});
    const body = reply.json as { error: Json; message: string };
    expect(Object.keys(body).sort()).toEqual(['error', 'message']);
    expect(Object.keys(body.error).sort()).toEqual(['code', 'correlation_id', 'message', 'retryable']);
  });
});

describe('the error vocabulary', () => {
  const errors = () => read(PAGES.errors);
  const rows = (md: string) => [...md.matchAll(/^\| `([a-z_-]+)` \| ([0-9, ]+) \| (yes|no) \|/gm)]
    .map((m) => ({ code: m[1], statuses: m[2].split(',').map((s) => Number(s.trim())).sort(), emitted: m[3] === 'yes' }));

  it('lists every envelope code the gateway source can emit, with its statuses, and nothing else', () => {
    const source = envelopeCodes(read(SRC.gateway));
    expect(source.unmapped, 'a fail() status with no CODE_BY_STATUS entry would be reported as "error"').toEqual([]);
    const documented = rows(section(errors(), '## Envelope codes'));
    const expected = [
      ...[...source.byCode.entries()].map(([code, statuses]) => ({ code, statuses: [...statuses].sort(), emitted: true })),
    ];
    const byStatus = /const CODE_BY_STATUS[^=]*=\s*\{([^}]*)\}/.exec(stripComments(read(SRC.gateway)))?.[1] ?? '';
    for (const code of source.declaredOnly) {
      const status = Number(new RegExp(`(\\d{3}):\\s*'${code}'`).exec(byStatus)?.[1]);
      expected.push({ code, statuses: [status], emitted: false });
    }
    const sortBy = (a: { code: string }, b: { code: string }) => a.code.localeCompare(b.code);
    expect(documented.sort(sortBy)).toEqual(expected.sort(sortBy));
    // control: a handful the brief names, so an empty extraction cannot pass
    for (const code of ['invalid_request', 'record_changed', 'review_expired', 'outcome_uncertain', 'read_only', 'rate_limited']) {
      expect(documented.map((r) => r.code)).toContain(code);
    }
    expect(source.declaredOnly).toContain('expired');
  });

  it('lists every code the intelligence service can return, with its status', () => {
    const source = intelligenceCodes(read(SRC.intelligence));
    const documented = rows(section(errors(), '## Intelligence codes'));
    const expected = [...source.entries()].map(([code, statuses]) => ({ code, statuses: [...statuses].sort(), emitted: true }));
    const sortBy = (a: { code: string }, b: { code: string }) => a.code.localeCompare(b.code);
    expect(documented.sort(sortBy)).toEqual(expected.sort(sortBy));
    expect(source.size).toBeGreaterThanOrEqual(20);
  });

  it('lists every SCIM detail sentence and the flat entry-level bodies', () => {
    const scim = section(errors(), '## SCIM error details');
    const details = scimDetails();
    const missing = details.fixed.filter((d) => !scim.includes(d));
    expect(missing).toEqual([]);
    for (const prefix of details.prefixes) expect(scim, prefix).toContain(prefix);
    expect(details.fixed.length).toBeGreaterThanOrEqual(25);
    const entry = section(errors(), '## Errors outside the envelope');
    for (const file of [SRC.entry, SRC.start]) {
      for (const m of read(file).matchAll(/JSON\.stringify\(\{ error: '([^']+)' \}\)/g)) expect(entry, m[1]).toContain(m[1]);
    }
  });

  it('would notice a code that is documented but not emitted, or emitted but not documented (control)', () => {
    const fake = "const CODE_BY_STATUS: Record<number, string> = { 400: 'a_b', 410: 'gone' };\nfail(400, 'x');\nfail(409, 'y', 'special');\nrefuse(503, 'down', 'm');";
    const found = envelopeCodes(fake);
    expect([...found.byCode.keys()].sort()).toEqual(['a_b', 'down', 'special']);
    expect(found.declaredOnly).toEqual(['gone']);
    expect(rows('| `a_b` | 400 | yes | x |')).toEqual([{ code: 'a_b', statuses: [400], emitted: true }]);
  });
});

describe('the constants a reader would copy', () => {
  const n = (value: number) => value.toLocaleString('en-US');
  const src = (file: string) => stripComments(read(file));

  it('limits and timeouts match the source', () => {
    const auth = read(PAGES.auth);
    expect(MAX_BODY).toBe(128_000);
    expect(auth).toContain(`${n(MAX_BODY)} bytes`);
    expect(/const MAX_BODY = ([\d_]+)/.exec(src(SRC.scim))?.[1].replace(/_/g, '')).toBe(String(MAX_BODY));
    expect(DEFAULT_RATE_LIMIT).toEqual({ windowMs: 60_000, max: 60 });
    expect(auth).toContain(`${DEFAULT_RATE_LIMIT.max} requests per ${DEFAULT_RATE_LIMIT.windowMs / 1000} seconds`);
    const review = Number(/const REVIEW_MINUTES = (\d+)/.exec(src(SRC.gateway))?.[1]);
    expect(review).toBe(10);
    expect(read(PAGES.gateway)).toContain(`${review} minutes`);
    const adapterMs = Number(/AbortSignal\.timeout\(([\d_]+)\)/.exec(src(SRC.gateway))?.[1].replace(/_/g, ''));
    expect(auth).toContain(`${adapterMs / 1000} seconds`);
    expect(auth).toContain(`\`${CORRELATION_ID_PATTERN.source}\``);
    const vercel = JSON.parse(read(SRC.vercel)) as { functions: Record<string, { maxDuration: number }> };
    expect(auth).toContain(`${vercel.functions['api/institution/[...path].ts'].maxDuration} seconds`);
    expect(/requestTimeout = ([\d_]+)/.exec(src(SRC.start))?.[1].replace(/_/g, '')).toBe('30000');
    expect(/headersTimeout = ([\d_]+)/.exec(src(SRC.start))?.[1].replace(/_/g, '')).toBe('10000');
    expect(auth).toContain('requestTimeout');
    expect(/SEMESTER_GATEWAY_PORT \|\| (\d+)/.exec(src(SRC.start))?.[1]).toBe('8787');
    expect(auth).toContain('8787');
    expect(/Math\.min\(rawCount, (\d+)\)/.exec(src(SRC.scim))?.[1]).toBe('200');
    expect(/\?\? '(\d+)'\);\s*\n\s*const startIndex/.exec(src(SRC.scim))?.[1] ?? '100').toBe('100');
    expect(read(PAGES.scim)).toContain('at most 200');
  });

  it('every environment variable the entry points read is listed, and every one listed is read', () => {
    const readBy = new Set<string>();
    for (const file of [SRC.runtime, SRC.start, SRC.scimRoute, SRC.entry]) {
      for (const m of src(file).matchAll(/\benv\.([A-Z][A-Z0-9_]+)/g)) readBy.add(m[1]);
    }
    const listed = new Set([...section(read(PAGES.auth), '## Environment variables').matchAll(/^\| `([A-Z][A-Z0-9_]+)` \|/gm)].map((m) => m[1]));
    expect([...listed].sort()).toEqual([...readBy].sort());
    expect(readBy.size).toBeGreaterThanOrEqual(25);
    expect(readBy.has('SEMESTER_READ_ONLY')).toBe(true);
    expect(readBy.has('SEMESTER_SCIM')).toBe(true);
  });

  it('action, search and cursor bounds match the contract and the gateway', () => {
    const contract = stripComments(read('packages/institution/src/index.ts'));
    expect(contract).toMatch(/x\.length > 0 && x\.length <= 200/);
    expect(contract).toMatch(/\^\[a-zA-Z\]\[a-zA-Z0-9_-\]\{0,63\}\$/);
    expect(contract).toMatch(/x\.length > 20000/);
    expect(contract).toMatch(/entries\.length > 30/);
    const gatewaySource = src(SRC.gateway);
    expect(gatewaySource).toMatch(/\.slice\(0, 200\)/);
    expect(gatewaySource).toMatch(/\.slice\(0, 500\)/);
    const doc = read(PAGES.gateway);
    for (const phrase of ['1 to 200 characters', 'At most 30 entries', '20000 characters', 'cut to 200 characters', 'cut to 500 characters']) {
      expect(doc, phrase).toContain(phrase);
    }
  });

  it('retryable is true for exactly 429 and 503, and a 429 sends no Retry-After', async () => {
    // The rule moved into `@semester/platform` when the gateway adopted its error envelope: the gateway builds a
    // `PlatformError` and the envelope reads `retryable` from it, so that getter is where "429 and 503 only" is held.
    expect(src('packages/platform/src/gateway/errors.ts')).toMatch(/get retryable\(\): boolean \{\s*return this\.status === 429 \|\| this\.status === 503;\s*\}/);
    const limited = sandboxGateway({ rateLimiter: { allow: () => false } });
    const reply = await exchange('probe', '', limited, '')('GET', '/status', { token: 'student-token' });
    expect(reply.status).toBe(429);
    expect((reply.json as { error: { retryable: boolean } }).error.retryable).toBe(true);
    expect([...reply.headers.keys()].some((k) => /retry-after|ratelimit/i.test(k))).toBe(false);
    expect(read(PAGES.auth)).toContain('sends no `Retry-After` header');
    expect(read(PAGES.errors)).toContain('`true` only for statuses 429 and 503');
  });

  it('records which entry point honours which switch, so the page cannot say otherwise', () => {
    // Read-only mode, SCIM and telemetry are wired in exactly one entry point each.
    expect(src(SRC.start)).toMatch(/readOnly:/);
    expect(src(SRC.runtime)).not.toMatch(/readOnly/);
    expect(src(SRC.runtime)).toMatch(/withScim\(/);
    expect(src(SRC.start)).not.toMatch(/scim/i);
    expect(src(SRC.runtime)).toMatch(/telemetry:/);
    expect(src(SRC.start)).not.toMatch(/telemetry:/);
    // The sandbox is installed by start.ts only, and both entry points re-check the token at commit.
    expect(src(SRC.runtime)).not.toMatch(/sandbox\.ts|sandboxAdapters|SEMESTER_SANDBOX/);
    expect(src(SRC.start)).toMatch(/sandboxAdapters\(/);
    expect(src(SRC.start)).toMatch(/\(process\.env\.SEMESTER_READ_ONLY \|\| ''\)\.trim\(\)\.toLowerCase\(\) === 'on'/);
    expect(src(SRC.runtime)).toMatch(/refreshIdentity:/);
    expect(src(SRC.start)).toMatch(/refreshIdentity:/);
    const auth = read(PAGES.auth);
    expect(auth).toMatch(/Read-only mode is wired only into `start\.ts`/);
    expect(read(PAGES.scim)).toMatch(/`start\.ts` does not mount SCIM/);
  });

  it('the shipped adapter registry is empty and the Vercel runtime then reports unavailable unless told otherwise', async () => {
    expect(shippedAdapters).toEqual([]);
    expect(src(SRC.runtime)).toMatch(/SEMESTER_MINIMUM_ADAPTERS \|\| '1'/);
    const journal = { healthy: () => true, retentionHealthy: () => true } as never;
    const base = { journal, monitoringConfigured: true, integrationsHealthy: true, intelligenceStatus: 'policy-disabled' as const };
    expect((await institutionReadiness({ ...base, adaptersInstalled: 0, minimumAdapters: 1 })).ready).toBe(false);
    expect((await institutionReadiness({ ...base, adaptersInstalled: 0, minimumAdapters: 0 })).ready).toBe(true);
    expect(read(PAGES.gateway)).toContain('SEMESTER_MINIMUM_ADAPTERS=0');
  });

  it('the service areas, roles and sandbox coverage tables match the contract and the sandbox', () => {
    const table = section(gatewayDocs(), '## Service areas');
    const sandbox = new Set(sandboxAdapters(new SandboxStore(':memory:')).map((a) => a.area));
    const documented = [...table.matchAll(/^\| `([a-z]+)` \| ([^|]+) \| (yes|no) \|/gm)].map((m) => [m[1], m[2].trim(), m[3]]);
    expect(documented).toEqual(UNIVERSITY_AREAS.map(([id, label]) => [id, label, sandbox.has(id) ? 'yes' : 'no']));
    expect(documented).toHaveLength(37);
    expect(sandbox.size).toBe(16);
    const roles = [...section(gatewayDocs(), '## Roles').matchAll(/^\| `([a-z_]+)` \|/gm)].map((m) => m[1]);
    expect(roles).toEqual([...UNIVERSITY_ROLES]);
  });

  it('telemetry routes and audit events match the source', () => {
    const gatewaySource = src(SRC.gateway);
    const set = /const TELEMETRY_ROUTES = new Set\(\[([^\]]*)\]\)/.exec(gatewaySource)?.[1] ?? '';
    const routes = [...set.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(routes).toHaveLength(11);
    const doc = section(read(PAGES.auth), '## Telemetry and audit');
    for (const route of [...routes, '/v1/intelligence/actions/:id/confirm', '/unmatched']) expect(doc, route).toContain(`\`${route}\``);
    const events = new Set([...gatewaySource.matchAll(/audit\(who, [^,]+, '([a-z.]+)'/g)].map((m) => m[1]));
    expect(events.size).toBe(7);
    for (const event of events) expect(doc, event).toContain(`\`${event}\``);
    expect(src(SRC.journal)).toContain('correlation_id');
  });
});

describe('the examples', () => {
  const pages = () => PAGE_FILES.map((file) => ({ file, text: read(file) }));

  it('every captured call is placed in exactly one page, and every marker has a call', () => {
    const placed = pages().flatMap((p) => markerIds(p.text));
    expect(new Set(placed).size, 'a marker is used twice').toBe(placed.length);
    expect([...new Set(placed)].sort()).toEqual([...rendered.keys()].sort());
    expect(rendered.size).toBeGreaterThanOrEqual(60);
  });

  it('are what the handlers answer now (REGISTERS=write rewrites them)', () => {
    for (const { file, text } of pages()) {
      const next = spliceExamples(text, rendered);
      if (WRITE) { if (next !== text) writeFileSync(at(file), next); continue; }
      expect(next, `${file} is stale: run REGISTERS=write npx vitest run src/lib/docs/gateway-reference.test.ts from app/`).toBe(text);
    }
  });

  it('are deterministic: a second run of the sandbox scenario renders the same text (control)', async () => {
    const before = new Map(rendered);
    captures.clear();
    await sandboxScenario();
    await readOnlyScenario();
    await rateLimitScenario();
    await fixtureScenario();
    await intelligenceScenario();
    await scimScenario();
    expect(renderAll()).toEqual(before);
  });

  it('every enveloped example carries retryable for 429 and 503 only, and echoes the correlation id sent', () => {
    let checked = 0;
    for (const c of captures.values()) {
      let body: { error?: { retryable?: boolean; correlation_id?: string; code?: string } } | null = null;
      try { body = JSON.parse(c.responseBody); } catch { continue; }
      if (!body || typeof body.error !== 'object' || typeof body.error?.code !== 'string' || c.scenario === 'scim') continue;
      checked++;
      expect(body.error.retryable, `${c.id} ${c.status}`).toBe(c.status === 429 || c.status === 503);
      const sent = c.headers.find(([k]) => k === 'X-Correlation-Id')?.[1];
      if (sent) expect(body.error.correlation_id, c.id).toBe(sent);
    }
    expect(checked).toBeGreaterThanOrEqual(25);
  });

  it('show the sandbox as the sandbox: every sandbox record says SANDBOX', () => {
    const records = rendered.get('records-courses') ?? '';
    expect(records).toContain('SANDBOX');
    expect(rendered.get('status') ?? '').toContain(SANDBOX_NAME);
  });
});
