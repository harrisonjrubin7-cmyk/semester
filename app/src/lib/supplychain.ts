/**
 * The software supply-chain policy, as data a test can hold the tree to.
 *
 * `docs/SUPPLY-CHAIN.md` is rendered from this file by `supplychain.test.ts`;
 * edit the data, then `npm run registers` from app/.
 *
 * ## What was already here, and what this adds
 *
 * Before this file the repository already had three supply-chain controls:
 * `npm ci` installs the lockfile exactly, `npm audit --audit-level=high` in
 * `ci.yml` fails on a known advisory, and `.github/dependabot.yml` opens the
 * pull request that fixes one (npm under `app/`, and the Actions themselves).
 * None of them asked what a package is *allowed to be*: its licence, where it
 * came from, or which third-party Actions may run with this repository's token.
 * A new dependency under the Remotion licence or a new Action from an unknown
 * publisher passed every gate. This file is that question, and the test makes
 * the answer a build failure rather than a code review nobody remembers.
 *
 * The four lockfiles' licences, as measured when this was written:
 *
 *   - `app/` (what ships): 292 packages, every one under an approved licence or
 *     a named weak-copyleft one used unmodified. No open decision. (dompurify's
 *     `MPL-2.0 OR Apache-2.0` is taken as Apache-2.0.)
 *   - `video/` (a local rendering tool, never deployed): 297, of which the
 *     Remotion family is under the Remotion licence — source-available, free
 *     only for individuals and small companies. That is an open decision, and
 *     it is written down below rather than discovered by a buyer's counsel.
 *   - `pipeline/`: 4, all MIT.
 */

/** Permissive licences a package may carry with no further review. */
export const APPROVED = [
  'MIT',
  'MIT-0',
  'ISC',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  '0BSD',
  'BlueOak-1.0.0',
  'CC0-1.0',
  'Unlicense',
  'Python-2.0',
] as const;

/**
 * Licences a package may carry only by name. Each is fine for Semester's use,
 * but carries an obligation that a new package under it should not inherit
 * silently — so a package under one of these that is not named in
 * `NAMED` below fails the build until someone names it and says why.
 */
export const BY_NAME = ['MPL-2.0', 'EPL-2.0', 'CC-BY-4.0'] as const;

/** Never in anything this repository ships or runs. */
export const FORBIDDEN = /\b(A?GPL|LGPL|SSPL|BUSL|Commons-Clause|Elastic-2\.0|CC-BY-NC|CC-BY-SA)/i;

export type Lockfile = 'app' | 'video' | 'pipeline';

/** Where each lockfile's code goes. Only `ships` reaches a student. */
export const LOCKFILES: Record<Lockfile, { path: string; ships: boolean; what: string }> = {
  app: { path: 'package-lock.json', ships: true, what: 'The app: built and deployed to every user (the workspace root lockfile, which also locks packages/*)' },
  video: { path: 'video/package-lock.json', ships: false, what: 'Local video rendering; never deployed' },
  pipeline: { path: 'pipeline/package-lock.json', ships: false, what: 'Local course-material pipeline; never deployed' },
};

export interface Named {
  /** A package name, or a scope prefix ending in `/` or `-` for a family. */
  pkg: string;
  lockfile: Lockfile;
  /** What the licence actually is, when the lockfile does not say. */
  license: string;
  why: string;
  /** `accepted` is a decision; `open` is one nobody has made yet. */
  decision: 'accepted' | 'open';
}

export const NAMED: readonly Named[] = [
  {
    pkg: 'elkjs',
    lockfile: 'app',
    license: 'EPL-2.0',
    why: 'Graph layout pulled in by mermaid. EPL-2.0 is file-level copyleft: using it unmodified in a bundle creates no obligation on Semester\'s own code; a modified copy would have to be published. Used unmodified.',
    decision: 'accepted',
  },
  {
    pkg: 'khroma',
    lockfile: 'app',
    license: 'MIT',
    why: 'Mermaid\'s colour library. Its package.json has no licence field; the LICENSE file shipped in the package is MIT.',
    decision: 'accepted',
  },
  {
    pkg: 'lightningcss',
    lockfile: 'app',
    license: 'MPL-2.0',
    why: 'Build-time CSS transform (and its per-platform binaries). Runs on the build machine; none of its code is in the bundle.',
    decision: 'accepted',
  },
  {
    pkg: 'axe-core',
    lockfile: 'app',
    license: 'MPL-2.0',
    why: 'Accessibility rules engine, a devDependency run only by the test suite (src/a11y/axe.test.tsx, src/lib/dim.test.ts), used unmodified. None of its code is in the bundle.',
    decision: 'accepted',
  },
  {
    pkg: 'mediabunny',
    lockfile: 'video',
    license: 'MPL-2.0',
    why: 'Media container library for local rendering, used unmodified.',
    decision: 'accepted',
  },
  {
    pkg: '@mediabunny/',
    lockfile: 'video',
    license: 'MPL-2.0',
    why: 'Audio encoders for mediabunny, used unmodified.',
    decision: 'accepted',
  },
  {
    pkg: 'caniuse-lite',
    lockfile: 'video',
    license: 'CC-BY-4.0',
    why: 'Browser-support data read by the bundler at build time. Attribution is to caniuse.com; nothing is redistributed.',
    decision: 'accepted',
  },
  {
    pkg: 'remotion',
    lockfile: 'video',
    license: 'Remotion License',
    why: 'Source-available, not open source: free for individuals and companies below the licence\'s headcount threshold, a paid company licence above it. Fine for a student project today; must be bought, or video/ replaced, before Semester is a company over that threshold. Nothing under video/ is deployed.',
    decision: 'open',
  },
  {
    pkg: '@remotion/',
    lockfile: 'video',
    license: 'Remotion License',
    why: 'The rest of the Remotion family, including the per-platform compositor binaries whose package.json omits the field. Same decision as remotion.',
    decision: 'open',
  },
];

/** The licence as the lockfile states it, or `undefined`. */
export type Stated = string | undefined;

/** Split an SPDX `(A OR B)` expression into its choices. */
export const choices = (license: string): string[] =>
  license
    .replace(/[()]/g, '')
    .split(/\s+OR\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

export const namedFor = (lockfile: Lockfile, name: string): Named | undefined =>
  NAMED.find((n) => n.lockfile === lockfile && (n.pkg.endsWith('/') || n.pkg.endsWith('-') ? name.startsWith(n.pkg) : name === n.pkg || name.startsWith(`${n.pkg}-`)));

export type Verdict =
  | { ok: true; via: 'approved' | 'named' }
  | { ok: false; reason: string };

/**
 * Whether one package may be in a lockfile. Approved licences pass; anything
 * else passes only when `NAMED` covers it; a forbidden licence fails even if
 * named, because naming a package is not a way to launder a GPL into the app.
 */
export function judge(lockfile: Lockfile, name: string, stated: Stated): Verdict {
  if (stated && FORBIDDEN.test(stated)) return { ok: false, reason: `${name} is ${stated}, which is forbidden` };
  // An `(A OR B)` expression lets the user pick, so one approved choice is enough.
  if (stated && choices(stated).some((c) => (APPROVED as readonly string[]).includes(c))) return { ok: true, via: 'approved' };
  const named = namedFor(lockfile, name);
  if (named) {
    if (FORBIDDEN.test(named.license)) return { ok: false, reason: `${name} is named as ${named.license}, which is forbidden` };
    if (LOCKFILES[lockfile].ships && named.decision === 'open') return { ok: false, reason: `${name} ships in ${lockfile} with an open licence decision` };
    return { ok: true, via: 'named' };
  }
  return { ok: false, reason: `${name} is ${stated ?? 'unlicensed in the lockfile'} and no one has named it in supplychain.ts` };
}

/** Where a lockfile entry may come from. */
export const REGISTRY = 'https://registry.npmjs.org/';

/**
 * Every third-party GitHub Action a workflow may run, with who publishes it and
 * why this repository trusts it with a job's token. A `uses:` line not listed
 * here fails the build. `.github/dependabot.yml` keeps the versions current.
 *
 * Each is pinned to a full commit SHA with its release in a trailing comment
 * (`supplychain.test.ts` holds both). A tag can be moved by the publisher, so a
 * tag would trust the publisher; a SHA trusts the bytes that were reviewed.
 * Dependabot's `github-actions` ecosystem opens the bump, SHA and comment
 * together, so the pin costs a review, not a chore.
 */
export const ACTIONS: Record<string, { publisher: string; why: string }> = {
  'actions/checkout': { publisher: 'GitHub', why: 'Checks out the repository.' },
  'actions/setup-node': { publisher: 'GitHub', why: 'Installs Node and caches npm.' },
  'actions/upload-artifact': { publisher: 'GitHub', why: 'Keeps the SBOM and test reports with the run.' },
  'actions/github-script': { publisher: 'GitHub', why: 'Posts CI summaries with the job token.' },
  'actions/configure-pages': { publisher: 'GitHub', why: 'Pages deploy.' },
  'actions/upload-pages-artifact': { publisher: 'GitHub', why: 'Pages deploy.' },
  'actions/deploy-pages': { publisher: 'GitHub', why: 'Pages deploy.' },
  'gitleaks/gitleaks-action': { publisher: 'Gitleaks', why: 'Secret scanning; reads the tree, writes nothing. See ci.yml.' },
  'stackhawk/hawkscan-action': { publisher: 'StackHawk', why: 'Runs DAST against the ephemeral local preview; receives the StackHawk API key and a read-only repository token.' },
  'actions/download-artifact': { publisher: 'GitHub', why: 'infra-apply.yml hands the reviewed plan from the plan job to the apply job.' },
  'actions/attest-build-provenance': { publisher: 'GitHub', why: 'Signs which workflow built the app bundle, at which commit (Sigstore). See supply-chain.yml.' },
  'actions/attest-sbom': { publisher: 'GitHub', why: 'Binds the CycloneDX SBOM to the same bundle (Sigstore). See supply-chain.yml.' },
  'hashicorp/setup-terraform': { publisher: 'HashiCorp', why: 'Installs a pinned Terraform for the infrastructure plans; holds no credential itself. See infra.yml.' },
  'supabase/setup-cli': { publisher: 'Supabase', why: 'Installs the CLI that deploys the Edge Functions; Supabase already holds the data.' },
};

/** The `owner/repo` an Action line names, without its ref or sub-path. */
export const actionOf = (uses: string): string => uses.split('@')[0].split('/').slice(0, 2).join('/');

/**
 * How fast a supply-chain finding is answered, by severity. This is the
 * "severity model and patch SLAs" that `HECVAT_READINESS.md` VULN-1 lists as
 * not started. The day counts are **accepted internal targets**: the founder,
 * acting in the security seat, accepted them unchanged on 29 September 2026
 * (D-124). No finding has yet been held against them, and nothing here is a
 * commitment to a customer until a contract or `docs/trust/SLA.md` says so.
 */
export const PATCH_POLICY = [
  {
    severity: 'critical',
    example: 'Active exploit, remote code execution, an exposed secret, a compromised package or Action',
    respond: 'Assess the same day; mitigate, patch, disable or roll back before anything else ships',
    days: 2,
    escalate: 'Security lead and executive; customer notice per contract and law if student data may be affected',
  },
  {
    severity: 'high',
    example: 'A serious auth, data or infrastructure flaw with a credible path to it',
    respond: 'Prioritised patch; a compensating control recorded if the patch waits',
    days: 14,
    escalate: 'Security lead',
  },
  {
    severity: 'medium',
    example: 'Exploitable only under constrained conditions, or limited impact',
    respond: 'Scheduled remediation by risk and criticality',
    days: 60,
    escalate: 'Engineering lead',
  },
  {
    severity: 'low',
    example: 'Minimal impact, or only in a non-production tool (video/, pipeline/)',
    respond: 'Normal maintenance; the grouped Dependabot update is usually the fix',
    days: 180,
    escalate: 'None',
  },
] as const;

/**
 * The path a dependency takes, and which step in this repository holds each.
 * `null` is a step nothing holds yet; the register tracks it.
 */
export const WORKFLOW: readonly { step: string; heldBy: string | null }[] = [
  { step: 'Owner states purpose, data touched and runtime impact', heldBy: '.github/pull_request_template.md — New dependency section' },
  { step: 'Licence, security and provenance review', heldBy: 'supplychain.test.ts (licence, registry, integrity)' },
  { step: 'Approved, or rejected', heldBy: 'supplychain.ts NAMED / ACTIONS — a diff a reviewer must approve' },
  { step: 'Locked version added', heldBy: 'package-lock.json, installed by npm ci' },
  { step: 'CI scan and test', heldBy: 'ci.yml — npm audit --audit-level=high, the suite' },
  { step: 'SBOM updated', heldBy: 'pages.yml — npm run sbom on every deploy' },
  { step: 'Release artifact and provenance retained', heldBy: 'supply-chain.yml — signed build provenance and SBOM attestation for the main bundle (not yet the Pages bytes: infra/README.md R-3)' },
  { step: 'Advisory monitoring', heldBy: '.github/dependabot.yml' },
  { step: 'Impact assessment: which services and tenants', heldBy: null },
  { step: 'Patch, mitigate, roll back or disable', heldBy: 'ROLLBACK.md, feature flags (docs/FEATURE-FLAG-REGISTRY.md)' },
  { step: 'Evidence and customer impact recorded', heldBy: null },
];
