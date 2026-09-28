# Resilience, trust, inclusion and ecosystem expansion — Phase 0 audit

This is Phase 0 of the *Semester Resilience, Trust, Inclusion, Faculty,
Ecosystem, and Performance Expansion* command: audit, dependency map and
compatibility plan. **Nothing in this phase changes the app.** It adds this
file, one design document per area (listed at the bottom) and the test plan,
plus one tripwire test that keeps their file references honest.

Read [`CLAUDE.md`](../CLAUDE.md) first. Its first rule decided the shape of this
audit: on 27 September, when this was written, thirty draft pull requests were
open against `main`, and six of them already build part of what the command
asks for. A plan that ignored them would have specified the same tables twice.

## What the command asks for, against what is here

The command lists 17 parts and about 250 new entities. Measured against `main`
(at `cb700d4`) and the open drafts, the parts fall into three groups.

| Group | Parts | What it means for the build |
|---|---|---|
| **Already largely built on `main`** | 3 My Data (privacy, export, delete, support access), 6 offline (service worker, local-first, two-device merge), 13 portability (CSV/ICS/Markdown export, workspace backup), 16 engagement (weekly brief, reflection, and a written refusal of streaks and comparison) | Extend the screen that exists. New tables are the exception |
| **Built in an open draft** | 1 integration (#779's control plane), 2 actions (#767 → #768 → #769's Action model and Action Center), 5 support (#791's help requests), 6 sync states (#777), 11 supporters (`family_grants` on `main`; #791 human help) | Wait for the draft, then build on its types. Rebase, do not fork |
| **Genuinely absent** | 4 faculty authoring, 5 status/incidents/SLOs, 7 localization, 8 most pathways, 12 extensions, 14 change management, 15 evaluation harness, 17 web vitals / virtualization / budgets | New, in the order below |

The per-area documents carry the detail: which file already answers the
question, which draft is about to, and for each entity the command names,
whether it is **reused**, **extended**, **new**, or **not a table**.

### The entity count comes down by more than half

Of the entities the command names, a large share already exist under another
name or are better as a column, a file or a computed value than a table. The
recurring cases:

- **One request table, not four.** `public.data_requests` (expansion migration)
  already carries `export`, `delete`, `correct` and `restrict`. Parts 3 and 13
  ask for `student_data_exports`, `student_deletion_requests`,
  `student_correction_requests` and `export_requests`; they are rows in it.
- **One quiet-hours setting, not three.** Parts 2, 3 and 16 each ask for quiet
  hours. `app/src/lib/notify.ts` already has `Quiet` and `inQuiet`, and
  `public.contact_channels.quiet_hours` already stores one per channel. A
  student with three quiet-hours settings that disagree is the bug.
- **One confidence vocabulary.** Part 2's five action confidences map onto the
  `source_label` the expansion tables already constrain (and #766 renders):
  `institution_verified` → official, `imported` → verified,
  `student_entered` → student_created, `estimated` → estimate,
  `needs_review` → needs_confirmation. A second enum would drift from the first.
- **Fixtures are files.** `connector_fixtures`, `evaluation_cases` and
  `evaluation_datasets` are test data that must be versioned with the code that
  reads them. They belong in the repository, run in CI, not in rows.
- **Decision records are computed.** #768's `Scored.parts` (urgency, impact,
  actionability, confidence, fatigue) is the decision record; storing a copy per
  render would only create something to go stale.
- **Some entities should not exist.** `action_explanation_views` would log each
  time a student opens an explanation. That is a record of behaviour with no
  purpose the student benefits from, which is the command's own definition of
  what not to build. It is declined, and the per-area document says why.

## Dependency map

```
#766 source labels ─┬─ #767 Action model ── #768 Action Center ── #769 Phase B
                    │                                   │
                    │                                   └──► Phase 1b: action explainability
#779 University OS control plane ───────────────────────────► Phase 1a: integration quality
   (integration_* tables, source_records, freshness,          (reconciliation, drift, lineage,
    T0–T6 classification, feature_kill_switch,                 simulation, mappings, providers)
    tenant flag registry)
        │
        ├──► Phase 3a: service degradation reuses feature_kill_switch
        └──► Phase 2: My Data "connected systems" reads integration_connections

#777 cross-device continuity (sync states) ──► Phase 3b: resilient student mode
#791 human help (help_requests)          ──► Phase 3a: support tickets extend it
#788 AI-use declaration                  ──► Phase 2 (export), Phase 4 (faculty integrity)
#770 community trust and safety           ──► Phase 5 (extensions must not reach community data)
```

**Phase 1 cannot start until #779 and #767/#768 have merged.** (#779 merged later on 27 September, so Phase 1a — integration quality — is unblocked; Phase 1b still waits for #767/#768.) Both define the
types it extends. Starting before would mean either copying their types (two
sources of truth) or stacking on unmerged branches (a rebase every time they
move). The per-area documents name the exact types.

## Compatibility plan

These are the existing promises the expansion must not break. Each is enforced
by something already in the repository, and the build phases must keep those
things green rather than work around them.

| Promise | Where it is made | What enforces it | What it constrains here |
|---|---|---|---|
| "Until you delete it. There is no retention schedule that quietly removes your work" | `app/src/lib/privacy.ts`, shown on the Privacy screen | [`RETENTION.md`](../RETENTION.md) and `app/src/lib/retention.test.ts` (every table must have a retention answer) | Part 13's `retention_policies` may govern **records about** work and institution-sourced copies, never student-owned work. Every new table needs a `RETENTION.md` row in the same change |
| No streak, no percentage of you, no comparison | `app/src/lib/you.ts`, `app/src/lib/weekly.ts` | Code comments only today | Part 16. Phase 6 adds a structural test (see the test plan) |
| Policies ask for a capability, never a role name | every migration since `supabase/migrations/20260922012000_capabilities.sql` | `supabase/capabilities.check.sql`, `supabase/grants.check.sql` | Every new surface gets a capability, not a role check |
| New public functions are allowlisted | `supabase/grants.check.sql` | CI runs `supabase/check.sh` | Each phase's RPCs are added to the allowlist deliberately |
| Every foreign key has a covering index | `supabase/indexes.check.sql` | CI | Same |
| Flags are off unless a school turns them on | `app/src/lib/experience-flags.ts` (build time); `public.tenant_feature_policy` (run time) | `supabase/intelligence-policy.check.sql` | Every feature in every phase ships behind a flag at `off` |
| A client module that writes a table lists it | `app/src/lib/cloud.ts` `OWNED_TABLES` | `docs/expansion/ROUTE-AND-FEATURE-CROSSWALK.md` rule | Same change as the first write |
| Five student destinations | `app/src/lib/nav.ts`; #773 | `app/src/screens.test.ts` | New features go **into** existing screens (see the crosswalk), never beside them |
| Support staff see aggregate progress only, with consent | `supabase/migrations/20260925103000_support_access.sql` | `supabase/support-access.check.sql` | Part 11 builds on `family_grants`, **not** support access — support access returns an average score, which a family member must never see |

## Phase order, adjusted for what is in flight

The command's branch names (`feature/...`) are replaced by whatever branch the
session building each phase is assigned; the phase boundaries are kept.

| Phase | Scope | Waits for | Design documents |
|---|---|---|---|
| 0 | This audit | — | all of them |
| 1a | Integration quality | #779 merged | integration quality, schema drift, lineage, simulation, tenant mapping, provider maturity |
| 1b | Action explainability | #767, #768 merged | action explainability |
| 2 | My Data, faculty enablement | #779 (connections); #788 (declarations) | student data control centre, faculty enablement |
| 3 | Service reliability, resilient mode | #777, #791 merged | service reliability, resilient student mode |
| 4 | Localization, pathways | — (can start now) | localization, learner pathways |
| 5 | Financial, career, supporters, extensions, portability | Phase 2 (export pipeline) | financial readiness, career, supporter, extensions, portability |
| 6 | Change management, evaluation, engagement | Phase 1b (actions to evaluate) | change management, evaluation harness, ethical engagement |
| 7 | Performance and hardening | everything | performance |

**Phase 4 is the one that can start today.** It depends on nothing in flight,
and it is the area where `main` has the least: no locale setting, English month
names hard-coded in `app/src/lib/date.ts`, and no `Intl.NumberFormat` anywhere.

## Findings that need a human decision before building

1. **Supporter sharing and FERPA.** Part 11 is written for adult students
   choosing to share. `public.student_context.is_minor` exists; what a supporter
   of a minor may see is a policy question for each school, not a default.
2. **SMS.** Part 16 allows SMS "with explicit consent". `contact_channels` can
   hold an SMS number, but there is no sender and no verification round-trip on
   `main`. That is a vendor, a cost and a compliance decision (TCPA opt-in
   records), not a build task.
3. **Extensions and data classification.** Part 12's "classification ceiling"
   needs #779's T0–T6 classes. Until those merge there is no ceiling to set.
4. **LTI deep linking (Part 4).** `supabase/migrations/20260921160000_lti.sql`
   already models an LTI platform, and #779 binds it further. Deep linking adds
   a registration with each school's LMS — an institutional agreement, not code.
5. **Provider "certification" (Part 1).** The command forbids claiming a
   partnership until verified. `app/src/lib/readiness.ts` `mayClaimConnection`
   already enforces this for connections; the provider registry must use it,
   and a human must record the verification.

## The documents

Each has the same sections: what exists on `main`, what is in flight, the
entity plan, capabilities and flags, hard boundaries, and the tests that prove
them. `app/src/lib/resilience-docs.test.ts` checks that every one exists, has
those sections, and that every repository path it names in backticks is really
there — the check `app/src/lib/roadmap.test.ts` added after its document had
been wrong about itself five times.

- [Integration quality and reconciliation](INTEGRATION-QUALITY-AND-RECONCILIATION.md)
- [Schema drift and contract testing](SCHEMA-DRIFT-AND-CONTRACT-TESTING.md)
- [Field lineage and source freshness](FIELD-LINEAGE-AND-SOURCE-FRESHNESS.md)
- [Sync simulation sandbox](SYNC-SIMULATION-SANDBOX.md)
- [Tenant mapping configuration](TENANT-MAPPING-CONFIGURATION.md)
- [Provider maturity, certification and partnerships](PROVIDER-MATURITY-CERTIFICATION-PARTNERSHIPS.md)
- [Action explainability and student control](ACTION-EXPLAINABILITY-AND-STUDENT-CONTROL.md)
- [Student data control centre](STUDENT-DATA-CONTROL-CENTER.md)
- [Faculty enablement](FACULTY-ENABLEMENT.md)
- [Service reliability and support operations](SERVICE-RELIABILITY-AND-SUPPORT-OPERATIONS.md)
- [Resilient student mode](RESILIENT-STUDENT-MODE.md)
- [Localization, plain language and internationalization](LOCALIZATION-PLAIN-LANGUAGE-INTERNATIONALIZATION.md)
- [Nontraditional learner pathways](NONTRADITIONAL-LEARNER-PATHWAYS.md)
- [Financial readiness workspace](FINANCIAL-READINESS-WORKSPACE.md)
- [Career portability and lifelong access](CAREER-PORTABILITY-AND-LIFELONG-ACCESS.md)
- [Supporter and family privacy model](SUPPORTER-FAMILY-PRIVACY-MODEL.md)
- [Extension ecosystem governance](EXTENSION-ECOSYSTEM-GOVERNANCE.md)
- [Data portability and offboarding](DATA-PORTABILITY-AND-OFFBOARDING.md)
- [Institutional change management](INSTITUTIONAL-CHANGE-MANAGEMENT.md)
- [AI and recommendation evaluation harness](AI-RECOMMENDATION-EVALUATION-HARNESS.md)
- [Ethical engagement and notifications](ETHICAL-ENGAGEMENT-AND-NOTIFICATIONS.md)
- [Performance and low-end device plan](PERFORMANCE-AND-LOW-END-DEVICE-PLAN.md)
- [Test plan](RESILIENCE-INCLUSION-ECOSYSTEM-TEST-PLAN.md)

Paths written from the repository root (app/src/…, supabase/…) are on
`main` and are checked. Files that exist only in an open draft are written
relative to `app/src` with the pull request beside them, and are not checked,
because they are not here yet.
