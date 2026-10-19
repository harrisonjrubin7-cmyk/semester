/**
 * The developer portal's three lifecycles, kept independent as the partner
 * specification requires: application, release, and installation.
 *
 * This module is the transition table and its evidence rule. It decides
 * whether a move is legal and what it must carry. It does not decide who may
 * make the move: the server runs that authorization check first, and nothing
 * here stands in for it.
 *
 * Edges marked "inferred" in docs/developer-portal/PROGRAM.md are choices the
 * specification leaves open. They are listed there as unresolved decisions.
 */

const APPLICATION_STATES = ['draft', 'sandbox-enabled', 'active', 'suspended', 'retired'] as const;
const RELEASE_STATES = ['draft', 'submitted', 'changes-required', 'certified', 'withdrawn'] as const;
const INSTALLATION_STATES = ['requested', 'approved', 'pilot', 'enabled', 'revoked', 'offboarded'] as const;

export type ApplicationState = (typeof APPLICATION_STATES)[number];
export type ReleaseState = (typeof RELEASE_STATES)[number];
export type InstallationState = (typeof INSTALLATION_STATES)[number];

/** One permitted move and the evidence it must carry before it is recorded. */
export interface Edge<S extends string> {
  readonly to: S;
  readonly evidence: readonly string[];
}

/** Every state is a key, so a state missing from a table fails to compile. */
export type Table<S extends string> = { readonly [K in S]: readonly Edge<S>[] };

/** Application: draft → sandbox-enabled → active → suspended → retired. */
export const APPLICATION_EDGES = {
  draft: [{ to: 'sandbox-enabled', evidence: ['sandbox-fixtures'] }],
  'sandbox-enabled': [{ to: 'active', evidence: ['certified-release'] }],
  active: [{ to: 'suspended', evidence: ['reason'] }],
  // Inferred: no path back from suspended. The specification does not say how
  // a suspension is lifted, so reinstatement is left out until it is decided.
  suspended: [{ to: 'retired', evidence: ['export-and-uninstall-instructions'] }],
  retired: [],
} as const satisfies Table<ApplicationState>;

/** Release: draft → submitted → changes-required → certified → withdrawn. */
export const RELEASE_EDGES = {
  draft: [
    { to: 'submitted', evidence: ['artifact-digest', 'dependency-inventory'] },
    { to: 'withdrawn', evidence: [] },
  ],
  submitted: [
    { to: 'changes-required', evidence: ['findings'] },
    { to: 'certified', evidence: ['findings', 'signed-decision'] },
    { to: 'withdrawn', evidence: [] },
  ],
  // Inferred: a corrected release is resubmitted as a new immutable artifact
  // rather than certified in place, because certification binds to the digest.
  'changes-required': [
    { to: 'submitted', evidence: ['artifact-digest', 'dependency-inventory'] },
    { to: 'withdrawn', evidence: [] },
  ],
  certified: [{ to: 'withdrawn', evidence: [] }],
  withdrawn: [],
} as const satisfies Table<ReleaseState>;

/** Installation: requested → approved → pilot → enabled → revoked → offboarded. */
export const INSTALLATION_EDGES = {
  // Inferred: revocation from any live state, which the specification implies
  // (revocation disables access) but does not list as an edge.
  requested: [
    { to: 'approved', evidence: ['approved-scopes'] },
    { to: 'revoked', evidence: ['reason'] },
  ],
  approved: [
    { to: 'pilot', evidence: ['pilot-plan'] },
    { to: 'revoked', evidence: ['reason'] },
  ],
  pilot: [
    { to: 'enabled', evidence: ['pilot-outcome', 'rollback-readiness'] },
    { to: 'revoked', evidence: ['reason'] },
  ],
  enabled: [{ to: 'revoked', evidence: ['reason'] }],
  revoked: [{ to: 'offboarded', evidence: ['downstream-acknowledgment'] }],
  offboarded: [],
} as const satisfies Table<InstallationState>;

export type TransitionResult<S extends string> =
  | { readonly ok: true; readonly to: S }
  | { readonly ok: false; readonly code: 'INVALID_TRANSITION'; readonly allowed: readonly S[] }
  | { readonly ok: false; readonly code: 'EVIDENCE_REQUIRED'; readonly missing: readonly string[] };

/**
 * Decide whether `from` may move to `to` given the evidence on hand.
 *
 * `from` and `to` are typed states, but a caller that read them from a request
 * has not checked them yet, so an unknown or prototype-key value is refused
 * rather than read from the table.
 */
export function transition<S extends string>(
  table: Table<S>,
  from: S,
  to: S,
  evidence: ReadonlySet<string>,
): TransitionResult<S> {
  const edges: readonly Edge<S>[] = Object.hasOwn(table, from) ? table[from] : [];
  const edge = edges.find((candidate) => candidate.to === to);
  if (!edge) {
    return { ok: false, code: 'INVALID_TRANSITION', allowed: edges.map((candidate) => candidate.to) };
  }
  const missing = edge.evidence.filter((item) => !evidence.has(item));
  if (missing.length > 0) {
    return { ok: false, code: 'EVIDENCE_REQUIRED', missing };
  }
  return { ok: true, to };
}

/**
 * Publication does not authorize an institution to install. An installation
 * may be approved only for a release that is currently certified.
 */
export function canApproveInstallation(release: ReleaseState): boolean {
  return release === 'certified';
}
