# Tenant configuration workbook

| Control | Value |
| --- | --- |
| Status | **TEMPLATE — COPY PER TENANT; NO TENANT HAS BEEN CONFIGURED FROM IT** |
| Owner | Solutions engineer seat; publisher is a different person |
| Evidence date | 2026-10-04 at `origin/main` `7287ddc` |
| Used in | [phase 2 (design), phase 3 (configure)](METHODOLOGY.md#phase-3--configure) |
| Copy to | `docs/evidence/implementation/<tenant-id>/tenant-configuration.md` (the folder is created by the first implementation) |

How to use it: copy this file. Fill **Intent** during design. During
configuration fill **Applied value** by reading the value *back from the tenant*
(never from memory), attach the **Evidence** link, and have the checker initial
the row. A row with no evidence is not done.

## Column meanings

- **Enforced by** — what makes the value true. Read it carefully, because it is
  the difference between a promise and a control.
  - `DB` — a constraint, policy or trigger refuses the contrary (cite the check).
  - `Policy` — row-level security or a capability grant decides.
  - `Flag` — `tenant_feature_policy` / a kill switch decides.
  - `Record only` — stored and audited, but **no feature reads it yet**. Must be
    labeled as such to the customer. As of the evidence date, every Configuration
    Studio domain is `Record only`: `effectiveConfig` is read only by the
    Studio's own screen ([`../CONFIGURATION-STUDIO.md`](../CONFIGURATION-STUDIO.md)).
- **Maker / checker** — two different people. Where the product enforces the
  separation it is stated; elsewhere the workbook does.
- **Source of truth** — who owns the value after go-live.

## Section A — Tenant identity

| # | Item | Intent | Applied value | Enforced by | Maker / checker | Source of truth | Evidence | State |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A1 | School id (stable, lowercase) | | | `DB` (`schools` primary key) | SE / IL | Semester | | |
| A2 | Legal and display name | | | Record only | SE / customer sponsor | Customer | | |
| A3 | Email domains (the credential `claim_school()` tests) | | | `DB` + `Policy` — **writable only by an app admin** | operator via `scripts/add-school.ts domains` / customer IT confirms | Customer IT | | |
| A4 | Domains start **empty** and admit nobody until the domain command is run on purpose | | | `DB` (`looksClaimable`) | operator / IL | Semester | | |
| A5 | Rollout state and reason — written only by an operator; one step forward at a time, with the leaving state's gate evidence | | | `DB` (`tenant_rollout`, history, evidence) — **record, not a switch** | IL / IL's deputy | Semester | | |

## Section B — Contract, plan and entitlement

| # | Item | Intent | Applied value | Enforced by | Maker / checker | Source of truth | Evidence | State |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B1 | Plan code and tenant tier (`pilot`, `department`, `campus`, `system`) | | | `DB` (`commercial_plans`) | CF / IL | Order form | | |
| B2 | Entitlements granted and expiry | | | `DB` (`subscription_entitlements`; source `plan`, `contract`, `grant`) | CF / IL | Order form | | |
| B3 | Contracts on file: order form, DPA, SLA, amendments (status `signed`; dates) | | | `DB` (`contracts`) | CF / counsel | Counsel | | |
| B4 | Renewal notice days and the renewal opportunity created on signing | | | `DB` (`renewal_opportunities`) | CF / CSM | Order form | | |
| B5 | Explicit **exclusions** named in the quote (a sent quote must have them) | | | `DB` (`quotes` constraint) | CF / IL | Order form | | |

Entitlement is not authorization: a plan grants a capability to exist; the
rollout state, feature policy and grants decide who can use it.

## Section C — Identity and access

Follow [`../SSO-TENANT-ONBOARDING.md`](../SSO-TENANT-ONBOARDING.md); this section
records the outcome.

| # | Item | Intent | Applied value | Enforced by | Maker / checker | Source of truth | Evidence | State |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C1 | IdP and protocol (SAML/OIDC); provider left `pending` until sign-off | | | `DB` (`institution_identity_provider`) | IE / customer IT | Customer IT | | |
| C2 | Attribute mapping — minimum claims only | | | `DB` + [`../SSO-CLAIM-MAPPING-AND-DATA-MINIMIZATION.md`](../SSO-CLAIM-MAPPING-AND-DATA-MINIMIZATION.md) | IE / SPR | Customer IT | | |
| C3 | SCIM credential issued once, vaulted, hash stored | | | `DB` | IE / customer IT | Customer IT | | |
| C4 | Group → role mappings approved by a tenant administrator | | | `Policy` | IE / university administrator | Customer | | |
| C5 | Controlled test accounts: student, faculty, staff/admin | | | — | SE / customer IT | Customer IT | | |
| C6 | Acceptance cases pass in staging: deprovisioning, unknown group, tenant mismatch | | | — | SE / AL-or-SPR | — | | |
| C7 | Provider set `authorized` only after C6 | | | `DB` | IL / customer sponsor | — | | |

## Section D — Roles and grants

Capabilities used by this method: `tenant:configure`, `config:manage`,
`config:publish`, `config:view`, `integration:view|configure|sync|replay|approve`,
`killswitch:engage`, `audit:read`, `migration:manage|approve|view`. The role →
capability pairs are [`../ROLE-PERMISSION-MATRIX.md`](../ROLE-PERMISSION-MATRIX.md)'s.

| # | Role | Held by (customer) | Backup | Scope | Grant expiry | Reviewed on | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D1 | `university_admin` | | | school | | | |
| D2 | `implementation_manager` (drafts config) | | | school | | | |
| D3 | `registrar` (publishes config) | | | school | | | |
| D4 | `integration_admin` | | | school | | | |
| D5 | Migration approvers (≥ 2 areas, none the opener) | | | school | | | |
| D6 | Auditor (`audit:read`) | | | school | | | |

Rules: every school-scoped grant has an owner, a backup and a review date. The
person who drafts a configuration is never its publisher. Department-, office-
and course-scoped grants are **not** revoked at offboarding (only school-scoped
ones are), so list them too if used.

## Section E — Configuration Studio (eleven domains)

One draft per domain at a time; versions are numbered and never edited. Rollback
is a new draft copied from an old version and published like any other. Keys are
a closed list with a type and range (`private.config_spec()`); 8 KB per version;
no card numbers in text.

| # | Domain | Keys set (list) | Applied version | Applied by a feature? | Enforced by | Maker / checker | Evidence | State |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| E1 | Academic structure | | | not yet — **Record only** | `DB` (schema), nothing reads it | SE / publisher | | |
| E2 | Workflows | | | not yet — **Record only** | same | | | |
| E3 | AI (course policy defaults; the kill switch stays authoritative) | | | not yet — **Record only** | same | | | |
| E4 | Notifications (outbox, quiet hours) | | | not yet — **Record only** | same | | | |
| E5 | Data (retention sweeps, offboarding export) | | | not yet — **Record only** | same | | | |
| E6 | Reporting (privacy floor `MIN_COHORT`, starts at n = 10, may only rise) | | | floor enforced in code | `DB` spec `min: 10` + `lib/institution-ops.ts` | | | |
| E7 | Roles | | | not yet — **Record only** | same | | | |
| E8 | Branding | | | not yet — **Record only** | same | | | |
| E9 | Content | | | not yet — **Record only** | same | | | |
| E10 | Features | | | not yet — **Record only** | same | | | |
| E11 | Accessibility | | | not yet — **Record only** | same | | | |

Truth rule: re-read [`../CONFIGURATION-STUDIO.md`](../CONFIGURATION-STUDIO.md) and the
`effectiveConfig` call sites at configuration time. When a domain has been
wired, change its row from **Record only** to the feature that applies it and
attach the test that proves a published version changes behavior. Do not
promise a customer a setting the product only records.

## Section F — Feature policy and kill switches

| # | Capability family | Desired state (`off`/`sandbox`/`production`) | Applied | Exposure decision / evidence class | Kill switch tested on | Who can engage | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F1 | Student surfaces in scope (list) | | | | | | |
| F2 | Faculty / staff surfaces in scope | | | | | | |
| F3 | Each integration connector flag | | | | | | |
| F4 | Writeback scopes (default **off**) | | | | | | |
| F5 | AI features (default off until the AI review passes) | | | | | | |
| F6 | Excluded capabilities (roadmap) — written down, **not** switched on | | | | | | |

Capability exposure is resolved across routes, entitlements and claims
(`feat(governance)` #1138); check the resolved state, not the flag alone.

## Section G — Data and trust policy

| # | Item | Intent | Applied | Enforced by | Approver | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| G1 | Data classes in scope; fields refused by name | | | `DB` (minimum-data refusals) | SPR / customer privacy officer | |
| G2 | Retention windows (counsel sets the real length; the 90-day offboarding default is a placeholder) | | | retention sweeps ([`../../RETENTION.md`](../../RETENTION.md)) | counsel | |
| G3 | Subprocessors in scope | | | register | SPR | |
| G4 | Consent defaults and the student's own controls | | | `Policy` | SPR | |
| G5 | Reporting floor (≥ 10) and who may see aggregates | | | `DB` | SPR | |
| G6 | Legal-hold contact on the customer side | | | `DB` (`legal_holds`) | counsel | |

## Section H — Support, communication and continuity

| # | Item | Intent | Applied | Evidence |
| --- | --- | --- | --- | --- |
| H1 | Student support route and staffed hours (only what is approved and tested) | | | |
| H2 | Operator/admin escalation route and named contacts, with backups | | | |
| H3 | Incident contacts and communication templates ([`../market-readiness/INCIDENT_COMMUNICATION_TEMPLATES.md`](../market-readiness/INCIDENT_COMMUNICATION_TEMPLATES.md)) | | | |
| H4 | Announcement texts the school sends in its own name ([`../launch/ANNOUNCEMENT-TEMPLATES.md`](../launch/ANNOUNCEMENT-TEMPLATES.md)) | | | |
| H5 | Known limitations page reviewed with the customer ([`../launch/KNOWN-LIMITATIONS.md`](../launch/KNOWN-LIMITATIONS.md)) | | | |

## Section I — Readback and freeze

| # | Step | Done by | Evidence |
| --- | --- | --- | --- |
| I1 | Export configuration and read every applied value back; diff against Intent | SE | dated export |
| I2 | Pull the audit-event extract for the change window | SE | extract |
| I3 | Customer approver signs the workbook as the approved baseline | customer sponsor | signature record |
| I4 | Freeze: later changes are change records with a maker, a checker and a date | IL | change register |

## Acceptance criteria for phase 3

1. Every Intent value has an Applied value read back from the tenant.
2. Every row has an Enforced-by class; every `Record only` row is disclosed to the customer.
3. No draft is published by its drafter.
4. No grant lacks an owner, backup and review date.
5. Excluded capabilities are off and listed.
6. The baseline is signed (I3).

## Evidence state

**Repository evidence.** The tables, constraints and screens named in each row
exist on `main`.

**Operational evidence.** No tenant has been configured from this workbook.

**Missing test/proof.** One tenant configured end to end with the readback and
audit extract filed; a second person re-doing section E from the workbook alone.

## Claim ceiling

Semester may share this as its configuration checklist and use it in sandbox work.

## Prohibited claims

Do not claim a setting is applied, enforced or customer-approved on the strength
of a Studio record; do not claim any tenant is configured.
