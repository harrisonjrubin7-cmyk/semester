# Edge-case catalog

<!-- Rendered from app/src/lib/governance/edgecases.ts by edgecases.test.ts. Edit the data, then run `npm run registers` from app/. -->

The cases the launch plan says still have to be tested, each with the
automated guard that already exercises it, or none. A guard is a test that
runs on every change; a runbook or a design does not count, and every guard
cited must exist. Most guards were written for a narrower question than the
case asks, and the note says what each proves and what it does not.

**37 of 81 cases have a guard; 44 are owed.** Of the plan's fourteen
especially important cases, 6 have nothing: EC-DQ-01, EC-LMS-02, EC-LMS-04, EC-LMS-07, EC-AI-01, EC-GOV-02.
Most owed cases wait on something that does not exist yet (an assessment
engine, billing, a live SIS), and the note says which.

## Identity and authorization

7 of 10 guarded.

| ID | Case | Guard | What it proves, and what it does not |
| --- | --- | --- | --- |
| EC-ID-01 | User belongs to two institutions with conflicting roles. | `supabase/tenancy.check.sql` | A profile is pinned to one school, so the case is refused rather than handled; there is no dual-membership model. |
| EC-ID-02 | Student changes institution or transfer status. | `supabase/tenancy.check.sql` | school_id cannot change once set. No transfer workflow exists, so the guard proves the refusal, not a migration of the student's data. |
| EC-ID-03 | SSO email differs from an existing personal account. | `supabase/identity-provisioning.check.sql` | First-login binding refuses a cross-domain or mismatched claim. Linking to an existing personal account is not offered. |
| EC-ID-04 | User loses SSO eligibility mid-term. | owed | No institutional SSO is active for any tenant; nothing ends a session when eligibility ends. |
| EC-ID-05 | SCIM deprovision arrives after the user started a critical workflow. | `supabase/identity-provisioning.check.sql` | Deprovisioning clears roles at once. The open session and unsaved work are not addressed. |
| EC-ID-06 | Role expires while the page remains open. **(important)** | `supabase/coursestudio.check.sql` | An expired or revoked faculty grant is refused at the write. The screen is not told until it tries. |
| EC-ID-07 | Consent revoked during an active support, AI, file or search request. **(important)** | `supabase/support-access.check.sql` | Revoking a support grant stops the next read. AI retrieval, file and search have no consent object to revoke. |
| EC-ID-08 | Admin accidentally grants a platform-wide role. | `supabase/role-grant-audit.check.sql` | The grant is audited, not prevented; no screen can make one, so today only the service key could. |
| EC-ID-09 | Break-glass access is used during an outage. | owed | No break-glass path exists. Emergency access would be the service key, which is unlogged in the product: R-02. |
| EC-ID-10 | User is a minor, guardian consent changes, or the user reaches the age of majority. | owed | The minimum age is a [DECIDE] in docs/legal/; no age gate or guardian model exists. |

## Data and source quality

5 of 10 guarded.

| ID | Case | Guard | What it proves, and what it does not |
| --- | --- | --- | --- |
| EC-DQ-01 | SIS says one course section; the LMS says another. **(important)** | owed | No live SIS or LMS connection exists; precedence rules are designed in docs/FIELD-LINEAGE-AND-SOURCE-FRESHNESS.md, not tested. |
| EC-DQ-02 | Student-entered plan conflicts with the institution source. | owed | Requirements are student-typed; there is no institutional source to conflict with. |
| EC-DQ-03 | Source record is deleted, renamed or reused. | `app/src/lib/integration/quality.test.ts` | Schema drift reports a removed or renamed field before records fail one by one. Record-level reuse of an identifier is not covered. |
| EC-DQ-04 | Integration sends an out-of-order update. | `app/src/lib/integration/pipeline.test.ts` | A record whose source timestamp is older than the one stored is refused as a timestamp regression, and the same one is skipped. A provider that sends no timestamp is not ordered, and the deployed integration-tick function is not exercised. |
| EC-DQ-05 | Webhook is replayed. **(important)** | `app/src/lib/integration/pipeline.test.ts` | A delivery seen twice is counted once by its idempotency key. There is no inbound endpoint yet, so no signature or timestamp window: INT-013. |
| EC-DQ-06 | Source is stale during registration. | `app/src/components/schoolrecords.test.tsx` | Stale records are labelled, never shown as current. The freshness cards are behind a flag that is off until a connection is live. |
| EC-DQ-07 | Catalog prerequisite changes after the student builds a plan. | owed | The catalog is a student-imported file; nothing re-checks a plan against a later import. |
| EC-DQ-08 | Time zone or daylight-saving change alters how a deadline is read. | `app/src/lib/date.test.ts` | Day arithmetic across the 1 November 2026 DST end is pinned, and locale.guard.test.ts keeps every date format in one module. Deadline display in a second time zone is not tested. |
| EC-DQ-09 | Course number changes across terms. | owed | Courses are matched by code within an import; no cross-term identity exists. |
| EC-DQ-10 | Institution merges or splits schools, departments or programs. | owed | The governance hierarchy has nodes for these, and no move or merge operation. |

## LMS and assessment

3 of 11 guarded.

| ID | Case | Guard | What it proves, and what it does not |
| --- | --- | --- | --- |
| EC-LMS-01 | Student loses network seconds before a deadline. **(important)** | `app/src/lib/offline.test.ts` | Queued writes replay when the network returns. Nothing is deadline-aware, and there is no submission to lose: LMS-005. |
| EC-LMS-02 | Autosave succeeds but the final submit acknowledgement fails. **(important)** | owed | No assignment submission exists. |
| EC-LMS-03 | Student submits twice from two devices. | `app/src/lib/merge.test.ts` | Two devices merging the same account's state is tested for the student's own workspace. That is not a submission. |
| EC-LMS-04 | Accommodation changes after an assessment starts. **(important)** | owed | No assessment engine; accommodation_shares carry expiry and revoke (supabase/expansion.check.sql) but no assessment binds to one. |
| EC-LMS-05 | Instructor changes a rubric after some grading is complete. | owed | No rubrics or grading workflow: LMS-006, LMS-012. |
| EC-LMS-06 | Grade is posted, then retracted or corrected. | owed | No gradebook: LMS-011. |
| EC-LMS-07 | SIS passback partially succeeds. **(important)** | owed | No passback: INT-005 is building and writes nothing. |
| EC-LMS-08 | Roster changes after a group assignment is made. | owed | No group assignments: LMS-007. |
| EC-LMS-09 | Course is copied with an expired or broken external link. | owed | No course copy: LMS-001. |
| EC-LMS-10 | Assessment item contains inaccessible media or an unsupported interaction. | owed | No assessment authoring. |
| EC-LMS-11 | Academic-integrity policy changes mid-term. | `supabase/coursestudio.check.sql` | A new published version of the course rules is immutable and dated, so the change is visible. What an open AI conversation does with it is EC-AI-05. |

## AI

4 of 10 guarded.

| ID | Case | Guard | What it proves, and what it does not |
| --- | --- | --- | --- |
| EC-AI-01 | AI source permission is revoked during generation. **(important)** | owed | Source access is checked before retrieval at the gateway, not during a stream. |
| EC-AI-02 | Prompt injection embedded in an uploaded document. | `app/src/ai/injection.test.ts` | Structural: twelve injection-shaped texts through every prompt builder stay inside a fence and leave the instructions byte-for-byte unchanged. It does not test what a live model does with the fence; app/src/ai/injection.live.test.ts does, with a key, and has not been run — AI-010’s remaining gap. |
| EC-AI-03 | AI cites a stale or retracted source. | owed | Citations point at the student's own sources; nothing marks one retracted. |
| EC-AI-04 | Provider outage or a safety-filter false positive. | `app/src/ai/helpstate.test.tsx` | An unreachable gateway is named to the student with a retry, and the local assistant answers when no gateway is configured. A safety-filter refusal is not distinguished from an outage. |
| EC-AI-05 | Course policy changes while a conversation remains open. | owed | Policy is read when a conversation is assembled, not on every turn. |
| EC-AI-06 | Student asks the AI to do prohibited active assessment work. | `app/src/lib/governance/ai-lifecycle.test.ts` | Prohibited scopes are refused at intake (G0). The runtime policy check for a specific request is prompt text, not a test: AI-007. |
| EC-AI-07 | AI produces a harmful, confident but unsupported recommendation. | owed | DO-NOT-BUILD rules 3 and 7 are held by review; no evaluation corpus scores unsupported claims: AI-011. |
| EC-AI-08 | Model version change alters answer behaviour. | owed | No pinned model versions or evaluation baseline: AI-002, AI-011. |
| EC-AI-09 | AI cost spike or rate-limit attack. | `app/src/lib/claudeclamp.test.ts` | The shared key pays only for what the app itself sends: model, max_tokens, tools and effort are clamped or refused (supabase/functions/_shared/clamp.ts), and the test holds the clamp to the app's own requests. Which models are allowed depends on the account's plan (`PLAN_MODELS`; an unknown or unreadable plan is Free) and is checked before the call is counted, held by `sharedplan.test.ts` and `sharedmodels.test.ts`. The sixty-call monthly count and the provider's spend cap at half (MONITORING.md) are not exercised by a test. |
| EC-AI-10 | Student deletes AI history but a linked study artifact remains. | owed | No link from a conversation to a saved study artifact is recorded, so nothing can be reconciled. |

## Integrations and infrastructure

4 of 12 guarded.

| ID | Case | Guard | What it proves, and what it does not |
| --- | --- | --- | --- |
| EC-INF-01 | OAuth refresh token is revoked. | owed | Disconnect now revokes the grant at Google or Microsoft (app/src/lib/revoke.ts); a revocation the provider makes on its own is not detected before the next call fails. |
| EC-INF-02 | LTI issuer or JWKS rotates unexpectedly. | `app/src/lib/ltikey.test.ts` | Key rotation and the JWKS the platform publishes are tested. A tool-side issuer change mid-term is not. |
| EC-INF-03 | SAML certificate expires. | owed | SAML is not activated for any tenant; no certificate rotation process: IAM-003. |
| EC-INF-04 | API provider returns partial success. | owed | No connector writes to an external system yet. |
| EC-INF-05 | Queue consumer processes an event twice. | `app/src/lib/integration/pipeline.test.ts` | Idempotency keys make the second processing a no-op in the pipeline model. The deployed integration-tick function is not exercised. |
| EC-INF-06 | Database migration locks a critical table. | owed | Migration order against production's ledger is enforced (app/src/lib/migrationorder.test.ts); lock risk is not modelled: maturity system 5. |
| EC-INF-07 | Backup completes but restore validation fails. **(important)** | `supabase/restore.sh` | The rehearsal dumps, restores into an empty database and compares six ways, on every change in CI (“Rehearse a backup and restore”). It has never run against production: R-10. |
| EC-INF-08 | Region or provider outage. | owed | Single region, single provider; DR is an outline: SRE-006. |
| EC-INF-09 | DNS or domain issue. | owed | The status page is served from the same host, so it would go with it. |
| EC-INF-10 | Email provider delay sends deadline reminders late. | owed | Reminders are on-device notifications; no email reminders exist to be late. |
| EC-INF-11 | Feature flag is misconfigured in production. **(important)** | `app/src/lib/pagesdemo.test.ts` | The one that happened: a repository variable left set turned the live site into the demo. The deploy now ignores that switch and a test runs the workflow's own script to prove it. Tenant flags in tenant_feature_policy have kill switches (flags.test.ts) and no baseline to drift from. |
| EC-INF-12 | Object storage or upload outage. | owed | Only community media touches storage: uploadImage (app/src/community/client.ts) reserves a row, uploads, and fails with a named reason if the bucket refuses; the reservation is swept after a day (community.sql), and that sweep has no check. A signed-URL failure is dropped and the image renders without an address. Everything else — the source locker, exports, backups — lives on the device or in Postgres, so a storage outage cannot lose a student’s work. No test exercises the outage: found by the operational reality register. |

## Commercial and customer operations

7 of 10 guarded.

| ID | Case | Guard | What it proves, and what it does not |
| --- | --- | --- | --- |
| EC-COM-01 | Payment webhook is delayed or out of order. | `app/src/lib/billing/webhook.test.ts` | An invoice that arrives before its subscription is answered with a retry and records nothing, and a subscription change is synced with the event's own time; the same event again is a no-op by its provider event id (supabase/commercial.check.sql). Stripe is off until keyed (COM-001), so no real delivery has been seen. |
| EC-COM-02 | Student cancels during a paid term but needs an export. | `app/src/components/betapanel.test.tsx` | Leaving the beta offers Export first and keeps the account. No paid term exists. |
| EC-COM-03 | Institution changes billing contact or purchase order late. | owed | Contracts, invoices and a billing_contact role exist since the commercial core (supabase/migrations/20260929070000_commercial_core.sql); nothing tests a contact or purchase order changed after an invoice is issued. |
| EC-COM-04 | Contract expires during finals. **(important)** | `supabase/tenant-plan.check.sql` | An ended plan is refused by entitlement at once. There is no grace period or read-only wind-down, which is the harm the case describes. |
| EC-COM-05 | Customer requests data deletion under a legal hold. **(important)** | `supabase/integration-hardening.check.sql` | A legal hold can be set on integration tables. Account deletion against a held row is not tested. |
| EC-COM-06 | Customer wants a feature enabled that the contract or entitlement does not allow. | `app/src/lib/entitlement.test.ts` | Entitlement order refuses what the plan does not carry. |
| EC-COM-07 | Customer requests custom code that would fork the product. | `app/src/lib/governance/config-tiers.test.ts` | The never-permitted list and the tiers are held; a request outside them has no configuration route. |
| EC-COM-08 | Customer does not complete UAT but wants to go live. | `supabase/tenant-rollout.check.sql` | The rollout state machine refuses an exit gate without its evidence. |
| EC-COM-09 | Customer merger changes the tenant, legal entity or data scope. | owed | No tenant merge or rename operation. |
| EC-COM-10 | Customer offboards but retains archive or export requirements. | owed | docs/DATA-PORTABILITY-AND-OFFBOARDING.md describes the process; no institutional export exists to test. |

## Accessibility and inclusion

5 of 9 guarded.

| ID | Case | Guard | What it proves, and what it does not |
| --- | --- | --- | --- |
| EC-A11Y-01 | Focus is hidden under a sticky composer or banner. | `app/src/styles/tokens.test.ts` | Every focused control carries scroll-margin equal to the header and bottom clearances, and app/src/ai/focusbar.test.tsx holds the scroller's scroll-padding to the Focus bar's inset. The clearances are constants; whether they match a bar's real height is measured only by app/scripts/keyboard-pass.mjs, a manual pass. |
| EC-A11Y-02 | Screen reader announces streamed AI text too aggressively. | `app/src/ai/streamlive.shape.test.ts` | The conversation is a polite log and the streaming text is rendered aria-hidden until the turn lands, so an answer is announced once, whole; the test reads the shape of both surfaces (the full chat and the panel). No screen reader has been run over a stream (EC-A11Y-09). |
| EC-A11Y-03 | Chart or table becomes unreadable at 200% zoom. | `app/src/styles/textscale.test.ts` | Text scaling is held; charts and wide tables are not screenshot-tested at zoom. |
| EC-A11Y-04 | Timer or accommodation is not announced. | owed | No timed assessment exists. |
| EC-A11Y-05 | Keyboard user cannot reach a schedule action. | `app/src/screens/Calendar.keyboard.test.tsx` | Every calendar action has a non-drag route. |
| EC-A11Y-06 | Course author uploads an inaccessible PDF. | owed | Pages with no readable text are reported to the student who imported them; a faculty upload through Course Studio is not checked. |
| EC-A11Y-07 | Automated accessibility checker misses a meaningful context issue. | owed | By definition. The external review docs/LAUNCH-DECISIONS.md item 11 asks for is the control. |
| EC-A11Y-08 | User needs a support format or human assistance. | `app/src/components/GetHelp.test.tsx` | A human route exists from the Action Center. No alternative-format request exists. |
| EC-A11Y-09 | Browser or assistive-technology combination behaves differently after an update. | owed | No screen-reader regression scripts on a browser matrix. |

## Governance and reputation

2 of 9 guarded.

| ID | Case | Guard | What it proves, and what it does not |
| --- | --- | --- | --- |
| EC-GOV-01 | Public claim conflicts with the actual release state. | `app/src/lib/gtm/rfp.test.ts` | RFP answers refuse "available" without a source, and trust.test.ts refuses any affirmed certification. Marketing copy on the public site is not held: PRG-002. |
| EC-GOV-02 | VPAT or HECVAT evidence expires. **(important)** | owed | No VPAT exists to expire; docs/trust/BRIDGE-LETTER.md is the process for the gap between audits. |
| EC-GOV-03 | Subprocessor changes without customer notice. | `app/src/lib/trust/subprocessors.test.ts` | The list cannot drift from the hosts the code calls. Notice to customers is a process with no owner. |
| EC-GOV-04 | Employee leaves with active privileged credentials. | owed | One person holds every credential; no offboarding checklist: R-09. |
| EC-GOV-05 | Partner integration is compromised. | owed | No partner integration is live. |
| EC-GOV-06 | Customer reports an accessibility barrier publicly. | owed | Accessibility tickets get the 24-hour target; the public response is a process in TRUST-BRAND-AND-LEGAL.md with no owner. |
| EC-GOV-07 | Security incident becomes public before the investigation completes. | owed | Incident messages are composed by audience; no public-statement step: maturity system 18. |
| EC-GOV-08 | Misleading ambassador or influencer statement. | owed | No ambassador program exists. |
| EC-GOV-09 | AI mistake spreads through the student community. | owed | Report incorrect information exists on Today; nothing traces a correction back to those who saw it. |
