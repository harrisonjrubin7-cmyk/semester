# Security findings register

> Owner: the security seat (held today by the founder; backup `UNASSIGNED`).
> Opened 4 October 2026 from the read of `main` at `7287ddc`. Part of
> [`SECURITY-PROGRAM.md`](SECURITY-PROGRAM.md).

**What this is.** One list of what is wrong, how bad, who owns it, and what
closes it, on the severity clock that [`SECURITY.md`](../../SECURITY.md) already
defines (critical 2 days, high 14, medium 60, low 180; the clock starts when the
finding is **confirmed**). **What it is not:** a penetration test, an
independent assessment, or evidence that anything not listed is fine. Nothing
here has been tested by an outside party.

**Status of the severities.** They are *proposed* by the author of this
register. The clock starts only when the owner confirms a finding, and the
"due if confirmed" column assumes confirmation on 4 October 2026. No finding
has been held to a clock yet (see `SECURITY.md`, "Two honest limits").

**Verified** says how the claim was established: **read** means the cited line
was read in the code while writing this register; **reported** means a
read-only audit reported it with that reference and it has not been re-read —
re-read it before closing the finding on the strength of this row.

## Open

| ID | Sev | Finding | Evidence | Verified | Closes when | Due if confirmed | Owner seat |
|---|---|---|---|---|---|---|---|
| F-01 | High | Tenant isolation is a per-school switch that is **off for every school**, and covers course rooms only. A confirmed address of any domain can enter any school's room. Becomes **Critical** the day a second real institution is live with the switch off. | `supabase/tenancy.check.sql:36-41`, `supabase/migrations/20260930185000_school_membership_enforcement.sql:19,41` | read | Enforcement is on for every institution before its pilot, and the verification suite in [`TENANT-ISOLATION-VERIFICATION.md`](TENANT-ISOLATION-VERIFICATION.md) (TI-01 to TI-12) runs in CI | 2026-10-18 | Security lead |
| F-08 | High | Nothing alerts anyone. One cost alert exists; detection is a weekly ten-minute manual read. No log sink, no routing, no on-call. | `MONITORING.md`, `docs/trust/LOGGING-MONITORING-AND-ALERTING-STANDARD.md` | read (MONITORING.md) | DET-01 to DET-06 in [`DETECTION-CATALOG.md`](DETECTION-CATALOG.md) route to a channel a human is paged on, and a delivery test is filed | 2026-10-18 | Security lead |
| F-02 | Medium | OAuth access and refresh tokens (calendar, mail, video) and the user's own AI API keys sit in plaintext in `localStorage`. Anything that runs script on the origin reads them. CSP `script-src 'self'` is the only barrier. | `app/src/lib/connect.ts:174`, `app/src/lib/assistant.ts:102,120` | read | Provider tokens move server-side (refresh tokens never reach the browser) or into a non-extractable store; BYO keys are optional and session-scoped | 2026-12-03 | Engineering lead |
| F-03 | Medium | Signing out clears no local data, and deleting the account removes the server copy only: grades, chat history and drafts stay in the browser stores until the user finds "Erase from this device". On a shared lab machine the next person reads them. | `app/src/lib/cloud.ts:449-451` (read); `cloud.ts:1616-1659`, `app/src/lib/erase.ts:135-173` (reported) | read (sign-out) | Product decision recorded: either sign-out offers a one-step erase (default on shared-device sessions) or the offline contract says plainly what stays; the service-worker caches are included | 2026-12-03 | Product + security |
| F-04 | Medium | The bring-your-own-key route calls the model provider straight from the browser, so the AI kill switch and a school's AI-off policy do not reach it. | `app/src/lib/claude.ts:938-942` | read | Either the route is disabled for any account in a tenant with AI off, or a client-side check of the same kill-switch row is added and the limit is stated in the AI inventory | 2026-12-03 | AI governance |
| F-05 | Medium | The institution gateway's OpenAI provider puts the question and the evidence straight into the user turn, without the untrusted-text fence the client uses; the shared-key function forwards `system`/`messages` unchanged, so the server cannot enforce one. No PII redaction or data-class gate exists on the shared-key or BYO path. The gateway is not deployed, so exposure today is the shared-key path. | `app/server/institution/providers/openai.ts:34-67`, `app/src/ai/untrusted.ts:20-25`, `supabase/functions/_shared/clamp.ts` | reported | AI-01 to AI-08 in [`DETECTION-CATALOG.md`](DETECTION-CATALOG.md) (red-team set) pass against the deployed path, and the fence is applied server-side | 2026-12-03 | AI governance |
| F-06 | Medium | Production is served from GitHub Pages, which cannot send headers. HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy` and `frame-ancestors` are not delivered; clickjacking is open and CSP violations report nowhere. The repo's own `index.html` says so. | `app/index.html:6-17`, `app/vercel.json`, `app/public/_headers` | read | Production is served from a host that sends the headers (the header files already exist), or an edge in front of Pages adds them; verified by a scan of the live origin | 2026-12-03 | Platform |
| F-09 | Medium | One person owns everything and approves nothing independently. The branch ruleset is defined in the repo and documented as "not active until the owner applies it"; no record shows it was applied. | `docs/BRANCH-PROTECTION.md:3-9`, `.github/rulesets/main.json`, `.github/CODEOWNERS` | reported | The ruleset's read-back is recorded under `docs/evidence/security/`, and a second reviewer or an explicit compensating control is named | 2026-12-03 | Security lead |
| F-10 | Medium | Gateway audit tables are not hash-chained and the service role holds `delete` on them; the ledger chains have no signature and their verifier is not scheduled. Someone with the service key can erase the trail. | `supabase/migrations/20260924184500_gateway_action_journal.sql:95-96`, `supabase/migrations/20260930110000_ledger_chains.sql` | read (grants) | Audit tables are append-only for the service role; chain verification runs on a schedule and a break pages a human (DET-05) | 2026-12-03 | Platform |
| F-12 | Medium | Verification has gaps: the open-read sweep flags only a literal `true`; `private` and `storage` have no RLS/policy sweep; about 18 `public` tables are not named by any suite (word-match, not run); definer sweep calls with neutral arguments so it cannot catch an IDOR on a real id. | `supabase/rls-coverage.check.sql:124,60-66,146-150`, `supabase/definer-sweep.check.sql:29-33` | reported (`using (active)` on `commercial_products` read) | TI-04, TI-07, TI-08, TI-10 land | 2026-12-03 | Security lead |
| F-11 | Low | Support access is platform-scoped: any holder of `support:ticket` reads every tenant's reply outbox. Fine with one operator; wrong with two. | `supabase/functions/support-reply-notify/index.ts:73` | reported | Support reads are tenant-scoped and time-boxed (see [`operations-console-access-model.md`](operations-console-access-model.md)) before a second support grantee exists | 2027-04-02 | Support + security |
| F-07 | Low | CSP `connect-src` allows `https://*.supabase.co` and `wss://*.supabase.co`, so injected script could send data to any Supabase project, and `style-src` allows `'unsafe-inline'`. | `app/vercel.json:11` | read | The project's own host replaces the wildcard | 2027-04-02 | Platform |
| F-17 | Low | The LTI launch redirect carries the user's email and a one-use token in the query string; the app strips them from the address bar on landing, but they exist in the redirect and, until stripped, in referrers. | `supabase/functions/lti/index.ts:860-870`, `app/src/lib/ltilanding.ts` | read | A server-set cookie or one-time server lookup replaces the email in the URL | 2027-04-02 | Engineering lead |
| F-13 | Low | `security.txt` is served under the Pages base path, not the origin root, and the contact is a personal mailbox. | `app/public/.well-known/security.txt` | reported | A role mailbox on a company domain, served at `/.well-known/` | 2027-04-02 | Security lead |
| F-14 | Low | The TURN credential is carried in the page for every visitor. | `SECRETS.md` (`VITE_TURN_USER`, `VITE_TURN_PASS`) | reported | Short-lived credentials minted per session | 2027-04-02 | Engineering lead |

## Closed by this change

| ID | Was | Now | Held by |
|---|---|---|---|
| C-01 | No static analysis of the source anywhere in CI | `.github/workflows/codeql.yml`: CodeQL, `security-extended`, weekly and on every pull request. **Runs only when code scanning is available** (public repository, or `CODEQL_ENABLED=true`); until then it is skipped, and this row is not a claim that SAST has run | `app/src/lib/supplychain.test.ts` (approved Action, pinned SHA, least-privilege token) |
| C-02 | The full-tree secret scan downloaded a binary and ran it with no integrity check | The download is checked against the SHA-256 in the publisher's checksums file before it is unpacked | `.github/workflows/ci.yml`, `app/src/lib/securityprogram.test.ts` |
| C-03 | `supabase/check.sh` passed any suite that printed no `ERROR`, so an empty suite or a missing `\ir` target read as green; two real suites printed no `ok` line | A suite with no `ok` notice fails; both suites now end with one | `supabase/check.sh`, `app/src/lib/securityprogram.test.ts` |

## Evidence owed (not findings; nothing is wrong, it has not been produced)

| ID | Evidence | Why it matters |
|---|---|---|
| E-01 | Independent penetration test | No outside party has tested; plan in `docs/trust/PENETRATION-TEST-PLAN.md` |
| E-02 | A restore of **production** from a provider backup, with RTO/RPO measured | Only a logical rehearsal exists: `docs/evidence/restore/2026-09-30-logical-rehearsal.md` |
| E-03 | A quarterly privileged-access review filed | The procedure exists in `docs/operating-model/OPERATING-RHYTHM.md`; none is filed |
| E-04 | A vendor assessed against [`SECURITY-PROGRAM.md`](SECURITY-PROGRAM.md) §8 | `docs/trust/VENDOR-RISK-REGISTER.md` says none has been |
| E-05 | A target-environment tabletop and break-glass drill | `docs/evidence/operations/2026-10-03-founder-readiness-tabletop.md` is document-level |
| E-06 | Security-awareness training record for every person with access | None exists |

## Ageing

A finding past its due date with no recorded compensating control is reported at
the next weekly review. The register is reviewed weekly while any High is open,
monthly after. Closing a finding means the **Closes when** condition holds *and*
the evidence is filed under `docs/evidence/security/`.
