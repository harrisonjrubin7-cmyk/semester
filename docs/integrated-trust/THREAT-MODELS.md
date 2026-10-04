# Threat models for the domains that had none

Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

**Status: drafted, not reviewed.** These models were written from the repository on 4 October 2026, from the survey recorded in the [domain requirements](DOMAIN-REQUIREMENTS.md). The platform threat model, `docs/SECURITY-THREAT-MODEL.md`, covers identity, tenancy, billing and AI in general; the integration model covers connectors; the AI toolkit model covers the client-only toolkit. Nothing covered uploads, family sharing, listings, the installable app, career records, Community or staff access as a domain. A draft is not a review: the security and privacy seats turn a model into a held one by signing it and tying each high row to a test or check (item RM-31). The security seat has no holder today. No adversarial test has been run against any of this.

**How to read a row.** *Control* is what must be true. *Today* is what the tree shows: an ID from the [control register](CONTROL-FRAMEWORK.md) where one applies, `none` where nothing exists, and the file that would prove it. *Test that must exist* is the guard whose absence means nobody would notice the control being removed. Severity is the platform's: a threat that can cross a tenant boundary or alter an official record is SEV1 if it happens.

Each model uses the same six letters: **S**poofing, **T**ampering, **R**epudiation, **I**nformation disclosure, **D**enial of service, **E**levation of privilege.

---

## T1. Student documents and uploads

**Assets.** Notes, documents, sheets and decks held as account state; attachments held on the device; images posted to Community; files read by the capture extension and the source checker; export files.
**Boundaries.** Device storage ↔ browser; browser ↔ database API; browser ↔ storage bucket; server function ↔ a URL a user supplied.

| | Threat | Control | Today | Test that must exist |
|---|---|---|---|---|
| T | A shared document is edited by someone whose access was revoked | Membership and permission re-checked on every sync, not only on open | Shares are expiring and revocable (TC-PRV-05); the document collaboration surface is not modelled | A check that a revoked member's queued edit is rejected on reconnect |
| I | An export file left on a shared device, or a link that outlives its purpose | Exports are generated on demand, never stored server-side; any signed link expires in minutes | Export is a single JSON response; no stored export (TC-PRV-01) | A test that no export is persisted, and that a signed URL's lifetime is bounded |
| I | A server function fetches a URL the user supplied and returns an internal address | Public addresses only, resolved at connect time, not by name | `productivity-sourcecheck` resolves DNS and refuses non-public addresses; `fetchcal` and `canvas` check by name only and have no per-user limit | A rebinding test for each function that fetches a user URL |
| I | A malicious or oversized file is parsed in the browser or a function | Size and type limits before parsing; parsing in a sandbox; no execution | Community images are limited to 10 MB and three types; other uploads have no stated limit | A fuzz or fixture test per parser, and a size limit stated per route |
| T | An uploaded image carries location data or hidden content | Metadata stripped on the device and re-checked server-side | Stripped on the device; the scanner that re-checks is not deployed (TC-TSF-03) | A test that an image with location data never reaches the bucket |
| D | One account fills storage or floods the parser | Per-account quota and rate limit | Direct inserts into fourteen tables are rate-limited; RPC calls are not (risk R-12, accepted) | A quota check on the bucket and on document size |
| R | A user disputes that they submitted or deleted something | A receipt and an audit row for submission and deletion | Submission receipts are a requirement of the learning domain; deletion is audited at the account level (TC-PRV-01) | A test that a submission returns a receipt only after durable storage |

## T2. Family and guardian access

**Assets.** Verified relationships; sharing scopes; the records they expose (grades, bills, alerts); the minor flag.
**Boundaries.** Student ↔ supporter; supporter ↔ institution; the student turning eighteen.

| | Threat | Control | Today | Test that must exist |
|---|---|---|---|---|
| S | Someone claims to be a guardian or payer | A verified relationship, with evidence kept, before any grant is usable | Staff create and verify a guardian link; the student sees but cannot end it (TC-PRV-06); adult supporter grants require a verified recipient | A check that an unverified link reads nothing, for both tables |
| E | A guardian reads more than was shared | Category-specific, expiring, revocable scopes; reading is a projection, not the table | `guardian_may_read` and `family_grants` are separate and can drift (P1 in the FERPA matrix); a single projection service does not exist | A parity test: for every category, both paths return the same rows |
| I | Payment-only access discloses records | A payer sees amounts due and nothing academic | Stated in CAP-041's acceptance; tested in `family.test.ts` | Keep; add a negative per academic category |
| T | A link outlives the student's eighteenth birthday | Age read at query time, not cached | `private.is_minor` is evaluated at query time (TC-PRV-06) | Keep |
| R | A student cannot tell who saw what | Reads log reader, time and fields, visible to the student | Reads log reader and time only; no fields, purpose or basis (TC-PRV-05) | A check that a read records the category read |
| I | A revoked share still serves from a cache | Revocation reaches every cache and offline copy | Not proved live; "immediate multi-cache revocation" is listed unproved in the FERPA matrix | A test across the service worker cache and the sync queue |
| E | Parental consent for a child under the minimum age is bypassed | Accounts under thirteen are refused at sign-up | Refused in SQL; parental consent (COPPA) has not begun counsel review (requires qualified human counsel review) | Keep; no relaxation without a decision record |

## T3. Marketplace and partner listings

**Assets.** Listings and offers; publisher identity; any order, payment or payout (none exist); disclosures to students.
**Boundaries.** Publisher ↔ platform; platform ↔ student; platform ↔ payment processor.

There is no marketplace in the tree. `public.opportunities` has drafts, a moderation queue and https-only links, and that is all. The register defers anything more until trust-and-safety, financial and legal infrastructure exist. This model is the entry criteria, written before the commerce, so the controls can be required rather than retrofitted.

| | Threat | Control | Today | Test that must exist |
|---|---|---|---|---|
| S | A fake employer or landlord | Identity and business verification before the first listing; a visible verified state | Publishers hold a role; no verification step | A check that an unverified publisher's listing cannot reach `published` |
| T | A listing is edited after approval to carry a harmful link | Re-review on any change to link or terms | Edit after publish is not tested | A check that an edit to a published listing returns it to review |
| I | A partner receives student data beyond the offer | Purpose-limited disclosure with a snapshot and a receipt | The FERPA matrix lists this as a P2 gap: no disclosure snapshot, no delivery receipt, no retention | A test that no student field is in any partner-facing view |
| R | A dispute over what was promised | An immutable record of the listing as shown at acceptance | None | A hash of the listing stored with the acceptance |
| E | A publisher role reaches other tenants' students | Publisher sees own listings and orders only | `marketplace_partner` holds `opportunity:publish` only | A role-matrix check, as for the integration tables |
| D | A flood of listings or reports | Per-publisher quotas; report-driven removal | Rate limit on direct inserts (TC-SEC-01 neighbour) | A quota test on listings |
| — | Fraud, unsafe offers, housing and deal scams | Reporting on a listing, removal by a moderator, refund and dispute paths, sanctions and tax screening where payments exist | None of the four exists | Entry criteria in [trust and safety](TRUST-AND-SAFETY.md#6-marketplace-entry-criteria) |

## T4. Mobile, offline and the installable app

**Assets.** The offline workspace; the sync queue; cached official data; the session token.
**Boundaries.** Device storage ↔ other apps and users of the device; device ↔ sync service; service worker ↔ network.

Semester is a web app and an installable PWA. There is no native client, no encrypted local database and no Dynamic Type or TalkBack work, so a native threat model is not drafted; it is item RM-48's neighbour and must precede any native build.

| | Threat | Control | Today | Test that must exist |
|---|---|---|---|---|
| I | A lost or shared device exposes the workspace | Sensitive classes are not cached, or are encrypted and expire | Browser persistence is not centrally classified or encrypted (P1 in the FERPA matrix); the session is in `localStorage` (G-22) | A classification table for every stored key, and a test that restricted classes are never written |
| I | Integration tokens in `localStorage` | Tokens held server-side or short-lived | Open (G-22) | A test that no integration token is stored client-side |
| T | A stale offline write overwrites a newer server value | Server-authoritative commands; idempotency keys; visible pending state | Sync conflict simulations exist; the contract for grades, registration and billing is server-only | A test that an offline queue cannot submit a registration or a payment |
| E | Revocation does not reach an offline device | Re-authorization on reconnect before the queue drains | Not proved | A test that a revoked session's queue is discarded, not replayed |
| S | A cached shell served by the service worker masks a failed backend | Health probes bypass the worker | Fixed on 28 September and guarded in `statuspage.test.ts` | Keep |
| D | The cache grows without bound on a low-end device | Quotas and eviction | A performance plan exists; no quota test | A test of the eviction rule |

## T5. Career, portfolio and credentials

**Assets.** Portfolio artefacts, applications, mentor and employer relationships, claimed and verified achievements.
**Boundaries.** Student ↔ employer or mentor; student ↔ verifier; minor ↔ any of them.

| | Threat | Control | Today | Test that must exist |
|---|---|---|---|---|
| S | A fabricated credential or a fake verifier | Verified achievements are signed by the issuer and labelled; self-asserted ones are labelled | `CREDENTIAL-WALLET.md` is a product document; no issuer verification exists | A test that a claim without an issuer signature cannot display as verified |
| I | Employer visibility exposes a student who did not opt in | Visibility is opt-in, per employer or category, revocable | Minors are excluded in SQL (TC-PRV-06); opt-in for adults is a product rule without a check | A check that default visibility is none |
| I | Ranking students for employers | Prohibited at AI intake | Refused at intake (TC-AI-03) | Keep; add a test that no route exposes a ranked list |
| T | A student edits an issued credential | Issued records are append-only and hash-chained | The academic ledger is chained; the credential wallet is not | A chain check on the wallet |
| E | Alumni access outlives affiliation | Access follows affiliation end dates | Memberships carry end dates in the design; not modelled for alumni | A check that an ended affiliation loses role grants (the SCIM trigger covers school scope only) |

## T6. Community

**Assets.** Posts, aliases, reports, cases, decisions, media, safety entries, volunteer work.
**Boundaries.** Author ↔ reader; reporter ↔ reviewer; volunteer ↔ staff; platform ↔ institution (escalation).

Community has a privacy model, a media-safety document, a moderation procedure and a 1,798-line database suite. It had no STRIDE model. It is held off in production.

| | Threat | Control | Today | Test that must exist |
|---|---|---|---|---|
| I | An alias is unmasked casually | Reveal only through a case, four hours, by a different reviewer, logged | In place (TC-TSF-02) | Keep |
| I | A reporter is identified to a reviewer or to the reported | `reporter_id` granted to nobody through the API | In place | Keep |
| I | Moderator reads of the queue are invisible | Every read of a case logged | Not logged (TC-TSF-02) | A check that opening a case writes an event |
| T | History of a case is edited or deleted with the case | Immutable case events, kept per retention | No immutability trigger (register MOD-004) | A trigger and a check that an update is refused |
| E | A volunteer removes content alone | Two independent agreeing volunteers; P2 and above are staff only | In place | Keep |
| S | A coordinated report campaign silences someone | Reports from a brigade set aside; automation can only protect | In place (`TRIAGE_THRESHOLDS`) | Keep |
| R | A decision cannot be explained | Reason code on every decision; appeal to a different reviewer | In place | Keep |
| D | A posting flood | Rate limits; burst detector | Thirty posts per hour; burst detector at eight in ten minutes | Keep |
| — | Abuse material, self-harm, threats | Preserve, report, route to a professional, never delete a match | Routing exists; reporting, takedown clock, scanner, escalation sender and coverage do not (TC-TSF-03 to 05) | Community stays off until these exist (RM-11, RM-36) |

## T7. Support and staff access

**Assets.** Student data reachable by staff; console actions; break-glass grants; support notifications.
**Boundaries.** Staff role ↔ tenant data; support agent ↔ student content; founder ↔ every seat.

| | Threat | Control | Today | Test that must exist |
|---|---|---|---|---|
| E | A support agent browses records out of curiosity | Access only through a student-granted, expiring, reasoned grant, visible to the student | In place (TC-SUP-01) | Keep |
| E | A global "see as the user" feature is added | None may exist | True by absence, unguarded (TC-SUP-03) | A database check that no function returns another account's rows outside grant tables |
| E | Break-glass is used for more than it was approved for | Scope and expiry enforced by the same predicate that grants access | The grant is recorded and reviewed; nothing consumes it (TC-SEC-09) | A check that a widened read happens only inside scope and before expiry |
| R | A staff action cannot be attributed | Audit row written first, never swallowed | In place (TC-SEC-08) | Keep |
| E | One person holds every role | Two people for high-impact actions; a second reviewer for the AI switch | Self-approval is refused in SQL; the second person does not exist | Exercise TT-02 and TT-08 |
| S | Phishing of a support agent | Multi-factor for staff; a known-address list | Console multi-factor only (TC-SEC-10); provider-console multi-factor is an attestation | An `aal2` requirement on every staff role |
| I | A support reply notification leaks content | Opt-in, no content, opt-out cancels unclaimed rows | In place (support notification consent boundary) | Keep |

## T8. Sessions, recovery and sign-in

**Assets.** Session tokens; recovery flows; sign-in records; device list.
**Boundaries.** Browser ↔ auth service; email ↔ recovery.

| | Threat | Control | Today | Test that must exist |
|---|---|---|---|---|
| S | Credential stuffing | Rate limits and breach-password checks at the auth service; step-up on a new device | Supabase defaults only; configuration is dashboard-only (`config.toml` has no auth section) | The auth configuration in the repository, with a test that reads it |
| E | Account takeover through recovery | Recovery verifies the mailbox and notifies the old address | Defaults | A test of the recovery flow's notices |
| I | A stolen token is usable indefinitely | Short sessions; revocation on sign-out everywhere | Persistent session in `localStorage`; "sign out other devices" exists; no session list, no operator-driven global revoke | A check that revoke-all invalidates a token |
| R | A user cannot see their devices | A session list with last use | None | A screen and its test |
| D | Lockout of a legitimate user by attackers | Lockout that does not block recovery | Unknown | A test of the lockout rule |

---

## Rules for adding a model

1. A model is written when a domain gets its first real user, not after.
2. Every row that can cross a tenant boundary or alter an official record names a test or check, and the model is `held` only when that test exists.
3. A threat model never certifies anything. It lists what would have to be true.
4. Findings from a penetration test are rows here, with the test that now guards each.
