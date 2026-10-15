# Company console catalog

**As of** 2026-10-05 · **Base** `origin/main` `3bd382d` · **Status** proposal; records no decision. Overview: [`SEMESTER_COMPANY_OPERATING_SYSTEM.md`](SEMESTER_COMPANY_OPERATING_SYSTEM.md). Same dossier format and conventions as [`INSTITUTION_CONSOLE_CATALOG.md`](INSTITUTION_CONSOLE_CATALOG.md): eight lines for the nineteen dimensions, **⊕** = proposed capability or event, screens are views of the existing Console (`#/console/<view>`, B-00) and reuse its shared pattern, states and context bar. Operating owner is a Semester **seat**; every seat is the founder or `UNASSIGNED` today.

Each console is a set of views inside `app/src/screens/Console.tsx`, lazy-loaded (the Releases tab already loads on demand because the opening-cost budget asked for it), registered in `app/src/lib/ops/console.ts` `VIEWS`, and rendered into [`OPERATIONS-CONSOLE-MAP.md`](../OPERATIONS-CONSOLE-MAP.md) by `npm run registers`. Nothing here adds a navigation root.

---

## 1. Corporate governance
- **Model/Data/Screens:** entity and ownership records, board and investor operations, resolutions, corporate calendar, insurance, IP records, legal-entity controls. Views: Entity, Board, Resolutions, Calendar. Source: [`docs/company/CORPORATE-GOVERNANCE-CHECKLIST.md`](../company/CORPORATE-GOVERNANCE-CHECKLIST.md), [`leadership-system/`](../company/leadership-system/).
- **Roles/Isolation:** founder/board-secretary seat; ⊕`governance:manage`. Company-only data: no tenant scope; still RLS-protected, no client table grant.
- **Workflows/Approvals/Policy/Consent:** resolution adoption (board + founder), board pack release (one approval), IP assignment recording. Entity facts stay `unconfirmed` until a document is attached (formation certificate, state, signing authority are unconfirmed today — master map).
- **Audit/SAF:** `resolution.adopted`, `boardpack.released`; authority: the signed document, linked by hash.
- **Review/SLO/Support:** counsel review of every resolution template — counsel not engaged.
- **Rollback/Tests/Gate:** a resolution is superseded, never edited; tests: append-only, attachment hash. Gates E, G (legal).
- **Owner/Commercial:** founder [finance seat]. A diligence or enterprise-security review asks for exactly this; absence delays a pilot.
- **Tier:** P1 board and entity; P2 insurance/IP tracking.

## 2. Product/engineering
- **Model/Data/Screens:** roadmap, requirements, design system, delivery plans, flags, releases, rollouts, tech debt, reliability, capacity, product evidence. Views: Releases, Rollouts, Flags, Delivery, Debt. Existing: Releases and flags tab (read-only, four registries), `platform_release_evidence`, `tenant_rollout`, `docs/program/`, [`TECHNICAL-DEBT-REGISTER.md`](../engineering-operations/TECHNICAL-DEBT-REGISTER.md).
- **Roles/Isolation:** ⊕`release:operate`, `killswitch:engage`, `console:operate`. Tenant-targeted rollouts are bound to a tenant list in the request.
- **Workflows/Approvals/Policy/Consent:** deploy a cohort (duty `release`: one for standard, two for high-risk flags), engage a kill switch, cut/promote a release, rollback. Release evidence rows are the gate input; the Command center already turns missing proof red.
- **Audit/SAF:** `release.promoted`, `rollout.cohort_changed`, `killswitch.engaged`; flag state is a row, build-time flags labelled build-time.
- **Review/SLO/Support:** accessibility + privacy review attached to each release candidate; release success rate, time-to-rollback.
- **Rollback/Tests/Gate:** kill switch; previous deployment promote; tests: T-02 (no direct write path), kill-switch effect. Gate R.
- **Owner/Commercial:** engineering seat. Safe rollout is the clause in every pilot agreement; if a tenant cannot be kept on a known version, pilots are unsafe.
- **Tier:** **P0** (rollout write path through approval), P1 (the rest).

## 3. Trust/security/privacy/accessibility
- **Model/Data/Screens:** security program, privacy program, compliance controls, vendor risk, AI governance, accessibility program, trust centre, security questionnaires, incident command. Views: Security, Privacy and data rights, Trust, Access reviews, Questionnaires, Accessibility. Existing: trust room (`trust_room_*`), [`docs/trust/`](../trust/) (66 files), evidence register, DSR/hold tables.
- **Roles/Isolation:** `trust_officer`, `compliance_owner`, `data_steward`, `data_request:handle`, `hold:read`, ⊕`access:review`. Privacy view returns counts/status, never student content.
- **Workflows/Approvals/Policy/Consent:** answer a questionnaire from approved claims only (claims register); release evidence via time-limited trust-room grant (duty `evidence-release`); run an access review; handle a DSR. Policy: claims need an approved row in [`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md).
- **Audit/SAF:** `trust_room_access_log`, `evidence.released`, `access_review.attested`; each control row has an evidence expiry and an escalation step (console Evidence view).
- **Review/SLO/Support:** the independent review that does not exist (single-person company) is a standing, named gap — security assessment not done; accessibility conformance report unverified.
- **Rollback/Tests/Gate:** evidence grant revocable; attestation superseded. Tests: evidence expiry, claim-without-evidence refused. Gates S, P, A11y.
- **Owner/Commercial:** security/trust/privacy seats (vacant/outside-counsel label). Every institutional deal is gated here ([`HIGHER-ED-RFP-RESPONSE-LIBRARY.md`](../HIGHER-ED-RFP-RESPONSE-LIBRARY.md)); HECVAT/SOC 2 are readiness matrices, not certifications.
- **Tier:** P0 evidence + incident basics; P1 control centre.

## 4. Revenue operations
- **Model/Data/Screens:** ICP, accounts, stakeholders, opportunities, pipeline, forecast, quotes, procurement, contracts, renewals, expansion, partner channels. Views: Customers (list), Customer 360, Pipeline, Quotes, Renewals. Existing: Customers tab (read-only; `customer`, `customer_contract`, `customer_commitment`, written by service key), [`docs/commercial/CRM-DATA-MODEL`](../commercial/README.md).
- **Roles/Isolation:** `account:manage`, `success:manage`, `billing:read`. A revenue operator sees accounts, never student rows.
- **Workflows/Approvals/Policy/Consent:** create quote from the price book (discount above floor: second approver), record procurement stage, record signed contract (document hash). Contacts are people: lawful basis and suppression honoured before any outreach (lead-intake consent recording is **unverified** — gap #10).
- **Audit/SAF:** `quote.issued`, `contract.recorded`; authority: the signed contract for terms; price book is `proposed` until approved (no current price book or selling authority).
- **Review/SLO/Support:** claims-register check on any quote narrative; forecast labelled hypothesis.
- **Rollback/Tests/Gate:** a quote is voided, never edited; tests: price-book version bound to quote. Gates E, P.
- **Owner/Commercial:** founder [success seat]. Empty today; the first row is the first customer.
- **Tier:** **P0** (Customer 360 + pilot record), P1 (pipeline, forecast), P2 (partner channels).

## 5. Customer implementation and success
- **Model/Data/Screens:** pilot design, implementation, tenant activation, data migration, training, adoption, support, customer health, QBRs, outcome reporting, reference readiness. Views: Pilots, Implementation, Health, Outcomes. Existing: `tenant_rollout`(+evidence, history), `success_plans`, `account_health_snapshots`; playbooks in [`docs/commercial/`](../commercial/) and [`coo/02`](coo/02-implementation-methodology.md), [`coo/10`](coo/10-tenant-launch-risk-and-readiness.md).
- **Roles/Isolation:** `tenant:implement`, `success:manage`, `account:manage`; implementation staff bound to assigned tenants by assignment rows, not by capability alone.
- **Workflows/Approvals/Policy/Consent:** activate tenant (gate with open-P0 refusal), approve field mapping (with institution steward), go/no-go (two-person), start/end dual run, close pilot with outcome report.
- **Audit/SAF:** `tenant.activated`, `mapping.approved`, `launch_gate.decided`. **Health is explainable:** each component names its source; components with no source (adoption, reliability) render `unknown` and are excluded from any aggregate, never imputed.
- **Review/SLO/Support:** health model reviewed for bias and gaming; QBR content is built from verified figures only.
- **Rollback/Tests/Gate:** tenant back to observation; rollout history. Tests: gate cannot pass with P0 exception; health `unknown` handling. Gates T, L.
- **Owner/Commercial:** success seat. Implementation hours per pilot are the first unit-economics datum; record them.
- **Tier:** **P0**.

## 6. Finance operations
- **Model/Data/Screens:** products/plans/prices, billing accounts, quotes/order forms, subscriptions, invoices, collections, revenue forecast, budget, cash/runway, spend controls, cloud and AI cost, board financial reporting. Views: Billing, Entitlements, Reconciliation, Forecast. Existing: Stripe functions (`billing-checkout|cancel|portal|webhook`), `commercial_*`, `subscriptions`, `invoices`, `payment_events`, `dunning_cases`, Finance model tab (client-side, **no database**).
- **Roles/Isolation:** `finance_operator`, `billing:read`, `account:manage`. Appends-only ledger; no UPDATE/DELETE path.
- **Workflows/Approvals/Policy/Consent:** issue quote → invoice (institutional billing is documented-unimplemented), set/modify an entitlement (writes `tenant_plan` + history; **entitlement ≠ flag**), refund/credit (duty `refund`, no executor yet), reconcile Stripe events to invoices.
- **Audit/SAF:** `entitlement.changed`, `invoice.issued`, `refund.requested`; the payment processor is authoritative for funds; Semester is authoritative for the entitlement. A Stripe test amount is labelled test.
- **Review/SLO/Support:** finance/legal review of any institutional money flow; webhook processing success SLO; reconciliation daily.
- **Rollback/Tests/Gate:** reversing entries; entitlement history restorable. Tests: webhook idempotency, ledger immutability, entitlement-to-capability resolution (currently *shadow*). Gates F, T.
- **Owner/Commercial:** finance seat. **P0 is only what a pilot needs:** quote, invoice record, entitlement set/lookup, renewal date. Runway and cash stay `$0 placeholder` until real numbers exist ([`13-REAL-NUMBERS-INTAKE.md`](../finance/13-REAL-NUMBERS-INTAKE.md)).
- **Tier:** **P0 basic**, P1 collections/forecast/budget, P2 advanced native finance and embedded finance.

## 7. Legal and vendor operations
- **Model/Data/Screens:** contract lifecycle, DPA/security-exhibit workflow, vendor inventory, vendor reviews, subprocessor register, legal holds, policy library, obligation calendar. Views: Vendors, Subprocessors, Contracts, Obligations.
- **Roles/Isolation:** `compliance_owner`, ⊕`vendor:manage`; counsel external.
- **Workflows/Approvals/Policy/Consent:** add a vendor (review before data access), subprocessor change (customer-notice period honoured), DPA execution. Policy: no vendor receives personal data before an approved review row.
- **Audit/SAF:** `vendor.reviewed`, `subprocessor.added`; the register is rendered from [`SUBPROCESSORS.md`](../SUBPROCESSORS.md); "no vendor risk-assessed, no DPAs on file" is the current truth.
- **Review/SLO/Support:** review cadence; notice-period tracking.
- **Rollback/Tests/Gate:** vendor offboarding with data-deletion confirmation; tests: subprocessor-change notice computed. Gate G.
- **Owner/Commercial:** founder [privacy seat]. A subprocessor change is a contract event; missing notice is a breach.
- **Tier:** P1.

## 8. People operations
- **Model/Data/Screens:** org chart, workforce plan, hiring scorecards, interview process, onboarding, **access lifecycle**, equipment, compensation/equity records, performance, training, offboarding.
- **Roles/Isolation:** ⊕`people:manage`; compensation/equity is the most restricted class; employee data is **not** student or tenant data and lives in a separate scope.
- **Workflows/Approvals/Policy/Consent:** onboarding grants capabilities from a role template (two-person at platform scope); **offboarding revokes every grant and credential the same day** — the first people workflow worth building, because it is the access lifecycle. Employee personal data handled under its own policy (counsel).
- **Audit/SAF:** `access.granted_on_hire`, `access.revoked_on_exit`; HR system, when one exists, is authoritative — do not build a parallel HRIS.
- **Review/SLO/Support:** legal review (employment law); revocation completes within 24 h (proposed).
- **Rollback/Tests/Gate:** re-grant is a new grant; tests: exit revokes all `role_grants`. Gates S, G.
- **Owner/Commercial:** founder [operations seat]. One-person company: build only the access-lifecycle slice and defer the rest until the first hire ([`12-GATED-HIRING-SCHEDULE.md`](../finance/12-GATED-HIRING-SCHEDULE.md)).
- **Tier:** P1 access lifecycle; P2 the rest.

## 9. Operations Command Center
See [`OPERATIONS_COMMAND_CENTER.md`](OPERATIONS_COMMAND_CENTER.md), which is the dossier for this console.
