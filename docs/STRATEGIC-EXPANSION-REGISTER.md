# Strategic Expansion Register

<!-- Rendered from app/src/lib/expansionregister.ts and expansiongovernance.ts by expansionregister.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

The long-horizon capabilities that make Semester durable for a decade, not
merely launchable: supply chain, credentials, research, continuity,
architecture, the learner profile, data quality, content and service
operations, analytics, releases, ethics, workforce, knowledge,
interoperability, benchmark, evidence and councils. What must be true **at
launch** is the [master register](MASTER-LAUNCH-READINESS-REGISTER.md); each
area here names the master rows it overlaps rather than restating them.

**The largest remaining value is in deepening quality, evidence, standards,
continuity and trust around the product — not in adding modules.** So this
register is mostly governance, and most of it is not started.

Statuses were assessed against `origin/main` at `e89e2ce`; a test holds each
to the kind of file it cites. Nothing is above `tested`, because nothing has
an artifact under `docs/evidence/`.

## Where it stands

| Area | Tier | Phase | Items | not-started | designed | building | tested |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| [SUP](#sup) Software supply-chain security | 0 | 0 | 36 | 14 | 1 | 9 | 12 |
| [CRD](#crd) Digital credentials and the Credential Wallet | 2 | 3 | 11 | 3 | 3 | 3 | 2 |
| [RES](#res) Research ethics and institutional review | 3 | 4 | 11 | 6 | 3 | 1 | 1 |
| [BCP](#bcp) Business continuity beyond technology | 1 | 2 | 11 | 7 | 3 | 0 | 1 |
| [ARB](#arb) Architecture Review Board | 1 | 2 | 12 | 1 | 6 | 0 | 5 |
| [PRF](#prf) Student-owned portable learning profile | 2 | 3 | 8 | 1 | 0 | 2 | 5 |
| [EVG](#evg) Academic and career evidence graph | 2 | 3 | 6 | 1 | 0 | 1 | 4 |
| [DQC](#dqc) Student-facing data-quality correction | 1 | 2 | 7 | 0 | 1 | 3 | 3 |
| [CGV](#cgv) Institution content governance | 1 | 2 | 6 | 0 | 1 | 2 | 3 |
| [SVC](#svc) Service catalogue and service ownership | 1 | 2 | 8 | 1 | 3 | 2 | 2 |
| [VND](#vnd) Dependency and vendor observability | 1 | 2 | 11 | 4 | 2 | 1 | 4 |
| [PPA](#ppa) Privacy-preserving analytics engineering | 1 | 2 | 11 | 1 | 0 | 2 | 8 |
| [REL](#rel) Release management for institutions | 0 | 1 | 11 | 4 | 1 | 1 | 5 |
| [ETH](#eth) Compensation, incentives and sales ethics | 1 | 2 | 8 | 5 | 2 | 0 | 1 |
| [WFA](#wfa) Workforce accessibility and inclusion | 1 | 2 | 6 | 6 | 0 | 0 | 0 |
| [KNW](#knw) Knowledge retention and onboarding | 1 | 2 | 10 | 3 | 5 | 1 | 1 |
| [IOP](#iop) Public interoperability commitment | 2 | 3 | 6 | 0 | 4 | 0 | 2 |
| [BEN](#ben) Higher-ed operating benchmark | 3 | 3 | 6 | 1 | 1 | 0 | 4 |
| [OUT](#out) Outcome and impact evidence programme | 2 | 3 | 8 | 2 | 2 | 1 | 3 |
| [CNL](#cnl) Strategic customer councils | 2 | 3 | 6 | 3 | 3 | 0 | 0 |
| **total** | | | **199** | **63** | **41** | **29** | **66** |

## Tiers

| Tier | Meaning | Areas |
| ---: | --- | --- |
| 0 | Must exist before enterprise launch | SUP, REL |
| 1 | Unlocks repeatable institutional scale | BCP, ARB, DQC, CGV, SVC, VND, PPA, ETH, WFA, KNW |
| 2 | High differentiation after the operational base | CRD, PRF, EVG, IOP, OUT, CNL |
| 3 | Strategic expansion after proof | RES, BEN |
| 4 | Only with strict governance and demonstrated need | — |

Tier 4 is the deferred list below: only with strict governance and demonstrated need.

## Phases and their exits

### Phase 0 — Foundations and risk controls

A secure, accessible, operable foundation before broad customer commitments.

| Capability | Owner | Exit evidence | Tracked in |
| --- | --- | --- | --- |
| NIST CSF, Privacy Framework and AI RMF mapping | Security, privacy, AI | Framework crosswalk and risk register | expansiongovernance.ts FRAMEWORKS |
| Tenant, RLS and object authorization | Security, platform | Automated positive and negative access tests | master IAM rows |
| Secure SDLC and supply-chain basics | Engineering, security | MFA, branch protection, scans, lockfiles, SBOM | SUP |
| Design system and WCAG baseline | Design, accessibility | Keyboard, reflow, contrast and component tests | master UX and A11Y rows |
| Data inventory and lineage baseline | Privacy, data | Data map, classification, retention matrix | master TRUST rows |
| SLOs, monitoring, backup and restore | SRE | Dashboards, restore drill, incident runbook | master SRE rows |
| Claims, trust and procurement foundations | Legal, security, marketing | Trust Center, HECVAT/VPAT request process | master SEC and LEG rows |

### Phase 1 — Full launch core

Make every advertised critical student, LMS, institution and company operation real.

| Capability | Owner | Exit evidence | Tracked in |
| --- | --- | --- | --- |
| Student platform and real auth | Product, engineering | Real account and persistence UAT | master STU and IAM rows |
| Native LMS critical workflows | LMS, product | Course lifecycle, assessment and gradebook UAT | master LMS rows |
| SSO, LTI and SIS integration base | Integration | Positive, negative, security and reconciliation tests | master INT rows |
| AI source, policy and evaluation controls | AI lead | Eval, red-team and kill-switch evidence | master AI rows |
| Billing, entitlement and support | Commercial, support | Checkout, cancel, dunning and support drills | master COM and SUP rows |
| HECVAT, VPAT, DPA and SLA | Security, accessibility, legal | Current scoped evidence package | master SEC rows |
| Release management for institutions | Engineering, implementation | Calendar, release notes, canary and change-impact records | REL |
| Supply-chain security programme | Engineering, security | SBOM, scan, patch, provenance and CI evidence | SUP |

### Phase 2 — Repeatable institution scale

Turn launches into a repeatable operating model.

| Capability | Owner | Exit evidence | Tracked in |
| --- | --- | --- | --- |
| Data quality console and student correction | Data, privacy, integration | Freshness, reconciliation and correction workflows | DQC |
| Content governance, service catalogue, vendor observability | Operations | Every service and vendor with owner, SLO, fallback and exit | CGV, SVC, VND |
| Privacy-preserving analytics | Data, privacy | Written re-identification policy and access-log review | PPA |
| Company continuity, ARB, ethics, workforce and knowledge | Executive | Succession plan, board charter, policies, first continuity exercise | BCP, ARB, ETH, WFA, KNW |

### Phase 3 — Durable differentiation

Portability, career evidence, and trust-based network effects.

| Capability | Owner | Exit evidence | Tracked in |
| --- | --- | --- | --- |
| Credential Wallet foundation | Product, career, privacy | Evidence, share, revoke and export UAT | CRD, PRF |
| Skills and evidence graph; verified skills | Product, learning, career | Course-to-skill model and verifier workflow | EVG, CRD |
| CASE identifiers; Open Badges and CLR export pilot | Curriculum, integration | Standards-valid export with issuer controls | CRD |
| Public interoperability and portability commitment | Product, legal | Published commitments mapped to controls | IOP |
| Outcome evidence, benchmark and councils | Research, product | Protocol, methodology review, chartered councils | OUT, BEN, CNL |

### Phase 4 — Ecosystem and global scale

Extend responsibly through standards, partners, and geography.

| Capability | Owner | Exit evidence | Tracked in |
| --- | --- | --- | --- |
| Credential issuer network and employer verification | Partnerships | Issuer governance, revocation, verification API, contracts | CRD |
| Research programme | Research, privacy | IRB, governance and methodology evidence | RES |
| Partner certification, localization, ISO programmes | Partnerships, security | A business case and gap assessment each | expansiongovernance.ts FRAMEWORKS |

## The register

### SUP

**Software supply-chain security.** NIST CSF 2.0 puts supplier and third-party risk in Govern: a compromised dependency, Action or build is a breach of every tenant at once. Tier 0, phase 0. Overlaps master rows `SEC-003`, `SEC-004`, `SEC-010`, `IAM-011`, `SRE-008`.

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| SUP-001 | Component inventory per production service: repository, owner, runtime, target, data class, dependencies, criticality | building | `app/src/lib/governance/charters.ts` — owners, source dependency and data class per module flag | Charters are per feature flag, not per service; no runtime, deployment target or criticality column. |
| SUP-002 | Approved dependency and source registry | tested | `app/src/lib/supplychain.ts` — approved licences, named packages, one registry<br>`app/src/lib/supplychain.test.ts` — every lockfile entry admitted or the build fails | Approval is by licence and source, not by package name; a new MIT package still enters on review alone. |
| SUP-003 | Inventory of Actions, CI plugins, registries, build images and deploy integrations | tested | `app/src/lib/supplychain.test.ts` — only approved Actions run; one registry | Build images (ubuntu-latest) and deploy integrations (Pages, Supabase) are not listed with an owner. |
| SUP-004 | Owner for each critical dependency or service | not-started | — | No dependency has a named owner; one person owns everything today. |
| SUP-005 | Locked versions and lockfiles in every package | tested | `app/src/lib/supplychain.test.ts` — app, video and pipeline lockfiles; sha512 on every entry<br>`.github/workflows/ci.yml` — npm ci installs the lockfile exactly | A reproducible build (same inputs, same bytes) has never been demonstrated. |
| SUP-006 | Review required for a new production dependency | building | `.github/pull_request_template.md` — New dependency section: purpose, data touched, licence | A checklist, not a gate: no CODEOWNERS entry makes a reviewer approve package.json. |
| SUP-007 | Continuous vulnerability scanning | building | `.github/dependabot.yml` — weekly npm and Actions updates<br>`.github/workflows/ci.yml` — npm audit --audit-level=high, non-blocking by design | Findings are annotations; no one is assigned to read them, and scan history is not kept. |
| SUP-008 | Severity-based patch targets | tested | `app/src/lib/supplychain.ts` — PATCH_POLICY: 2, 14, 60 and 180 days<br>`app/src/lib/supplychain.test.ts` — worse findings answered faster | Targets accepted unchanged by the founder acting in the security seat on 29 September 2026 (D-124); no finding has yet been answered against them. The contact HECVAT VULN-1 also asks for is published in SECURITY.md and app/public/.well-known/security.txt. |
| SUP-009 | Maintainer, reputation and provenance review for critical dependencies | not-started | — | No list of critical dependencies and no record of who maintains them. |
| SUP-010 | Private registry, cache or allowlist for critical packages | building | `app/src/lib/supplychain.ts` — REGISTRY: every entry from registry.npmjs.org | One public registry is enforced; there is no package-name allowlist or cache. |
| SUP-011 | Remove unused dependencies | not-started | — | No unused-dependency check runs. |
| SUP-012 | Licence inventory with prohibited categories | tested | `app/src/lib/supplychain.test.ts` — forbidden families refused even by name<br>`docs/SUPPLY-CHAIN.md` — rendered inventory of all three lockfiles | The Remotion licence under video/ is an open decision. |
| SUP-013 | SBOM for every production release | tested | `.github/workflows/pages.yml` — CycloneDX SBOM after every build, kept 90 days<br>`app/src/lib/supplychain.test.ts` — the step exists, between build and deploy | Kept 90 days with the run, not with a release; not attached to anything a buyer can download. |
| SUP-014 | MFA required for source-control access | not-started | — | A GitHub setting; nothing in the repository records it. Needs an export under docs/evidence/. |
| SUP-015 | Organization-owned repository | not-started | `.github/workflows/ci.yml` — notes the repository is owned by a personal account | Owned by a personal account: the company does not own its source. |
| SUP-016 | Branch protection, required checks and no force-push on main | not-started | `VALIDATED.md` — recommends requiring up-to-date branches | Recommended, not recorded as configured. |
| SUP-017 | Peer review for protected paths | not-started | — | No CODEOWNERS file. |
| SUP-018 | Least-privilege tokens for bots, apps and CI | tested | `app/src/lib/supplychain.test.ts` — every workflow read-only by default; only Pages may write | Deploy keys and GitHub App grants are settings, not reviewed here. |
| SUP-019 | Secret scanning and push protection | building | `.github/workflows/ci.yml` — gitleaks over every push<br>`.gitleaks.toml` — rules | Push protection is a setting and is not recorded. |
| SUP-020 | Access revoked promptly on departure; quarterly access review | not-started | `docs/market-readiness/HECVAT_READINESS.md` — IAM-3 access review NOT_STARTED | No review cadence, no retained export. |
| SUP-021 | Actions pinned to an immutable commit | not-started | — | Pinned to major tags, which a publisher can move. |
| SUP-022 | Third-party Actions reviewed before use | tested | `app/src/lib/supplychain.test.ts` — a new publisher fails until named with a reason | The review is the diff to ACTIONS; nobody signs it. |
| SUP-023 | Separate build, staging and production credentials | designed | `SECRETS.md` — where each secret lives<br>`STAGING.md` — the staging environment | Not verified that no credential is shared between environments. |
| SUP-024 | No production secrets in build logs | building | `.github/workflows/pages.yml` — settings passed as masked secrets | No scan of logs for a leaked value. |
| SUP-025 | Protected environment approval for production | not-started | `.github/workflows/pages.yml` — deploys to the github-pages environment | The environment exists; no approval rule is recorded on it. |
| SUP-026 | Build provenance generated, signed and retained | not-started | — | No provenance attestation; below SLSA build level 2. |
| SUP-027 | Release artifact tied to commit, run, lockfile, tests, reviewer and deploy record | building | `.github/workflows/pages.yml` — SBOM named by commit SHA | Only the SBOM carries the commit; nothing binds reviewer or test result to the artifact. |
| SUP-028 | Artifact identity verified before promotion; no rebuild after approval | not-started | `ROLLBACK.md` — rolls back by rebuilding an earlier ref | Rollback rebuilds rather than redeploying the approved bytes. |
| SUP-029 | Production artifact and manifest retained for rollback and audit | building | `.github/workflows/pages.yml` — SBOM retained 90 days | The built bundle itself is not archived. |
| SUP-030 | Rollback and artifact restoration tested | tested | `ROLLBACK.md` — redeploy any earlier ref<br>`app/src/lib/rollback.test.ts` — rollback preconditions held | No rollback drill recorded under docs/evidence/. |
| SUP-031 | Advisory monitoring linked to affected services and tenants | building | `.github/dependabot.yml` — advisories open pull requests | No map from a package to the services and tenants it reaches. |
| SUP-032 | Emergency patch and feature-disable workflow | tested | `app/src/lib/flags.ts` — kill switches<br>`app/src/lib/flags.test.ts` — kill switch holds<br>`docs/SUPPLY-CHAIN.md` — the dependency workflow | No written emergency patch path for a dependency with no fix. |
| SUP-033 | Supplier-compromise runbook and tabletop exercise | not-started | — | No runbook and no tabletop. |
| SUP-034 | Customer notification when a supply-chain event is material | tested | `app/src/lib/governance/incident-comms.ts` — audiences, approvers, cadence<br>`app/src/lib/governance/incident-comms.test.ts` — held | No supply-chain trigger names when it applies. |
| SUP-035 | Vendor and third-party component risk register | tested | `app/src/lib/trust/subprocessors.ts` — every host named<br>`app/src/lib/trust/subprocessors.test.ts` — held to the CSP | No risk rating or review date per vendor. |
| SUP-036 | Corrective actions tracked and re-tested; scan history kept | not-started | — | Nothing records a finding from report to re-test. |

### CRD

**Digital credentials and the Credential Wallet.** A student-owned, verifiable record of learning is portable value no LMS offers, but only once issuer, sharing and privacy controls are mature. Tier 2, phase 3. Overlaps master rows `UOS-004`, `UOS-007`, `LMS-015`.

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| CRD-001 | CASE competency and learning-outcome registry | not-started | — | No competency identifiers anywhere. |
| CRD-002 | Skills taxonomy and evidence model | tested | `app/src/lib/skills-graph.ts` — skills with evidence links<br>`app/src/lib/skills-graph.test.ts` — held | Free-text skills, not a governed taxonomy. |
| CRD-003 | Verified-skills workflow with scoped verifiers | building | `supabase/migrations/20260926150000_expansion_roles_and_features.sql` — skill_records: student requests, scoped skill:verify decides<br>`supabase/expansion.check.sql` — SQL check | No screen uses it. |
| CRD-004 | Issuer correction and revocation, audited | not-started | `docs/CREDENTIAL-WALLET.md` — names the gap | Once verified, no policy lets the issuer revise or revoke. |
| CRD-005 | Institution issuer governance | building | `supabase/migrations/20260926150000_expansion_roles_and_features.sql` — skill:verify granted per course or office | No issuer register, no credential type an institution defines. |
| CRD-006 | Open Badges support | not-started | `docs/CREDENTIAL-WALLET.md` — standards order | Nothing exports a badge. |
| CRD-007 | Comprehensive Learner Record plan | designed | `docs/CREDENTIAL-WALLET.md` — CLR-compatible export after the foundation | No mapping written. |
| CRD-008 | Student-controlled wallet: private by default, share, revoke, view history | designed | `docs/CREDENTIAL-WALLET.md` — flows and safeguards<br>`supabase/migrations/20260926150000_expansion_roles_and_features.sql` — talent_profiles opt-in expires; a receipt per view | Only the employer opt-in exists; named-recipient and time-limited shares do not. |
| CRD-009 | Sensitive classes excluded from sharing by default | designed | `docs/CREDENTIAL-WALLET.md` — grade, disability, financial, health, conduct, immigration, private study | No share model, so no filter. |
| CRD-010 | Verifiable portfolio artifacts | tested | `app/src/lib/career-evidence.ts` — an artifact must cite its course or entry<br>`app/src/lib/career-evidence.test.ts` — held | Device-local; nothing an outsider can verify. |
| CRD-011 | Employer verification flow | building | `supabase/migrations/20260926150000_expansion_roles_and_features.sql` — employers read opted-in profiles with talent:search | Employers see; they cannot verify a credential. |

### RES

**Research ethics and institutional review.** Measuring outcomes or publishing on student data without a protocol is how a vendor loses a university. Tier 3, phase 4. Overlaps master rows `SEC-008`, `SEC-009`, `UOS-008`.

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| RES-001 | Research data governance policy | not-started | `PILOT.md` — says the pilot is product development, not research | No policy for when it becomes research. |
| RES-002 | IRB decision tree | not-started | — | Nothing says when a study needs review. |
| RES-003 | Consent and recruitment templates | designed | `PILOT.md` — consent with optional quoting and a way out<br>`docs/operating-model/RESEARCH-AND-SERVICE-DESIGN.md` — recruitment matrix | Product research only; no research-study consent. |
| RES-004 | De-identification review | not-started | — | No review step. |
| RES-005 | Data-access approval workflow | building | `supabase/migrations/20260926150000_expansion_roles_and_features.sql` — research_partner reads aggregates only, n ≥ 10 | No approval record for a partner's access. |
| RES-006 | Research partnership agreement | not-started | — | No template. |
| RES-007 | Publication review | designed | `PILOT.md` — publication needs IRB review and re-consent | One sentence, no process. |
| RES-008 | Research data retention schedule | not-started | — | RETENTION.md covers product data only. |
| RES-009 | Participant compensation policy | designed | `PILOT.md` — no payment, told before that changes<br>`docs/operating-model/ACCESSIBILITY-GOVERNANCE.md` — paid assistive-tech panel | No research rate or disclosure rule. |
| RES-010 | Methodology and limitations standards | tested | `app/src/lib/institution-ops.ts` — metric definitions, lineage, pre-registered intervention metric<br>`app/src/lib/institution-ops.test.ts` — held | Metric-level only; no study-level standard. |
| RES-011 | Independent ethics or advisory review | not-started | — | None. |

### BCP

**Business continuity beyond technology.** A company of one is a single point of failure that no restore drill covers. Tier 1, phase 2. Overlaps master rows `SRE-006`, `SRE-010`, `SEC-007`, `SUP-002`, `PRG-001`, `LEG-001`.

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| BCP-001 | Key-person dependency plan | not-started | `ROLLBACK.md` — names the single owner as a single point of failure | Named, not planned for. |
| BCP-002 | Leadership succession and emergency operating authority | not-started | `docs/FEATURE-FLAG-REGISTRY.md` — kill-switch authority only | No one else can act for the company. |
| BCP-003 | Remote-work continuity | not-started | — | None. |
| BCP-004 | Vendor failure contingency | designed | `docs/market-readiness/DISASTER_RECOVERY.md` — recovery path per component | No exit plan per vendor. |
| BCP-005 | Payment-provider outage plan | not-started | `docs/DECISION-LOG.md` — D-009: no payment processor yet | Not applicable until there is a processor. |
| BCP-006 | Domain and DNS recovery | not-started | — | Registrar access and recovery are undocumented. |
| BCP-007 | Identity-provider lockout recovery | designed | `docs/superpowers/specs/2026-09-24-vanderbilt-production-readiness-design.md` — break-glass admin accounts with MFA and audit | Not built; GitHub and Supabase account lockout not covered. |
| BCP-008 | Legal counsel continuity | not-started | — | No counsel engaged. |
| BCP-009 | Customer communication tree | tested | `app/src/lib/governance/incident-comms.ts` — thirteen audiences, approvers, cadence<br>`app/src/lib/governance/incident-comms.test.ts` — held | Incident-scoped; no company-event (ownership, closure) path. |
| BCP-010 | Media and crisis communications | not-started | `docs/operating-model/TRUST-BRAND-AND-LEGAL.md` — points crisis comms at incident comms | No media plan. |
| BCP-011 | Annual company continuity exercise | designed | `docs/trust/SOC2-READINESS.md` — incident and DR tabletop planned | None run. |

### ARB

**Architecture Review Board.** Keeps a large product from becoming a collection of inconsistent technical choices. Tier 1, phase 2. Overlaps master rows `PRG-003`, `SEC-002`, `AI-001`, `AI-002`, `SRE-006`, `SRE-007`, `A11Y-007`.

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| ARB-001 | A board with a charter, members and cadence | not-started | — | Review is spread across governance docs; no board. |
| ARB-002 | Architecture decision records | designed | `docs/architecture/README.md` — ADRs 0001–0006<br>`DECISIONS.md` — platform decisions | No rule that a change of this size needs one. |
| ARB-003 | Approved technology standards | designed | `docs/design/SEMESTER-UI-CONSTITUTION.md` — UI components and tokens | UI only; no approved languages, stores or services. |
| ARB-004 | Data boundary rules | tested | `app/src/lib/integration/classification.ts` — T0–T6 classes and allowed destinations<br>`app/src/lib/integration/classification.test.ts` — held | Integration-scoped. |
| ARB-005 | API and integration standards | tested | `app/src/lib/institution-ops.ts` — API scopes, rate limits, key rotation<br>`app/src/lib/institution-ops.test.ts` — held | No public API style guide. |
| ARB-006 | Deprecation and migration standards | tested | `app/src/lib/institution-ops.ts` — mayRetire needs 12 months' notice<br>`app/src/lib/institution-ops.test.ts` — held | API-scoped. |
| ARB-007 | Threat-model review | designed | `docs/INTEGRATION-THREAT-MODEL.md` — integrations<br>`docs/ai-toolkit/AI-TOOLKIT-THREAT-MODEL.md` — AI toolkit | Two models; no register or review cadence. |
| ARB-008 | Performance and capacity review | tested | `app/src/lib/governance/error-budgets.ts` — journey SLOs<br>`app/src/lib/governance/error-budgets.test.ts` — held | No load or capacity test. |
| ARB-009 | Accessibility architecture review | designed | `docs/operating-model/ACCESSIBILITY-GOVERNANCE.md` — review required per extension | No review of core architecture changes. |
| ARB-010 | AI model and provider review | tested | `docs/operating-model/AI-GOVERNANCE-BOARD.md` — board approves provider changes<br>`app/src/lib/governance/ai-lifecycle.test.ts` — lifecycle gates | Board has no members. |
| ARB-011 | Disaster-recovery architecture review | designed | `docs/market-readiness/DISASTER_RECOVERY.md` — recovery paths | No RTO/RPO; the gateway journal has no backup. |
| ARB-012 | Scalability and cost review | designed | `docs/operating-model/COMMERCIAL-GOVERNANCE.md` — AI cost controls | No cost-per-tenant model reviewed. |

### PRF

**Student-owned portable learning profile.** A profile that survives courses and institutions, which the student controls and institutions can only add verified elements to. Tier 2, phase 3. Overlaps master rows `STU-008`, `STU-011`, `IAM-002`, `UOS-004`, `UOS-007`.

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| PRF-001 | Academic goals | tested | `app/src/lib/path-profile.ts` — programme, target term, goals<br>`app/src/lib/path-profile.test.ts` — held | Not in one exportable profile. |
| PRF-002 | Learning preferences | tested | `app/src/lib/aboutme.ts` — student-typed preferences<br>`app/src/lib/aboutme.test.ts` — held | Not in one exportable profile. |
| PRF-003 | Accessibility preferences | building | `app/src/lib/accessmode.ts` — accessibility presets | Device-local; accommodation passports are separate and never store diagnoses. |
| PRF-004 | Portfolio artifacts and projects | tested | `app/src/lib/career-evidence.ts` — artifacts, bullets, résumé versions<br>`app/src/lib/career-evidence.test.ts` — held | Device-local. |
| PRF-005 | Verified skills and credentials | building | `supabase/migrations/20260926150000_expansion_roles_and_features.sql` — skill_records verification | See CRD. |
| PRF-006 | Selected learning reflections | not-started | — | None. |
| PRF-007 | Student-controlled sharing | tested | `app/src/lib/advisor-shares.ts` — scoped, expiring, revocable shares<br>`app/src/lib/sharing.test.ts` — held | Advisor-scoped only. |
| PRF-008 | Exportable record | tested | `app/src/lib/export.ts` — CSV, Markdown, ICS<br>`app/src/lib/export.test.ts` — held | Career evidence is not in the export. |

### EVG

**Academic and career evidence graph.** Shows where a skill came from without inventing a claim: outcome → work → skill → artifact → credential → pathway. Tier 2, phase 3. Overlaps master rows `LMS-015`, `UOS-004`.

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| EVG-001 | Course outcomes | tested | `app/src/lib/institution-ops.ts` — curriculumMap: course → outcome → skill → credential → career<br>`app/src/lib/institution-ops.test.ts` — held | No data source feeds it. |
| EVG-002 | Assignments and projects → demonstrated skills | not-started | — | The skills graph reads courses, projects, work and organisations, not assignments. |
| EVG-003 | Skills with evidence | tested | `app/src/lib/skills-graph.ts` — claims with reasons<br>`app/src/lib/skills-graph.test.ts` — held | Held in code; nothing under docs/evidence/ shows it operating. |
| EVG-004 | Portfolio artifacts | tested | `app/src/lib/career-evidence.ts` — artifact tied to course, tagged with confirmed skills<br>`app/src/lib/career-evidence.test.ts` — held | Held in code; nothing under docs/evidence/ shows it operating. |
| EVG-005 | Verified credentials | building | `app/src/lib/institution-ops.ts` — a credentials field in curriculumMap | A field, not a credential. |
| EVG-006 | Internships, jobs and graduate pathways | tested | `app/src/lib/skills-graph.ts` — explainFit, missingSkillPlan<br>`app/src/lib/skills-graph.test.ts` — held | Graduate pathways are not modelled. |

### DQC

**Student-facing data-quality correction.** Students see wrong data first; letting them flag it gives them agency and fixes the source. Tier 1, phase 2. Overlaps master rows `TRUST-001`, `TRUST-002`, `TRUST-004`, `STU-002`, `STU-004`, `INT-014`.

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| DQC-001 | A student can flag a requirement, section, deadline, material or source | tested | `app/src/lib/actions.ts` — correct event: say what is wrong<br>`app/src/lib/actions.test.ts` — held | The five named reasons are free text, not choices. |
| DQC-002 | Needs-review label shown on flagged data | tested | `app/src/lib/source.ts` — needs_review source label<br>`app/src/lib/source.test.ts` — held | Held in code; nothing under docs/evidence/ shows it operating. |
| DQC-003 | Correction queue to the data steward | building | `supabase/migrations/20260926150000_expansion_roles_and_features.sql` — data_requests kind correct, data_request:handle | A queue with no screen. |
| DQC-004 | Routed to the source owner per domain | tested | `app/src/lib/governance/data-contracts.ts` — correctionProcess per domain<br>`app/src/lib/governance/data-contracts.test.ts` — held | Held in code; nothing under docs/evidence/ shows it operating. |
| DQC-005 | Resolve, reject or needs official review | building | `supabase/migrations/20260926150000_expansion_roles_and_features.sql` — completed or rejected | No "needs official review" state. |
| DQC-006 | Student notified of the outcome | designed | `docs/operating-model/DATA-STEWARDSHIP.md` — student sees corrected at source | Not built. |
| DQC-007 | Correction audited | building | `supabase/migrations/20260926150000_expansion_roles_and_features.sql` — handled_by, completed_at | No audit view. |

### CGV

**Institution content governance.** Without an owner and an expiry on every page, a campus hub goes stale in a term. Tier 1, phase 2. Overlaps master rows `UOS-001`, `LMS-002`, `A11Y-006`.

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| CGV-001 | Content owner, department scope and publishing rights | building | `supabase/migrations/20260928302000_office_action_feed.sql` — offices, publish roles, department scope<br>`supabase/officeactions.check.sql` — SQL check | Office actions only; campus pages and resources are not covered. |
| CGV-002 | Approval status | tested | `app/src/lib/office-actions.ts` — draft → in review → published → withdrawn<br>`app/src/lib/office-actions.test.ts` — held | Held in code; nothing under docs/evidence/ shows it operating. |
| CGV-003 | Last reviewed, expiry, source URL and audience | tested | `app/src/lib/launch/content.ts` — owner, source, review period, visibility, expiry<br>`app/src/lib/launch/content.test.ts` — held | Launch content only. |
| CGV-004 | Accessibility status | designed | `docs/operating-model/ACCESSIBILITY-GOVERNANCE.md` — validated before publishing | No per-item field. |
| CGV-005 | Version history | tested | `supabase/migrations/20260928309000_course_studio.sql` — append-only published versions<br>`app/src/lib/coursestudio.test.ts` — held | Course Studio only. |
| CGV-006 | Retirement and archive policy | building | `supabase/migrations/20260928302000_office_action_feed.sql` — withdrawn status | Withdrawn, not archived on a schedule. |

### SVC

**Service catalogue and service ownership.** Each service Semester sells needs an owner, an SLO, a runbook and a way out. Tier 1, phase 2. Overlaps master rows `PRG-003`, `PRG-005`, `SRE-001`, `SRE-002`, `SRE-010`.

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| SVC-001 | A catalogue of services: platform, LMS, AI, LTI, SIS, SSO/SCIM, migration, marketplace, career, support, implementation, analytics, API | not-started | — | Charters are per feature flag; no service list. |
| SVC-002 | Owner, dependencies and data categories | tested | `app/src/lib/governance/charters.ts` — owners, source dependency, classification<br>`app/src/lib/governance/charters.test.ts` — every module flag has one | Per flag, not per service. |
| SVC-003 | SLO | tested | `app/src/lib/governance/error-budgets.ts` — journey SLOs<br>`app/src/lib/governance/error-budgets.test.ts` — held | Held in code; nothing under docs/evidence/ shows it operating. |
| SVC-004 | Support tier | designed | `docs/trust/SLA.md` — SLA framework | Not a commitment. |
| SVC-005 | Runbook | designed | `docs/INTEGRATION-OPERATOR-RUNBOOK.md` — integrations | Most services have none. |
| SVC-006 | Status components | building | `.github/workflows/production-smoke.yml` — hourly probe | No public status page. |
| SVC-007 | Cost and security owners | building | `app/src/lib/governance/charters.ts` — costModel field | No named cost owner. |
| SVC-008 | Continuity plan and deprecation policy per service | designed | `docs/operating-model/PORTFOLIO-GOVERNANCE.md` — sunset process | No per-service continuity. |

### VND

**Dependency and vendor observability.** Vendor risk on paper does not say what students see when Supabase is down. Tier 1, phase 2. Overlaps master rows `INT-001`, `INT-014`, `AI-003`, `AI-012`, `SEC-010`, `SRE-006`.

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| VND-001 | Vendor inventory | tested | `app/src/lib/trust/subprocessors.ts` — every host<br>`app/src/lib/trust/subprocessors.test.ts` — held to the CSP | No owner, fallback or exit columns. |
| VND-002 | Identity provider: status, fallback, impact | designed | `docs/vanderbilt/incident-routing.md` — SSO/SCIM row with containment | Owner unassigned. |
| VND-003 | Database (Supabase): status and alerting | designed | `MONITORING.md` — one alert and a weekly check | No status-source subscription. |
| VND-004 | Application edge: synthetic checks | building | `.github/workflows/production-smoke.yml` — hourly | Not tied to a customer-impact statement. |
| VND-005 | Email and SMS provider | not-started | — | None. |
| VND-006 | AI provider: availability and kill switch | tested | `app/src/lib/flags.ts` — kill.ai_generation<br>`app/src/lib/flags.test.ts` — held | No provider status subscription. |
| VND-007 | LMS/SIS connectors: owner, retry, dead-letter | tested | `supabase/migrations/20260928040000_integration_quality.sql` — source owner, backup, escalation<br>`app/src/lib/integration/pipeline.test.ts` — retry, backoff, dead-letter | Held in code; nothing under docs/evidence/ shows it operating. |
| VND-008 | Payments, calendar/file APIs, monitoring, DNS/CDN | not-started | — | None observed. |
| VND-009 | Circuit breakers | not-started | — | Named as a mitigation, not built. |
| VND-010 | Incident communication rule per dependency | tested | `app/src/lib/governance/incident-comms.ts` — integration_delay audience<br>`app/src/lib/governance/incident-comms.test.ts` — held | Integrations only. |
| VND-011 | Exit plan per vendor | not-started | — | None. |

### PPA

**Privacy-preserving analytics engineering.** Aggregates about students must never become a way to find one. Tier 1, phase 2. Overlaps master rows `UOS-008`, `LMS-017`, `SEC-006`, `SEC-009`.

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| PPA-001 | Aggregation standards | tested | `app/src/lib/institution-ops.ts` — no per-student grain<br>`app/src/lib/institution-ops.test.ts` — held | Held in code; nothing under docs/evidence/ shows it operating. |
| PPA-002 | Small-cell suppression, primary and complementary | tested | `app/src/lib/institution-ops.ts` — suppression<br>`app/src/lib/cohortfloor.test.ts` — held | Held in code; nothing under docs/evidence/ shows it operating. |
| PPA-003 | Cohort minimums | tested | `app/src/lib/cohortfloor.test.ts` — SQL floors equal MIN_COHORT = 10 | Held in code; nothing under docs/evidence/ shows it operating. |
| PPA-004 | Differential privacy review where appropriate | not-started | — | None. |
| PPA-005 | Metric approval workflow | tested | `app/src/lib/institution-ops.ts` — sensitive exports need a non-author reviewer<br>`app/src/lib/institution-ops.test.ts` — held | Held in code; nothing under docs/evidence/ shows it operating. |
| PPA-006 | Data-access logging | building | `supabase/migrations/20260921143653_access_log.sql` — who read your rows | SQL only. |
| PPA-007 | Research separated from operational analytics | building | `supabase/migrations/20260926150000_expansion_roles_and_features.sql` — research_partner aggregates only | No separate store. |
| PPA-008 | No re-identification policy | tested | `app/src/lib/institution-ops.ts` — complementary suppression<br>`app/src/lib/institution-ops.test.ts` — held | Enforced in code; no written policy a partner signs. |
| PPA-009 | Dashboard export controls | tested | `app/src/lib/institution-ops.test.ts` — exportReport refusals | Held in code; nothing under docs/evidence/ shows it operating. |
| PPA-010 | Analytics retention limits | tested | `RETENTION.md` — activity kept 400 days<br>`app/src/lib/retention.test.ts` — held | Held in code; nothing under docs/evidence/ shows it operating. |
| PPA-011 | Student-facing transparency | tested | `app/src/lib/privacy.ts` — claims on the Privacy screen<br>`app/src/lib/privacy.test.ts` — held | Held in code; nothing under docs/evidence/ shows it operating. |

### REL

**Release management for institutions.** A registrar will not trust a platform that changes under them in finals week. Tier 0, phase 1. Overlaps master rows `SRE-008`, `SRE-009`, `SRE-010`, `PRG-006`, `PRG-007`, `SEC-003`.

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| REL-001 | Release calendar | not-started | — | Main deploys on every merge. |
| REL-002 | Customer release notes | designed | `CHANGELOG.md` — tester-facing changelog | Not written for an institution. |
| REL-003 | Tenant-specific release windows | not-started | — | None. |
| REL-004 | Preview or staging tenant | tested | `STAGING.md` — staging<br>`app/src/lib/institutional-preview.test.ts` — held | Held in code; nothing under docs/evidence/ shows it operating. |
| REL-005 | Beta and early-access agreement | tested | `docs/PRIVATE-BETA-PROGRAM.md` — invite-only rules<br>`app/src/lib/beta.test.ts` — held | Held in code; nothing under docs/evidence/ shows it operating. |
| REL-006 | Feature-flag rollout | tested | `app/src/lib/flags.ts` — off, preview, sandbox, production per tenant<br>`app/src/lib/flags.test.ts` — held | Held in code; nothing under docs/evidence/ shows it operating. |
| REL-007 | Canary releases | not-started | — | None. |
| REL-008 | Rollback commitments | tested | `ROLLBACK.md` — any earlier ref<br>`app/src/lib/rollback.test.ts` — held | No drill evidence. |
| REL-009 | Change impact assessment: security, privacy, accessibility, data, integration, training, support | not-started | — | release-readiness scores a feature, not a change. |
| REL-010 | Customer notification rules | tested | `app/src/lib/governance/incident-comms.ts` — rollback and maintenance audiences<br>`app/src/lib/governance/incident-comms.test.ts` — held | Held in code; nothing under docs/evidence/ shows it operating. |
| REL-011 | Post-release verification | building | `.github/workflows/production-smoke.yml` — hourly synthetic check | Not triggered by a release. |

### ETH

**Compensation, incentives and sales ethics.** Incentives that reward overselling undo every trust control in this register. Tier 1, phase 2. Overlaps master rows `PRG-002`, `COM-002`, `COM-004`.

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| ETH-001 | Sales compensation that does not reward overselling | not-started | — | No sales team yet; write it before hiring one. |
| ETH-002 | Customer-success incentives tied to adoption and renewal | not-started | — | None. |
| ETH-003 | Ambassador disclosure and compensation | designed | `docs/LAUNCH-CONTENT-AND-TRAINING.md` — never paid per sign-up | No disclosure text. |
| ETH-004 | Partner referral disclosure | not-started | — | None. |
| ETH-005 | Executive conflict-of-interest policy | not-started | — | None. |
| ETH-006 | Gift and procurement ethics policy | not-started | — | None. |
| ETH-007 | Customer reference permission | designed | `docs/PILOT-TO-ANNUAL-CONVERSION.md` — written consent, no sub-threshold outcomes | Held in code; nothing under docs/evidence/ shows it operating. |
| ETH-008 | Responsible marketing review | tested | `app/src/lib/marketreadiness.test.ts` — claims held to code<br>`app/src/lib/gtm/rfp.test.ts` — RFP answers need evidence | Held in code; nothing under docs/evidence/ shows it operating. |

### WFA

**Workforce accessibility and inclusion.** A company that sells accessibility should be one people with disabilities can work at. Tier 1, phase 2.

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| WFA-001 | Accessible hiring and interview accommodations | not-started | — | No hiring process yet. |
| WFA-002 | Accessible internal tools and documents | not-started | — | Product accessibility only. |
| WFA-003 | Captioned meetings | not-started | — | None. |
| WFA-004 | Neurodiversity-inclusive practices and support structures | not-started | — | None. |
| WFA-005 | Inclusive performance review | not-started | — | None. |
| WFA-006 | Manager accessibility training | not-started | — | None. |

### KNW

**Knowledge retention and onboarding.** Company knowledge cannot live only in the founder's head. Tier 1, phase 2. Overlaps master rows `COM-003`.

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| KNW-001 | Decision log and ADRs | designed | `docs/DECISION-LOG.md` — product decisions<br>`docs/architecture/README.md` — ADRs | Held in code; nothing under docs/evidence/ shows it operating. |
| KNW-002 | Product requirement archive | designed | `docs/PLATFORM_REQUIREMENTS.md` — requirements | Held in code; nothing under docs/evidence/ shows it operating. |
| KNW-003 | Customer implementation library | designed | `docs/superpowers/plans/2026-09-24-vanderbilt-06-accessibility-legal.md` — dated implementation plans | Plans, not a library of customer implementations. |
| KNW-004 | Incident learning library | not-started | — | No post-incident reviews kept. |
| KNW-005 | Sales and procurement FAQ | tested | `app/src/lib/gtm/rfp.ts` — answers need evidence and status<br>`app/src/lib/gtm/rfp.test.ts` — held | Held in code; nothing under docs/evidence/ shows it operating. |
| KNW-006 | Engineering onboarding | designed | `SETUP.md` — setup<br>`REGRESSION-CHECKLIST.md` — the gates | Held in code; nothing under docs/evidence/ shows it operating. |
| KNW-007 | Role-specific playbooks | designed | `docs/market-readiness/SUPPORT_PLAYBOOK.md` — support<br>`docs/INTEGRATION-OPERATOR-RUNBOOK.md` — integration | Held in code; nothing under docs/evidence/ shows it operating. |
| KNW-008 | Documentation ownership and expiry | building | `app/src/lib/runbooklinks.test.ts` — no dead links in operational docs | No owner or expiry per doc. |
| KNW-009 | Internal search | not-started | — | None beyond the repository. |
| KNW-010 | Succession handover checklists | not-started | — | None. |

### IOP

**Public interoperability commitment.** Institutions wary of lock-in buy from vendors who promise the way out in public. Tier 2, phase 3. Overlaps master rows `LEG-004`, `INT-006`, `INT-007`, `INT-008`.

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| IOP-001 | Open standards commitment | designed | `docs/FERPA-COPPA-1EDTECH-READINESS.md` — 1EdTech readiness register | Internal; not published. |
| IOP-002 | Data portability promise | designed | `docs/DATA-PORTABILITY-AND-OFFBOARDING.md` — portability and offboarding | Internal; not published. |
| IOP-003 | Integration plan | designed | `docs/operating-model/PILOT-TO-PRODUCTION.md` — LMS interoperability phase | Internal. |
| IOP-004 | Customer export commitment | tested | `app/src/lib/export.ts` — exports<br>`app/src/lib/export.test.ts` — held | Student export; no tenant bulk export commitment. |
| IOP-005 | No unnecessary lock-in policy | designed | `docs/operating-model/DEFENSIBILITY.md` — data portability, not lock-in | Internal. |
| IOP-006 | Standards conformance evidence | tested | `app/src/lib/integration/providers.ts` — certified only with dated, person-verified evidence<br>`app/src/lib/integration/quality.test.ts` — held | No certification held. |

### BEN

**Higher-ed operating benchmark.** A published benchmark positions Semester as a strategic voice, not only a vendor — with methodology and privacy first. Tier 3, phase 3.

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| BEN-001 | A benchmark programme with methodology and privacy review | designed | `docs/operating-model/DEFENSIBILITY.md` — annual aggregated outcome benchmarks | No methodology. |
| BEN-002 | Navigation friction | tested | `app/src/lib/institution-ops.ts` — workflow_friction metric<br>`app/src/lib/institution-ops.test.ts` — held | Definition only. |
| BEN-003 | Registration readiness | tested | `app/src/lib/institution-ops.ts` — registration_ready cohort metric<br>`app/src/lib/institution-ops.test.ts` — held | Definition only. |
| BEN-004 | Accessibility, AI governance and integration maturity | tested | `app/src/lib/integration/providers.ts` — maturity ladder<br>`app/src/lib/governance/ai-lifecycle.test.ts` — AI gates | No institution-facing maturity scale. |
| BEN-005 | Student data transparency and advising preparation | tested | `app/src/lib/advisor-meeting.ts` — advising prep<br>`app/src/lib/advisor-meeting.test.ts` — held | Held in code; nothing under docs/evidence/ shows it operating. |
| BEN-006 | Career evidence maturity | not-started | — | None. |

### OUT

**Outcome and impact evidence programme.** An outcome claim without a protocol and an independent evaluator is marketing. Tier 2, phase 3. Overlaps master rows `SUP-003`, `UOS-008`.

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| OUT-001 | Theory of change and outcome taxonomy | tested | `app/src/lib/institution-ops.ts` — metric dictionary<br>`app/src/lib/institution-ops.test.ts` — held<br>`docs/operating-model/COMMERCIAL-GOVERNANCE.md` — outcome ladder | No written theory of change. |
| OUT-002 | Measurement plan | tested | `app/src/lib/gtm/pilot.ts` — baseline required per metric<br>`app/src/lib/gtm/pilot.test.ts` — held | Held in code; nothing under docs/evidence/ shows it operating. |
| OUT-003 | Institution-approved research protocol | not-started | — | None. |
| OUT-004 | Cohort comparison methodology | building | `app/src/lib/institution-ops.ts` — pre-registered matched cohort, definition only | Never run. |
| OUT-005 | Confounder and limitation disclosure | designed | `docs/operating-model/COMMERCIAL-GOVERNANCE.md` — careful attribution | Held in code; nothing under docs/evidence/ shows it operating. |
| OUT-006 | Aggregate reporting | tested | `app/src/lib/cohortfloor.test.ts` — floors | Held in code; nothing under docs/evidence/ shows it operating. |
| OUT-007 | Case-study standards | designed | `docs/PILOT-TO-ANNUAL-CONVERSION.md` — consent and thresholds | Held in code; nothing under docs/evidence/ shows it operating. |
| OUT-008 | Independent evaluation partner | not-started | — | None. |

### CNL

**Strategic customer councils.** Each constituency with a charter, a cadence and visible decisions, not just an advisory board. Tier 2, phase 3. Overlaps master rows `AI-001`, `PRG-001`.

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| CNL-001 | Student council | not-started | `docs/operating-model/AI-GOVERNANCE-BOARD.md` — a student seat on the AI board only | None. |
| CNL-002 | Faculty council | not-started | — | A faculty seat on the AI board only. |
| CNL-003 | Advisor, registrar and CIO/CISO councils | not-started | — | None. |
| CNL-004 | Accessibility council | designed | `docs/operating-model/ACCESSIBILITY-GOVERNANCE.md` — paid assistive-tech panel, monthly | No members. |
| CNL-005 | AI governance council | designed | `docs/operating-model/AI-GOVERNANCE-BOARD.md` — membership, quorum, quarterly | No members, no compensation policy. |
| CNL-006 | Enterprise customer council | designed | `docs/operating-model/RESEARCH-AND-SERVICE-DESIGN.md` — annual customer advisory board | No members. |

## How a capability is ranked

Each dimension is scored 1–5. A decision aid for the quarterly review, never a
replacement for it; `priority()` in `expansiongovernance.ts` refuses an
incomplete card rather than guessing.

| Dimension | Weight | Question |
| --- | ---: | --- |
| trust | +1.5 | Does it materially reduce security, privacy, accessibility, or operational risk? |
| revenue | +1.3 | Does it unlock a customer segment, contract, or renewal? |
| studentValue | +1.2 | Does it make a recurring student decision or action clearer? |
| differentiation | +1.1 | Does it improve Semester's defensibility in university buying? |
| dependency | +1.2 | Does it unblock several other capabilities? |
| evidenceUrgency | +1.2 | Is it needed for HECVAT, VPAT, SOC 2, DPA, SLA, or procurement? |
| readiness | +0.8 | Can Semester staff support it now? |
| complexity | −1 | How much team time, vendor spend, and ongoing maintenance does it require? |
| irreversibility | −1 | How hard is it to pilot safely and roll back? |

It ranks capabilities against each other. What *kind* of build one gets —
core, module, pilot, partner or decline — is still the governance scorecard in
[`operating-model/PORTFOLIO-GOVERNANCE.md`](operating-model/PORTFOLIO-GOVERNANCE.md).

## The admission gate

Before a long-horizon capability enters active delivery, `admit()` needs a
written answer to each of these, a scorecard route of core, module or pilot,
and — for Tier 4 or anything on the deferred list — a recorded governance review.

- [ ] Strategic problem and target user documented; it makes a real student decision clearer
- [ ] Student, customer or institution value evidenced — a safe, measurable benefit
- [ ] Data source and authority identified; source, limitation and privacy impact explainable
- [ ] Privacy, security and accessibility review completed
- [ ] Role, scope and consent model defined
- [ ] Operational owner and support model assigned; it can be supported, contracted and offboarded
- [ ] SLO, failure, fallback and rollback defined — including during academic peak periods
- [ ] Metrics and limitations defined, so it can be shown to work
- [ ] Contract and commercial implications reviewed
- [ ] Staffing, cost, vendor and maintenance burden approved
- [ ] Can be tested in a controlled environment
- [ ] Sunset, deprecation or exit path defined
- [ ] Comfortable explaining it to a student, parent, faculty member, accessibility reviewer, privacy officer and regulator

If the answer is yes, it strengthens Semester. If not, it is scope that should wait.

## What not to expand into early

Semester is stronger if it becomes the platform students and institutions
trust precisely because it refuses to cross these lines casually.

| Capability | Why it waits |
| --- | --- |
| Health records | HIPAA/FERPA boundary; a breach is unrecoverable for trust. |
| Mental-health prediction | Clinical claims, false positives with real harm, and no consent a student can meaningfully give. |
| Behavioral risk scoring | An unexplained label follows a student; `DO-NOT-BUILD.md` rule 3 already forbids an unexplained score. |
| Disciplinary decision tools | Due process belongs to people; Semester would be evidence in a hearing. |
| Financial-aid eligibility decisions | A regulated determination; Semester may explain, never decide. |
| Biometric proctoring | Biometric law, accessibility harm, and surveillance. |
| Emotion recognition | Scientifically weak and restricted in education under the EU AI Act. |
| Student surveillance | The opposite of the product thesis. |
| Direct bank or payment credential storage | PCI scope and a breach target; payments stay with the processor. |
| Public social feeds | Moderation at scale, minors, and harassment; community stays scoped and moderated. |
| Unmoderated messaging | Safety and duty of care. |
| Unreviewed marketplace transactions | Fraud and liability. |
| Automated admissions or academic-dismissal decisions | High-impact decisions about a person need a person. |
| Direct registration writes | Tier 4: a wrong write loses a student a seat; read and prepare only. |
| Emergency disclosure | Tier 4: a FERPA health-or-safety disclosure is an institutional act. |
| International data residency expansion | Tier 4: needs transfer mechanisms and local counsel. |

Several are already refused in code — `governance/ai-lifecycle.ts` refuses
health, disciplinary and financial-aid decisions; `institution-ops.ts` forbids
risk and wellbeing scores and attention, location and reading-time measures;
`server/institution/money.ts` never takes a card number. Three are close to
things the app has, and are named so the line stays visible: the Community
feed (finite, own communities only) is not a public social feed; class chat
rooms with after-the-fact moderation are not unmoderated messaging; and
`control-plane.ts` support signals (missed items and inactivity, shown to a
supporter only with consent) are not behavioural risk scoring.

## Frameworks

A planning tool, not a certification claim.

| Framework | Use | Adopt | Where it stands |
| --- | --- | --- | --- |
| NIST CSF 2.0 | Umbrella security programme: govern, suppliers, incident, recovery | now | No crosswalk from CSF functions to controls exists yet. (`docs/SUPPLY-CHAIN.md`, `docs/SECURITY-GAP-ANALYSIS.md`) |
| NIST Privacy Framework | Privacy risk, data lifecycle, user control | now | Controls exist; not mapped to the framework. (`docs/STUDENT-DATA-CONTROL-CENTER.md`, `RETENTION.md`) |
| NIST AI RMF 1.0 | Map, measure, manage and govern Semester Intelligence | now | AI gates G0–G5 exist and are tested; the RMF mapping is not written. (`docs/operating-model/AI-LIFECYCLE-GATES.md`, `app/src/lib/governance/ai-lifecycle.test.ts`) |
| CIS Controls | Practical technical-control baseline | now | Not assessed. |
| OWASP ASVS | Application-security verification in the SDLC | now | Not assessed. The RLS and capability checks cover part of V4 (access control) without saying so. |
| OWASP Top 10 / API Top 10 | Threat coverage in threat models and tests | now | One threat model; not keyed to the Top 10. (`docs/INTEGRATION-THREAT-MODEL.md`) |
| OWASP SAMM | Software-assurance maturity plan | now | Not assessed. |
| SLSA | Build pipeline and artifact integrity | now | Scripted build on a hosted runner; no signed provenance, so below SLSA build level 2. (`app/src/lib/supplychain.test.ts`) |
| SBOM (CycloneDX / SPDX) | Dependency transparency | now | CycloneDX SBOM of every deploy, kept 90 days. (`.github/workflows/pages.yml`, `app/src/lib/supplychain.test.ts`) |
| NIST SP 800-161 | Cyber supply-chain risk management | now | Applied to dependencies and subprocessors informally. (`docs/SUPPLY-CHAIN.md`, `docs/SUBPROCESSORS.md`) |
| HECVAT 4 | Higher-ed vendor assessment | now | Readiness tracked row by row; the response is not complete. (`docs/market-readiness/HECVAT_READINESS.md`, `docs/trust/HECVAT-VPAT-PLAN.md`) |
| WCAG 2.2 AA | Product and public-site accessibility baseline | now | Automated regression coverage; no formal third-party audit. (`docs/WCAG-UI-AUDIT-SCORECARD.md`, `app/src/lib/contrast.test.ts`) |
| VPAT / ACR | Accessibility procurement evidence | now | Planned; no ACR has been issued. (`docs/trust/HECVAT-VPAT-PLAN.md`) |
| DPA / FERPA mapping | Contractual and technical privacy mapping | now | Checklists exist; counsel has not reviewed them. (`docs/trust/DPA-CHECKLIST.md`, `docs/FERPA-COPPA-1EDTECH-READINESS.md`) |
| SLOs and error budgets | Service operations | now | Budgets defined and tested; no production traffic measures them yet. (`docs/operating-model/SLOS-AND-ERROR-BUDGETS.md`, `app/src/lib/governance/error-budgets.test.ts`) |
| ITIL 4 (lightweight) | Incident, change and problem practice | now | Incident communications held; change and problem management informal. (`docs/operating-model/INCIDENT-COMMUNICATIONS.md`, `app/src/lib/governance/incident-comms.test.ts`) |
| LTI 1.3 / LTI Advantage | LMS launch, deep linking, grades | now | Implemented and tested; not 1EdTech certified. (`docs/LTI-1.3-LAUNCH-RUNBOOK.md`, `app/src/lib/lti.test.ts`) |
| OneRoster, QTI, Common Cartridge | Rostering, assessment and course interchange | now | Planned in the LMS learning plan. (`docs/LMS-LEARNING-ROADMAP.md`, `docs/FERPA-COPPA-1EDTECH-READINESS.md`) |
| CASE, Open Badges, CLR | Competencies, credentials, learner portability | when-justified | Designed for the wallet phases; nothing exports to them. (`docs/CREDENTIAL-WALLET.md`) |
| SOC 2 Type I / II | Independent assurance | readiness-now | Readiness work only; no auditor engaged. (`docs/trust/SOC2-READINESS.md`) |
| ISO/IEC 27001 and 27701 | ISMS and privacy certification for global procurement | when-justified | When target customers or revenue justify the certification effort. |
| ISO/IEC 42001 | AI management system | when-justified | As AI governance matures and enterprise demand warrants. |
| NIST SP 800-53 | Control mapping for public-sector buyers | when-justified | Map selectively on a buyer requirement; never attempt the full catalogue unasked. |
| CSA Cloud Controls Matrix | Cloud/SaaS questionnaires (CAIQ) | when-justified | If customers send CAIQ. |
| ISO 22301 | Business continuity management | when-justified | When an enterprise contract requires a formal BCMS. |
| COBIT | Enterprise IT governance and audit alignment | when-justified | For large institutional governance alignment. |
| FinOps practices | Cloud and AI cost governance | when-justified | As infrastructure and AI costs grow. |

## Immediate next actions

| Action | State | Where |
| --- | --- | --- |
| Establish the supply-chain register and CI/CD controls | done-here | docs/SUPPLY-CHAIN.md, SUP |
| Add SBOM generation to the release process | done-here | .github/workflows/pages.yml |
| Create the data lineage and source-of-truth catalogue | in-progress | docs/FIELD-LINEAGE-AND-SOURCE-FRESHNESS.md; master TRUST rows |
| Adopt the immediate framework stack | in-progress | expansiongovernance.ts FRAMEWORKS — adopt now, mapping not written |
| Put the Credential Wallet in Phase 3, after data, privacy and issuer governance | done-here | docs/CREDENTIAL-WALLET.md; CRD is Tier 2, Phase 3 |
| Run a quarterly prioritisation review with the scoring model | open | expansiongovernance.ts priority(); docs/operating-model/OPERATING-RHYTHM.md holds the quarterly portfolio review |
| Require the decision gate for every long-horizon capability | done-here | expansiongovernance.ts admit() |
