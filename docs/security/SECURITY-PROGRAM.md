# Semester security program

> Owner: the security seat — held today by the founder, backup `UNASSIGNED`.
> Written 4 October 2026 against `main` at `7287ddc`. Review: monthly while any
> High finding is open, quarterly after. Index of the documents this one binds
> together; it replaces none of them.

## 0. Claim ceiling — read first

Semester has **no SOC 2 report, no ISO/IEC 27001 certification, no completed
HECVAT, no independent penetration test, no signed data-processing agreement
and no insurance.** Nothing in this program, its register or its tests changes
that, and nothing here may be quoted to a customer as if it did. The words a
procurement answer may use are *designed*, *in the repository*, *tested by CI*,
*measured on <date>*, and — only with a filed artifact — *evidenced*.
[`app/src/lib/securityprogram.test.ts`](../../app/src/lib/securityprogram.test.ts)
fails if this file affirms a certification. Legal and compliance conclusions
(what FERPA or a state law requires, notification duties, contract terms) are
for qualified counsel; where this program needs one it says *counsel decides*.

## 1. How to read this

The repository already has a policy for every area below — about 60 files in
[`docs/trust/`](../trust), a threat model, a severity table, a supply-chain
policy, an incident playbook. **Writing ten more policies would be the wrong
work.** A read of `main` found the gaps are operational: no alert reaches a
person, no static analysis ran, tenant isolation is a switch that is off, no
independent test, no filed access review, no restored production backup. So
each section says what exists, what this program adds, and what is still
missing. Gaps are tracked as findings in
[`FINDINGS-REGISTER.md`](FINDINGS-REGISTER.md); a gap is never described as
coverage.

| # | Area | Existing policy and enforcement | This program adds | Open |
|---|---|---|---|---|
| 1 | Architecture and threat model | `docs/SECURITY-THREAT-MODEL.md`, `docs/INTEGRATION-THREAT-MODEL.md`, `docs/trust/THREAT-MODEL.md` | §2 domain map, per-change record | Domain models for billing, community/media, LTI/SCIM/SSO, marketing site |
| 2 | Identity and privileged access | `docs/SSO-SECURITY-AND-SESSION-MANAGEMENT.md`, `docs/trust/PASSWORD-SESSION-AND-MFA-STANDARD.md`, `docs/security/operations-console-access-model.md` | §3 target controls | Passkey policy, session list, break-glass drill |
| 3 | Tenant isolation | `supabase/rls-coverage.check.sql`, `supabase/definer-sweep.check.sql`, `docs/TENANT-CONTRACT.md` | [`TENANT-ISOLATION-VERIFICATION.md`](TENANT-ISOLATION-VERIFICATION.md), `check.sh` guard | F-01, F-12 |
| 4 | Secure SDLC | `.github/workflows/ci.yml`, `docs/SUPPLY-CHAIN.md`, `.github/dependabot.yml`, `SECRETS.md` | §4 gate table; CodeQL; verified secret scanner | Attesting the deployed bytes, applied ruleset (F-09) |
| 5 | Data protection | `docs/trust/ENCRYPTION-AND-KEY-MANAGEMENT-STANDARD.md`, `RESTORE.md`, `RETENTION.md` | §5 by data store | F-02, F-03, production restore (E-02) |
| 6 | Vulnerability management | `SECURITY.md` severity table, `docs/trust/VULNERABILITY-MANAGEMENT-POLICY.md` | §6 intake, scoring, ageing | Acknowledgement clock, role mailbox (F-13) |
| 7 | Monitoring and IR | `MONITORING.md`, `docs/INCIDENT-RECOVERY-PLAYBOOK.md` | [`DETECTION-CATALOG.md`](DETECTION-CATALOG.md) | Everything routed (F-08) |
| 8 | Vendor risk | `docs/trust/VENDOR-RISK-REGISTER.md`, `docs/SUBPROCESSORS.md` | §8 tiers and evidence | No vendor assessed (E-04) |
| 9 | Evidence and questionnaires | `docs/trust/EVIDENCE-REGISTER.md`, `docs/trust/HECVAT-READINESS-MATRIX.md`, `docs/trust/SECURITY-QUESTIONNAIRE.md` | §9 response plan | Filed artifacts |
| 10 | Training, reviews, tabletops, audit | `docs/operating-model/OPERATING-RHYTHM.md`, `docs/PROOF-CALENDAR.md` | §10 calendar | E-03, E-05, E-06 |

## 2. Security architecture and threat model by domain

**Trust boundaries** (the platform-wide ones are B1–B8 in
[`docs/SECURITY-THREAT-MODEL.md`](../SECURITY-THREAT-MODEL.md)): browser ↔
Supabase API; browser ↔ Edge Functions (every `verify_jwt` is `false` by
design, so each function authenticates itself); Edge Function/gateway ↔
database with the service role (bypasses RLS); the AI path ↔ model providers;
LTI/SCIM/SSO ↔ institutions; staff console ↔ tenant data.

**Principles the architecture is held to.** Authorisation is decided on the
server and by the database, never by the client. Default-deny: a new table, RPC
or function is closed until opened on purpose. The tenant comes from a
membership the server holds, never from anything the request says. The service
role is for workers that filter by an identity they derived. Every consequential
action is audited in a table the actor cannot edit. AI is a service behind the
same policy: it reads only what the caller may read and acts only after a human
confirms.

| Domain | Crown-jewel data | Principal threats | Held by | Threat model today | Gaps |
|---|---|---|---|---|---|
| Identity and tenancy | accounts, memberships, role grants | account takeover; tenant spoofing; privilege escalation; SSO/SCIM abuse | RLS, `has_capability`, SSO membership binding | platform model B1–B8; `docs/SSO-SECURITY-AND-SESSION-MANAGEMENT.md` | F-01 |
| Student OS (planner, notes, files) | personal work, calendar, tokens | XSS token theft; shared-device residue; sync conflicts overwriting | per-user RLS, CSP | covered generally | F-02, F-03 |
| Academic records and grades | transcripts, grades, holds | unauthorised read/change; IDOR; grade tampering | dual control, hash-chained ledgers | `docs/security/ferpa-risk-and-permission-matrix.md` | F-10; legitimate-purpose taxonomy is counsel's |
| Learning / LMS (LTI) | launches, roles, passback | forged launch; replay; cross-deployment | pinned `RS256`, nonce spend, header refusal | `docs/INTEGRATION-THREAT-MODEL.md` | F-17 |
| AI services | prompts, retrieved records | prompt injection; exfiltration; cross-tenant retrieval; runaway spend | fence, clamp, kill switch, per-user cap | `docs/ai-toolkit/AI-TOOLKIT-THREAT-MODEL.md` | F-04, F-05; red-team AI-01…08 |
| Family and guardian | sharing scopes, consent | over-sharing; age/consent bypass | share tables, consent records | `docs/security/guardian-data-model.md` | AI-04 |
| Finance and billing | payment status, invoices | webhook forgery; entitlement tampering; replay | Stripe signature, idempotent events | **none separate** | DET-16; write it |
| Community and media | posts, uploads | harassment; unsafe media; cross-school visibility | private bucket, upload gate, moderation | `docs/COMMUNITY-MEDIA-SAFETY.md` | TI-08, TI-11 |
| Career and alumni | consents, portfolios | marketing to current students; broker misuse | consent per use | partial | counsel |
| Operations console | everything, by tenant | insider misuse; support over-reach | JIT/break-glass, two-person, audit chain | `docs/security/operations-console-access-model.md` | F-11 |
| Integrations (SCIM/SSO/SIS) | rosters, identities | token theft; poisoned roster | hashed bearer, allowlists | `docs/INTEGRATION-THREAT-MODEL.md` T1–T32 | — |
| Marketing / company site | leads | form abuse; claims drift | lead-intake RPC; claims tests | **none separate** | write it |

**Per-change threat records.** Any change across a boundary carries the record in
[`THREAT-RECORD-TEMPLATE.md`](THREAT-RECORD-TEMPLATE.md). The domain models above
marked *none separate* are written by the first change that touches the domain.

## 3. Identity, authentication, sessions, devices, privileged access

Target controls. *Proposal* means the owner has not decided it; a decision is
recorded as `docs/decisions/D-<pull request number>.md`.

| Control | Target | Exists | Gap |
|---|---|---|---|
| Staff and admin MFA | Phishing-resistant (passkey/WebAuthn) required for every console, provider and source-control account; SMS/phone is not an accepted factor for privileged actions | `private.mfa_fresh()` accepts totp, webauthn **and phone** (`supabase/migrations/20260929100000_console_control_plane.sql`) | *Proposal:* drop `phone` from privileged freshness; provider-console MFA is not checkable from the repo (self-attest and file) |
| Passkeys for students | Offered, not forced; recovery that does not weaken it | none described in the docs | Policy and enrolment flow |
| Session | Idle and absolute lifetimes, re-auth for sensitive actions, revoke-all on password/factor change | per-request `getUser` validation | Values not set; no session list; no `session_security_events` |
| Device | Lost-device revoke; shared-device mode that wipes on sign-out | "Erase from this device" exists | F-03 |
| Privileged access | JIT, purpose + ticket, time-boxed, two-person for dangerous actions, session audit | break-glass: 4 h cap, ticket, two approvers, fresh MFA, forced review | Never drilled (E-05); support is platform-scoped (F-11) |
| Break-glass | Sealed credential, alert on use (DET-01), review within the window, quarterly drill | table and caps exist | Drill, alert |
| Machine identities | Inventory of every key/token, owner, rotation date | `SECRETS.md` inventory; rotation log empty | Rotate-and-record the first |
| Joiner/mover/leaver | Grant on ticket, quarterly re-justification, removal same day | `docs/operating-model/OPERATING-RHYTHM.md` quarterly review | None filed (E-03) |

## 4. Secure SDLC and release gates

| Stage | Control | State |
|---|---|---|
| Review | Pull request required, code-owner review, resolved conversations, stale-approval dismissal | Defined in `.github/rulesets/main.json`; **applied?** unproven (F-09) |
| Secrets | gitleaks on the diff and the whole tree; secrets in provider stores only | Present; binary now checksum-verified (C-02) |
| SAST | CodeQL, `security-extended` | Added (C-01); runs where code scanning is available |
| DAST | StackHawk against the local preview | Present, gated on its secret; does **not** scan the Supabase API |
| Dependencies | `npm audit --audit-level=high`, grouped Dependabot, licence/registry/integrity checks | Present; audit is non-blocking by design (`.github/workflows/ci.yml`) |
| SBOM | CycloneDX on every deploy, kept 90 days | Present. `.github/workflows/supply-chain.yml` also attests an SBOM against the bundle it builds, and verifies it in the same run — **that bundle, not the bytes `.github/workflows/pages.yml` deploys** (see below) |
| Signing and provenance | Build-provenance attestation for the artifact that is deployed | **Partial.** `.github/workflows/supply-chain.yml` signs and verifies provenance for the bundle it builds from a clean checkout. Its own header says the deployed bytes differ (`.github/workflows/pages.yml` bakes in `VITE_BASE` and the demo build), so the deployed artifact is not yet attested; main records this as risk R-3 in `infra/README.md` |
| IaC and workflow scanning | Validate Terraform, and hold every workflow to a policy | **Present for Terraform and workflows:** `.github/workflows/infra.yml` runs `terraform validate` and an OPA policy over every workflow (checksum-pinned binary). **Not covered:** the Supabase migrations and `supabase/config.toml`, which the SQL suites test instead |
| Pinning | Every Action pinned to a SHA with a release comment | Enforced by `app/src/lib/supplychain.test.ts` |
| Policy tests | RLS, grants, definers, tenant isolation | `supabase/check.sh`; **now fails a silent suite** (C-03) |

**Release gate (every release).** `tsc -b`, lint, `check:university`, tests,
`test:shuffle`, build, `supabase/check.sh`, secrets, CodeQL (where available),
threat record present for boundary changes. **Additional gate for enabling an
institution:** the tenant release gate in
[`TENANT-ISOLATION-VERIFICATION.md`](TENANT-ISOLATION-VERIFICATION.md); AI
red-team set green; a rollback tried (`ROLLBACK.md`).

## 5. Data protection

| Store | In transit | At rest | Keys | Backup | Deletion | Gap |
|---|---|---|---|---|---|---|
| Postgres (Supabase) | TLS | provider-managed — **unverified** | provider | provider daily; retention not yet read off the dashboard (`RETENTION.md`); PITR state to be confirmed | `erase_account`, retention sweeps, legal holds | E-02 |
| Journal review bodies | TLS | AES-256-GCM (`app/server/institution/journal-crypto.ts`) | env-held key | with DB | 180-day purge | key inventory and rotation |
| Object storage | TLS, signed one-minute URLs | provider-managed | provider | provider | per retention | TI-08/TI-11 |
| Browser stores | TLS | **plaintext** | none | none | manual erase only | F-02, F-03 |
| Logs | TLS | provider | provider | none | per provider | no sink or retention set (F-08) |
| AI providers | TLS | provider | provider | n/a | `store: false`; **not** proof of zero retention (`docs/trust/AI-DATA-USE-STANDARD.md`) | contract terms are counsel's |

**Keys and secrets.** Four stores, inventory by blast radius in
[`SECRETS.md`](../../SECRETS.md); service-role key and Supabase access token
first. Rotation is rehearsed once, recorded in the log (currently empty), then
on a schedule: service/signing keys annually and on any suspected exposure;
provider tokens on staff change. **Local and device data.** No SQLCipher exists
in the code (docs say so); until it does, the offline contract must not describe
local data as encrypted. **Backups.** A backup is not evidence until restored:
E-02 is a restore of production from a provider backup with RTO/RPO measured,
repeated after any infrastructure change and at least annually.

## 6. Vulnerability management

- **Sources:** Dependabot, `npm audit`, CodeQL, StackHawk, gitleaks, provider
  advisories, outside reports to the security contact, the quarterly manual
  attempt (§10).
- **Severity and clock:** the table in [`SECURITY.md`](../../SECURITY.md) —
  critical 2 days, high 14, medium 60, low 180 — held to
  `PATCH_POLICY` by a test, and restated in
  [`docs/infrastructure/VULNERABILITY-MANAGEMENT.md`](../infrastructure/VULNERABILITY-MANAGEMENT.md)
  with the same numbers (D-124); a critical advisory in a production dependency
  also blocks `main` through `.github/workflows/supply-chain.yml`. Any suspected read of another account's rows is
  critical until disproven.
- **Scoring — proposal.** Score with CVSS v4.0 base for a vendor-assigned CVE or
  a scanner finding, then adjust to the table: **raise** one level when the
  asset holds student records or the path is internet-reachable without
  authentication; **lower** one level only with a recorded compensating control.
  CVSS never lowers a cross-tenant finding below Critical.
- **Register and ageing:** [`FINDINGS-REGISTER.md`](FINDINGS-REGISTER.md); open
  past due with no compensating control is reported at the next weekly review.
  Metrics: open by severity, median age, % closed in clock, repeat root causes.
- **Acknowledgement:** with one reader the honest clock is "when the owner next
  reads mail"; a role mailbox and a stated acknowledgement time are F-13 and a
  precondition of any bug-bounty or customer commitment. Safe-harbour wording
  for researchers is counsel's.

## 7. Monitoring, detection and incident response

See [`DETECTION-CATALOG.md`](DETECTION-CATALOG.md): sixteen detections with
sources, severities and routes; staged SIEM; the AI red-team set; and the
incident-record requirements. Exit criterion for F-08: DET-01 to DET-06 page a
human and a delivery test is filed. Notification duties to students,
institutions and regulators are decided by counsel per jurisdiction; the
72-hour notice clock in `SECURITY.md` is the one commitment already made.

## 8. Third-party and vendor risk

| Tier | Meaning | Before use | Cadence |
|---|---|---|---|
| 1 | Holds or processes student records or credentials (database host, auth, AI providers, email, payments) | Security review against the questionnaire; their report or attestation **obtained and read, not assumed**; DPA reviewed by counsel; subprocessor entry; exit plan | Annually and on any breach notice |
| 2 | Sees metadata or can reach production (CI, monitoring, DNS/CDN) | Short review; scoped tokens; least privilege | Annually |
| 3 | No data access (design, analytics without identifiers) | Listed | At renewal |

Every vendor has an owner, a tier, the data classes it sees, a review date and an
exit plan (what we do if they go away or are breached). The register is
[`docs/trust/VENDOR-RISK-REGISTER.md`](../trust/VENDOR-RISK-REGISTER.md) and the
published list is [`docs/SUBPROCESSORS.md`](../SUBPROCESSORS.md), kept in step by
a test. **Today no vendor has been assessed** (E-04); the first reviews are the
database/auth host and the AI providers. A vendor's own SOC 2 or ISO report is *their* report and is never cited as ours.

## 9. Evidence library and procurement questionnaires

**Evidence classes** (as `EVIDENCE-REGISTER.md` already defines): policy
(document), design, automated check (test/CI run bound to a commit), measured
record (dated, with the figures), outside assessment. Each artifact has an
owner, a date, an expiry and a path under `docs/evidence/`; an expired artifact
stops supporting its answer
([`app/src/lib/ops/claims.test.ts`](../../app/src/lib/ops/claims.test.ts) holds expiry).

**Answering a questionnaire** (a HECVAT, SIG Lite, CAIQ, VPAT or custom RFP) is never done from memory:

1. Start from the readiness matrix and the draft response, never from memory.
2. Every *Yes* cites a filed artifact or a CI check on a named commit. No
   artifact → *No*, *Partial*, or *Planned with date*; never a hopeful *Yes*.
3. Anything legal (data-processing terms, breach duties, liability, FERPA
   characterisation) goes to counsel before it is sent.
4. Record who answered, from which commit, and when; reuse only unexpired answers.
5. A *No* is a roadmap item with an owner, not an apology: it points at a finding
   or evidence-owed row.

**Today's honest answers:** pen test — No (E-01); SOC 2 — No; ISO 27001 — No;
HECVAT — draft, not a completed submission; DPA — template, none signed;
SSO/MFA — designed, partly evidenced; encryption at rest — provider-managed,
unverified; incident response — documented, never exercised in the target
environment; backup restore — logically rehearsed, production not restored.

**Evidence to produce first, in this order:** applied-ruleset read-back (F-09) →
first rotation log entry → provider backup restore (E-02) → first access review
(E-03) → first vendor assessment (E-04) → break-glass drill (E-05) → pen-test
scoping.

## 10. Training, access reviews, tabletops, audit schedule

| When | Activity | Output filed under `docs/evidence/` |
|---|---|---|
| Weekly | Findings register; detections digest; `MONITORING.md` ten-minute read | one line in the register |
| Monthly | Dependency and Action review; secrets inventory check; re-check this file's claims against the code | dated note |
| Quarterly | **Privileged-access review** (every grant re-justified from the role-grant audit); **vendor review**; **break-glass drill**; **manual isolation attempt** (§2, TI list); tabletop (below) | review record; drill record; new TI/DET if anything was found |
| Semi-annually | Restore rehearsal; kill-switch drill (`drill:killswitch`) including the gateway | measured RTO/RPO; drill JSON |
| Annually | Pen test (once commissioned); policy review; training refresh; key rotation; full re-read of the threat models; `security.txt` renewal | report; signed review |
| On hire/role change | Training before access; access on ticket | training record |
| On any incident | Post-incident review within 10 working days | review → new detection or test |

**Training (minimum, per person with any access):** phishing and credential
hygiene; handling student records (what FERPA-style rules mean in practice, as
counsel explains them); secrets and the incident first moves; AI and
prompt-injection basics for anyone who touches prompts. Recorded by date and
person; none exists today (E-06).

**Tabletop scenarios (rotate, one per quarter):** (1) a second school's member
reads another's room; (2) service-role key in a public gist; (3) poisoned
roster via SCIM; (4) compromised dependency in a release; (5) prompt injection
that gets a record out; (6) insider support over-reach; (7) database host outage
with a provider restore; (8) ransom-style deletion with legal hold active.
Each ends with the **notification decision** being made, by counsel.

## 11. Owners

One person holds every seat today (the founder), with every backup
`UNASSIGNED`; this program makes no claim of separation of duties it does not
have. Seats, as `docs/trust/EVIDENCE-REGISTER.md` names them:

| Seat | Owns here | Backup |
|---|---|---|
| Security lead | §3, §4, §6, §7, F-01/F-08/F-09 | UNASSIGNED |
| Engineering lead | F-02, F-17, F-14, TI-10, release gates | UNASSIGNED |
| Platform | F-06, F-07, F-10, log drain and alert routing | UNASSIGNED |
| AI governance | F-04, F-05, AI-01…08 | UNASSIGNED |
| Privacy / counsel liaison | notification decisions, DPAs, safe harbour, §9 legal answers | external counsel |
| Customer trust | §9 questionnaires, trust room | UNASSIGNED |

**Trigger to change this:** the first institutional pilot, or any second person
with production access, requires a named backup for Security lead and a second
reviewer on the ruleset. Until then the compensating control for self-approval
is the CI gates above plus a recorded read-back of what the founder approved.

## 12. 30 / 60 / 90 days

| By | Do | Done when |
|---|---|---|
| 30 days (2026-11-03) | Apply the ruleset and file the read-back; route DET-01–DET-06 to a paging channel and file delivery tests; turn on `enforce_membership` in staging and land TI-01–TI-05; decide F-03 (shared-device erase); choose the role mailbox; first rotation entry | F-09, F-08 closed or compensated; TI-01–05 green |
| 60 days (2026-12-03) | TI-06–TI-12; move provider tokens server-side or document the limit (F-02); decide F-04; header-capable host (F-06); first vendor assessments (database/auth, AI); provider restore (E-02); first access review | F-01 closable; E-02, E-03, E-04 filed |
| 90 days (2027-01-02) | AI red-team on the deployed path; attest the bytes `.github/workflows/pages.yml` deploys (R-3); break-glass drill; tabletop 1; pen-test scope and quote | AI-01…08 green; E-05 filed; E-01 scoped |

**Not claimed at day 90:** SOC 2, ISO 27001, HECVAT completion, or independent
assurance of any kind. Those need an outside party and, for SOC 2, an
observation period.
