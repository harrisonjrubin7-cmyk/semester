# Security gap audit, 30 September 2026 (D-160)

**What this is.** A requirement-by-requirement read of `main` (`c369196`) and the
open drafts against the FERPA/LTI checklist and the architecture-hardening
briefs, with what was fixed, what was left, and why. **What it is not:** a
penetration test, a code-level security certification, or a statement that
Semester meets any regulation. Nothing here is a claim that Semester is FERPA
compliant, certified, or ready for a pilot; those need evidence and counsel
review that do not exist yet (see [Claims](#claims)).

The PDFs (`docs/expansion/Architecture-Audit-Summary-and-Hardening-Scorecard.pdf`,
`FERPA-Consent-AI-Training-Policy-and-800-1-Checklist.pdf`,
`LMS-Migration-Runbook-Blackboard-Moodle-and-Shared-Object-Model.pdf`,
`EdTech-Stack-Audit-LTI-AI-Grading-and-API-Extensibility.pdf`) were read as
**evidence, not authority**. Where a PDF and the code disagree the code was
read, and where a requirement came only from the request, the table says so.

Read on the schema built from every migration, not on production. Nothing was
applied to production; nothing here used real student data or created a credential.

## De-duplication

| Where | What is there | Consequence |
|---|---|---|
| `main` | `decide()` (`packages/institution/src/policy.ts`), `private.has_capability`, break-glass (`20260929110000`), support/advisor/family shares, hash-chained console audit, LTI launch checks, SCIM, integration control plane, Migration Center | Built on, not re-implemented |
| #1012 (hardening) — **merged** during this work | `public.legal_holds`, `private.tenant_is_held`, hold-gated sweeps and erase; hash chains on the academic and student-account ledgers; a break-glass override audit hook | Legal holds are not re-implemented; the roster tables call `private.tenant_is_held` (see Coordination) |
| #1021 (full beta) | School offboarding (`school_offboarding`, `propose/approve/…_offboarding`), school-membership requests, advisor-share audit | School-level offboarding is not re-implemented. This change adds the **person-level** case (a member deprovisioned by SCIM), which #1021 does not touch. Its migrations use `20260930100000`, `110000`, `200000` |
| #1019 | `tenantcontract.ts` (pure), exit plans, policy drift | No overlap |
| This change | `20260930210000`, `20260930220000` | Free on `main` and in every open draft at the time of writing. #1021's `20260930100000` and `110000` now collide with what #1012 merged there and need renumbering; that is #1021's to do |

Decision numbers up to D-159 are taken or claimed by `main` or open drafts (several drafts claim D-155 and D-156). This is **D-160**; if another draft takes it first, renumber this one.

## The checklist against the code

`P` present · `~` partial · `M` missing · **Fixed** here · **Open** left, with the reason.

### LTI 1.3

| Requirement | Was | Now |
|---|---|---|
| Trust tuple iss + client_id + deployment_id, preconfigured | `~` PK is (issuer, client_id, deployment_id); `aud`/`iss`/deployment compared to the row; login treats client and deployment as optional | Cross-deployment and cross-client negatives added (`lti.test.ts`). **Open:** tenant is not part of the tuple and an unbound registration is *allowed with a warning* (`launchTenant`, a recorded decision). Refusing it breaks every registration installed before binding shipped; that is a product decision, not a fix |
| JWKS preconfigured, no `jku`/`x5u`/`jwk`/`x5c` | `~` URL came from the registration row; nothing refused the headers, `jose` ignored them | **Fixed.** `checkHeader` refuses them by name before any key is fetched (`ltiverify.ts`) |
| Asymmetric allowlist; no `none`, no HS confusion | `~` `jwtVerify(token, keys)` with no options; safe only by `jose` defaults | **Fixed.** `algorithms: ['RS256']`, `issuer`, `audience`, `maxTokenAge`, `requiredClaims` pinned; `alg none` and HS256-with-public-key tokens built in the test and refused |
| iss/aud/azp/exp/iat/nbf/state/nonce/deployment/version/message-type/context/roles | `~` no `nbf`, no maximum age, `azp` checked only for several audiences | **Fixed.** `nbf`, token age (`too-old`), `azp` on a single audience. **Open:** `context` stays optional (some link types carry none) |
| Single-use replay defence | `~` `spend_lti_nonce` is one atomic `UPDATE … RETURNING`, 300 s expiry, registration taken from the flight | Documented and kept. The comment in `lti.ts` said the nonce is spent after validation; the function spends it *before* (deliberately, so a replay cannot win a race). Comment corrected. **Open:** no `jti` store (the platform need not send one); no concurrent-spend test (needs two sessions) |
| Sanitised logging | `~` `sub` logged on every launch; `${e}` put library messages and URLs in the log | **Fixed.** `sub` is a 12-hex digest; errors log class and code only; a structural test keeps it so |
| Controlled key refresh | `~` cached per URL, `jose` defaults for cooldown | **Fixed.** Cooldown, cache age and timeout pinned in `JWKS_OPTIONS`. The URL is the registration's, so a hostile `kid` can only ask a platform already trusted |

### FERPA-style authorization and evidence

| Requirement | Was | Now |
|---|---|---|
| One decision = role + relationship/scope + purpose + classification, with permit/deny evidence | `~` `decide()` is pure, fail-closed and tested but **no production code calls it**; `has_capability` has no purpose or classification and writes no decision row | **Open.** The set of legitimate-purpose codes maps to FERPA exceptions (school-official interest, health or safety, audit or evaluation). That list is for counsel, not engineering. Building the writer first would fix a taxonomy nobody has approved |
| Canonical internal identity independent of email/SIS/IdP | `~` `auth.users.id` is the person; SCIM and LTI subjects are aliases; **email is still a join key** in advisor and support shares and a `%@vanderbilt.edu` suffix in `classmates.sql` | **Open.** A person/alias table changes what a share is keyed on and needs a migration plan for existing shares |
| Server-set tenant context | `~` correct by design (tenant from the registration, connection or membership); no client header found; no sweep proving every RPC | **Open.** An RPC-by-RPC sweep is a larger review than this change |
| Default-deny for endpoints | `~` database has a whole-schema allowlist; **edge functions had none**: every `verify_jwt` is `false` by design, so a function with no check of its own would be open and nothing would fail | **Fixed** for edge functions: `edgeguards.ts` + test. **Open:** background jobs, exports, search and file access have no registry |
| Field-level allowlists | `~` allowlists in SCIM, `minimizeClaims`, `limit_fields`; support read masks (a denylist) | **Fixed for the new surface only:** roster rows are an allowlist per entity. **Open** elsewhere |
| Delegated, JIT, break-glass, export | Break-glass `P` (4 h cap, ticket, two approvers, fresh MFA, forced review). Delegation, JIT, staff export `M` | **Open.** Who may bulk-export education records, and who approves, is a policy decision |
| Immutable audit | `P`, fragmented over five streams, no shared correlation id | **Open** |
| Consent and revocation evidence | `~` 16 of 20 model fields have a column; `purpose`, `legal_basis`, `revocation_reason`, `audit_correlation_id` do not (`ferpa-consent.ts`) | **Open.** `legal_basis` and what counts as a signature are counsel's |
| **Termination evidence** | `M` **SCIM deprovisioning emptied `institution_membership.roles` but nothing revoked `role_grants`, which is what `has_capability` reads.** A staff member removed by the school's identity provider kept school-scoped authority until a grant expired. Reproduced on the schema before the fix | **Fixed.** A trigger revokes that person's live school-scope grants for that school on `deprovisioned`. `suspended` revokes nothing; reactivation does not restore authority. A one-time backfill repairs people already deprovisioned. `offboarding-grants.check.sql`, 13 checks. **Open:** grants scoped to an organization, course, department or office are not keyed by school, so they are not touched |
| Periodic access-review evidence | `M` prose only | **Open.** Cadence and reviewer are a policy decision |

### OneRoster and roster imports

OneRoster ingestion **was not built**: no client, no roster table, no CSV code, no manifest. EDT-6 in `docs/FERPA-COPPA-1EDTECH-READINESS.md` is `NOT_STARTED` and **stays so**.

| Requirement | Now |
|---|---|
| Per-tenant credentials | `private.roster_import_config`: a *pointer* (`vault:`, `env:`, `secret-manager:`), a raw secret is refused, a REST source without one is refused; unreadable to every client role |
| Staged / quarantined imports | `roster_stage` writes staged rows only; the live table changes in one place, `roster_promote`. Rows outside a per-entity key allowlist reject the whole batch |
| Schema, hash, manifest | `roster_validate`: row counts and a content digest per file, no unlisted entity, enrollments must name staged users and classes |
| Delta threshold | A batch removing more than the school's `max_removal_pct` (10 by default) is **held**, and promotes only with an approver who is not the person who staged it |
| Idempotency | One batch per (school, manifest digest); a second stage returns the first; promoting a promoted batch does nothing |
| Reconciliation | `roster_reconcile`: added, changed, unchanged, removed, per entity, stored with the batch |
| Last known good, rollback | Promotion snapshots the roster it replaces; `roster_rollback` restores it, newest promotion only |
| Cross-tenant | Every function takes its school from the batch row; 98 checks including the same manifest under two schools |

**Not built, deliberately:** an HTTP client, OneRoster REST pagination or auth, a CSV parser, any read of `roster_current` by the app, a screen. Nothing imports into these tables, and nothing may claim OneRoster support until a real import has run against a real vendor sandbox.

## What needs a person, not a patch

1. The legitimate-purpose code list, and what a decision record must carry (counsel).
2. `legal_basis`, the meaning of a signature, consent versions and retention of signed copies (counsel).
3. Whether an unbound LTI registration should keep launching (product; recorded decision).
4. Access-review cadence and reviewer; staff export policy; JIT elevation (policy).
5. Retention of staged roster rows and snapshots (counsel and the school; `RETENTION.md` says so).
6. Whether to remove the `%@vanderbilt.edu` suffix rule in `classmates.sql`.
7. A penetration test. The briefs say so themselves: their scores are a baseline from repository structure, not a security certification.

## Coordination

- **#1012 (legal holds, merged).** A hold means records are not destroyed. Roster promotion and rollback destroy nothing (the replaced roster goes to `roster_snapshot`; promoted rows stay staged), and a `before delete` guard on the batch, staged-row and snapshot tables refuses any delete while `private.tenant_is_held` is true for the school, with `55006` like `refuse_delete_while_held`. `roster_current` is not guarded, because replacing it is the point of a promotion. Deprovision-time revocation is not a deletion, so a hold does not stop it, and should not: a hold preserves records, it does not preserve someone's access. Held and released both tested (`roster-import.check.sql`).
- **#1021 (offboarding).** School offboarding will `cascade` `roster_*` rows through `schools(id) on delete cascade`; `roster_current.batch_id` is `on delete restrict`, so a purge must delete `roster_current` before batches, which the cascade from `schools` already does in the right order. Not re-tested against #1021's purge, which is unmerged.
- Migration timestamps `20260930210000` and `20260930220000` are free in `main` and every open draft as of this writing.

## Claims

Nothing in this change moves a claim. Semester is **not** described here or anywhere as FERPA compliant, certified, or pilot-ready, and `claims.ts` is untouched. The audit's conclusion is narrower: three real gaps were closed (envelope-level LTI verification, person-level termination, an unguarded-by-default endpoint list), one foundation was laid for a control that did not exist (staged roster imports), and the rest is written down with the reason it was not attempted.
