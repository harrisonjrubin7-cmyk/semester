# 08 · Tenant AI configuration console

**Builds on:** [`../CONFIGURATION-STUDIO.md`](../CONFIGURATION-STUDIO.md) (versioned, reviewed configuration),
`supabase/migrations/20260923210000_intelligence_policy.sql` (`ai_policy`, `tenant_feature_policy`, `approved_source`,
`consent_record`, `tenant_policy_audit_event`), `app/src/lib/aiflags.ts`, `app/src/lib/config/studio.ts`,
`packages/institution/src/course-agent-policy.ts`.

A university does not ask "may students use AI". It asks whether the assistant may see the gradebook, which provider
holds the data, what happens when a course says no, and who can switch it off at two in the morning. The console is
where a school answers those questions, and where Semester proves it kept the answers.

## What exists, as verified

Three separate places hold AI configuration, with three vocabularies, and they do not meet.

| Store | Holds | Vocabulary | Written by | Read by |
| --- | --- | --- | --- | --- |
| `ai_policy` | `allowed_modes`, `allowed_providers`, `default_provider`, `web_sources_allowed`, `course_sources_only`, `monthly_budget_cents`, `retention_days`, `policy_version` | modes: `explain`, `hint`, `practice`, `review`, `draft` | **One holder of `ai:configure`, in one statement**: insert, update and delete are open to the capability, audited by trigger, with no second person, no draft, no effective date and a `policy_version` the writer types | The institutional gateway |
| Configuration Studio, domain `ai` | `ai_enabled`, `default_course_mode` (`off`, `assist`, `full`), `allowed_actions`, `require_citations` | actions: `explain`, `quiz`, `summarize`, `plan`, `feedback` | Draft by one person, **published by another**; versions numbered and never edited; rollback is a new draft; audited with the actor's grant | **Nothing.** The Studio's own page says no setting is applied until a feature reads `effectiveConfig` |
| `aiOff` categories (`aiflags.ts`) | `screen`, `deadlines`, `grades`, `attendance`, `coursework`, `courses` that a school has turned *off* | context blocks | The school pack | Consumer context assembly (`lib/context.ts`) |

Three consequences. **The reviewed store is not read and the read store is not reviewed**: the Studio has the
two-person control and no effect; `ai_policy` has the effect and no second person. **The vocabularies disagree**:
`hint`, `practice`, `review` and `draft` have no Studio equivalent; `quiz`, `summarize` and `plan` have no gateway
equivalent. And **`feature_state` defaults to `off`** (a capability with no row is off), which is the right default
and the one to keep.

## Design: one policy model, three layers

- **One model** for what a school may configure: the console writes it; the Studio's draft, review, publish and
  rollback machinery is how it is *authored*; `ai_policy` and its successors are the *effective* store the gateway
  reads; the consumer client receives a **policy pack** derived from it. One vocabulary, defined once, with the others
  as views.
- **Precedence, most restrictive wins at every level and a lower level can narrow but never widen:**

```
Semester floor        (immutable: tier-4 refused, training off, audit on, kill switch authoritative)
  → institution policy
    → school or campus
      → course and section policy   (published by the institution; unknown ⇒ concepts only)
        → assignment policy
          → the student's own preference (narrow only)
```

- **The floor is not a setting.** A console that cannot change a behaviour does not show a switch for it
  (`aiflags.ts` says so about its own list). The floor is stated on the page, as text, so an administrator can read
  what Semester will not let them do.

## Console sections

Each is a screen and a set of requirements. Every change is a **draft with a diff, a reason and an effective date**,
reviewed by a second person where the section says, and rollbackable to any prior version.

| Section | A school can… | Review |
| --- | --- | --- |
| **1 Overview** | See AI state per feature, spend against budget, route and breaker health, kill-switch status, open incidents, evidence expiring, drift and complaint signals | n/a |
| **2 Features and rollout** | Set each feature to `off`, `preview`, `sandbox` or `production`, **per role and per cohort or ring**, with a pilot cohort named; see each feature's tier and what it needs | Second person to move a tier 2 or 3 feature to `production` |
| **3 Sources and data** | Register approved sources with **origin, authority, classification, owner, `verified_by`, `verified_at`, `valid_until`**; bind each to `institution` or a course and term; set freshness windows; allow or disallow web sources and uploads; see quarantined sources; set the context categories (`aiOff`) | Second person for a new authoritative source |
| **4 Models and routes** | Choose from Semester's **approved catalogue** only; order a **fallback list**; set the data zone; bring their own provider account; **allow or forbid student device keys** (`allow_device_keys`) | Second person; a route outside the catalogue cannot be added |
| **5 Policy hierarchy** | Set institution defaults; see which courses have published policy and which are `unknown`; choose the default for unknown | Second person |
| **6 Budgets and limits** | Set the monthly budget, per-feature and per-user caps, alert thresholds at 80% and a hard stop at 100% | One person may lower; **raising a ceiling needs a second** |
| **7 Retention and data rights** | Set retention (bounded), see deletion and export status, place a legal hold; **training on their data is shown as off and locked** | Second person to shorten or lengthen |
| **8 Tools and automations** | Enable each registered tool per role; name the **approver role, queue and SLA** for each action that needs human approval | Second person |
| **9 Review queue** | Work the human-approval queue; see waiting time, approve-without-open and override rates per reviewer | n/a (it is the review) |
| **10 Notices and transparency** | Fill the notice template ([chapter 09](09-user-transparency.md)); set the human contact, the non-AI alternative and the reporting route; **a template with an unfilled bracket cannot be published** | Second person; counsel's approval recorded |
| **11 Evidence** | See which evaluation runs, red-team results and drills back **this tenant's** configuration, their dates and expiry; an expired item turns the feature to `preview` | n/a |
| **12 Audit and change** | Search and export every configuration change: who, what, diff, reason, effective date, approver; see drift between the published and the effective store | n/a |
| **13 Emergency** | Engage the tenant kill, a feature kill or a tool disable, **one person, one confirmation, no review**; release is two-person | Release only |

**Emergency controls are the exception to review, on purpose.** Slowing the engage path with a second approver is the
wrong trade; the release path is where the second person belongs, which matches the runbook's authority rule.

## What the console cannot do

Stated on the page, enforced in the database and the gateway, and tested:

1. Enable a tier-4 or prohibited use, or any use on the intake-refusal list.
2. Turn on training, fine-tuning or secondary use of the tenant's data.
3. Turn off audit, or turn it to a mode that omits actions.
4. Add a model, provider or region outside Semester's approved catalogue.
5. Weaken a course's published policy, or make a course's `unknown` policy permissive.
6. Widen the Semester floor, or a higher layer's restriction, at a lower layer.
7. Read any user's prompts, answers or history. The console shows counts, rates, costs and anonymised signals; **a
   named administrator reading a student's AI conversation is not a console feature** and would be a separate,
   break-glass, audited, counsel-approved process.
8. Mark a feature `production` without current evidence for its tier.
9. Disable the kill switch or make it tenant-optional.
10. Publish a notice with unknown or misleading values.

## Roles

| Role | Can | Cannot |
| --- | --- | --- |
| **AI administrator** | Draft and publish sections 2–8, 10, within review rules | Review their own change; publish evidence |
| **Privacy officer** | Review sections 3, 7, 10; place holds | Draft routes |
| **Academic lead** | Review sections 5 and 2 for academic features; see course-policy coverage | Change budgets |
| **Security lead** | Review 4 and 8; engage emergency controls | Edit sources |
| **Auditor (read-only)** | Section 12 and the exports | Anything else |
| **Break-glass** | Time-limited, justified, two-person, audited access beyond the above | Persist: the grant expires and is itself an audit event |

Roles map to capabilities (`ai:configure`, `config:manage`, `config:publish`, `audit:read`), least privilege.
Nobody holds both the draft and the publish capability *for the same change* (the Studio already enforces this and
checks it on an account that holds both).

## Validation

Constraints that must hold at save, in the database and again in the gateway, because a client is not a boundary:

- `default_provider` is in `allowed_providers` (exists); every provider and route is in the approved catalogue.
- A mode set is a subset of the platform's modes (exists), and a feature cannot be on in a mode its tier forbids.
- A feature at `production` has unexpired evidence for its tier; a route requiring `zero_retention` has its
  attestation.
- A data zone is **fixed at onboarding** ([`../target-architecture/05-ENVIRONMENTS-AND-ROLLOUT.md`](../target-architecture/05-ENVIRONMENTS-AND-ROLLOUT.md) §7); changing it is a migration with a plan, not a console setting, and the console shows it read-only.
- A retention value is within bounds and not shorter than an active hold.
- A budget ceiling is non-negative and a raise is a reviewed change.

## Simulation

The console includes **"What would this person see?"**: pick a role, a course and a set of sources, and it returns the
decisions the gateway *would* make (state, mode, policy, sources, route, budget, approval needed) **without calling a
model**. It runs the same decision code as the gateway, not a copy, so a school can check a policy before publishing it
and an auditor can check one afterwards. It is also the cheapest test of precedence there is.

## The console is a product, and must be accessible

WCAG 2.2 AA, keyboard-first, screen-reader tested, plain language, no colour-only status. An administrator who cannot
operate the console cannot govern the AI, and a console that is only usable by the people who built it is a
configuration system in name.

## Requirements

| ID | Requirement | State |
| --- | --- | --- |
| `TC-01` | One policy model; the three current stores are views or are retired | not started |
| `TC-02` | The Studio's draft, review, publish and rollback govern AI policy; direct single-statement writes to `ai_policy` end | not started: `ai:configure` writes it directly |
| `TC-03` | One vocabulary for modes and actions | not started: three vocabularies |
| `TC-04` | The gateway reads the published, effective store; the Studio's `effectiveConfig` is connected to it | not started: nothing reads the Studio |
| `TC-05` | Precedence: floor, institution, school, course, assignment, user; narrow only | partial: tenant ∩ course modes at the gateway |
| `TC-06` | Default off for a capability with no row | **built** (`feature_state` returns `off`) |
| `TC-07` | Policy pack for the consumer client, including `allow_device_keys` and AI status | not started |
| `TC-08` | Source registry with authority, classification, `verified_by`, `verified_at`, `valid_until` | partial: origin and authority only |
| `TC-09` | Model catalogue owned by Semester; tenants choose from it; ordered fallback list; data zone | not started |
| `TC-10` | Per-feature, per-role, per-cohort rollout with the tier and evidence shown | not started |
| `TC-11` | Budgets per feature and per user; raise needs a second person | partial: tenant monthly budget only |
| `TC-12` | Retention and deletion status visible; training shown off and locked | partial: `retention_days` stored |
| `TC-13` | Tool enable per role; approver role, queue and SLA | not started |
| `TC-14` | Notice templates with bracket blockers; a template with an unfilled bracket cannot be published | designed (`AI-TRANSPARENCY-AND-USER-NOTICE.md`) |
| `TC-15` | Evidence view; expired evidence turns a feature to `preview` | not started |
| `TC-16` | Audit and export of every change with diff, reason, effective date, approver | partial: trigger audit exists; no diff or reason |
| `TC-17` | Emergency controls: one person to engage, two to release | partial: kill switch rows exist; no console |
| `TC-18` | The ten "cannot do" guardrails enforced and tested | not started |
| `TC-19` | Simulation runs the gateway's decision code without a model call | not started |
| `TC-20` | The console meets WCAG 2.2 AA and is screen-reader tested | not started |
| `TC-21` | Drift detection between published and effective configuration | not started |
