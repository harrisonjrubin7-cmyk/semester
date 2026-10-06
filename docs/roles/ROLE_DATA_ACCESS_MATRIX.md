# Role data access matrix

**As of** 2026-10-05 · **Part of** [`ROLE_SYSTEM_MASTER_MAP.md`](ROLE_SYSTEM_MASTER_MAP.md) · **Status** audit evidence.

Per-document-role detail is held in [`MODULE-PRIVACY-MODEL.md`](../MODULE-PRIVACY-MODEL.md) §2 (checked against `app_roles` by `app/src/lib/governance/module-privacy.test.ts`). Authority labels for source data are in [`master/SEMESTER_DATA_AUTHORITY_MATRIX.md`](../master/SEMESTER_DATA_AUTHORITY_MATRIX.md). Consent design is in [`CONSENT-SHARING-DESIGN.md`](../CONSENT-SHARING-DESIGN.md) and [`SUPPORTER-FAMILY-PRIVACY-MODEL.md`](../SUPPORTER-FAMILY-PRIVACY-MODEL.md). This page states the rules as enforced and the gaps.

## Standing rules

1. **Student data is owned by the account** (`auth.uid()`). No role reads private study work by default.
2. **Company roles read no student rows.** `supabase/company-roles-student-data.check.sql` asserts it for the 14 global roles; the table-wide sweep reads all 64 tables ([`D-1294`](../decisions/D-1294.md)).
3. **Aggregates carry a floor.** Institution operations and demand views use n ≥ 10 with no per-student grain; `productivity_readiness_aggregate` has the same floor.
4. **Access to a student's material is a grant the student makes**, time-limited, previewed and audited: advisor shares (≤ 120 days, ≤ 32 KB, reads logged), support access (≤ 7 days, student and supporter differ), family grants, peer-mentor acceptance, accommodation shares.
5. **Minors:** minimum age 13; minors kept off social surfaces until 18; guardian restrictions withhold items from export (`export-withholds-guardian-restrictions.check.sql`).
6. **Audit tables hold hashes, not content** (`audit_event` pseudonymises actor and object; `ai-audit-content-free.check.sql` pins AI audit tables to no prompt or answer columns).

## Data classes

DB domain `public.data_classification` T1 to T6 with `data_classification_rules` (T3 and above never reach consumer AI); application tiers T0 to T4 in documents. The two vocabularies differ and should be reconciled in the classification document planned for `feat/policy-consent-classification-audit-foundation`. Disability and accommodation data is T4. `private.account_data_map()` maps columns for export and erasure; a full table-and-field inventory is partial (register item B02).

## Matrix by family

R = may read, W = may write or act, S = only what a student shared or an aggregate, — = none by design.

| Family | Own account data | Student academic record | Student private work | Finance | Disability / health | Family data | Audit | Tenant config |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Student | R W | R (own) | R W | R (own) | R W (own) | R W (grants) | R (own access log) | — |
| Faculty, TA | own | course scope: grades W | — | — | — | — | — | — |
| Advisor | own | S (share) | S (share) | — | — | — | — | — |
| Registrar | own | R W by capability | — | — | — | — | school scope | partial |
| Student accounts, aid | own | — | — | R W by capability | — | — | — | — |
| Disability services | own | — | — | — | S (passport) | — | — | — |
| Institution admin | own | — | — | — | — | `guardians:manage` (staff) | `audit:read` | W |
| Moderator, trust and safety | own | — | — | — | — | — | case content by review right | — |
| Employer | own | — | opted-in profile only | — | — | — | — | — |
| Guardian | own | per grant | per grant | per grant | — | R | access events | — |
| Semester operator | own | **none** | **none** | billing roles read billing only | **none** | **none** | Console audit | by approval |
| Support agent | own | **none** by default; time-limited, student-approved signals | | | | | | — |

## Gaps

1. **Consent is not in the capability decision.** Each function must call it; none is enforced generically (RG per `ROLE_CAPABILITY_MATRIX.md`).
2. **Eight or more per-feature consent and relationship tables** (`consent_record`, `gtm_consent`, `demand_consents`, `study_match_optins`, `community_identity_grants`, and others) with no common read model; two data-request tables (`data_requests` legacy, `data_subject_request`).
3. **Anonymous table privileges.** The live read-only pass showed `anon` SELECT on 32 public tables (including `profiles`, `messages`, `notes`, `push_devices`, `family_grants`, `organization_members`) and `{public}`-role policies on advisor, family and registration tables. RLS gated the rows, so this was a defence-in-depth gap, not an observed leak. Migration `20261005200000_anon_keeps_only_its_public_catalog.sql` on main removes the grants; applying it to the live project is UNVERIFIED, and the `{public}` policies remain (RG-08, DR-04).
4. **Operator audit and read paths** are checked by name, not by a test that tries each operator role against every student table with real foreign ids; the definer sweep uses neutral arguments and cannot catch a function that answers a real foreign id.
5. **Retention clocks** are defined (three years on audit; `ai_policy.retention_days`); whether the sweeps run in production is UNVERIFIED.
