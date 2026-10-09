# Software supply chain

<!-- Rendered from app/src/lib/supplychain.ts and the lockfiles by supplychain.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

What a dependency or a build step is allowed to be, held by a test rather
than by review. Every row below is checked on every change; a new package
under an unlisted licence, a lockfile entry from outside the registry, or a
workflow step from an unapproved publisher fails CI.

| Control | Held by |
| --- | --- |
| Lockfile installed exactly (`npm ci`) | `ci.yml`, `pages.yml` |
| Known advisories reported on every run — non-blocking by design, so an advisory published overnight does not turn an unrelated PR red; see the comment on the step | `ci.yml` — `npm audit --audit-level=high` |
| Every workflow's job token is read-only unless a job asks for more | `app/src/lib/supplychain.test.ts` |
| Fix PRs for advisories and updates, npm and Actions | `.github/dependabot.yml` |
| Secrets never committed | `ci.yml` — gitleaks, `.gitleaks.toml` |
| Every package under an approved or named licence | `app/src/lib/supplychain.test.ts` |
| Every package from `registry.npmjs.org` with a sha512 integrity hash | `app/src/lib/supplychain.test.ts` |
| Only approved third-party Actions run | `app/src/lib/supplychain.test.ts` |
| Every Action pinned to a full commit SHA, with its release in a comment | `app/src/lib/supplychain.test.ts` |
| An SBOM (CycloneDX) of every deploy, kept 90 days | `pages.yml` → `npm run sbom`; asserted by `supplychain.test.ts` |

What is **not** held yet — signed build provenance, a
supplier-compromise playbook — is tracked with the rest of the
strategic expansion in [`STRATEGIC-EXPANSION-REGISTER.md`](STRATEGIC-EXPANSION-REGISTER.md).

## Licence inventory

| Licence | `app/` | `video/` | `pipeline/` |
| --- | ---: | ---: | ---: |
| MIT | 195 | 233 | 4 |
| ISC | 35 | 18 |  |
| Apache-2.0 | 33 | 5 |  |
| MPL-2.0 | 13 | 4 |  |
| BSD-3-Clause | 8 | 6 |  |
| BSD-2-Clause | 4 | 9 |  |
| Remotion License (stated in package) |  | 8 |  |
| SEE LICENSE IN LICENSE.md |  | 6 |  |
| Unlicense | 1 | 2 |  |
| 0BSD | 1 | 1 |  |
| MIT-0 | 2 |  |  |
| Remotion License |  | 2 |  |
| (MPL-2.0 OR Apache-2.0) | 1 |  |  |
| BlueOak-1.0.0 | 1 |  |  |
| CC-BY-4.0 |  | 1 |  |
| CC0-1.0 | 1 |  |  |
| EPL-2.0 | 1 |  |  |
| MIT (stated in package) | 1 |  |  |
| Python-2.0 |  | 1 |  |
| Remotion License https://remotion.dev/license |  | 1 |  |
| **total** | **297** | **297** | **4** |

- `app/` — The app: built and deployed to every user (the workspace root lockfile, which also locks packages/*) **(ships)**.
- `video/` — Local video rendering; never deployed.
- `pipeline/` — Local course-material pipeline; never deployed.

Approved without review: `MIT`, `MIT-0`, `ISC`, `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`, `0BSD`, `BlueOak-1.0.0`, `CC0-1.0`, `Unlicense`, `Python-2.0`.

Allowed only by name: `MPL-2.0`, `EPL-2.0`, `CC-BY-4.0` — and anything the lockfile does not state.

Never allowed, even by name: GPL, AGPL, LGPL, SSPL, BUSL, Commons Clause, Elastic 2.0, and non-commercial or share-alike Creative Commons.

## Named packages

| Package | Lockfile | Licence | Decision | Why |
| --- | --- | --- | --- | --- |
| `elkjs` | app | EPL-2.0 | accepted | Graph layout pulled in by mermaid. EPL-2.0 is file-level copyleft: using it unmodified in a bundle creates no obligation on Semester's own code; a modified copy would have to be published. Used unmodified. |
| `khroma` | app | MIT | accepted | Mermaid's colour library. Its package.json has no licence field; the LICENSE file shipped in the package is MIT. |
| `lightningcss` | app | MPL-2.0 | accepted | Build-time CSS transform (and its per-platform binaries). Runs on the build machine; none of its code is in the bundle. |
| `axe-core` | app | MPL-2.0 | accepted | Accessibility rules engine, a devDependency run only by the test suite (src/a11y/axe.test.tsx, src/lib/dim.test.ts), used unmodified. None of its code is in the bundle. |
| `mediabunny` | video | MPL-2.0 | accepted | Media container library for local rendering, used unmodified. |
| `@mediabunny/` | video | MPL-2.0 | accepted | Audio encoders for mediabunny, used unmodified. |
| `caniuse-lite` | video | CC-BY-4.0 | accepted | Browser-support data read by the bundler at build time. Attribution is to caniuse.com; nothing is redistributed. |
| `remotion` | video | Remotion License | **open** | Source-available, not open source: free for individuals and companies below the licence's headcount threshold, a paid company licence above it. Fine for a student project today; must be bought, or video/ replaced, before Semester is a company over that threshold. Nothing under video/ is deployed. |
| `@remotion/` | video | Remotion License | **open** | The rest of the Remotion family, including the per-platform compositor binaries whose package.json omits the field. Same decision as remotion. |

**The open decision.** The Remotion licence under `video/` is free for an
individual or a small company and requires a paid company licence above its
headcount threshold. Nothing under `video/` is deployed, and the test refuses
an open decision in anything that is. It must be bought, or the tool
replaced, before Semester is a company above that threshold.

## A dependency, from request to response

| Step | Held by |
| --- | --- |
| Owner states purpose, data touched and runtime impact | .github/pull_request_template.md — New dependency section |
| Licence, security and provenance review | supplychain.test.ts (licence, registry, integrity) |
| Approved, or rejected | supplychain.ts NAMED / ACTIONS — a diff a reviewer must approve |
| Locked version added | package-lock.json, installed by npm ci |
| CI scan and test | ci.yml — pinned OSV-Scanner over every lockfile, npm audit --audit-level=high, actionlint, the suite |
| SBOM updated | pages.yml — npm run sbom on every deploy |
| Release artifact and provenance retained | supply-chain.yml — signed build provenance and SBOM attestation for the main bundle (not yet the Pages bytes: infra/README.md R-3) |
| Advisory monitoring | .github/dependabot.yml |
| Impact assessment: which services and tenants | **nothing yet** |
| Patch, mitigate, roll back or disable | ROLLBACK.md, feature flags (docs/FEATURE-FLAG-REGISTRY.md) |
| Evidence and customer impact recorded | **nothing yet** |

## Severity and patch targets

Accepted internal targets: the founder, acting in the security seat, accepted
them unchanged on 29 September 2026 (D-124). Not a customer commitment until a
contract or [`trust/SLA.md`](trust/SLA.md) says so.
This is the severity model `market-readiness/HECVAT_READINESS.md` VULN-1 asks for.
The same four rows stand in `SECURITY.md` beside the published contact
(`app/public/.well-known/security.txt`), and `security.test.ts` holds the two
tables to each other.

| Severity | Example | Response | Fixed within | Escalate to |
| --- | --- | --- | ---: | --- |
| critical | Active exploit, remote code execution, an exposed secret, a compromised package or Action | Assess the same day; mitigate, patch, disable or roll back before anything else ships | 2 days | Security lead and executive; customer notice per contract and law if student data may be affected |
| high | A serious auth, data or infrastructure flaw with a credible path to it | Prioritised patch; a compensating control recorded if the patch waits | 14 days | Security lead |
| medium | Exploitable only under constrained conditions, or limited impact | Scheduled remediation by risk and criticality | 60 days | Engineering lead |
| low | Minimal impact, or only in a non-production tool (video/, pipeline/) | Normal maintenance; the grouped Dependabot update is usually the fix | 180 days | None |

## Approved GitHub Actions

| Action | Publisher | Why |
| --- | --- | --- |
| `actions/checkout` | GitHub | Checks out the repository. |
| `actions/setup-node` | GitHub | Installs Node and caches npm. |
| `actions/upload-artifact` | GitHub | Keeps the SBOM and test reports with the run. |
| `actions/github-script` | GitHub | Posts CI summaries with the job token. |
| `actions/configure-pages` | GitHub | Pages deploy. |
| `actions/upload-pages-artifact` | GitHub | Pages deploy. |
| `actions/deploy-pages` | GitHub | Pages deploy. |
| `github/codeql-action` | GitHub | Static analysis (SAST) of the source; writes results to the Security tab only. See codeql.yml. |
| `gitleaks/gitleaks-action` | Gitleaks | Secret scanning; reads the tree, writes nothing. See ci.yml. |
| `stackhawk/hawkscan-action` | StackHawk | Runs DAST against the ephemeral local preview; receives the StackHawk API key and a read-only repository token. |
| `actions/download-artifact` | GitHub | infra-apply.yml hands the reviewed plan from the plan job to the apply job. |
| `actions/attest-build-provenance` | GitHub | Signs which workflow built the app bundle, at which commit (Sigstore). See supply-chain.yml. |
| `actions/attest-sbom` | GitHub | Binds the CycloneDX SBOM to the same bundle (Sigstore). See supply-chain.yml. |
| `hashicorp/setup-terraform` | HashiCorp | Installs a pinned Terraform for the infrastructure plans; holds no credential itself. See infra.yml. |
| `supabase/setup-cli` | Supabase | Installs the CLI that deploys the Edge Functions; Supabase already holds the data. |
