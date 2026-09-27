# Go-to-market execution plan — status and where each part lives

The source is the *Semester GTM, Enrollment Marketing, Student Adoption and Higher-Ed Sales Execution Plan*
(26 pages, 19 sections). This page does not restate it. It records which of its parts are code, which are
already covered by something else in the repository, and what is still to build, so a session picking up
the backlog in §15 starts from here rather than from the PDF.

## The rules that are now code

The plan's non-negotiables (§1.1) and acceptance criteria (§16) that can be enforced without a screen live
in [`app/src/lib/gtm/`](../../app/src/lib/gtm). Each is a pure function with tests. Each of the guards below
was deliberately broken once to confirm its test goes red.

| Plan | Rule | Where |
| --- | --- | --- |
| §7.1, §16.2 | Targeting uses an allow-list of public or self-declared fields. Education-record, aid, health, disability, conduct, protected-trait and poll-response fields are refused by name, and unclassified fields are refused too. | `campaign.ts` `checkAudience` |
| §13.3, §16.2 | A campaign can't activate without consent requirements, owner ≠ approver, privacy/accessibility/brand review (latest of each approved, none by the owner), frequency cap, landing page, tested opt-out and conversion instrumentation, substantiated claims, a review date after it ends, and standard UTM links. | `campaign.ts` `activationGate` |
| §16.2 | Staff at one school can't see or activate another school's campaign. | `campaign.ts` `visibleTo`, tenant check in the gate |
| §8.1, §16.2 | SMS needs explicit opt-in (no transactional exemption), passes quiet hours in the recipient's own time zone, and stays under the frequency cap. STOP takes effect on the next decision. "Yes" never re-subscribes anyone. | `messaging.ts` `decideSend`, `consentFromKeyword` |
| §11.6, §16.2 | Every send decision carries campaign ID, template ID and version, consent version, and an audit event. Transactional email is kept separate from marketing email. | `messaging.ts` |
| §11.7, §12.4 | A single UTM convention, `{tenant}_{cycle}_{audience}_{objective}`, that always parses back into its four parts. Campaign links may carry no parameters beyond UTM and a placement code. | `utm.ts` |
| §11.4, §16.4 | The KPI formulas return no rate for an empty cohort. Each metric exports its methodology and attribution model and states that it makes no causal claim. §11.3 benchmarks are stored as directional ranges, never as targets. | `kpi.ts` |
| §10 | Sponsorship: prohibited categories, school-approved categories/surfaces/segments, a visible "Sponsored" label, a "why shown" explanation, human approval, a scheduled audit and a complaint route. Never on AI answers, advising, rankings, or urgent academic flows, even when a school lists that surface. Reports go out as suppressed aggregates only. | `sponsor.ts` |
| §6 | A pilot must run 60–120 days and have a baseline, sponsor, champion, a minimum-necessary read-only data plan, 3–5 metrics each with a baseline, agreed annual price, a midpoint review, and a conversion date near the end. It runs in sandbox until production data is approved. It isn't final until someone signs the decision, and it can't convert while a high-severity issue is open. | `pilot.ts` |
| §5 | Committee roles still unmapped. Overdue decision-log items, highest risk first. An approval needs evidence and a date. | `pilot.ts` |

Two flags gate this work, both **off** and high-risk, in [the registry](../FEATURE-FLAG-REGISTRY.md):
`module.campaign_manager` and `module.sponsorship`. Both need `tenant:configure` until a dedicated marketing
capability exists, and both stop on `kill.sharing`.

## The database

[`supabase/migrations/20260928090000_gtm_foundation.sql`](../../supabase/migrations/20260928090000_gtm_foundation.sql)
creates the §17 entities and enforces the same rules again, so neither a screen nor a worker can skip them.
[`supabase/gtm.check.sql`](../../supabase/gtm.check.sql) walks them as each account involved (130 checks), and
`app/src/lib/gtm/schema.test.ts` fails if a list in the migration drifts from its TypeScript copy.

| Plan entity | Table | What the database refuses |
| --- | --- | --- |
| Prospect, ConsentRecord, Preference | `gtm_prospects`, `gtm_consent`, `gtm_suppression` | Any signed-in read or write, since these are for workers only. A contact has no column outside the targeting allow-list, so there is nothing sensitive to select. Consent is append-only, and the latest row wins. |
| Campaign, CampaignApproval, LandingPage | `gtm_campaigns`, `gtm_campaign_reviews`, `gtm_campaign_links` | Sensitive or unknown audience fields. Links without the UTM convention. A campaign not born as a draft. Edits outside draft. Reviews by the owner or outside review. Approval by anyone except the named approver, or with a review missing or older than the last edit. Activation without the module in production, with `kill.sharing` engaged, or with any §13.3 field missing. |
| CommunicationEvent | `gtm_communication_events` | An allowed decision with no current consent, a stale consent version, a withdrawn topic, a suppressed contact, the recipient's quiet hours, the cap reached, an inactive campaign, or no template version. Rows are append-only. |
| ConversionEvent, AttributionTouch, DashboardAccessLog | `gtm_conversion_events`, `gtm_report_access` | A malformed campaign name. Staff see only `gtm_campaign_report`, whose counts are suppressed below ten, and every read is logged. |
| Sponsor, SponsorReview, SponsorPlacement | `gtm_sponsor_policy`, `gtm_sponsor_placements` | Protected surfaces, even in the school's own policy. Categories outside the allow-list. A missing "Sponsored" label. Approval by the placement's author. Going live without the school's policy and the module. Edits after approval. |
| InstitutionAccount, Stakeholder, DecisionLogEntry | `gtm_accounts`, `gtm_stakeholders`, `gtm_decision_log` | Writes by anyone but Semester's sales. A customer school's configurers read only their own account. An approval needs evidence and a resolution date. |
| Pilot, PilotMetric, PilotOutcome | `gtm_pilots`, `gtm_pilot_metrics`, `gtm_pilot_outcomes` | Starting a pilot without the §6.2 elements. Deciding one without a signed outcome. Converting or expanding while a high-severity issue is open. |

New roles: `marketing_admin`, `campaign_reviewer`, `marketing_analyst`, and the global `account_executive`.
`university_admin` also gains `sponsor:review`. `RETENTION.md` gives each table its retention period, and says
plainly that no time-based purge of contacts or sends exists yet.

## Parts the repository already had

| Plan | Already covered by |
| --- | --- |
| §12.2 flag metadata, §12.3 evaluation order | `app/src/lib/flags.ts` — same order: kill switch → environment → entitlement → connection → scope → capability → role → classification → course → user |
| §12.5 T0–T6 data classification | `app/src/lib/integration/classification.ts`, which mirrors the database floor |
| Consent ledger | `public.consent_record` (`supabase/migrations/20260923210000_intelligence_policy.sql`) |
| Tenant configuration audit | `tenant_feature_policy` + `tenant_policy_audit_event` |
| §3.3 trust artifacts, §4.4 procurement pack | `docs/market-readiness/` (security, privacy, accessibility, AI governance, incident response, procurement checklist) |
| §6 pilot operations | `docs/market-readiness/PILOT_PLAYBOOK.md`, `PILOT.md` |
| §13.4 portfolio scorecard, §12.1 configuration tiers, data contracts, deal desk | `app/src/lib/governance/` and `docs/operating-model/` (#813) |

## Still to build (§15 backlog), in the order the plan's launch sequence (§18) needs it

1. **Trust Center and procurement room** (§3.3): public summaries, plus controlled access to the artifacts that
   already exist in `docs/market-readiness/`. Each artifact needs an owner, version, publish date and review date.
2. **Workflow pages**: two or three, following the §3.2 template. Check the public-site work in progress first
   (`feature/public-site`, `feature/public-tools`) so the routes aren't duplicated.
3. **Campaign manager screen** over `activationGate` and `gtm_activation_failures`, listing every remaining failure.
   **Preference center** writing `gtm_consent` for recruitment contacts and `consent_record` for enrolled students.
4. **Email/SMS adapters** (worker, service role) that insert the decision into `gtm_communication_events` first,
   and send only if the insert succeeded. No direct platform publishing for social (§15 phase 2).
5. **Retention periods** for contacts and sends, with a sweep. `RETENTION.md` records that none exists yet, and a
   school has to set one before any campaign goes live.
6. **Orientation QR/deep-link flow** using `campaignUrl(..., location)`, SSO, and the first-meaningful-action
   instrumentation (§9.2).
7. **Dashboards** (§11.5) built on `kpi.ts`. Each labels its attribution model, logs access, and uses no risk
   score (§16.4).
8. **Ambassador program** (§9.4). No peer-data access, by construction.

The admissions calendar (§8) and content cadence (§8.1) are operating material, not code. A campaign built
from them is a `Campaign` whose `funnelStage` matches the calendar row.
