/**
 * The ecosystem coverage matrix: every prototype route and every design-registry
 * capability, held against repository evidence.
 *
 * Three inputs, none of them this file's opinion:
 *
 * - `docs/handoff/prototype/screens.json` — the 281 routes of the design
 *   project's interactive prototype, the acceptance reference (`handoff/BUILD.md`
 *   §4). It is the list of things that must exist; it says nothing about
 *   whether they do.
 * - `docs/handoff/registry/capabilities.json` — the design side's 122
 *   capabilities. Its `status` block reports design facts only
 *   (`REPO-CROSSWALK.md`: "The agent's Phase 0 writes `docs/registry-status.json`
 *   with these seven levels from repo evidence"). This is that Phase 0.
 * - `docs/ecosystem/crosswalk.json` — the curated map from each route to the
 *   repository: screens, modules, server code, migrations, tests, flags. Every
 *   path it cites must exist; `build` refuses one that does not, because a
 *   matrix that cites a file nobody can open is the failure mode the 00-stream
 *   audit was written to avoid.
 *
 * The status ladder is `REPO-CROSSWALK.md`'s: specified → schema-present →
 * code-present → connected → tested → deployed → operational. A route reaches
 * `deployed` only when its schema is in the applied-migration listing *and*
 * the app build it lives in has been seen running; neither is inferred from a
 * green build. "Presence is not completion."
 *
 * Pure: reads what it is handed and a path-exists probe. The test regenerates
 * the committed outputs and fails on any difference, so the matrix cannot
 * drift from the crosswalk, and the crosswalk cannot cite a path that moved.
 */

export const LADDER = ['specified', 'schema-present', 'code-present', 'connected', 'tested', 'deployed', 'operational'] as const;
export type Status = (typeof LADDER)[number];

/** The vocabulary the coverage programme asks for, beside the repository's ladder. */
export const PROGRAMME_WORD: Record<Status, string> = {
  specified: 'specified',
  'schema-present': 'in progress',
  'code-present': 'in progress',
  connected: 'implemented',
  tested: 'verified',
  deployed: 'deployed',
  operational: 'deployed',
};

export interface PrototypeRoute {
  ws: string;
  wsLabel: string;
  key: string;
  label: string;
  route: string;
  component: string;
  file: string;
  navFile: string;
  stream: string;
}

export interface Evidence {
  route: string;
  status: Status;
  roles: string[];
  screens: string[];
  modules: string[];
  server: string[];
  migrations: string[];
  tests: string[];
  flags: string[];
  note: string;
  gap: string;
}

export interface Crosswalk {
  generated: string;
  method: string;
  routes: Record<string, Omit<Evidence, 'route'>>;
  /** Design-registry capability id → the prototype routes that carry it, when one does. */
  capabilities?: Record<string, { routes?: string[]; note?: string }>;
}

export interface Capability {
  id: string;
  ws: string;
  area: string;
  routes: string[];
  actors: string[];
  perms: string[];
  records: { table: string; exists: boolean }[];
  commands: { name: string; exists: boolean }[];
  events: string[];
  screens: string[];
  design: string | null;
  designMissing: string | null;
  status: Record<string, boolean | null>;
}

export interface Deployed {
  supabase: { project: string; listedAt: string; method: string; migrations: string[] };
  app: { verified: boolean; status: string };
}

/**
 * Which Semester operating system each prototype workspace belongs to
 * (`handoff/PHASES.md`, "One super OS, three layers"), who owns its records,
 * and the role that leads it (`REPO-CROSSWALK.md`, role workspaces table).
 */
export interface WorkspaceInfo { system: string; ownership: string; role: string }
export const WORKSPACES: Record<string, WorkspaceInfo> = {
  public: { system: 'Student / Education OS', ownership: 'Semester company (public content)', role: 'visitor, prospect' },
  applicant: { system: 'Student / Education OS', ownership: 'Student-owned, institution-verified', role: 'applicant, admitted student' },
  student: { system: 'Student / Education OS', ownership: 'Student-owned device and account data; institution records read-only', role: 'student' },
  family: { system: 'Student / Education OS', ownership: 'Student-delegated, expiring grants', role: 'family delegate' },
  alumni: { system: 'Student / Education OS', ownership: 'Lifelong personal account; institution-issued credentials', role: 'alumni' },
  success: { system: 'Student / Education OS', ownership: 'Student-owned plan; advisor reads by grant', role: 'student, advisor' },
  clubs: { system: 'Student / Education OS', ownership: 'Organization-owned, institution-verified', role: 'club officer, member' },
  faculty: { system: 'Institution OS', ownership: 'Tenant (institution) records; LMS stays authoritative', role: 'instructor' },
  ta: { system: 'Institution OS', ownership: 'Tenant records, assignment-scoped', role: 'teaching assistant' },
  advisor: { system: 'Institution OS', ownership: 'Tenant records, caseload-scoped', role: 'academic advisor' },
  institution: { system: 'Institution OS', ownership: 'Tenant control plane', role: 'registrar, office staff, institution admin' },
  admissions: { system: 'Institution OS', ownership: 'Tenant records', role: 'admissions staff' },
  career: { system: 'Institution OS', ownership: 'Tenant records; employer postings reviewed', role: 'career services staff' },
  campus: { system: 'Institution OS', ownership: 'Tenant records; campus systems authoritative', role: 'housing and dining staff' },
  finops: { system: 'Institution OS', ownership: 'Tenant records; Banner Finance is the ledger of record', role: 'student accounts and aid officers' },
  support: { system: 'Institution OS', ownership: 'Team-owned cases', role: 'support, wellbeing and housing staff' },
  insights: { system: 'Business OS (campus leadership)', ownership: 'Aggregates only; groups under 10 suppressed', role: 'leaders, analysts' },
  marketplace: { system: 'Semester company and partners', ownership: 'Semester company moderation', role: 'marketplace moderator' },
  trust: { system: 'Institution OS', ownership: 'Tenant security and privacy office', role: 'security and privacy officer' },
  employer: { system: 'Semester company and partners', ownership: 'Partner-owned postings, career office review', role: 'employer, partner' },
  company: { system: 'Semester company and partners', ownership: 'Semester company; never reads student tables', role: 'Semester business roles' },
  operations: { system: 'Semester company and partners', ownership: 'Semester platform operations; grant-scoped tenant access', role: 'platform operator' },
  os: { system: 'Semester company and partners', ownership: 'Design project evidence register (programme-level)', role: 'founder, programme' },
  executive: { system: 'Business OS (campus leadership)', ownership: 'Aggregates; decision records', role: 'executive' },
  social: { system: 'Student / Education OS', ownership: 'Student-owned; kept apart from education records', role: 'student, moderator' },
  studio: { system: 'Student / Education OS', ownership: 'Student-owned private work; separate from official records', role: 'student, faculty' },
};

/**
 * The design registry groups its 122 capabilities by its own eight workspaces, which
 * are not the prototype's 26. This says which operating system and lead role each one is.
 */
export const CAPABILITY_WORKSPACES: Record<string, WorkspaceInfo> = {
  public: WORKSPACES.public!,
  shared: { system: 'Shared platform (all operating systems)', ownership: 'Platform-owned; tenant-scoped rows', role: 'every role' },
  edu: WORKSPACES.student!,
  inst: WORKSPACES.institution!,
  acct: { system: 'Semester company and partners', ownership: 'Customer (institution) account with Semester', role: 'institution billing contact, business admin' },
  company: WORKSPACES.company!,
  ops: WORKSPACES.operations!,
  dev: { system: 'Semester company and partners', ownership: 'Partner developers; scoped installs', role: 'partner developer' },
};

/** Build streams (`handoff/execute/00-INDEX.md`), with the external dependencies and human-only gates each carries. */
export interface StreamInfo { name: string; integrations: string[]; humanOnly: string[] }
export const STREAMS: Record<string, StreamInfo> = {
  '00': { name: 'Repo audit and design-system sync', integrations: [], humanOnly: ['design-system baseline approval'] },
  '01': { name: 'Database, tenancy, RLS and core logic', integrations: ['Supabase Postgres'], humanOnly: [] },
  '02': { name: 'Identity, SAML SSO, onboarding', integrations: ['Supabase Auth SAML', 'SCIM'], humanOnly: ['institution IdP metadata and test accounts'] },
  '03': { name: 'Student OS', integrations: ['imported catalog and syllabus files'], humanOnly: [] },
  '04': { name: 'Faculty, TA, advisor, registrar, finance, student affairs', integrations: ['LTI 1.3 AGS grade passback'], humanOnly: ['two-person approval roster'] },
  '05': { name: 'Institution console, integrations, migration', integrations: ['SIS', 'LMS', 'OneRoster', 'SCIM'], humanOnly: ['integration credentials per tenant'] },
  '06': { name: 'Governed AI gateway', integrations: ['approved model provider'], humanOnly: ['AI provider choice and data terms'] },
  '07': { name: 'Community, career, family, developer platform', integrations: ['Handshake (read-only)', 'push'], humanOnly: [] },
  '08': { name: 'Operations command center and site operations', integrations: [], humanOnly: [] },
  '09': { name: 'Security, privacy, accessibility, compliance', integrations: [], humanOnly: ['insurance', 'HECVAT', 'attorney review'] },
  '10': { name: 'Pilot launch', integrations: [], humanOnly: ['signed pilot agreement', 'cutover approval'] },
  '11': { name: 'Public site, GTM, run and grow', integrations: ['Stripe'], humanOnly: ['price approval', 'claims approval'] },
  '12': { name: 'One place: nobody leaves Semester', integrations: [], humanOnly: [] },
  '13': { name: 'Platform maturity', integrations: [], humanOnly: [] },
  '14': { name: 'Native platform', integrations: ['app stores'], humanOnly: ['decision that a native client is required'] },
  '15': { name: 'Native finance', integrations: ['payment rails'], humanOnly: ['payment provider and legal model'] },
  '16': { name: 'Native operations', integrations: [], humanOnly: [] },
  '17': { name: 'Web-to-app journey', integrations: [], humanOnly: [] },
  '18': { name: 'Role-system reconciliation', integrations: [], humanOnly: [] },
  '19': { name: 'Gradebook, degree audit, advising, transcripts', integrations: ['SIS', 'LTI AGS'], humanOnly: [] },
  '20': { name: 'Semester Social', integrations: ['media scanning'], humanOnly: [] },
  '21': { name: 'Work Studio and Semester Intelligence', integrations: ['approved model provider'], humanOnly: [] },
  '22': { name: 'FERPA, data flows, vendor controls, AI governance', integrations: [], humanOnly: ['attorney review'] },
  '23': { name: 'Collaboration infrastructure, reliability, migrations', integrations: [], humanOnly: [] },
  '24': { name: 'Shared shell, role resolver, navigation, notifications, mobile', integrations: ['push'], humanOnly: [] },
  '25': { name: 'Completion program', integrations: [], humanOnly: [] },
  '26': { name: 'Faculty OS and Semester Intelligence', integrations: ['approved model provider'], humanOnly: [] },
  '27': { name: 'Executive OS', integrations: [], humanOnly: [] },
  '28': { name: 'Career OS and Interview Studio', integrations: ['Handshake (read-only)', 'Big Interview'], humanOnly: ['activation gates before any write'] },
  '29': { name: 'Semester Account, identity and mail', integrations: ['mail delivery'], humanOnly: ['deliverability gate'] },
  '30': { name: 'Phased build (ordering)', integrations: [], humanOnly: [] },
};

/** The six states every production screen must implement (`handoff/START-HERE.md`). */
export const SIX_STATES = 'default, loading, empty, error, no permission, offline';

export interface Row {
  identifier: string;
  system: string;
  workspace: string;
  module: string;
  role: string;
  screen: string;
  behavior: string;
  data: string;
  permissions: string;
  integrations: string;
  acceptance: string;
  status: string;
  ladder: Status;
  evidence: string;
  deployment: string;
  blockers: string;
}

export const COLUMNS = [
  'Identifier', 'System', 'Workspace', 'Module', 'User role', 'Screen or workflow', 'Required behavior',
  'Data dependencies', 'Permissions', 'Integration dependencies', 'Acceptance criteria', 'Implementation status',
  'Verification evidence', 'Deployment status', 'Blockers',
] as const;

export interface BuildResult { rows: Row[]; problems: string[] }

const EMPTY: Omit<Evidence, 'route'> = {
  status: 'specified', roles: [], screens: [], modules: [], server: [], migrations: [], tests: [], flags: [], note: '', gap: '',
};

const uniq = <T,>(xs: readonly T[]): T[] => [...new Set(xs)];
const list = (xs: readonly string[]): string => (xs.length ? xs.join('; ') : '—');

/** Status an evidence block can honestly claim from what it cites, before the curator's own judgement. */
export function ceiling(e: Omit<Evidence, 'route'>, deployed: Deployed): Status {
  const hasCode = e.screens.length + e.modules.length + e.server.length > 0;
  if (e.status === 'tested' && !e.tests.length) return 'connected';
  if ((e.status === 'connected' || e.status === 'tested') && !hasCode) return e.migrations.length ? 'schema-present' : 'specified';
  if (e.status === 'code-present' && !hasCode) return e.migrations.length ? 'schema-present' : 'specified';
  if (e.status === 'schema-present' && !e.migrations.length) return hasCode ? 'code-present' : 'specified';
  if (e.status === 'deployed' || e.status === 'operational') {
    const applied = new Set(deployed.supabase.migrations);
    const schemaOk = e.migrations.every((m) => applied.has(versionOf(m)));
    if (!deployed.app.verified || !schemaOk || !e.tests.length) return e.tests.length ? 'tested' : 'connected';
  }
  return e.status;
}

export const versionOf = (migrationPath: string): string => migrationPath.replace(/^.*\//, '').replace(/_.*$/, '');

function deploymentText(e: Omit<Evidence, 'route'>, deployed: Deployed): string {
  const parts: string[] = [];
  if (e.migrations.length) {
    const applied = new Set(deployed.supabase.migrations);
    const missing = e.migrations.map(versionOf).filter((v) => !applied.has(v));
    parts.push(missing.length
      ? `schema: ${missing.length} of ${e.migrations.length} cited migration(s) not in the ${deployed.supabase.project} listing (${missing.join(', ')})`
      : `schema: applied on Supabase project ${deployed.supabase.project} (listing ${deployed.supabase.listedAt})`);
  }
  if (e.screens.length + e.modules.length + e.server.length) parts.push(`app: ${deployed.app.status}`);
  return parts.length ? parts.join(' · ') : 'nothing to deploy yet';
}

export function build(
  routes: readonly PrototypeRoute[],
  capabilities: readonly Capability[],
  crosswalk: Crosswalk,
  deployed: Deployed,
  exists: (repoPath: string) => boolean,
): BuildResult {
  const problems: string[] = [];
  const known = new Set(routes.map((r) => r.route));
  for (const route of Object.keys(crosswalk.routes)) {
    if (!known.has(route)) problems.push(`crosswalk names ${route}, which is not a prototype route`);
  }
  const rows: Row[] = [];
  for (const r of routes) {
    const e = { ...EMPTY, ...(crosswalk.routes[r.route] ?? {}) };
    for (const p of [...e.screens, ...e.modules, ...e.server, ...e.migrations, ...e.tests]) {
      if (!exists(p)) problems.push(`${r.route} cites ${p}, which does not exist`);
    }
    if (!LADDER.includes(e.status)) problems.push(`${r.route} has status ${String(e.status)}, not on the ladder`);
    const ladder = ceiling(e, deployed);
    if (ladder !== e.status) problems.push(`${r.route} claims ${e.status} but its evidence supports ${ladder}`);
    const ws = WORKSPACES[r.ws];
    if (!ws) problems.push(`${r.route} is in workspace ${r.ws}, which WORKSPACES does not describe`);
    const stream = STREAMS[r.stream];
    if (!stream) problems.push(`${r.route} names stream ${r.stream}, which STREAMS does not describe`);
    const mapped = Boolean(crosswalk.routes[r.route]);
    const human = stream?.humanOnly ?? [];
    const blockers = [
      ...(mapped ? [] : ['not yet mapped to repository evidence']),
      ...(e.gap ? [e.gap] : []),
      ...(ladder !== 'tested' && ladder !== 'deployed' && ladder !== 'operational' && human.length ? human.map((h) => `human-only: ${h}`) : []),
      ...(!deployed.app.verified && (e.screens.length || e.modules.length) ? ['production app not probed from this session'] : []),
    ];
    rows.push({
      identifier: r.route.replace(/^#\//, ''),
      system: ws?.system ?? '?',
      workspace: `${r.wsLabel} (${r.ws})`,
      module: `${r.stream} · ${stream?.name ?? '?'}`,
      role: uniq([...(e.roles.length ? e.roles : []), ...(ws ? [ws.role] : [])]).join('; '),
      screen: `${r.label} — prototype ${r.component} in ${r.file}`,
      behavior: e.note || `Reproduce the prototype screen ${r.route} (${r.component}) against real data and services.`,
      data: list(e.migrations),
      permissions: list([...(e.roles.length ? [`roles: ${e.roles.join(', ')}`] : []), ...(e.flags.length ? [`flags: ${e.flags.join(', ')}`] : []), 'server-side deny by default; RLS + tenant_id']),
      integrations: list(stream?.integrations ?? []),
      acceptance: `Six states (${SIX_STATES}); server-side authorization with negative tests; behaviour matches ${r.route}; stream ${r.stream} exit gate`,
      status: `${PROGRAMME_WORD[ladder]} (${ladder})`,
      ladder,
      evidence: list([...e.screens.map((p) => `screen ${p}`), ...e.modules.map((p) => `module ${p}`), ...e.server.map((p) => `server ${p}`), ...e.tests.map((p) => `test ${p}`)]),
      deployment: deploymentText(e, deployed),
      blockers: list(blockers),
    });
  }
  const byRoute = new Map(rows.map((row) => [`#/${row.identifier}`, row]));
  for (const c of capabilities) {
    const link = crosswalk.capabilities?.[c.id];
    const carried = (link?.routes ?? []).map((route) => byRoute.get(route)).filter((x): x is Row => Boolean(x));
    for (const route of link?.routes ?? []) if (!byRoute.has(route)) problems.push(`capability ${c.id} names ${route}, which is not a prototype route`);
    const ladder = carried.length ? carried.map((row) => row.ladder).sort((a, b) => LADDER.indexOf(a) - LADDER.indexOf(b))[0]! : 'specified';
    const ws = CAPABILITY_WORKSPACES[c.ws];
    if (!ws) problems.push(`capability ${c.id} is in registry workspace ${c.ws}, which CAPABILITY_WORKSPACES does not describe`);
    rows.push({
      identifier: `capability:${c.id}`,
      system: ws?.system ?? '?',
      workspace: `design registry (${c.ws})`,
      module: c.area,
      role: c.actors.join('; ') || (ws?.role ?? ''),
      screen: `${c.screens.join(', ') || 'capability'} (design routes ${c.routes.join(', ') || '—'})`,
      behavior: link?.note || `Design registry capability ${c.id}: ${c.area}.`,
      data: list(c.records.map((rec) => `${rec.table}${rec.exists ? '' : ' (design: not yet modelled)'}`)),
      permissions: list(c.perms),
      integrations: list(c.events),
      acceptance: `Commands ${c.commands.map((x) => x.name).join(', ') || '—'} exist and are authorized; carried by ${carried.length ? carried.map((row) => row.identifier).join(', ') : 'no prototype route yet'}`,
      status: `${PROGRAMME_WORD[ladder]} (${ladder})`,
      ladder,
      evidence: carried.length ? `via ${carried.map((row) => row.identifier).join(', ')}` : '—',
      deployment: carried.length ? uniq(carried.map((row) => row.deployment)).join(' · ') : 'nothing to deploy yet',
      blockers: carried.length ? uniq(carried.flatMap((row) => row.blockers.split('; '))).filter((b) => b !== '—').join('; ') || '—' : 'not carried by any mapped prototype route',
    });
  }
  return { rows, problems };
}

const cell = (v: string): string => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function toCsv(rows: readonly Row[]): string {
  const lines = [COLUMNS.join(',')];
  for (const r of rows) {
    lines.push([r.identifier, r.system, r.workspace, r.module, r.role, r.screen, r.behavior, r.data, r.permissions, r.integrations, r.acceptance, r.status, r.evidence, r.deployment, r.blockers].map(cell).join(','));
  }
  return `${lines.join('\n')}\n`;
}

export interface Registry {
  generated: string;
  method: string;
  ladder: readonly Status[];
  counts: Record<Status, number>;
  byWorkspace: Record<string, Record<Status, number>>;
  routes: Record<string, { status: Status; evidence: string; deployment: string; blockers: string }>;
  capabilities: Record<string, { status: Status; via: string }>;
}

const zero = (): Record<Status, number> => Object.fromEntries(LADDER.map((s) => [s, 0])) as Record<Status, number>;

export function toRegistry(rows: readonly Row[], crosswalk: Crosswalk): Registry {
  const counts = zero();
  const byWorkspace: Record<string, Record<Status, number>> = {};
  const routes: Registry['routes'] = {};
  const capabilities: Registry['capabilities'] = {};
  for (const r of rows) {
    if (r.identifier.startsWith('capability:')) {
      capabilities[r.identifier.slice('capability:'.length)] = { status: r.ladder, via: r.evidence };
      continue;
    }
    counts[r.ladder] += 1;
    const ws = r.identifier.split('/')[0]!;
    byWorkspace[ws] ??= zero();
    byWorkspace[ws][r.ladder] += 1;
    routes[`#/${r.identifier}`] = { status: r.ladder, evidence: r.evidence, deployment: r.deployment, blockers: r.blockers };
  }
  return { generated: crosswalk.generated, method: crosswalk.method, ladder: LADDER, counts, byWorkspace, routes, capabilities };
}

/** The counts table for `docs/ecosystem/INVENTORY.md`, rewritten between its markers. */
export function countsMarkdown(rows: readonly Row[]): string {
  const reg = toRegistry(rows, { generated: '', method: '', routes: {} });
  const total = Object.values(reg.counts).reduce((a, b) => a + b, 0);
  const head = `| Workspace | ${LADDER.join(' | ')} | total |\n| --- | ${LADDER.map(() => '---:').join(' | ')} | ---: |`;
  const line = (name: string, c: Record<Status, number>) => `| ${name} | ${LADDER.map((s) => c[s]).join(' | ')} | ${Object.values(c).reduce((a, b) => a + b, 0)} |`;
  const body = Object.entries(reg.byWorkspace).map(([ws, c]) => line(ws, c));
  const caps = rows.filter((r) => r.identifier.startsWith('capability:'));
  const capCounts = zero();
  for (const c of caps) capCounts[c.ladder] += 1;
  return [
    `Prototype routes: ${total}. Design-registry capabilities: ${caps.length}.`,
    '',
    head,
    ...body,
    line('**all routes**', reg.counts),
    line('**capabilities**', capCounts),
  ].join('\n');
}

export const MARK_START = '<!-- generated: counts start -->';
export const MARK_END = '<!-- generated: counts end -->';

export function spliceCounts(markdown: string, counts: string): string {
  const a = markdown.indexOf(MARK_START);
  const b = markdown.indexOf(MARK_END);
  if (a < 0 || b < 0 || b < a) throw new Error(`INVENTORY.md needs ${MARK_START} … ${MARK_END}`);
  return `${markdown.slice(0, a + MARK_START.length)}\n${counts}\n${markdown.slice(b)}`;
}
